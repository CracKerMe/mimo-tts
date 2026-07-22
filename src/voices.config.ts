// 语音角色配置：调用方用 roleId 引用，服务端解析为 voice + 默认风格/模型。
// 角色是 voiceId/voicePrompt/styleInstruction/stylePreset 的便捷组合，降低重复传参。
export interface VoiceRole {
  voice?: string; // 预置音色 ID（mimo-v2.5-tts）
  voicePrompt?: string; // 音色描述（mimo-v2.5-tts-voicedesign）
  styleInstruction?: string;
  stylePreset?: string;
  note?: string;
}

export const VOICE_ROLES: Record<string, VoiceRole> = {
  新闻播报: { voice: '白桦', styleInstruction: '语速平稳，字正腔圆，严肃专业。', note: '中文男声，适合资讯播报' },
  午夜电台: { voice: 'Mia', styleInstruction: '低沉慵懒，节奏舒缓，带着磁性私语的亲密感。' },
  儿童故事: { voice: '茉莉', styleInstruction: '活泼亲切，语速轻快，充满童趣。' },
  东北老铁: { voice: '苏打', stylePreset: '东北话', styleInstruction: '热情豪爽，接地气。' },
  英文助手: { voice: 'Dean', styleInstruction: '清晰自然，友好专业。' },
  御姐配音: { voice: '冰糖', stylePreset: '高冷', styleInstruction: '冷艳高傲，语速从容，气场强大。' },
};

export const VOICE_ROLE_KEYS = Object.keys(VOICE_ROLES) as [string, ...string[]];
