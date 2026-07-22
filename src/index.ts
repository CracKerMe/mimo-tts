import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { MimoTtsAgentTool } from './MimoTtsAgentTool.js';
import { env } from './config.js';
import { Readable } from 'stream';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const app = new Hono()

const textFileFields = ['textFile', 'file'];
const booleanFields = new Set(['isStream', 'optimizeTextPreview']);

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
      body.text = await text.text();
    }

    if (typeof body.text !== 'string') {
      for (const field of textFileFields) {
        const file = formBody[field];
        if (file instanceof File) {
          body.text = await file.text();
          break;
        }
      }
    }

    const voiceCloneFile = formBody.voiceCloneFile;
    if (!body.voiceCloneBase64 && voiceCloneFile instanceof File) {
      const buffer = Buffer.from(await voiceCloneFile.arrayBuffer());
      const mediaType = voiceCloneFile.type || 'audio/mpeg';
      body.voiceCloneBase64 = `data:${mediaType};base64,${buffer.toString('base64')}`;
    }

    return body;
  }

  try {
    return await c.req.json<Record<string, unknown>>();
  } catch (e) {
    const raw = await c.req.text();
    console.error('Failed to parse JSON. Raw body:', JSON.stringify(raw));
    // Try to parse just the first JSON object
    const match = raw.match(/^\s*(\{[\s\S]*?\})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // Fall through to throw original error
      }
    }
    throw e;
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
});

app.get('/', (c) => c.text('Hello Hono!'));

app.post('/api/agent/tools/tts', async (c) => {
  try {
    const body = await parseTtsRequestBody(c);
    const result = await mimoTtsTool.execute(body);

    // 确保 tmp 目录存在
    const tmpDir = join(process.cwd(), 'tmp');
    await mkdir(tmpDir, { recursive: true });

    if (result instanceof Readable) {
      // 流式输出：收集数据并保存
      const chunks: Buffer[] = [];
      const stream = new ReadableStream({
        start(controller: ReadableStreamDefaultController<Uint8Array>) {
          result.on('data', (chunk) => {
            chunks.push(chunk);
            controller.enqueue(chunk);
          });
          result.on('end', async () => {
            controller.close();
            // 保存到文件
            const filename = `tts-stream-${Date.now()}.pcm`;
            const filepath = join(tmpDir, filename);
            await writeFile(filepath, Buffer.concat(chunks));
            console.log(`音频已保存到: ${filepath}`);
          });
          result.on('error', (err) => controller.error(err));
        },
      });
      return c.body(stream, 200, { 'Content-Type': 'audio/pcm' });
    }

    // 非流式输出：保存到文件
    const format = body.format || 'wav';
    const filename = `tts-${Date.now()}.${format}`;
    const filepath = join(tmpDir, filename);
    await writeFile(filepath, result as Buffer);
    console.log(`音频已保存到: ${filepath}`);

    return new Response(result as unknown as BodyInit, {
      status: 200,
      headers: { 'Content-Type': `audio/${format}` },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    const err = error as any;
    return c.json({
      error: err.message,
      status: err.status,
      code: err.code,
      type: err.type,
      param: err.param,
    }, err.status || 400);
  }
});

serve({
  fetch: app.fetch,
  port: env.PORT
}, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});
