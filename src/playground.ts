import type { Context } from 'hono';

export function playgroundHandler(c: Context) {
  return c.html(playgroundHtml);
}

const playgroundHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MiMo TTS Playground</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #09090b;
      --bg-card: #18181b;
      --bg-hover: #27272a;
      --bg-input: #09090b;
      --border: #27272a;
      --border-focus: #f97316;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --primary: #f97316;
      --primary-hover: #fb923c;
      --primary-glow: rgba(249, 115, 22, 0.15);
      --success: #22c55e;
      --error: #ef4444;
      --warning: #eab308;
      --radius: 12px;
      --radius-sm: 8px;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* ===== Layout ===== */
    .app {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }

    /* ===== Header ===== */
    .header {
      text-align: center;
      margin-bottom: 48px;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--primary-glow);
      border: 1px solid rgba(249, 115, 22, 0.3);
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      margin-bottom: 20px;
      letter-spacing: 0.05em;
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
    }

    .header h1 span {
      background: linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header p {
      color: var(--text-muted);
      font-size: 1rem;
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* ===== Main Grid ===== */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 24px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
      .sidebar { order: -1; }
    }

    /* ===== Card ===== */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .card-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-glow);
      border-radius: 10px;
      font-size: 1.1rem;
    }

    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
    }

    .card-subtitle {
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .card-body {
      padding: 24px;
    }

    /* ===== Form Elements ===== */
    .form-group {
      margin-bottom: 20px;
    }

    .form-group:last-child { margin-bottom: 0; }

    .form-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-label .hint {
      font-size: 0.7rem;
      color: var(--text-dim);
      text-transform: none;
      letter-spacing: 0;
    }

    textarea, select, input[type="text"], input[type="password"] {
      width: 100%;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      color: var(--text);
      font-size: 0.9rem;
      font-family: inherit;
      transition: all 0.15s ease;
      outline: none;
    }

    textarea:focus, select:focus, input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    textarea::placeholder, input::placeholder {
      color: var(--text-dim);
    }

    textarea {
      min-height: 160px;
      resize: vertical;
      line-height: 1.6;
    }

    select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2371717a' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 36px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* ===== Toggles ===== */
    .toggle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .toggle-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .toggle-item:hover {
      border-color: var(--text-dim);
    }

    .toggle-item.active {
      border-color: var(--primary);
      background: var(--primary-glow);
    }

    .toggle-item input[type="checkbox"] {
      display: none;
    }

    .toggle-check {
      width: 18px;
      height: 18px;
      border: 2px solid var(--text-dim);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .toggle-item.active .toggle-check {
      background: var(--primary);
      border-color: var(--primary);
    }

    .toggle-check::after {
      content: '';
      width: 10px;
      height: 6px;
      border: 2px solid white;
      border-top: none;
      border-right: none;
      transform: rotate(-45deg) scale(0);
      transition: transform 0.15s ease;
    }

    .toggle-item.active .toggle-check::after {
      transform: rotate(-45deg) scale(1);
    }

    .toggle-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .toggle-item.active .toggle-label {
      color: var(--text);
    }

    /* ===== Primary Button ===== */
    .btn-generate {
      width: 100%;
      padding: 18px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      font-size: 1rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      position: relative;
      overflow: hidden;
    }

    .btn-generate:hover:not(:disabled) {
      background: var(--primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);
    }

    .btn-generate:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-generate:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-generate .spinner {
      display: none;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .btn-generate.loading .spinner { display: block; }
    .btn-generate.loading .btn-text { display: none; }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .btn-generate .shortcut {
      font-size: 0.7rem;
      opacity: 0.7;
      margin-left: 4px;
    }

    /* ===== Sidebar ===== */
    .sidebar {
      position: sticky;
      top: 24px;
    }

    /* ===== Status ===== */
    .status-card {
      margin-bottom: 16px;
    }

    .status-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text-dim);
      flex-shrink: 0;
    }

    .status-dot.loading {
      background: var(--warning);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .status-dot.success { background: var(--success); }
    .status-dot.error { background: var(--error); }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); }
      50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(234, 179, 8, 0); }
    }

    .status-info {
      flex: 1;
    }

    .status-text {
      font-size: 0.85rem;
      font-weight: 500;
    }

    .status-time {
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    /* ===== Player ===== */
    .player-card {
      margin-bottom: 16px;
      display: none;
    }

    .player-card.active { display: block; }

    .player-card audio {
      width: 100%;
      padding: 16px;
      background: var(--bg-input);
      border-radius: var(--radius-sm);
    }

    .player-actions {
      display: flex;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .btn-action {
      flex: 1;
      padding: 10px 16px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
    }

    .btn-action:hover {
      background: var(--bg-hover);
      color: var(--text);
      border-color: var(--text-dim);
    }

    /* ===== History ===== */
    .history-list {
      max-height: 400px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--border) transparent;
    }

    .history-list::-webkit-scrollbar {
      width: 6px;
    }

    .history-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .history-list::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .history-item {
      padding: 14px 16px;
      cursor: pointer;
      transition: background 0.15s ease;
      border-bottom: 1px solid var(--border);
    }

    .history-item:last-child { border-bottom: none; }

    .history-item:hover {
      background: var(--bg-hover);
    }

    .history-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .history-voice {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      background: var(--primary-glow);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .history-time {
      font-size: 0.7rem;
      color: var(--text-dim);
    }

    .history-text {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .history-empty {
      text-align: center;
      padding: 40px 16px;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    .history-empty-icon {
      font-size: 2rem;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .btn-clear {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-dim);
      font-size: 0.8rem;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-top: 12px;
    }

    .btn-clear:hover {
      background: var(--bg-hover);
      color: var(--text-muted);
      border-color: var(--text-dim);
    }

    /* ===== Toast ===== */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 14px 20px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 10px;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 100;
      max-width: 400px;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    .toast.error {
      border-color: rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.1);
    }

    .toast.success {
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.1);
    }

    /* ===== Noise Texture ===== */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: -1;
    }

    /* ===== Glow Effect ===== */
    .glow {
      position: fixed;
      top: -200px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(249, 115, 22, 0.08) 0%, transparent 70%);
      pointer-events: none;
      z-index: -1;
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="app">
    <header class="header">
      <div class="header-badge">✦ XIAOMI AI LAB</div>
      <h1>MiMo <span>TTS</span></h1>
      <p>基于小米 MiMo V2.5 的语音合成引擎，支持多音色、风格控制与流式输出</p>
    </header>

    <div class="main-grid">
      <!-- Main Content -->
      <div class="main-content">
        <!-- Text Input -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div class="card-icon">✏️</div>
            <div>
              <div class="card-title">文本输入</div>
              <div class="card-subtitle">输入需要合成的文本内容</div>
            </div>
          </div>
          <div class="card-body">
            <div class="form-group">
              <div class="form-label">
                <span>合成文本</span>
                <span class="hint">⌘ + Enter 快速生成</span>
              </div>
              <textarea id="inputText" placeholder="在这里输入你想要合成的文本...">你好，欢迎体验小米 MiMo 语音合成服务。这是一段测试文本，希望你喜欢我的声音。</textarea>
            </div>
          </div>
        </div>

        <!-- Voice Settings -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div class="card-icon">🎵</div>
            <div>
              <div class="card-title">音色配置</div>
              <div class="card-subtitle">选择音色、风格和输出格式</div>
            </div>
          </div>
          <div class="card-body">
            <div class="form-row" style="margin-bottom: 20px;">
              <div class="form-group" style="margin-bottom: 0;">
                <div class="form-label">预置音色</div>
                <select id="voiceId">
                  <option value="">默认音色</option>
                  <option value="冰糖">🧊 冰糖 · 中文女声</option>
                  <option value="茉莉">🌸 茉莉 · 中文女声</option>
                  <option value="苏打">🫧 苏打 · 中文男声</option>
                  <option value="白桦">🌲 白桦 · 中文男声</option>
                  <option value="Mia">✨ Mia · 英文女声</option>
                  <option value="Chloe">💎 Chloe · 英文女声</option>
                  <option value="Milo">🎯 Milo · 英文男声</option>
                  <option value="Dean">🎩 Dean · 英文男声</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <div class="form-label">风格预设</div>
                <select id="stylePreset">
                  <option value="">无预设</option>
                  <option value="温柔">🌙 温柔</option>
                  <option value="磁性">🧲 磁性</option>
                  <option value="活力">⚡ 活力</option>
                  <option value="东北话">🗣️ 东北话</option>
                  <option value="唱歌">🎤 唱歌</option>
                </select>
              </div>
            </div>

            <div class="form-row" style="margin-bottom: 20px;">
              <div class="form-group" style="margin-bottom: 0;">
                <div class="form-label">输出格式</div>
                <select id="format">
                  <option value="wav">WAV · 无损音频</option>
                  <option value="pcm16">PCM16 · 流式传输</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <div class="form-label">风格指令 <span class="hint">可选</span></div>
                <input type="text" id="styleInstruction" placeholder="如：语速放慢，声音温柔">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <div class="form-label">高级选项</div>
              <div class="toggle-grid">
                <div class="toggle-item" onclick="toggleOption(this, 'isStream')">
                  <input type="checkbox" id="isStream">
                  <div class="toggle-check"></div>
                  <span class="toggle-label">流式输出</span>
                </div>
                <div class="toggle-item" onclick="toggleOption(this, 'singing')">
                  <input type="checkbox" id="singing">
                  <div class="toggle-check"></div>
                  <span class="toggle-label">唱歌模式</span>
                </div>
                <div class="toggle-item" onclick="toggleOption(this, 'optimizeTextPreview')">
                  <input type="checkbox" id="optimizeTextPreview">
                  <div class="toggle-check"></div>
                  <span class="toggle-label">智能润色</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Generate Button -->
        <button class="btn-generate" id="submitBtn" onclick="generateTTS()">
          <div class="spinner"></div>
          <span class="btn-text">🎙️ 生成语音</span>
        </button>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <!-- API Key -->
        <div class="card status-card">
          <div class="card-header">
            <div class="card-icon">🔑</div>
            <div>
              <div class="card-title">API 配置</div>
              <div class="card-subtitle">可选 · 服务端已配置可留空</div>
            </div>
          </div>
          <div class="card-body">
            <input type="password" id="apiKey" placeholder="输入 API Key...">
          </div>
        </div>

        <!-- Status -->
        <div class="card status-card" id="statusCard" style="display:none;">
          <div class="status-content">
            <div class="status-dot" id="statusDot"></div>
            <div class="status-info">
              <div class="status-text" id="statusText">就绪</div>
              <div class="status-time" id="statusTime"></div>
            </div>
          </div>
        </div>

        <!-- Player -->
        <div class="card player-card" id="playerCard">
          <div class="card-header">
            <div class="card-icon">🎧</div>
            <div>
              <div class="card-title">播放器</div>
              <div class="card-subtitle" id="audioInfo">-</div>
            </div>
          </div>
          <audio id="audioPlayer" controls></audio>
          <div class="player-actions">
            <a class="btn-action" id="downloadBtn" download="tts-output.wav">
              ⬇️ 下载
            </a>
            <button class="btn-action" onclick="playAgain()">
              🔄 重播
            </button>
          </div>
        </div>

        <!-- History -->
        <div class="card">
          <div class="card-header">
            <div class="card-icon">📜</div>
            <div>
              <div class="card-title">历史记录</div>
              <div class="card-subtitle">最近 20 条</div>
            </div>
          </div>
          <div class="history-list" id="historyList">
            <div class="history-empty">
              <div class="history-empty-icon">📭</div>
              <div>暂无记录</div>
            </div>
          </div>
          <div style="padding: 0 16px 16px;">
            <button class="btn-clear" onclick="clearHistory()">清空历史</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <script>
    const API_BASE = window.location.origin;
    let currentAudioUrl = null;
    let history = JSON.parse(localStorage.getItem('tts-history') || '[]');

    // Init
    document.addEventListener('DOMContentLoaded', () => {
      renderHistory();
      const savedKey = localStorage.getItem('tts-api-key');
      if (savedKey) document.getElementById('apiKey').value = savedKey;
    });

    document.getElementById('apiKey').addEventListener('change', (e) => {
      localStorage.setItem('tts-api-key', e.target.value);
    });

    function toggleOption(el, id) {
      const cb = document.getElementById(id);
      cb.checked = !cb.checked;
      el.classList.toggle('active', cb.checked);
    }

    function setStatus(type, text) {
      const card = document.getElementById('statusCard');
      const dot = document.getElementById('statusDot');
      const textEl = document.getElementById('statusText');
      const timeEl = document.getElementById('statusTime');

      card.style.display = 'block';
      dot.className = 'status-dot ' + type;
      textEl.textContent = text;
      timeEl.textContent = new Date().toLocaleTimeString();
    }

    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      const icons = { error: '❌', success: '✅', info: 'ℹ️' };
      toast.className = 'toast ' + type;
      toast.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + message + '</span>';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4000);
    }

    async function generateTTS() {
      const text = document.getElementById('inputText').value.trim();
      if (!text) {
        showToast('请输入要合成的文本', 'error');
        return;
      }

      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.classList.add('loading');

      setStatus('loading', '正在生成...');

      const apiKey = document.getElementById('apiKey').value.trim();
      const voiceId = document.getElementById('voiceId').value;
      const stylePreset = document.getElementById('stylePreset').value;
      const format = document.getElementById('format').value;
      const isStream = document.getElementById('isStream').checked;
      const singing = document.getElementById('singing').checked;
      const optimizeTextPreview = document.getElementById('optimizeTextPreview').checked;
      const styleInstruction = document.getElementById('styleInstruction').value.trim();

      const body = { text };
      if (voiceId) body.voiceId = voiceId;
      if (stylePreset) body.stylePreset = stylePreset;
      if (format) body.format = format;
      if (isStream) body.isStream = true;
      if (singing) body.singing = true;
      if (optimizeTextPreview) body.optimizeTextPreview = true;
      if (styleInstruction) body.styleInstruction = styleInstruction;

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['X-API-Key'] = apiKey;

      const startTime = Date.now();

      try {
        const response = await fetch(API_BASE + '/api/agent/tools/tts', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(err.message || '请求失败: ' + response.status);
        }

        const blob = await response.blob();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = URL.createObjectURL(blob);

        const player = document.getElementById('audioPlayer');
        player.src = currentAudioUrl;

        const ext = format === 'pcm16' ? 'pcm' : 'wav';
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.href = currentAudioUrl;
        downloadBtn.download = 'tts-output.' + ext;

        const sizeKB = (blob.size / 1024).toFixed(1);
        document.getElementById('audioInfo').textContent = sizeKB + ' KB · ' + duration + 's';

        document.getElementById('playerCard').classList.add('active');
        player.play();

        setStatus('success', '生成完成');
        showToast('语音生成成功 · ' + duration + 's', 'success');

        addToHistory({
          text: text.substring(0, 100),
          voice: voiceId || '默认',
          style: stylePreset || '-',
          time: new Date().toLocaleString(),
          audioUrl: currentAudioUrl,
          duration: duration + 's',
        });

      } catch (error) {
        setStatus('error', '生成失败');
        showToast(error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }

    function playAgain() {
      const player = document.getElementById('audioPlayer');
      player.currentTime = 0;
      player.play();
    }

    function addToHistory(item) {
      history.unshift(item);
      if (history.length > 20) history.pop();
      localStorage.setItem('tts-history', JSON.stringify(history));
      renderHistory();
    }

    function renderHistory() {
      const container = document.getElementById('historyList');
      if (history.length === 0) {
        container.innerHTML = '<div class="history-empty"><div class="history-empty-icon">📭</div><div>暂无记录</div></div>';
        return;
      }

      container.innerHTML = history.map((item, index) => \`
        <div class="history-item" onclick="playHistoryItem(\${index})">
          <div class="history-item-header">
            <span class="history-voice">\${item.voice}</span>
            <span class="history-time">\${item.time}</span>
          </div>
          <div class="history-text">\${item.text}</div>
        </div>
      \`).join('');
    }

    function playHistoryItem(index) {
      const item = history[index];
      if (item.audioUrl) {
        const player = document.getElementById('audioPlayer');
        player.src = item.audioUrl;
        document.getElementById('playerCard').classList.add('active');
        document.getElementById('audioInfo').textContent = item.duration;
        player.play();
      }
    }

    function clearHistory() {
      history = [];
      localStorage.removeItem('tts-history');
      renderHistory();
      showToast('历史已清空', 'success');
    }

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generateTTS();
      }
    });
  </script>
</body>
</html>`;
