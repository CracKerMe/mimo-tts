import { OpenAI } from 'openai';
import { z } from 'zod';
import { PassThrough, Readable } from 'stream';

export interface MimoTtsAgentToolOptions {
  apiKey: string;
  baseURL?: string;
  defaultVoice?: string;
  defaultFormat?: 'wav' | 'pcm16';
  defaultIsStream?: boolean;
  defaultOptimizeTextPreview?: boolean;
  defaultStyleInstruction?: string;
}

export const MimoTtsInputSchema = z.object({
  text: z.string().min(1).describe("需要进行语音合成的长段落文案。"),
  voiceId: z.string().optional().describe("预置音色ID。如: mimo_default, 冰糖, Milo...。未提供时使用服务默认音色。"),
  voicePrompt: z.string().optional().describe("音色描述句。用于生成全新音色（mimo-v2.5-tts-voicedesign）。"),
  voiceCloneBase64: z.string().optional().describe("Base64编码的音频样本（含前缀 data:audio/...;base64,...），用于音色复刻（mimo-v2.5-tts-voiceclone）。"),
  format: z.enum(['wav', 'pcm16']).optional().describe("输出音频格式。默认 wav，流式请用 pcm16。"),
  styleInstruction: z.string().optional().describe("风格指令。控制语速、情绪、停顿等演绎指导（放 user 消息）。"),
  audioTagStyle: z.string().optional().describe("音频标签风格。如 (磁性) (唱歌) [轻笑]（拼接到 assistant 消息文本前）。"),
  optimizeTextPreview: z.boolean().optional().describe("是否对合成文本进行智能润色（仅 voicedesign 模型支持）。"),
  isStream: z.boolean().optional().describe("是否开启流式返回（pcm16）。未提供时使用服务默认配置。"),
}).superRefine((data, ctx) => {
  const voiceInputs = [data.voiceId, data.voicePrompt, data.voiceCloneBase64].filter(Boolean);
  if (voiceInputs.length > 1) {
    ctx.addIssue({
      code: 'custom',
      message: "voiceId、voicePrompt、voiceCloneBase64 只能提供其中之一；未提供时使用服务默认音色",
    });
  }
});

export type MimoTtsInput = z.infer<typeof MimoTtsInputSchema>;

export class MimoTtsAgentTool {
  private client: OpenAI;
  private readonly defaultVoice: string;
  private readonly defaultFormat: 'wav' | 'pcm16';
  private readonly defaultIsStream: boolean;
  private readonly defaultOptimizeTextPreview: boolean;
  private readonly defaultStyleInstruction?: string;

  public readonly toolName = 'generate_mimo_tts';
  public readonly description = '小米 MiMo V2.5 语音合成工具，支持预置音色、音色设计、音色复刻，以及风格控制与流式输出。';

  constructor(options: MimoTtsAgentToolOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
    this.defaultVoice = options.defaultVoice ?? 'mimo_default';
    this.defaultFormat = options.defaultFormat ?? 'wav';
    this.defaultIsStream = options.defaultIsStream ?? false;
    this.defaultOptimizeTextPreview = options.defaultOptimizeTextPreview ?? false;
    this.defaultStyleInstruction = options.defaultStyleInstruction;
  }

  public getFunctionSchema() {
    return {
      type: "function",
      function: {
        name: this.toolName,
        description: this.description,
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "需要合成的文案（必须放在 assistant 消息中）" },
            voiceId: { type: "string", description: "预置音色ID。如 mimo_default, 冰糖, Milo, Chloe 等。未提供时使用服务默认音色" },
            voicePrompt: { type: "string", description: "音色描述句。用于生成全新音色（voicedesign 模型）" },
            voiceCloneBase64: { type: "string", description: "Base64编码的音频样本，用于音色复刻（voiceclone 模型），需含 data:audio/...;base64 前缀" },
            format: { type: "string", enum: ["wav", "pcm16"], description: "输出音频格式：wav 或 pcm16" },
            styleInstruction: { type: "string", description: "风格指令：控制语速、情绪、停顿等（放 user 消息）" },
            audioTagStyle: { type: "string", description: "音频标签风格：如 (磁性) (唱歌) [轻笑]，放 assistant 消息文本中" },
            optimizeTextPreview: { type: "boolean", description: "是否智能润色合成文本（仅 voicedesign 模型）" },
            isStream: { type: "boolean", description: "是否流式输出（pcm16）。未提供时使用服务默认配置" }
          },
          required: ["text"]
        }
      }
    };
  }

  public async execute(rawParams: unknown): Promise<Readable | Buffer> {
    const params = MimoTtsInputSchema.parse(rawParams);

    let model: string;
    if (params.voiceCloneBase64) {
      model = 'mimo-v2.5-tts-voiceclone';
    } else if (params.voicePrompt && !params.voiceId) {
      model = 'mimo-v2.5-tts-voicedesign';
    } else {
      model = 'mimo-v2.5-tts';
    }

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

    const format = params.format ?? this.defaultFormat;
    const isStream = params.isStream ?? this.defaultIsStream;
    const audioConfig: any = { format: isStream ? 'pcm16' : format };

    if (model === 'mimo-v2.5-tts') {
      audioConfig.voice = params.voiceId ?? this.defaultVoice;
    } else if (model === 'mimo-v2.5-tts-voiceclone') {
      audioConfig.voice = params.voiceCloneBase64;
    } else if (model === 'mimo-v2.5-tts-voicedesign') {
      if (params.optimizeTextPreview ?? this.defaultOptimizeTextPreview) {
        audioConfig.optimize_text_preview = true;
      }
    }

    if (isStream || audioConfig.format === 'pcm16') {
      return this.handleStreamRequest(model, messages, audioConfig);
    } else {
      return this.handleSyncRequest(model, messages, audioConfig);
    }
  }

  private async handleStreamRequest(model: string, messages: any[], audio: any): Promise<Readable> {
    const responseStream = await this.client.chat.completions.create({
      model,
      messages,
      audio,
      stream: true
    });

    const passThrough = new PassThrough();

    (async () => {
      try {
        for await (const chunk of responseStream) {
          const audioData = (chunk.choices[0]?.delta as { audio?: { data?: string } }).audio?.data;
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

  private async handleSyncRequest(model: string, messages: any[], audio: any): Promise<Buffer> {
    const completion = await this.client.chat.completions.create({
      model,
      messages,
      audio
    });

    const base64Data = completion.choices[0]?.message?.audio?.data;
    if (!base64Data) {
      throw new Error("API 响应中未包含音频数据");
    }
    return Buffer.from(base64Data, 'base64');
  }
}
