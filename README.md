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
