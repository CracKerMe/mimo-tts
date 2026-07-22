import { z } from 'zod';

const MB = 1024 * 1024;

// 严格布尔解析：env 中都是字符串，z.coerce.boolean() 会把 "false" 误判为 true
// （Boolean("false") === true），这里显式映射 "1/true/yes/on" → true，其余 → false。
const boolFromString = z.preprocess((v) => {
  if (typeof v === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
  }
  return v;
}, z.boolean());

const envSchema = z.object({
  MIMO_API_KEY: z.string().min(1, 'MIMO_API_KEY is required'),
  MIMO_API_BASE_URL: z.string().min(1).default('https://api.xiaomimimo.com/v1'),
  MIMO_API_TIMEOUT: z.coerce.number().int().positive().default(60_000),
  MIMO_API_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  PORT: z.coerce.number().positive().default(3000),

  // TTS 服务默认值
  MIMO_TTS_DEFAULT_VOICE: z.string().default('mia'),
  MIMO_TTS_DEFAULT_FORMAT: z.enum(['wav', 'pcm16']).default('wav'),
  MIMO_TTS_DEFAULT_IS_STREAM: boolFromString.default(false),
  MIMO_TTS_OPTIMIZE_TEXT_PREVIEW: boolFromString.default(false),
  MIMO_TTS_DEFAULT_STYLE_INSTRUCTION: z.string().optional(),

  // 服务端安全与健壮性配置（公网暴露前提）
  MIMO_TTS_REQUIRE_AUTH: boolFromString.default(true),
  MIMO_TTS_SERVER_API_KEY: z.string().optional(),
  MIMO_TTS_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  MIMO_TTS_RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60),
  MIMO_TTS_MAX_TEXT_LENGTH: z.coerce.number().int().positive().default(10_000),
  MIMO_TTS_MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * MB),
  MIMO_TTS_SAVE_AUDIO: boolFromString.default(false),
}).superRefine((data, ctx) => {
  if (data.MIMO_TTS_REQUIRE_AUTH && !data.MIMO_TTS_SERVER_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['MIMO_TTS_SERVER_API_KEY'],
      message: '开启鉴权(MIMO_TTS_REQUIRE_AUTH=true)时必须提供 MIMO_TTS_SERVER_API_KEY',
    });
  }
});

export const env = envSchema.parse(process.env);
