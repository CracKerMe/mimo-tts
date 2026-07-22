```
npm install
npm run dev
```

```
open http://localhost:3000
```

## TTS API

`POST /api/agent/tools/tts`

请求级 TTS 配置放在 JSON body 中。`voiceId`、`voicePrompt`、`voiceCloneBase64` 可选其一；不传时使用 `MIMO_TTS_DEFAULT_VOICE`。

```json
{
  "text": "要合成的文本",
  "voiceId": "mia",
  "format": "wav",
  "styleInstruction": "语速自然，情绪温和",
  "audioTagStyle": "(温柔)",
  "isStream": false
}
```

### 易用性增强参数

- **`roleId`**：引用服务端预配置角色（见 `src/voices.config.ts`），自动套用其音色与默认风格。与 `voiceId`/`voicePrompt`/`voiceCloneBase64` 互斥。
- **`stylePreset`**：风格预设 key（见 `src/stylePresets.ts`），如 `温柔`、`磁性`、`东北话`、`唱歌`，自动转换为对应音频标签或自然语言指令。
- **`singing`**：`true` 时自动添加 `(唱歌)` 标签，**仅 `mimo-v2.5-tts` 支持**（与 `voicePrompt`/`voiceCloneBase64` 互斥）。

```json
{
  "text": "晚安，今天也要好好休息。",
  "roleId": "午夜电台"
}
```

```json
{
  "text": "全村的希望，冲鸭！",
  "stylePreset": "东北话"
}
```

### 预置音色列表

`GET /api/voices` 返回官方静态预置音色表（ID / 语言 / 性别）。

```bash
curl http://localhost:3000/api/voices
```

### 流式 WAV 封装

流式接口默认返回裸 `pcm16`。前端若要直接播放，可加 `?container=wav`，服务端会先写入 44 字节 WAV 头再流式拼接 PCM（无需客户端拼头）：

```bash
curl -X POST "http://localhost:3000/api/agent/tools/tts?container=wav" \
  -H "Content-Type: application/json" \
  -d '{"text":"这是一个流式 WAV 测试。","format":"pcm16","isStream":true}' \
  --output out.wav
```

> 注意：`mimo-v2.5-tts-voicedesign` / `mimo-v2.5-tts-voiceclone` 的流式当前为兼容模式（全部推理完成后一次性返回），仅 `mimo-v2.5-tts` 为真流式。

环境变量只作为服务默认值使用，例如 `MIMO_TTS_DEFAULT_VOICE`、`MIMO_TTS_DEFAULT_FORMAT`、`MIMO_TTS_DEFAULT_IS_STREAM`。body 中传入同名能力参数时，以本次请求的 body 为准。

也支持 `multipart/form-data` 上传文本文件，服务会把文件内容转换为 `text` 后再合成。文本文件字段名可用 `textFile` 或 `file`；音色复刻音频文件可用 `voiceCloneFile`。

```bash
curl -X POST http://localhost:3000/api/agent/tools/tts \
  -F "textFile=@./article.txt" \
  -F "voiceId=mia" \
  -F "format=wav" \
  --output output.wav
```

```bash
curl -X POST http://localhost:3000/api/agent/tools/tts \
  -F "textFile=@./article.txt" \
  -F "voiceCloneFile=@./sample.mp3" \
  -F "format=wav" \
  --output output.wav
```

## 安全与可配置项

公网部署时，本服务默认开启以下防护（详见 `CODE_REVIEW.md`）：

- **鉴权**：`MIMO_TTS_REQUIRE_AUTH=true` 时，调用方必须在请求头携带 `X-API-Key`，且值等于 `MIMO_TTS_SERVER_API_KEY`，否则返回 `401`。
- **限流**：基于 IP 的内存令牌桶，`MIMO_TTS_RATE_LIMIT` / `MIMO_TTS_RATE_LIMIT_WINDOW` 控制额度，超限返回 `429` 并带 `Retry-After`。
- **请求体大小**：`MIMO_TTS_MAX_FILE_BYTES` 限制单请求体大小（按 `Content-Length` 提前拒绝）。
- **输入校验**：`text` 最大长度 `MIMO_TTS_MAX_TEXT_LENGTH`、上传/Base64 音频大小上限，非法输入返回 `422`。
- **错误脱敏**：所有错误响应仅含 `{ error, requestId }`，明细仅服务端日志，不泄露内部信息。
- **落盘开关**：`MIMO_TTS_SAVE_AUDIO=false`（默认）时不将合成结果写入 `tmp/`，避免磁盘无限增长。

完整环境变量说明见 `.env.example`（复制为 `.env` 后填入）。本地开发可将 `MIMO_TTS_REQUIRE_AUTH` 设为 `false` 方便自测。

> 注意：环境变量中的布尔值需用 `true`/`false`（或 `1`/`0`）表示；字符串 `"false"` 会被严格解析为 false，而非被误判为 true。
