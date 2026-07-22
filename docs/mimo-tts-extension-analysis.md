# 小米 MiMo V2.5 TTS 文档能力梳理与 mimo-tts 项目扩展可行性报告

> 依据：小米语音合成 API v2.5 技术文档（https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5，更新于 2026-07-15）
> 对象：`mimo-tts` 当前代码（`src/index.ts`、`src/config.ts`、`src/MimoTtsAgentTool.ts`、`src/middleware.ts`）
> 结论先行：项目已覆盖文档中绝大多数**已声明**能力（三模型、风格控制、流式、安全与健壮性）。真正"未覆盖"的多为**产品化/易用性**层（角色配置、风格预设、音色列表、用量可观测、批量编排）。需注意一个**关键约束**：API 不暴露数值化音频参数（rate/pitch/volume/采样率/位深/声道），"精确音频参数动态调整"在 API 层面不可行。

---

## 一、文档能力梳理

### 1.1 模型矩阵
| Model ID | 能力 | 不支持 |
|---|---|---|
| `mimo-v2.5-tts` | 预置精品音色、**唱歌模式** | 音色设计、音色复刻 |
| `mimo-v2.5-tts-voicedesign` | 文本描述定制音色（voice design） | 唱歌、预置音色、音色复刻 |
| `mimo-v2.5-tts-voiceclone` | 音频样本复刻任意音色 | 唱歌、预置音色、音色设计 |

### 1.2 接口与鉴权
- 协议：OpenAI 兼容的 Chat Completions（`POST {base_url}/chat/completions`），`base_url` 默认 `https://api.xiaomimimo.com/v1`。
- 鉴权：Bearer `MIMO_API_KEY`（OpenAI SDK 标准）。
- 消息结构：目标文本必须放在 `role: assistant` 的 `content`；`role: user` 为可选，用于传入风格指令/对话历史（不出现在合成语音中）。`voicedesign` 模型下 `user` 消息为必填。
- `audio` 参数：`{ format: "wav"|"pcm16", voice?: string, optimize_text_preview?: boolean }`。
  - `voice`：预置音色 ID（tts 模型）或 `data:audio/...;base64,...`（voiceclone 模型）。
  - `optimize_text_preview`：仅 voicedesign 支持，为 `true` 时可不传 `assistant` 消息。

### 1.3 音频格式与编码
- 输出格式：**仅 `wav` 与 `pcm16`**（流式必须 `pcm16`）。
- 编码规格：固定 **24kHz / PCM16LE / 单声道**（文档示例中 `sf.write(..., samplerate=24000)`）。
- 输入样本（仅 voiceclone）：`mp3` / `wav`，Base64 前加 `data:{MIME};base64,` 前缀，≤ 10 MB。

### 1.4 风格 / 情绪控制（核心卖点）
- **自然语言控制**：描述放 `user` 消息（如"语速稍快、带着激动与小骄傲"）；支持**导演模式**（【角色】【场景】【指导】三维度）。
- **音频标签控制**：放 `assistant` 消息文本，开头 `(风格)` 整体标签（支持多风格同括号、半角/全角/方括号），文本中任意位置插 `[细粒度标签]`。
  - 整体风格：基础情绪/复合情绪/整体语调/音色定位/人设腔调/方言/角色扮演/唱歌。
  - 细粒度：`[吸气][叹气][轻笑][哽咽][颤抖]` 等。
- 支持**多风格切换、多情绪混合、多粒度控制（段落→句→词→字）**。

### 1.5 预置音色列表（静态）
`mimo_default`（中国集群默认 `冰糖`，其他集群 `Mia`）、`冰糖`、`茉莉`、`苏打`、`白桦`、`Mia`、`Chloe`、`Milo`、`Dean`。

### 1.6 流式与约束
- 流式：`mimo-v2.5-tts` 支持**低延迟真流式**；`voicedesign` / `voiceclone` 的流式当前**降级为兼容模式**（全部推理完成后一次性返回）。
- 计费：限时免费（无成本压力，但用量可观测仍建议做）。
- **文档未声明**：限流、并发上限、文本长度上限、错误码表 → 项目现有上限均为自定值。

