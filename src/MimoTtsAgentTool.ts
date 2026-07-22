import { OpenAI } from 'openai';
import { z } from 'zod';
import { PassThrough, Readable } from 'node:stream';
import { env } from './config.js';

export interface MimoTtsAgentToolOptions {
  apiKey: string;
  baseURL?: string;
  defaultVoice?: string;
  defaultFormat?: 'wav' | 'pcm16';
  defaultIsStream?: boolean;
  defaultOptimizeTextPreview?: boolean;
  defaultStyleInstruction?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// 基础 schema（无 refine，便于派生工具 schema）
const MimoTtsBaseSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(env.MIMO_TTS_MAX_TEXT_LENGTH)
      .describe('需要进行语音合成的长段落文案。'),
    voiceId: z
      .string()
      .optional()
      .describe('预置音色ID。如: mimo_default, 冰糖, Milo...。未提供时使用服务默认音色。'),
    voicePrompt: z
      .string()
      .optional()
      .describe('音色描述句。用于生成全新音色（mimo-v2.5-tts-voicedesign）。'),
    voiceCloneBase64: z
      .string()
      .max(Math.ceil(env.MIMO_TTS_MAX_FILE_BYTES * 1.4))
      .optional()
      .describe('Base64编码的音频样本（含前缀 data:audio/...;base64,...），用于音色复刻（mimo-v2.5-tts-voiceclone）。'),
    format: z.enum(['wav', 'pcm16']).optional().describe('输出音频格式。默认 wav，流式请用 pcm16。'),
    styleInstruction: z.string().optional().describe('风格指令。控制语速、情绪、停顿等演绎指导（放 user 消息）。'),
    audioTagStyle: z.string().optional().describe('音频标签风格。如 (磁性) (唱歌) [轻笑]（拼接到 assistant 消息文本前）。'),
    optimizeTextPreview: z.boolean().optional().describe('是否对合成文本进行智能润色（仅 voicedesign 模型支持）。'),
    isStream: z.boolean().optional().describe('是否开启流式返回（pcm16）。未提供时使用服务默认配置。'),
  });

// 暴露给 LLM Agent 的工具 schema：仅语义参数，能力参数(format/isStream)由服务端决定（N4）
export const MimoTtsToolSchema = MimoTtsBaseSchema.omit({ format: true, isStream: true });

// 全量请求校验 schema（含音色参数互斥 refine）
export const MimoTtsInputSchema = MimoTtsBaseSchema.superRefine((data, ctx) => {
  const voiceInputs = [data.voiceId, data.voicePrompt, data.voiceCloneBase64].filter(Boolean);
  if (voiceInputs.length > 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'voiceId、voicePrompt、voiceCloneBase64 只能提供其中之一；未提供时使用服务默认音色',
    });
  }
});

export type MimoTtsInput = z.infer<typeof MimoTtsInputSchema>;

// MiMo audio 扩展参数（OpenAI SDK 无对应类型，集中声明以避免 any 散落）
interface TtsAudioConfig {
  format: 'wav' | 'pcm16';
  voice?: string;
  optimize_text_preview?: boolean;
}

export type MimoTtsResult = { data: Buffer | Readable; format: 'wav' | 'pcm16' };

export class MimoTtsAgentTool {
  private readonly client: OpenAI;
  private readonly defaultVoice: string;
  private readonly defaultFormat: 'wav' | 'pcm16';
  private readonly defaultIsStream: boolean;
  private readonly defaultOptimizeTextPreview: boolean;
  private readonly defaultStyleInstruction?: string;

  public readonly toolName = 'generate_mimo_tts';
  public readonly description =
    '小米 MiMo V2.5 语音合成工具，支持预置音色、音色设计、音色复刻，以及风格控制与流式输出。';

  constructor(options: MimoTtsAgentToolOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
    this.defaultVoice = options.defaultVoice ?? 'mimo_default';
    this.defaultFormat = options.defaultFormat ?? 'wav';
    this.defaultIsStream = options.defaultIsStream ?? false;
    this.defaultOptimizeTextPreview = options.defaultOptimizeTextPreview ?? false;
    this.defaultStyleInstruction = options.defaultStyleInstruction;
  }

