import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { MimoTtsAgentTool } from './MimoTtsAgentTool.js';
import { env } from './config.js';
import { Readable } from 'node:stream';
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

const app = new Hono();

// 中间件栈（顺序很重要）：requestId → 限流(请求体大小) → 鉴权 → 限频 → 路由
app.use('*', requestIdMiddleware);
app.use('*', bodyLimitMiddleware(env.MIMO_TTS_MAX_FILE_BYTES));
app.use('*', authMiddleware(env.MIMO_TTS_REQUIRE_AUTH, env.MIMO_TTS_SERVER_API_KEY));
app.use('*', rateLimitMiddleware(env.MIMO_TTS_RATE_LIMIT, env.MIMO_TTS_RATE_LIMIT_WINDOW));
app.onError(errorHandler);

const textFileFields = ['textFile', 'file'];
const booleanFields = new Set(['isStream', 'optimizeTextPreview']);

function assertFileSize(file: File): void {
  if (file.size > env.MIMO_TTS_MAX_FILE_BYTES) {
    throw new HttpError(
      413,
      `上传文件超过大小上限（${env.MIMO_TTS_MAX_FILE_BYTES} 字节）`,
    );
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

app.get('/', (c) => c.text('Hello Hono!'));

app.post('/api/agent/tools/tts', async (c) => {
  const body = await parseTtsRequestBody(c);
  const result = await mimoTtsTool.execute(body);

  // 流式：直接转发，不再缓冲整段音频到内存（修复 C2）
  if (result.data instanceof Readable) {
    const webStream = Readable.toWeb(result.data) as ReadableStream<Uint8Array>;

    if (env.MIMO_TTS_SAVE_AUDIO) {
      const tmpDir = join(process.cwd(), 'tmp');
      await mkdir(tmpDir, { recursive: true });
      const filepath = join(tmpDir, `tts-stream-${Date.now()}.${result.format}`);
      result.data.pipe(createWriteStream(filepath)); // 边流边写，不占双倍内存
      console.log(`音频已保存到: ${filepath}`);
    }

    return c.body(webStream, 200, { 'Content-Type': `audio/${result.format}` });
  }

  // 非流式：仅在显式开启时落盘（修复 C2/C5），格式取自校验结果（修复 C3）
  if (env.MIMO_TTS_SAVE_AUDIO) {
    const tmpDir = join(process.cwd(), 'tmp');
    await mkdir(tmpDir, { recursive: true });
    const filepath = join(tmpDir, `tts-${Date.now()}.${result.format}`);
    await writeFile(filepath, result.data);
    console.log(`音频已保存到: ${filepath}`);
  }

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