---

## 二、项目现状分析

### 2.1 技术栈与架构
- 栈：`Hono` + `@hono/node-server` + `openai` SDK + `zod`，TypeScript，单实例 HTTP 服务。
- 分层：`middleware.ts`（鉴权/限流/错误脱敏/请求体大小）→ `index.ts`（路由 + body 解析 + 流式直转/落盘）→ `MimoTtsAgentTool.ts`（模型选择/消息构造/上游调用/function schema 自动生成）→ `config.ts`（env 校验）。
- 已具备健壮性：超时/重试、流式 `PassThrough` 直转不缓冲、落盘开关、Zod 双 schema（工具 schema 由 zod 自动生成，单一事实来源）。

### 2.2 能力对照表
| 文档能力 | 项目覆盖 | 说明 |
|---|---|---|
| 三模型选择 | ✅ 已覆盖 | `selectModel()` 映射 voiceCloneBase64/voicePrompt |
| 预置音色 | ✅ 已覆盖 | `voiceId` |
| 音色设计 | ✅ 已覆盖 | `voicePrompt` + `optimizeTextPreview` |
| 音色复刻 | ✅ 已覆盖 | `voiceCloneBase64` / multipart `voiceCloneFile` |
| 自然语言风格 | ✅ 已覆盖 | `styleInstruction` → user 消息 |
| 音频标签（前缀） | 🟡 部分 | `audioTagStyle` 仅拼接到 assistant 文本**开头**，不支持 `[标签]` 任意内联 |
| 导演模式 | 🟡 部分 | 等价于自由文本 `styleInstruction`，无结构化字段 |
| 唱歌模式 | 🟡 部分 | 可通过 `audioTagStyle="(唱歌)"` 触发，无专用开关/校验 |
| 流式（pcm16） | ✅ 已覆盖 | tts 模型真流式；另两模型降级（文档一致） |
| 输出格式 wav/pcm16 | ✅ 已覆盖 | |
| 安全（鉴权/限流/限大小/脱敏） | ✅ 已覆盖 | |
| 音色列表查询端点 | ❌ 未覆盖 | 文档为静态表，项目未暴露 |
| 批量/并发/队列 | ❌ 未覆盖 | 一次请求 = 一次合成 |
| 用量/成本可观测 | ❌ 未覆盖 | 未读 `usage` |
| CORS / 健康检查探活 | ❌ 未覆盖 | |
| 测试 | ❌ 未覆盖 | 0 测试 |

---

## 三、功能扩展方向与可行性评估

### A. 多语音风格 / 情感切换（结构化风格预设）— 🟢 高
- **功能**：用命名预设（如 `温柔`、`磁性`、`东北话`、`唱歌`）代替手敲标签，调用方按 key 选取。
- **可行性**：高。文档支持 `(风格)` 标签与自然语言指令，项目已透传 `audioTagStyle`/`styleInstruction`，只需加一层"key→标签/指令"注册表。
- **改动范围**：新增 `src/stylePresets.ts`（注册表）；`MimoTtsToolSchema` 增加 `stylePreset`；`buildTtsMessages` 合并预设；更新 README/`.http`。
- **工作量**：小（1 新模块 + 2 处修改 + 文档）。
- **风险**：低。注意预设与用户自定义指令的合并顺序；唱歌仅 tts 模型，需校验。

### B. 音频参数动态调整（rate/pitch/volume）— 🔴 低（受 API 限制）
- **功能**：暴露语速/音调/音量等数值参数。
- **可行性**：**低**。MiMo **不提供数值化** rate/pitch/volume/采样率/位深/声道字段，只能经自然语言/标签"软控制"。若做"数值→NL 映射"（如 `rate=1.2` → "语速偏快"），可行但属近似、不可精确。
- **改动范围**：若坚持做，新增 `src/prosody.ts` 将 `{rate,pitch,volume}` 翻译为 `styleInstruction` 片段；schema 增可选字段。
- **工作量**：中。
- **风险**：中。映射不精确，效果依赖模型；建议命名改为"演绎倾向"而非"精确参数"，并明确告知调用方。

