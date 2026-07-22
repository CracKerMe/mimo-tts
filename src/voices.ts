// 小米 MiMo V2.5 预置音色列表（静态，取自官方技术文档）
export interface PresetVoice {
  voiceId: string;
  name: string;
  lang: string;
  gender: string;
  note?: string;
}

export const PRESET_VOICES: PresetVoice[] = [
  {
    voiceId: 'mimo_default',
    name: 'MiMo-默认',
    lang: '因集群而异',
    gender: '集群默认',
    note: '中国集群默认「冰糖」，其他集群默认「Mia」',
  },
  { voiceId: '冰糖', name: '冰糖', lang: '中文', gender: '女性' },
  { voiceId: '茉莉', name: '茉莉', lang: '中文', gender: '女性' },
  { voiceId: '苏打', name: '苏打', lang: '中文', gender: '男性' },
  { voiceId: '白桦', name: '白桦', lang: '中文', gender: '男性' },
  { voiceId: 'Mia', name: 'Mia', lang: '英文', gender: '女性' },
  { voiceId: 'Chloe', name: 'Chloe', lang: '英文', gender: '女性' },
  { voiceId: 'Milo', name: 'Milo', lang: '英文', gender: '男性' },
  { voiceId: 'Dean', name: 'Dean', lang: '英文', gender: '男性' },
];
