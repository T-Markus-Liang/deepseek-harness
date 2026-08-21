// ==================== 斗地主 - 语音系统（方言/年龄/性格版） ====================
// 混合模式：优先使用 edge-tts 服务器（Microsoft Neural 语音，含方言声源），不可用时降级 Web Speech API
// v5: CosyVoice3 方言角色（东北大叔/四川大妈/粤语女生）+ IndexTTS-2.5 情绪微调
// 台词文本与 tts_models/lines_table.py 一致（manifest key 匹配预生成音频）

// 角色配置：年龄 + 方言 + 性格 + 台词库（8 角色独立，与 tts_models/lines_table_roles.py 一致）
const ROLE_CONFIG = {
  '老胡': {  // 🧔 东北大叔：粗犷豪爽，东北腔，男声
    voice: 'dongbei',
    tag: '东北大叔',
    lines: {
      single: ['来一张！', '整个小的！', '这单张，瞅你咋整！'],
      pair: ['对儿，走你！', '成双成对！'],
      triple: ['三条！', '仨！'],
      tripleOne: ['三带一！', '仨带个小的！'],
      tripleTwo: ['三带二！', '仨带俩！'],
      straight: ['老顺子，溜溜的！', '顺子走起！'],
      doubleStraight: ['连对！', '成双成对连上！'],
      plane: ['飞机起飞！', '轰隆隆飞过去！'],
      planeSingle: ['飞机带个翅膀！'],
      planePair: ['飞机带双！'],
      bomb: ['轰他娘的！', '看我东北大炮！', '炸你没商量！'],
      rocket: ['王炸！这局稳赢！', '王炸压死！'],
      pass: ['要不起，服了！', '整不起！', '过！'],
      bid: ['俺抢地主！', '这牌俺要定了！'],
      noBid: ['这牌不中', '俺先不抢'],
      win: ['赢麻了，哈哈哈！', '东北爷们打牌就是利索！'],
      lose: ['哎呀妈呀，又输咧！', '下把指定翻盘！']
    }
  },
  '德叔': {  // 🧓 北京大爷：沉稳侃爷，北京话，老年男声
    voice: 'beijing',
    tag: '北京大爷',
    lines: {
      single: ['单张，走着！', '来张小的！', '这牌这么出，地道！'],
      pair: ['对儿，齐活！', '俩一样，走你！'],
      triple: ['仨！', '三条！'],
      tripleOne: ['三带一！', '仨带个小的！'],
      tripleTwo: ['三带俩！', '仨带对！'],
      straight: ['顺子，溜啊！', '连起来了，瓷实！'],
      doubleStraight: ['连对！', '对子连着走！'],
      plane: ['飞机！', '这飞机，稳当！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['嘿，炸了！', '这炮仗，响！'],
      rocket: ['王炸！稳了！', '双王在手，天下我有！'],
      pass: ['要不起，得嘞！', '过过过！', '歇了！'],
      bid: ['这牌不错，我抢！', '地主我来当当！'],
      noBid: ['牌太碎', '先不抢，稳当'],
      win: ['嘿，赢了！地道！', '咱北京爷们儿，玩的就是稳！'],
      lose: ['得，输了。', '下把翻盘，走着瞧！']
    }
  },
  '大壮': {  // 💪 山东大汉：憨厚豪迈，山东话，壮年男声
    voice: 'shandong',
    tag: '山东大汉',
    lines: {
      single: ['来一张！', '单张，走！', '俺出一张！'],
      pair: ['对子！', '俩一样，中！'],
      triple: ['三条！', '仨！'],
      tripleOne: ['三带一！', '仨带一个！'],
      tripleTwo: ['三带二！', '仨带俩！'],
      straight: ['顺子！', '连着出，中！'],
      doubleStraight: ['连对！', '对子连着！'],
      plane: ['飞机！', '轰隆过去了！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['炸！', '俺这炮仗，够劲儿！', '炸你没商量！'],
      rocket: ['王炸！', '双王，厉害吧！'],
      pass: ['要不起！', '中，过！', '先过！'],
      bid: ['俺抢地主！', '这牌俺要了！'],
      noBid: ['牌不行', '俺先不抢'],
      win: ['中！赢了！', '咱山东大汉，打牌就是实在！'],
      lose: ['哎呀，输了', '下把指定赢回来！']
    }
  },
  '小呆': {  // 👩 四川大妈：泼辣爽利，四川话，成熟女声
    voice: 'sichuan',
    tag: '四川大妈',
    lines: {
      single: ['出张小的噻！', '来一张，巴适！', '这单张你接得住不？'],
      pair: ['对子来咯！', '整一对！'],
      triple: ['三条！', '搞三个！'],
      tripleOne: ['三带一！', '三个带一个！'],
      tripleTwo: ['三带二！', '三个带两个！'],
      straight: ['顺子，溜得很！', '连起走！'],
      doubleStraight: ['连对！', '对子连起！'],
      plane: ['飞机起飞咯！', '飞过去！'],
      planeSingle: ['飞机带一个！'],
      planePair: ['飞机带两个！'],
      bomb: ['炸死你娃儿！', '炸弹来咯！', '巴适，炸！'],
      rocket: ['王炸！巴适得板！', '王炸，要得！'],
      pass: ['要不起噻！', '莫得办法！', '过！'],
      bid: ['老子要抢地主！', '这牌老子要！'],
      noBid: ['这牌不得行', '先稳一哈'],
      win: ['巴适！这把赢得安逸！', '安逸惨咯！'],
      lose: ['搞啥子嘛，又输咯！', '下把再来！']
    }
  },
  '王阿姨': {  // 👵 上海阿姨：精明细致，上海话，成熟女声
    voice: 'shanghai',
    tag: '上海阿姨',
    lines: {
      single: ['出一张喏！', '小牌先走！', '迭张牌，蛮好！'],
      pair: ['对子来咯！', '两个一样额！'],
      triple: ['三条！', '三个头！'],
      tripleOne: ['三带一！', '三个带一个！'],
      tripleTwo: ['三带二！', '三个带两个！'],
      straight: ['顺子，清爽！', '一路连下去！'],
      doubleStraight: ['连对！', '对子连起来！'],
      plane: ['飞机！', '飞起来咯！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['炸弹！', '炸了依！', '迭记厉害咯！'],
      rocket: ['王炸！', '双王，结棍！'],
      pass: ['要不起哦！', '算了，过！', '过过过！'],
      bid: ['迭把牌蛮好，我抢！', '地主我来做！'],
      noBid: ['牌一般', '先看看'],
      win: ['赢咯！蛮灵额！', '阿拉上海人打牌，稳！'],
      lose: ['哎，输脱了', '下把再赢回来！']
    }
  },
  '辣妹': {  // 💃 湖南辣妹：火辣直接，湖南话，年轻女声
    voice: 'hunan',
    tag: '湖南辣妹',
    lines: {
      single: ['出一张！', '单张，走你！', '小牌先探路！'],
      pair: ['对子！', '俩一起，走！'],
      triple: ['三条！', '仨！'],
      tripleOne: ['三带一！', '仨带一个！'],
      tripleTwo: ['三带二！', '仨带俩！'],
      straight: ['顺子！', '一路顺下去！'],
      doubleStraight: ['连对！', '对子连起！'],
      plane: ['飞机！', '飞咯！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['炸死你！', '炸弹，来咯！', '看你往哪跑！'],
      rocket: ['王炸！', '双王在手，谁怕谁！'],
      pass: ['要不起！', '过！', '先过你！'],
      bid: ['我抢地主！', '这牌我要了！'],
      noBid: ['牌不行', '先不抢'],
      win: ['哈哈，赢了！', '湖南妹子打牌，辣得很！'],
      lose: ['哼，输了', '下把再来，不信赢不了！']
    }
  },
  '阿珍': {  // 👧 粤语女生：活泼俏皮，粤语，年轻女声
    voice: 'yue',
    tag: '粤语女生',
    lines: {
      single: ['出张细牌！', '嚟一张！', '看我嘅！'],
      pair: ['一对！', '孖住出！'],
      triple: ['三条！', '三张！'],
      tripleOne: ['三带一！', '三带一个！'],
      tripleTwo: ['三带二！', '三带两个！'],
      straight: ['顺子！', '一条龙！'],
      doubleStraight: ['连对！', '孖孖连住！'],
      plane: ['飞机！', '飞起嚟！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['炸弹！', '炸你！', 'boom！'],
      rocket: ['王炸！', '双王，犀利！'],
      pass: ['唔该，过！', '要唔起！', '过先啦！'],
      bid: ['我抢地主！', '呢把我要！'],
      noBid: ['呢手牌唔得', '先睇下先'],
      win: ['哈哈，赢咗啦！', '呢把实赢！'],
      lose: ['唉，又输咗咯！', '唔紧要，再嚟！']
    }
  },
  '阿妹': {  // 👸 云南阿妹：温柔腼腆，云南话，年轻女声
    voice: 'yunnan',
    tag: '云南阿妹',
    lines: {
      single: ['出一张咯！', '来张小牌！', '慢慢出！'],
      pair: ['对子！', '两个一起！'],
      triple: ['三条！', '三个一样！'],
      tripleOne: ['三带一！', '三个带一个！'],
      tripleTwo: ['三带二！', '三个带两个！'],
      straight: ['顺子！', '连着出！'],
      doubleStraight: ['连对！', '对子连着！'],
      plane: ['飞机！', '飞过去咯！'],
      planeSingle: ['飞机带单！'],
      planePair: ['飞机带对！'],
      bomb: ['炸弹！', '炸咯！', '厉害吧！'],
      rocket: ['王炸！', '双王！'],
      pass: ['要不起！', '过咯！', '先过！'],
      bid: ['我抢地主！', '这牌我要咯！'],
      noBid: ['牌不好', '先不抢'],
      win: ['嘻嘻，赢了！', '云南阿妹运气好！'],
      lose: ['哎呀，输了', '下次再来！']
    }
  },
  '你': {  // 😎 玩家本人：轻松愉快，粤语俏皮
    voice: 'you',
    tag: '玩家',
    lines: {
      play: ['出张细牌！', '嚟一张！', '看我嘅！'],
      pass: ['唔该，过！', '要唔起！', '过先啦！'],
      bid: ['我抢地主！', '呢把我要！'],
      noBid: ['呢手牌唔得', '先睇下先'],
      win: ['哈哈，赢咗啦！', '呢把实赢！'],
      lose: ['唉，又输咗咯！', '唔紧要，再嚟！']
    }
  }
};

// 兼容旧接口：角色 -> 声源 key（edge-tts / Web Speech 降级用）
const ROLE_TTS_VOICES = {
  '小呆': 'sichuan',   // 四川大妈
  '老胡': 'dongbei',   // 东北大叔
  '你': 'yue'          // 粤语女生
};

// 兼容旧引用（内部不再直接用，保留以免其他文件报错）
const SPEECH_LINES = ROLE_CONFIG['小呆'].lines;
const HUMAN_LINES = ROLE_CONFIG['你'].lines;

// ===== 开源 TTS 预生成音频（CosyVoice3 8 角色主打 + 旧版回退）=====
// CosyVoice3 生成 8 角色独立语音（方言+性格）到 /tts_cosy_roles/
// 旧版 tts_cosy_it（3 方言复用）与 tts_cosy（CosyVoice2）保留作回退
const ROLES_MANIFEST_URL = '/tts_cosy_roles/manifest.json';  // 8 角色独立语音（优先）
const IT_MANIFEST_URL = '/tts_cosy_it/manifest.json';        // 3 方言复用（回退）
const COSY_MANIFEST_URL = '/tts_cosy/manifest.json';         // CosyVoice2 彩蛋（回退）
// 角色名 -> voice 前缀（manifest key 前缀）；characters.js 的 voice 字段同值
const COSY_VOICE_MAP = {
  '小呆': 'xiaodai', '老胡': 'laohu', '你': 'you',
  '德叔': 'beijing', '王阿姨': 'shanghai', '辣妹': 'hunan',
  '大壮': 'shandong', '阿珍': 'guangdong', '阿妹': 'yunnan'
};
let rolesManifest = null;
let itManifest = null;
let cosyManifest = null;
let cosyEnabled = false;

/**
 * 加载预生成音频清单（8 角色 + 3 方言 + CosyVoice2 三份）
 */
function loadCosyManifest() {
  return Promise.all([
    fetch(ROLES_MANIFEST_URL, { mode: 'cors' }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(IT_MANIFEST_URL, { mode: 'cors' }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(COSY_MANIFEST_URL, { mode: 'cors' }).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([rolesM, itM, cosyM]) => {
    rolesManifest = rolesM && Object.keys(rolesM).length > 0 ? rolesM : null;
    itManifest = itM && Object.keys(itM).length > 0 ? itM : null;
    cosyManifest = cosyM && Object.keys(cosyM).length > 0 ? cosyM : null;
    cosyEnabled = !!(rolesManifest || itManifest || cosyManifest);
    return cosyEnabled;
  });
}

/**
 * 尝试用预生成音频播放（IndexTTS-2 优先，CosyVoice2 彩蛋回退）
 * @param {string} roleName - 角色名（小呆/老胡/你）
 * @param {string} text - 台词文本
 * @returns {boolean} 是否命中预生成音频
 */
// 预生成 wav 的 blob 缓存（url -> objectURL），绕过服务器 application/octet-stream 导致的播放失败
const wavBlobCache = {};

/**
 * 用 fetch+blob 播放预生成 wav（强制 audio/wav，绕过服务器错误的 Content-Type）
 * 服务器对 .wav 返回 application/octet-stream，直接 new Audio(url) 流式播放会 NotSupportedError；
 * fetch 成 blob 并指定 audio/wav 后用 objectURL 播放即可正常。
 * @param {string} url - wav 完整路径
 * @param {Function} [onFail] - fetch/播放失败时的降级回调（如 Web Speech）
 */
function playWavAsBlob(url, onFail) {
  if (wavBlobCache[url]) { enqueueAudio(wavBlobCache[url]); return; }
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
    .then(blob => {
      const typed = new Blob([blob], { type: 'audio/wav' });
      const objUrl = URL.createObjectURL(typed);
      wavBlobCache[url] = objUrl;
      enqueueAudio(objUrl);
    })
    .catch(() => { if (onFail) onFail(); });
}

function speakViaCosy(roleName, text, voiceKey) {
  if (!cosyEnabled) return false;
  // 优先用 voiceKey（8 角色独立 voice 前缀），否则按角色名查 COSY_VOICE_MAP
  const voicePrefix = voiceKey || COSY_VOICE_MAP[roleName];
  if (!voicePrefix) return false;
  const cosyKey = voicePrefix + '_' + text;
  const fallback = () => speakViaWebSpeech(text, 1.0, 1.0);
  // 1. CosyVoice3 8 角色独立语音（方言+性格，最自然）
  if (rolesManifest && rolesManifest[cosyKey]) {
    playWavAsBlob('/tts_cosy_roles/' + rolesManifest[cosyKey], fallback);
    return true;
  }
  // 2. CosyVoice3 3 方言复用（回退）
  if (itManifest && itManifest[cosyKey]) {
    playWavAsBlob('/tts_cosy_it/' + itManifest[cosyKey], fallback);
    return true;
  }
  // 3. CosyVoice2 彩蛋（回退）
  if (cosyManifest && cosyManifest[cosyKey]) {
    playWavAsBlob(cosyManifest[cosyKey], fallback);
    return true;
  }
  return false;
}

const TTS_SERVER = 'http://127.0.0.1:3098';
let ttsServerAvailable = false;
let ttsServerChecked = false;

// Web Speech API 降级
let speechSynth = null;
let bestChineseVoice = null;
let allChineseVoices = [];
let voiceReady = false;
let lastSpeakTime = 0;

// 音频缓存 { key: blobUrl }
const audioCache = {};
// 播放队列，防止语音重叠
const playQueue = [];
let isPlayingAudio = false;

/**
 * 检查 TTS 服务器是否可用
 */
function checkTTSServer() {
  return new Promise((resolve) => {
    fetch(TTS_SERVER + '/health', { mode: 'cors' })
      .then(r => {
        ttsServerAvailable = r.ok;
        ttsServerChecked = true;
        resolve(ttsServerAvailable);
      })
      .catch(() => {
        ttsServerAvailable = false;
        ttsServerChecked = true;
        resolve(false);
      });
  });
}

/**
 * 预热 TTS 缓存：为每个角色预生成其方言台词，确保出牌时语音即时播放
 */
function prewarmTTS() {
  if (!ttsServerAvailable) return;
  for (const roleName of Object.keys(ROLE_CONFIG)) {
    const role = ROLE_CONFIG[roleName];
    const voice = role.voice;
    const phrases = new Set();
    Object.values(role.lines).forEach(arr => arr.forEach(p => phrases.add(p)));
    for (const text of phrases) {
      const cacheKey = voice + '_' + text;
      if (!audioCache[cacheKey]) {
        const url = TTS_SERVER + '/tts?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice);
        fetch(url, { mode: 'cors' })
          .then(r => r.blob())
          .then(blob => {
            audioCache[cacheKey] = URL.createObjectURL(blob);
          })
          .catch(() => {});
      }
    }
  }
  console.log('[TTS] 预热完成，方言语音已缓存');
}

/**
 * 通过 TTS 服务器生成语音，立即返回，音频就绪后播放
 */
function speakViaTTS(text, voiceKey) {
  if (!ttsServerAvailable) return;
  
  const cacheKey = voiceKey + '_' + text;
  if (audioCache[cacheKey]) {
    enqueueAudio(audioCache[cacheKey]);
    return;
  }
  
  const url = TTS_SERVER + '/tts?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voiceKey);
  fetch(url, { mode: 'cors' })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      audioCache[cacheKey] = blobUrl;
      enqueueAudio(blobUrl);
    })
    .catch(() => {
      speakViaWebSpeech(text, 1.0, 1.0);
    });
}

/**
 * 音频播放队列：串行播放，避免语音重叠
 */
function enqueueAudio(url) {
  playQueue.push(url);
  processQueue();
}

function processQueue() {
  if (isPlayingAudio || playQueue.length === 0) return;
  isPlayingAudio = true;
  const url = playQueue.shift();
  const audio = new Audio(url);
  audio.volume = 0.8;
  audio.onended = () => {
    isPlayingAudio = false;
    processQueue();
  };
  audio.play().catch(() => {
    isPlayingAudio = false;
    processQueue();
  });
}

/**
 * 通过 Web Speech API 说话（降级方案）
 */
function speakViaWebSpeech(text, rate, pitch) {
  if (!speechSynth) {
    if (!initSpeech()) return;
  }
  if (speechSynth.speaking) {
    speechSynth.cancel();
  }
  const now = Date.now();
  if (now - lastSpeakTime < 300) return;
  lastSpeakTime = now;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    if (bestChineseVoice) utterance.voice = bestChineseVoice;
    else if (allChineseVoices.length > 0) utterance.voice = allChineseVoices[0];
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 0.9;
    speechSynth.speak(utterance);
  } catch (e) {}
}

/**
 * 初始化语音合成
 */
function initSpeech() {
  // 加载 CosyVoice2 预生成方言音频清单
  loadCosyManifest();
  
  checkTTSServer().then(() => {
    if (ttsServerAvailable) {
      prewarmTTS(); // 服务器可用则预热
    }
  });
  
  if (!window.speechSynthesis) return false;
  speechSynth = window.speechSynthesis;
  const loadVoices = () => {
    const voices = speechSynth.getVoices();
    if (voices.length > 0) {
      allChineseVoices = voices.filter(v => v.lang.startsWith('zh'));
      const preferred = ['Microsoft Xiaoxiao', 'Microsoft Yunxi', 'Microsoft Yunyang', 'Microsoft Yaoyao', 'Google 普通话', 'Google 中文', 'Sin-Ji', 'zh-CN', 'zh-TW', 'zh-HK'];
      for (const name of preferred) {
        const found = allChineseVoices.find(v => v.name.includes(name));
        if (found) { bestChineseVoice = found; break; }
      }
      if (!bestChineseVoice && allChineseVoices.length > 0) bestChineseVoice = allChineseVoices[0];
      voiceReady = true;
    }
  };
  loadVoices();
  if (!voiceReady) speechSynth.onvoiceschanged = () => { loadVoices(); };
  return true;
}

/**
 * 获取语音状态
 */
function getVoiceStatus() {
  return {
    ttsServer: ttsServerAvailable,
    webSpeech: voiceReady,
    voiceName: bestChineseVoice ? bestChineseVoice.name : '无',
    voiceCount: allChineseVoices.length,
    cacheCount: Object.keys(audioCache).length,
    cosyEnabled: cosyEnabled,
    cosyLines: (itManifest ? Object.keys(itManifest).length : 0) + (cosyManifest ? Object.keys(cosyManifest).length : 0),
    itLines: itManifest ? Object.keys(itManifest).length : 0,
    cvLines: cosyManifest ? Object.keys(cosyManifest).length : 0,
    roles: Object.keys(ROLE_CONFIG).map(name => name + '(' + ROLE_CONFIG[name].tag + ':' + ROLE_CONFIG[name].voice + ')')
  };
}

/**
 * 统一说话接口（优先 CosyVoice2 预生成方言音频，其次 edge-tts，最后 Web Speech）
 * @param {string} text - 台词
 * @param {number} rate - 语速
 * @param {number} pitch - 音调
 * @param {string} voiceKey - edge-tts 声源 key
 * @param {string} roleName - 角色名（小呆/老胡/你），用于 CosyVoice 方言音频
 */
function speak(text, rate = 1.0, pitch = 1.0, voiceKey = 'xiaoxiao', roleName = null, cosyVoice = null) {
  // 优先使用预生成的方言音频（最有人情味）；cosyVoice 是新角色的语音映射（laohu/xiaodai/human）
  if ((roleName || cosyVoice) && speakViaCosy(roleName, text, cosyVoice)) return;
  if (ttsServerAvailable) {
    speakViaTTS(text, voiceKey);
  } else {
    speakViaWebSpeech(text, rate, pitch);
  }
}

function _randomLine(lines) {
  if (!lines || !lines.length) return '出牌！';
  return lines[Math.floor(Math.random() * lines.length)];
}

/** 取角色台词库 */
function _roleLines(playerName, cosyVoice) {
  const role = ROLE_CONFIG[playerName];
  if (role) return role;
  // 新角色（随机对手）：按 voice 映射到对应角色台词库
  const voiceToRole = {
    'laohu': '老胡', 'beijing': '德叔', 'shandong': '大壮',
    'xiaodai': '小呆', 'shanghai': '王阿姨', 'hunan': '辣妹',
    'guangdong': '阿珍', 'yunnan': '阿妹', 'you': '你'
  };
  const mapped = voiceToRole[cosyVoice];
  if (mapped && ROLE_CONFIG[mapped]) return ROLE_CONFIG[mapped];
  // 兜底：老胡台词库完整（含全部牌型行）
  return ROLE_CONFIG['老胡'];
}

/** AI 出牌说话（按角色方言/性格） */
function speakPlay(playerName, cardType, cards, cosyVoice) {
  const role = _roleLines(playerName, cosyVoice);
  const lines = role.lines;
  let line = '';
  switch (cardType) {
    case CARD_TYPE.SINGLE: line = _randomLine(lines.single); break;
    case CARD_TYPE.PAIR: line = _randomLine(lines.pair); break;
    case CARD_TYPE.TRIPLE: line = _randomLine(lines.triple); break;
    case CARD_TYPE.TRIPLE_ONE: line = _randomLine(lines.tripleOne); break;
    case CARD_TYPE.TRIPLE_TWO: line = _randomLine(lines.tripleTwo); break;
    case CARD_TYPE.STRAIGHT: line = _randomLine(lines.straight); break;
    case CARD_TYPE.DOUBLE_STRAIGHT: line = _randomLine(lines.doubleStraight); break;
    case CARD_TYPE.PLANE:
    case CARD_TYPE.PLANE_SINGLE:
    case CARD_TYPE.PLANE_PAIR:
      if (cardType === CARD_TYPE.PLANE) line = _randomLine(lines.plane);
      else if (cardType === CARD_TYPE.PLANE_SINGLE) line = _randomLine(lines.planeSingle);
      else line = _randomLine(lines.planePair);
      break;
    case CARD_TYPE.BOMB: line = _randomLine(lines.bomb); break;
    case CARD_TYPE.ROCKET: line = _randomLine(lines.rocket); break;
    default: line = '出牌！';
  }
  speak(line, 1.0, 1.0, role.voice, playerName, cosyVoice);
}

/** AI 过牌说话（按角色） */
function speakPass(playerName, cosyVoice) {
  const role = _roleLines(playerName, cosyVoice);
  speak(_randomLine(role.lines.pass), 1.0, 1.0, role.voice, playerName, cosyVoice);
}

/** AI 叫牌说话（按角色） */
function speakBid(playerName, score, cosyVoice) {
  const role = _roleLines(playerName, cosyVoice);
  speak(score > 0 ? _randomLine(role.lines.bid) : _randomLine(role.lines.noBid), 1.0, 1.0, role.voice, playerName, cosyVoice);
}

/** AI 赢牌说话（按角色） */
function speakWin(playerName, cosyVoice) {
  const role = _roleLines(playerName, cosyVoice);
  speak(_randomLine(role.lines.win), 1.0, 1.0, role.voice, playerName, cosyVoice);
}

/** AI 输牌说话（按角色） */
function speakLose(playerName, cosyVoice) {
  const role = _roleLines(playerName, cosyVoice);
  speak(_randomLine(role.lines.lose), 1.0, 1.0, role.voice, playerName, cosyVoice);
}

/* ============ 人类玩家语音（普通话） ============ */

/** 人类玩家出牌说话 */
function speakHumanPlay() {
  const role = ROLE_CONFIG['你'];
  speak(_randomLine(role.lines.play), 1.0, 1.0, role.voice, '你');
}

/** 人类玩家过牌说话 */
function speakHumanPass() {
  const role = ROLE_CONFIG['你'];
  speak(_randomLine(role.lines.pass), 1.0, 1.0, role.voice, '你');
}

/** 人类玩家叫牌说话 */
function speakHumanBid(score) {
  const role = ROLE_CONFIG['你'];
  speak(score > 0 ? _randomLine(role.lines.bid) : _randomLine(role.lines.noBid), 1.0, 1.0, role.voice, '你');
}

/** 人类玩家胜利说话 */
function speakHumanWin() {
  const role = ROLE_CONFIG['你'];
  speak(_randomLine(role.lines.win), 1.0, 1.0, role.voice, '你');
}

/** 人类玩家失败说话 */
function speakHumanLose() {
  const role = ROLE_CONFIG['你'];
  speak(_randomLine(role.lines.lose), 1.0, 1.0, role.voice, '你');
}
