import { z } from 'zod';

const envSchema = z.object({
  MIMO_API_KEY: z.string().min(1, 'MIMO_API_KEY is required'),
  MIMO_API_BASE_URL: z.string().min(1).default('https://api.xiaomimimo.com/v1'),
  PORT: z.coerce.number().positive().default(3000),
  MIMO_TTS_DEFAULT_VOICE: z.string().default('mia'),
  MIMO_TTS_DEFAULT_FORMAT: z.enum(['wav', 'pcm16']).default('wav'),
  MIMO_TTS_DEFAULT_IS_STREAM: z.coerce.boolean().default(false),
  MIMO_TTS_OPTIMIZE_TEXT_PREVIEW: z.coerce.boolean().default(false),
  MIMO_TTS_DEFAULT_STYLE_INSTRUCTION: z.string().optional(),
});

export const env = envSchema.parse(process.env);