### C. 批量 / 并发合成与队列 — 🟡 中（需谨慎）
- **功能**：单请求提交多段文本/多任务，服务端并发合成并聚合结果（zip 或分段流）。
- **可行性**：中。API 无批量端点，需服务端编排：并发调用上游 + 限流/排队（防触发未知上游限频）+ 结果聚合。
- **改动范围**：新增 `src/batch.ts`（拆分、并发度上限、错误隔离、tmp 清理）；新路由 `POST /api/agent/tools/tts/batch`；建议采用"异步任务 + 状态轮询"而非同步阻塞。
- **工作量**：中–大。
- **风险**：中–高。上游限频未知，盲并发可能 429/资损；大批量落盘须清理（呼应 CODE_REVIEW C2）。

### D. 流式合成增强（WAV 封装 / 实时播放）— 🟢 高
- **功能**：将 pcm16 实时封装为可播放 WAV 流（补 44 字节 WAV 头），或提供"流式转 WAV 文件"落盘。
- **可行性**：高。预设模型已真流式，当前 `PassThrough` 直转已就位，仅需封装层。
- **改动范围**：`index.ts` 增加可选 WAV 头注入（流式先写 header 再 pipe pcm，结束回填长度）；或新增 `?container=wav`。文档警示 voiceclone/voicedesign 流式降级。
- **工作量**：小–中。
- **风险**：低–中。流式长度未知，WAV 头需支持"结束后回填"或"可更新长度"。

### E. 配置化 / DSL 语音角色管理 — 🟢 高
- **功能**：用配置文件声明"角色"（voice + 默认 styleInstruction + 默认 model + 可选 voicePrompt/clone），调用方用 `roleId` 引用。
- **可行性**：高。纯服务端配置 + 一层解析，不改变上游调用。
- **改动范围**：新增 `src/voices.config.ts`（或 JSON）；`resolveRole(roleId)`；schema 增 `roleId` 并与 `voiceId/voicePrompt` 互斥（扩展现有 `superRefine`）。
- **工作量**：小–中。
- **风险**：低。注意 role 与显式 `voiceId` 优先级；配置热更新可选。

### F. 音色列表查询 + 唱歌模式显式化 — 🟢 高
- **功能**：`GET /api/voices` 返回文档静态音色表；`singing: true` 便捷开关（自动加 `(唱歌)`，仅 tts 模型）。
- **可行性**：高。静态数据 + 小逻辑。
- **改动范围**：新增 `src/voices.ts`（静态表，取自文档）+ 路由 `GET /api/voices`；`singing` 作为 `audioTagStyle` 便捷封装（schema 增 boolean + 模型校验）。
- **工作量**：小。
- **风险**：低。唱歌仅 `mimo-v2.5-tts` 支持。

### G. 用量 / 成本可观测（P2/N5）— 🟢 高
- **功能**：记录每次合成的 usage（音频时长/字符数）、来源 IP、模型，结构化日志或 metrics。
- **可行性**：高。读 `completion.usage`（若上游返回），否则用音频字节数/时长估算；流式场景 usage 可能在 final chunk。
- **改动范围**：`MimoTtsAgentTool` 读 usage/算时长；service 或 middleware 落结构化日志；可选 Prometheus。
- **工作量**：小–中。
- **风险**：低。

### H. 架构演进：完整分层 + 测试补全（A1 / 后续建议）— 🟢 高
- 拆分 `src/routes`、`src/services`、`src/clients`，消除 `index.ts` 上帝文件；补 CORS、健康检查上游探活、多实例限流（Redis）；补齐单元测试（schema 校验、模型选择、流式转发、鉴权/限流/脱敏）。
- **工作量**：中。**长期维护性收益最大**。

---

## 四、Top 3 推荐扩展（含最小可行实现步骤）