  // 由 zod schema 自动生成 function schema，单一事实来源（N1）
  public getFunctionSchema() {
    const parameters = z.toJSONSchema(MimoTtsToolSchema) as Record<string, unknown>;
    delete parameters.$schema;
    return {
      type: 'function',
      function: {
        name: this.toolName,
        description: this.description,
        parameters,
      },
    };
  }

  public async execute(rawParams: unknown): Promise<MimoTtsResult> {
    const params = MimoTtsInputSchema.parse(rawParams);

    const model = this.selectModel(params);
    const messages = this.buildTtsMessages(params);
    const format = params.format ?? this.defaultFormat;
    const isStream = params.isStream ?? this.defaultIsStream;
    const audio = this.buildAudioConfig(model, params, format, isStream);

    if (isStream || audio.format === 'pcm16') {
      return { data: this.handleStreamRequest(model, messages, audio), format: 'pcm16' };
    }
    const data = await this.handleSyncRequest(model, messages, audio);
    return { data, format };
  }

  // 模型选择：映射 + 单一决策函数（N3）
  private selectModel(params: MimoTtsInput): string {
    if (params.voiceCloneBase64) return 'mimo-v2.5-tts-voiceclone';
    if (params.voicePrompt && !params.voiceId) return 'mimo-v2.5-tts-voicedesign';
    return 'mimo-v2.5-tts';
  }

  // Prompt 构造集中管理（N2）
  private buildTtsMessages(params: MimoTtsInput): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const userPrompts: string[] = [];

    const styleInstruction = params.styleInstruction ?? this.defaultStyleInstruction;
    if (styleInstruction) userPrompts.push(styleInstruction);

    if (userPrompts.length > 0) {
      messages.push({ role: 'user', content: userPrompts.join('\n') });
    }

    let assistantContent = params.text;
    if (params.audioTagStyle) {
      assistantContent = `${params.audioTagStyle}${assistantContent}`;
    }
    messages.push({ role: 'assistant', content: assistantContent });

    return messages;
  }

  private buildAudioConfig(
    model: string,
    params: MimoTtsInput,
    format: 'wav' | 'pcm16',
    isStream: boolean,
  ): TtsAudioConfig {
    const config: TtsAudioConfig = { format: isStream ? 'pcm16' : format };

    if (model === 'mimo-v2.5-tts') {
      config.voice = params.voiceId ?? this.defaultVoice;
    } else if (model === 'mimo-v2.5-tts-voiceclone') {
      config.voice = params.voiceCloneBase64;
    } else if (model === 'mimo-v2.5-tts-voicedesign') {
      if (params.optimizeTextPreview ?? this.defaultOptimizeTextPreview) {
        config.optimize_text_preview = true;
      }
    }

    return config;
  }

  private handleStreamRequest(
    model: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    audio: TtsAudioConfig,
  ): Readable {
    const passThrough = new PassThrough();

    (async () => {
      try {
        const responseStream = await this.client.chat.completions.create({
          model,
          messages,
          // MiMo 扩展参数，SDK 无类型，故断言
          audio: audio as unknown as OpenAI.Chat.ChatCompletionCreateParams['audio'],
          stream: true,
        });

        for await (const chunk of responseStream) {
          const audioData = (
            chunk.choices[0]?.delta as { audio?: { data?: string } } | undefined
          )?.audio?.data;
          if (audioData) {
            passThrough.write(Buffer.from(audioData, 'base64'));
          }
        }
        passThrough.end();
      } catch (error) {
        passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return passThrough;
  }

  private async handleSyncRequest(
    model: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    audio: TtsAudioConfig,
  ): Promise<Buffer> {
    const completion = await this.client.chat.completions.create({
      model,
      messages,
      audio: audio as unknown as OpenAI.Chat.ChatCompletionCreateParams['audio'],
    });

    const base64Data = (
      completion.choices[0]?.message as { audio?: { data?: string } } | undefined
    )?.audio?.data;
    if (!base64Data) {
      throw new Error('API 响应中未包含音频数据');
    }
    return Buffer.from(base64Data, 'base64');
  }
}
