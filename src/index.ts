import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { MimoTtsAgentTool, type MimoTtsMeta } from './MimoTtsAgentTool.js';
import { env } from './config.js';
import { Readable, PassThrough } from 'node:stream';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import {
  authMiddleware,
  bodyLimitMiddleware,
  errorHandler,
  HttpError,
  rateLimitMiddleware,
  requestIdMiddleware,
} from './middleware.js';
import { PRESET_VOICES } from './voices.js';

const PCM_SAMPLE_RATE = 24000;
const PCM_BYTES_PER_SEC = PCM_SAMPLE_RATE * 2 * 1; // 16bit 单声道

const app = new Hono();

// 中间件栈（顺序很重要）：requestId → 限流(请求体大小) → 鉴权 → 限频 → 路由
app.use('*', requestIdMiddleware);
app.use('*', bodyLimitMiddleware(env.MIMO_TTS_MAX_FILE_BYTES));
app.use('*', authMiddleware(env.MIMO_TTS_REQUIRE_AUTH, env.MIMO_TTS_SERVER_API_KEY));
app.use('*', rateLimitMiddleware(env.MIMO_TTS_RATE_LIMIT, env.MIMO_TTS_RATE_LIMIT_WINDOW));
app.onError(errorHandler);

const textFileFields = ['textFile', 'file'];
const booleanFields = new Set(['isStream', 'optimizeTextPreview', 'singing']);

function assertFileSize(file: File): void {
  if (file.size > env.MIMO_TTS_MAX_FILE_BYTES) {
    throw new HttpError(413, `上传文件超过大小上限（${env.MIMO_TTS_MAX_FILE_BYTES} 字节）`);
  }
}

async function parseTtsRequestBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formBody = await c.req.parseBody();
    const body: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(formBody)) {
      if (value instanceof File) continue;
      body[key] = booleanFields.has(key) ? value === 'true' : value;
    }

    const text = formBody.text;
    if (text instanceof File) {
      assertFileSize(text);
      body.text = await text.text();
    }

    if (typeof body.text !== 'string') {
      for (const field of textFileFields) {
        const file = formBody[field];
        if (file instanceof File) {
          assertFileSize(file);
          body.text = await file.text();
          break;
        }
      }
    }

    const voiceCloneFile = formBody.voiceCloneFile;
    if (!body.voiceCloneBase64 && voiceCloneFile instanceof File) {
      assertFileSize(voiceCloneFile);
      const buffer = Buffer.from(await voiceCloneFile.arrayBuffer());
      const mediaType = voiceCloneFile.type || 'audio/mpeg';
      body.voiceCloneBase64 = `data:${mediaType};base64,${buffer.toString('base64')}`;
    }

    return body;
  }

  // JSON：解析失败直接 400，不记录原始 body（避免泄露隐私，见 C4）
  try {
    return await c.req.json<Record<string, unknown>>();
  } catch {
    throw new HttpError(400, '请求体不是合法的 JSON');
  }
}

// 44 字节 WAV 头（PCM16 / 24kHz / 单声道），dataSize 置 0xFFFFFFFF 表示流式未知长度
function buildWavHeader(): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = PCM_SAMPLE_RATE * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(0xffffffff, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(0xffffffff, 40);
  return header;
}

function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

// 结构化用量日志（P2/N5）：仅记录元数据，不缓冲音频
function logTtsUsage(c: Context, meta: MimoTtsMeta, bytes: number): void {
  const durationSec = bytes > 0 ? Number((bytes / PCM_BYTES_PER_SEC).toFixed(2)) : null;
  console.log(
    JSON.stringify({
      event: 'tts_usage',
      requestId: c.get('requestId'),
      model: meta.model,
      voice: meta.voice,
      chars: meta.chars,
      bytes,
      durationSec,
      ip: clientIp(c),
      ts: new Date().toISOString(),
    }),
  );
}

const mimoTtsTool = new MimoTtsAgentTool({
  apiKey: env.MIMO_API_KEY,
  baseURL: env.MIMO_API_BASE_URL,
  defaultVoice: env.MIMO_TTS_DEFAULT_VOICE,
  defaultFormat: env.MIMO_TTS_DEFAULT_FORMAT,
  defaultIsStream: env.MIMO_TTS_DEFAULT_IS_STREAM,
  defaultOptimizeTextPreview: env.MIMO_TTS_OPTIMIZE_TEXT_PREVIEW,
  defaultStyleInstruction: env.MIMO_TTS_DEFAULT_STYLE_INSTRUCTION,
  timeoutMs: env.MIMO_API_TIMEOUT,
  maxRetries: env.MIMO_API_MAX_RETRIES,
});

import { playgroundHandler } from './playground.js';

app.get('/', playgroundHandler);

// 预置音色列表查询端点（静态，取自官方文档）
app.get('/api/voices', (c) => c.json({ voices: PRESET_VOICES }));

app.post('/api/agent/tools/tts', async (c) => {
  const body = await parseTtsRequestBody(c);
  const result = await mimoTtsTool.execute(body);

  // 流式：直接转发，不缓冲整段音频到内存（修复 C2）
  if (result.data instanceof Readable) {
    const wantWav = (c.req.query('container') ?? '').toLowerCase() === 'wav';
    const saveExt = wantWav ? 'wav' : result.format;

    let outStream: Readable = result.data;
    let contentType = `audio/${result.format}`;

    if (wantWav) {
      // 将 pcm16 实时封装为可播放 WAV 流（前端无需自行拼 PCM 头）
      const out = new PassThrough();
      out.write(buildWavHeader());
      result.data.pipe(out);
      outStream = out;
      contentType = 'audio/wav';
    }

    if (env.MIMO_TTS_SAVE_AUDIO) {
      const tmpDir = join(process.cwd(), 'tmp');
      await mkdir(tmpDir, { recursive: true });
      const filepath = join(tmpDir, `tts-stream-${Date.now()}.${saveExt}`);
      outStream.pipe(createWriteStream(filepath)); // 边流边写，不占双倍内存
      console.log(`音频已保存到: ${filepath}`);
    }

    // 字节计数在原始 pcm 流上；多个 'data' 监听器均收到完整数据（无冲突）
    let bytes = 0;
    result.data.on('data', (chunk) => {
      bytes += (chunk as Buffer).length;
    });
    result.data.on('end', () => logTtsUsage(c, result.meta, bytes));

    const webStream = Readable.toWeb(outStream) as ReadableStream<Uint8Array>;
    return c.body(webStream, 200, { 'Content-Type': contentType });
  }

  // 非流式：仅在显式开启时落盘（修复 C2/C5），格式取自校验结果（修复 C3）
  if (env.MIMO_TTS_SAVE_AUDIO) {
    const tmpDir = join(process.cwd(), 'tmp');
    await mkdir(tmpDir, { recursive: true });
    const filepath = join(tmpDir, `tts-${Date.now()}.${result.format}`);
    await writeFile(filepath, result.data);
    console.log(`音频已保存到: ${filepath}`);
  }

  logTtsUsage(c, result.meta, (result.data as Buffer).length);

  // Node 的 Response 类型未将 Buffer 纳入 BodyInit，此处为运行期合法的边界断言
  return new Response(result.data as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': `audio/${result.format}` },
  });
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    console.log(`Server is running on http://localhost:${env.PORT}`);
  },
);
