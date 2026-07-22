// 风格预设注册表：key -> 音频标签(tag) 和/或 自然语言指令(instruction)
export interface StylePreset {
  tag?: string;
  instruction?: string;
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  温柔: { tag: '温柔' },
  磁性: { tag: '磁性' },
  高冷: { tag: '高冷' },
  俏皮: { tag: '俏皮' },
  慵懒: { tag: '慵懒' },
  开心: { tag: '开心' },
  悲伤: { tag: '悲伤' },
  愤怒: { tag: '愤怒' },
  东北话: { tag: '东北话' },
  粤语: { tag: '粤语' },
  四川话: { tag: '四川话' },
  河南话: { tag: '河南话' },
  兴奋: { instruction: '语速偏快，情绪兴奋，声音明亮有活力。' },
  温柔治愈: { tag: '温柔', instruction: '语气轻柔，节奏舒缓，带着安抚感。' },
  唱歌: { tag: '唱歌' },
};

export const STYLE_PRESET_KEYS = Object.keys(STYLE_PRESETS) as [string, ...string[]];
