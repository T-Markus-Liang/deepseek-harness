// ==================== 斗地主 - 背景音乐（原版mp3播放） ====================
// 使用小旭音乐《欢乐斗地主-游戏中1》原版 BGM（33秒循环播放）
// 优先通过父页面插件播放（FAB 点击 = 父页面真实手势，Safari/Chrome 均允许自动播放；
// iframe 内 AudioContext 在 Safari 下无法通过父页面手势解锁）。
// 父页面不可用时（如脱离插件直接访问 iframe），fallback 到本页面 Web Audio 播放。

let audioCtx = null;
let isPlaying = false;      // 是否处于"应播放"状态（父页面或本地）
let parentBGM = false;      // 是否已确认父页面接管 BGM
let bgmBuffer = null;      // 解码后的音频缓冲（本地 fallback）
let bgmSource = null;      // 当前播放源
let bgmGain = null;        // 音量控制节点
let bgmFetchStarted = false;
let bgmVolume = 0.35;      // 当前音量 (0-1)
let bgmUserMuted = false;  // 用户手动静音标志：true 时任何逻辑都不得自动播放

const BGM_URL = '/dou_dizhu_bgm.mp3';

// 向父页面发送 BGM 控制指令（插件在父页面用真实手势播放）
function _bgmParent(action, volume) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'DOUDIZHU_BGM', action, volume }, '*');
      return true;
    }
  } catch (e) {}
  return false;
}

// 监听父页面 BGM 状态回传（playing/volume），同步本地按钮状态
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'DOUDIZHU_BGM_STATE') return;
  parentBGM = true;
  isPlaying = !!d.playing;
  if (typeof d.volume === 'number') bgmVolume = d.volume;
  // 同步喇叭按钮
  const toggle = document.getElementById('bgm-toggle');
  if (toggle) toggle.textContent = isPlaying ? '🔊 音乐' : '🔇 音乐';
  const volEl = document.getElementById('bgm-volume');
  if (volEl) volEl.style.display = isPlaying ? 'inline-block' : 'none';
});

/**
 * 初始化 AudioContext（本地 fallback 用）
 */
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn('Web Audio API not supported');
  }
}

/**
 * 加载并解码 BGM（只加载一次，带缓存）
 * @returns {Promise<AudioBuffer|null>}
 */
async function loadBGM() {
  if (bgmBuffer || bgmFetchStarted) return bgmBuffer;
  bgmFetchStarted = true;
  try {
    const res = await fetch(BGM_URL);
    const buf = await res.arrayBuffer();
    bgmBuffer = await audioCtx.decodeAudioData(buf);
  } catch (e) {
    console.warn('BGM 加载失败:', e);
    bgmBuffer = null;
  }
  return bgmBuffer;
}

/**
 * 开始播放背景音乐
 * 优先：通知父页面插件播放（父页面 FAB 手势解锁，Safari/Chrome 均可自动播放）
 * 兜底：父页面不可用（脱离插件直接访问 iframe）时本地 Web Audio 播放
 */
function startBGM() {
  if (isPlaying) return;
  if (bgmUserMuted) return; // 用户已静音则不播放

  // 通知父页面播放（真实手势已在 FAB 点击时授予父页面）
  if (_bgmParent('start')) {
    isPlaying = true; // 乐观置为播放中，父页面状态回传会校正
    return;
  }

  // 本地 fallback
  initAudio();
  if (!audioCtx) return;

  isPlaying = true;

  // 恢复 AudioContext（手势解锁）；确保 resume 完成后再 start，否则可能无声
  const ensureRunning = () => {
    if (audioCtx.state === 'suspended') {
      return audioCtx.resume().catch(() => {});
    }
    return Promise.resolve();
  };

  ensureRunning().then(() => {
    return loadBGM();
  }).then(buffer => {
    if (!buffer || !isPlaying) return;

    // 停止旧的播放源（如有）
    if (bgmSource) {
      try { bgmSource.stop(); } catch (e) {}
      try { bgmSource.disconnect(); } catch (e) {}
      bgmSource = null;
    }

    bgmSource = audioCtx.createBufferSource();
    bgmSource.buffer = buffer;
    bgmSource.loop = true;

    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = bgmVolume;

    bgmSource.connect(bgmGain);
    bgmGain.connect(audioCtx.destination);
    bgmSource.start();
  });
}

/**
 * 停止播放背景音乐
 */
function stopBGM() {
  isPlaying = false;
  _bgmParent('stop'); // 通知父页面停止（若已接管）

  if (bgmSource) {
    try { bgmSource.stop(); } catch (e) {}
    try { bgmSource.disconnect(); } catch (e) {}
    bgmSource = null;
  }
}

/**
 * 切换背景音乐（用户手动操作：点击右上角按钮）
 * 关闭 = 记录用户静音，任何自动逻辑不得再启动
 */
function toggleBGM() {
  if (isPlaying) {
    stopBGM();
    bgmUserMuted = true;  // 用户点击关闭 → 永久静音直到再次手动打开
    _bgmParent('mute');   // 同步父页面静音状态
  } else {
    bgmUserMuted = false; // 用户手动打开 → 解除静音
    _bgmParent('unmute'); // 同步父页面解除静音
    startBGM();
  }
}

/**
 * 是否正在播放
 */
function isBGMPlaying() {
  return isPlaying;
}

/**
 * 获取 AudioContext 状态（'running' | 'suspended' | 'closed' | null）
 * @returns {string|null}
 */
function getAudioCtxState() {
  return audioCtx ? audioCtx.state : null;
}

/**
 * 在真实用户手势下重试解锁 AudioContext 并重启播放
 * 用于 postMessage 触发的 resume 被浏览器自动播放策略拒绝（context 仍 suspended）的场景：
 * 此时 isPlaying=true 但实际无声，用户点击喇叭时走到这里，真实手势 resume 会成功。
 */
function retryBGMUnlock() {
  if (bgmUserMuted) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state !== 'suspended') return; // 已 running 无需处理

  audioCtx.resume().then(() => {
    if (audioCtx.state !== 'running') return;
    // resume 成功：重建播放源重新 start（旧 source 可能因 suspended 时 start 而无输出）
    try { bgmSource.stop(); } catch (e) {}
    try { bgmSource.disconnect(); } catch (e) {}
    bgmSource = null;
    isPlaying = false;   // 允许 startBGM 重新走完整流程
    startBGM();
  }).catch(() => {});
}

/**
 * 是否处于用户静音状态
 */
function isBGMUserMuted() {
  return bgmUserMuted;
}

/**
 * 设置背景音乐音量 (0-1)
 * @param {number} level - 音量值，0 到 1
 */
function setBGMVolume(level) {
  bgmVolume = Math.max(0, Math.min(1, level));
  if (bgmGain) {
    bgmGain.gain.value = bgmVolume;
  }
  _bgmParent('setVolume', bgmVolume);
}

/**
 * 获取当前背景音乐音量
 * @returns {number} 当前音量 0-1
 */
function getBGMVolume() {
  return bgmVolume;
}