### Top 1 — 易用性增强包：角色配置 + 风格预设 + 音色列表（A + E + F）
**价值**：立即提升产品力，工作量小，全部基于已支持能力。
**MVP 步骤**：
1. 新增 `src/voices.ts`：导出文档静态音色表 + `GET /api/voices` 路由。
2. 新增 `src/stylePresets.ts`：key→`{tag?, instruction?}` 注册表（覆盖基础情绪/语调/方言/唱歌）。
3. 新增 `src/voices.config.ts`：声明若干角色（默认 voice + styleInstruction + model）。
4. `MimoTtsInputSchema` 增加 `roleId`、`stylePreset`、`singing`；扩展 `superRefine` 处理与 `voiceId/voicePrompt` 的互斥/合并；`buildTtsMessages`/`buildAudioConfig` 消费新字段。
5. 更新 README 与 `mimo-tts.http`。

### Top 2 — 用量 / 成本可观测（G）
**价值**：生产化必备，成本极低。
**MVP 步骤**：
1. `handleSyncRequest`/`handleStreamRequest` 收集 `usage` 或计算音频时长（字节数 ÷ 采样率 ÷ 2 ÷ 声道）。
2. 在响应后由 `requestIdMiddleware`/service 输出结构化日志 `{requestId, model, voice, chars, durationSec, ip}`。
3. （可选）暴露 `GET /api/metrics` 或接 Prometheus。

### Top 3 — 流式 WAV 封装（D）
**价值**：让前端无需自行拼 PCM 头即可播放，降低集成门槛。
**MVP 步骤**：
1. `index.ts` 流式分支支持 `?container=wav`：先写 44 字节 WAV 头（采样率 24000、16bit、mono），再 `pipe` pcm 数据；结束回填 `dataSize`。
2. 非流式分支保持返回纯 wav 不变。
3. 文档注明 voiceclone/voicedesign 流式降级。

> 批量/队列（C）建议作为**第二里程碑**：先做保守并发 + 异步任务轮询，待确认上游限频后再放开。

---

## 五、关键约束与风险提示

1. **API 无数值化音频参数**：rate/pitch/volume/采样率/位深/声道均不暴露，"精确音频参数动态调整"在 API 层不可行，只能 NL/标签软控制（见方向 B）。
2. **输出规格固定**：24kHz / PCM16LE / 单声道；格式仅 wav/pcm16（mp3 仅作复刻输入）。
3. **流式降级**：真流式仅 `mimo-v2.5-tts`；`voicedesign`/`voiceclone` 流式为兼容模式（全推理后一次性返回）。
4. **限流/长度/并发文档未声明**：项目现有 `MIMO_TTS_MAX_TEXT_LENGTH=10000` 等为自定值；批量功能须保守并发以防资损。
5. **限时免费**：暂无直接成本压力，但用量可观测（G）仍建议优先做以便未来计费。
6. **兼容性**：唱歌/方言/角色扮演等标签效果依赖模型，预设需实测验证；voice design 的 `user` 消息在仅用 `roleId` 时仍需保证非空（结合 `optimize_text_preview` 可豁免）。

---

## 六、实现进展（2026-07-22，code 模式已落地）

报告中 Top 3 推荐扩展已全部实现并通过 `tsc` 类型检查与运行时冒烟测试（无真实 API Key 环境下验证路由、入参校验、角色解析、互斥/唱歌校验）。

| 方向 | 状态 | 落地内容 |
|---|---|---|
| A/E/F 角色配置+风格预设+音色列表 | ✅ 已实现 | 新增 `src/voices.ts`、`src/stylePresets.ts`、`src/voices.config.ts`；`MimoTtsAgentTool` 增加 `roleId`/`stylePreset`/`singing` 字段与互斥/唱歌校验；`index.ts` 新增 `GET /api/voices` |
| G 用量可观测 | ✅ 已实现 | `MimoTtsResult` 增加 `meta`；`index.ts` 输出结构化 `tts_usage` 日志（model/voice/chars/bytes/durationSec/ip），不缓冲音频 |
| D 流式 WAV 封装 | ✅ 已实现 | 流式分支支持 `?container=wav`，写入 44 字节 WAV 头（PCM16/24kHz/单声道，dataSize=0xFFFFFFFF 流式标记）后 pipe PCM |

**未做（按报告列为后续）**：批量/队列（C，依赖上游限频确认）、CORS、多实例限流（Redis）、测试补全、完整分层目录。
