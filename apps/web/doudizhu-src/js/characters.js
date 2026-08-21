// ==================== 斗地主 - 角色池 ====================
// 每局从角色池随机抽取 2 个 AI 对手。
// 每个角色：名字 / 头像 emoji / 标签 / 性格 / 语音映射（复用现有方言语音库）

const CHARACTER_POOL = [
  {
    id: 'laohu',
    name: '老胡',
    avatar: '/avatars/laohu.jpg',
    tag: '东北大叔',
    personality: 'aggressive',   // 豪爽激进：爱叫地主、爱炸
    voice: 'laohu'               // 东北男声语音
  },
  {
    id: 'xiaodai',
    name: '小呆',
    avatar: '/avatars/xiaodai.jpg',
    tag: '四川大妈',
    personality: 'aggressive',   // 泼辣果断
    voice: 'xiaodai'             // 四川女声语音
  },
  {
    id: 'guangdong',
    name: '阿珍',
    avatar: '/avatars/guangdong.jpg',
    tag: '粤语女生',
    personality: 'balanced',     // 活泼稳健
    voice: 'guangdong'           // 粤语女声语音
  },
  {
    id: 'beijing',
    name: '德叔',
    avatar: '/avatars/beijing.jpg',
    tag: '北京大爷',
    personality: 'balanced',     // 侃爷稳健
    voice: 'beijing'             // 北京男声语音
  },
  {
    id: 'shanghai',
    name: '王阿姨',
    avatar: '/avatars/shanghai.jpg',
    tag: '上海阿姨',
    personality: 'conservative', // 精明保守：少叫地主、留大牌
    voice: 'shanghai'            // 上海女声语音
  },
  {
    id: 'hunan',
    name: '辣妹',
    avatar: '/avatars/hunan.jpg',
    tag: '湖南辣妹',
    personality: 'aggressive',   // 火辣激进
    voice: 'hunan'               // 湖南女声语音
  },
  {
    id: 'shandong',
    name: '大壮',
    avatar: '/avatars/shandong.jpg',
    tag: '山东大汉',
    personality: 'balanced',     // 憨厚稳健
    voice: 'shandong'            // 山东男声语音
  },
  {
    id: 'yunnan',
    name: '阿妹',
    avatar: '/avatars/yunnan.jpg',
    tag: '云南阿妹',
    personality: 'conservative', // 温柔保守
    voice: 'yunnan'              // 云南女声语音
  }
];

/**
 * 每局随机抽取 2 个 AI 对手（不重复，不抽中人类）
 * @returns {Array} 两个对手角色对象 [players[1]角色, players[2]角色]
 */
function drawOpponents() {
  const pool = [...CHARACTER_POOL];
  // 洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [pool[0], pool[1]];
}

/**
 * 角色性格 -> 出牌风格参数
 */
const PERSONALITY_PARAMS = {
  aggressive: {      // 激进：爱叫地主、爱用炸弹、管上就出
    bidBonus: 3,     // 叫分加成
    bombBias: 1.4,   // 炸弹使用倾向（高）
    passTolerance: 0.6,  // 过牌容忍度（低=不爱过）
    bigCardBias: 0.3     // 大牌早出倾向
  },
  balanced: {        // 稳健：合理出牌
    bidBonus: 0,
    bombBias: 1.0,
    passTolerance: 1.0,
    bigCardBias: 0.5
  },
  conservative: {    // 保守：少叫地主、留大牌、能过就过
    bidBonus: -3,    // 叫分减成
    bombBias: 0.7,   // 炸弹使用倾向（低）
    passTolerance: 1.5,  // 过牌容忍度（高=爱过）
    bigCardBias: 0.7     // 大牌保留倾向（高=晚出）
  }
};
