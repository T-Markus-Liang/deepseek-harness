// ==================== 斗地主 - 背景音乐（原版mp3播放） ====================
// 使用小旭音乐《欢乐斗地主-游戏中1》原版 BGM（33秒循环播放）
// 通过 Web Audio API 播放（可复用 AudioContext 手势解锁，实现默认打开）

let audioCtx = null;
let isPlaying = false;
let bgmBuffer = null;      // 解码后的音频缓冲
let bgmSource = null;      // 当前播放源
let bgmGain = null;        // 音量控制节点
let bgmFetchStarted = false;
let bgmVolume = 0.35;      // 当前音量 (0-1)
let bgmUserMuted = false;  // 用户手动静音标志：true 时任何逻辑都不得自动播放

const BGM_URL = '/dou_dizhu_bgm.mp3';

/**
 * 初始化 AudioContext
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
 */
function startBGM() {
  if (isPlaying) return;
  if (bgmUserMuted) return; // 用户已静音则不播放

  initAudio();
  if (!audioCtx) return;

  // 恢复 AudioContext（手势解锁）
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  isPlaying = true;

  loadBGM().then(buffer => {
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
  } else {
    bgmUserMuted = false; // 用户手动打开 → 解除静音
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
}

/**
 * 获取当前背景音乐音量
 * @returns {number} 当前音量 0-1
 */
function getBGMVolume() {
  return bgmVolume;
}
