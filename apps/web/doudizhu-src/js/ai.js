// ==================== 斗地主 - AI 策略 ====================

/**
 * AI 策略模块
 */

/**
 * 评估手牌质量，决定叫分（按性格调整）
 * @param {Array} hand - 手牌
 * @param {number} currentBid - 当前最高叫分
 * @param {string} personality - 性格（aggressive/balanced/conservative）
 * @returns {number} 叫分 (0-3)
 */
function decideBid(hand, currentBid, personality) {
  if (currentBid >= 3) return 0;
  
  let score = 0;
  const countMap = getCountMap(hand);
  
  // 炸弹加分
  for (const [rank, count] of Object.entries(countMap)) {
    if (count === 4) score += 6;
  }
  
  // 王加分
  if (hand.some(c => c.rank === 17)) score += 4; // 大王
  if (hand.some(c => c.rank === 16)) score += 3; // 小王
  
  // 2加分
  const twoCount = countMap[15] || 0;
  score += twoCount * 2;
  
  // A加分
  const aceCount = countMap[14] || 0;
  score += aceCount * 1;
  
  // 牌总数多也加分
  if (hand.length >= 17) score += 1;
  
  // 性格调整：激进爱叫地主 / 保守少叫
  const params = PERSONALITY_PARAMS[personality] || PERSONALITY_PARAMS['balanced'];
  score += params.bidBonus;
  
  // 决定叫分
  if (score >= 12) return 3;
  if (score >= 8) return 2;
  if (score >= 5) return 1;
  return 0;
}

/**
 * AI 选择要出的牌
 * @param {Array} hand - 手牌
 * @param {Object|null} lastPlay - 上一手牌
 * @param {number} lastPlayer - 上一手出牌的人
 * @param {boolean} isLandlord - 是否是地主
 * @param {number} currentPlayer - 当前玩家索引
 * @returns {Array|null} 要出的牌，或 null 表示过牌
 */
function choosePlay(hand, lastPlay, lastPlayer, isLandlord, currentPlayer, landlord, personality) {
  const validPlays = findValidPlays(hand, lastPlay);
  
  if (validPlays.length === 0) return null;
  
  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
    // 自由出牌
    return chooseFreePlay(hand, validPlays, isLandlord, personality);
  } else {
    // 跟牌
    return chooseFollowPlay(hand, validPlays, lastPlay, lastPlayer, isLandlord, currentPlayer, landlord, personality);
  }
}

/**
 * 自由出牌策略（按性格调整：激进早出大牌/炸弹，保守留大牌）
 */
function chooseFreePlay(hand, validPlays, isLandlord, personality) {
  const params = PERSONALITY_PARAMS[personality] || PERSONALITY_PARAMS['balanced'];
  // 按牌型分组
  const grouped = {
    singles: [],
    pairs: [],
    triples: [],
    tripleOnes: [],
    tripleTwos: [],
    straights: [],
    doubleStraights: [],
    planes: [],
    planeSingles: [],
    planePairs: [],
    bombs: [],
    rockets: [],
    fourTwos: []
  };
  
  for (const play of validPlays) {
    const type = detectType(play);
    if (!type) continue;
    switch (type.type) {
      case CARD_TYPE.SINGLE: grouped.singles.push(play); break;
      case CARD_TYPE.PAIR: grouped.pairs.push(play); break;
      case CARD_TYPE.TRIPLE: grouped.triples.push(play); break;
      case CARD_TYPE.TRIPLE_ONE: grouped.tripleOnes.push(play); break;
      case CARD_TYPE.TRIPLE_TWO: grouped.tripleTwos.push(play); break;
      case CARD_TYPE.STRAIGHT: grouped.straights.push(play); break;
      case CARD_TYPE.DOUBLE_STRAIGHT: grouped.doubleStraights.push(play); break;
      case CARD_TYPE.PLANE: grouped.planes.push(play); break;
      case CARD_TYPE.PLANE_SINGLE: grouped.planeSingles.push(play); break;
      case CARD_TYPE.PLANE_PAIR: grouped.planePairs.push(play); break;
      case CARD_TYPE.BOMB: grouped.bombs.push(play); break;
      case CARD_TYPE.ROCKET: grouped.rockets.push(play); break;
      case CARD_TYPE.FOUR_TWO: grouped.fourTwos.push(play); break;
    }
  }
  
  // 如果手牌很少（<=4张），直接出大牌
  if (hand.length <= 4) {
    // 有火箭先出火箭
    if (grouped.rockets.length > 0) return grouped.rockets[0];
    // 有炸弹出炸弹（激进型更早炸）
    if (grouped.bombs.length > 0 && (personality === 'aggressive' || hand.length <= 2 || Math.random() < params.bombBias)) {
      return grouped.bombs[0];
    }
    // 出最大的牌型
    for (const play of validPlays) {
      if (play.length === hand.length) return play;
    }
  }
  
  // 优先出小牌
  
  // 1. 出顺子（如果有较长的顺子）
  if (grouped.straights.length > 0) {
    // 选最小的顺子
    const minStraight = grouped.straights.reduce((min, p) => {
      const type = detectType(p);
      return type.rank < detectType(min).rank ? p : min;
    });
    return minStraight;
  }
  
  // 2. 出连对
  if (grouped.doubleStraights.length > 0) {
    const minDS = grouped.doubleStraights.reduce((min, p) => {
      const type = detectType(p);
      return type.rank < detectType(min).rank ? p : min;
    });
    return minDS;
  }
  
  // 3. 出飞机
  if (grouped.planes.length > 0) {
    return grouped.planes[0];
  }
  if (grouped.planeSingles.length > 0) {
    return grouped.planeSingles[0];
  }
  if (grouped.planePairs.length > 0) {
    return grouped.planePairs[0];
  }
  
  // 4. 出三带（先出最小的）
  if (grouped.tripleOnes.length > 0) {
    return grouped.tripleOnes[grouped.tripleOnes.length - 1];
  }
  if (grouped.tripleTwos.length > 0) {
    return grouped.tripleTwos[grouped.tripleTwos.length - 1];
  }
  if (grouped.triples.length > 0) {
    return grouped.triples[grouped.triples.length - 1];
  }
  
  // 5. 出对子（先出小对）
  if (grouped.pairs.length > 0) {
    // findValidPlays生成顺序是降序，取最后一个（最小）
    return grouped.pairs[grouped.pairs.length - 1];
  }
  
  // 6. 出单张（先出最小单张）
  if (grouped.singles.length > 0) {
    // findValidPlays生成顺序是降序，取最后一个（最小）
    return grouped.singles[grouped.singles.length - 1];
  }
  
  // 7. 出四带二
  if (grouped.fourTwos.length > 0) {
    return grouped.fourTwos[grouped.fourTwos.length - 1];
  }
  
  // 8. 出炸弹（激进型提前炸抢牌权；稳健/保守留到最后）
  if (grouped.bombs.length > 0) {
    // 激进：有炸弹就喜欢炸（约 60% 概率提前出）
    if (personality === 'aggressive' && Math.random() < 0.6) {
      return grouped.bombs[grouped.bombs.length - 1];
    }
    if (personality !== 'conservative' && Math.random() < 0.2) {
      return grouped.bombs[grouped.bombs.length - 1];
    }
  }
  if (grouped.rockets.length > 0 && personality !== 'conservative') {
    return grouped.rockets[grouped.rockets.length - 1];
  }
  
  return validPlays[0];
}

/**
 * 跟牌策略（按性格调整）
 */
function chooseFollowPlay(hand, validPlays, lastPlay, lastPlayer, isLandlord, currentPlayer, landlord, personality) {
  const params = PERSONALITY_PARAMS[personality] || PERSONALITY_PARAMS['balanced'];
  
  // 判断上一手出牌的人是不是队友
  let isPartner = false;
  if (!isLandlord) {
    // AI是农民，队友是另一个农民（非地主非自己）
    const partnerIndex = [0, 1, 2].find(i => i !== currentPlayer && i !== landlord);
    isPartner = lastPlayer === partnerIndex;
  }
  // 地主没有队友，所以 isPartner 保持 false
  
  // 队友出的牌：激进型继续跟（抢出牌权），稳健/保守让队友走
  if (isPartner) {
    // 如果手牌很少，有机会出完，就继续出
    if (hand.length <= 3) {
      // 找最小的能管上的牌
      return validPlays[validPlays.length - 1];
    }
    // 激进型：即使队友出牌也想出牌（减少过牌）
    if (personality === 'aggressive' && Math.random() < 0.5) {
      return validPlays[validPlays.length - 1];
    }
    // 否则过牌，让队友继续
    return null;
  }
  
  // 对手出的牌，尽量管上
  
  // 按 rank 分类
  const playsByRank = {};
  for (const play of validPlays) {
    const type = detectType(play);
    if (type) {
      const key = `${type.type}_${type.rank}`;
      if (!playsByRank[key]) playsByRank[key] = [];
      playsByRank[key].push(play);
    }
  }
  
  // 分离炸弹和普通牌
  const normalPlays = [];
  const bombPlays = [];
  const rocketPlays = [];
  
  for (const play of validPlays) {
    const type = detectType(play);
    if (!type) continue;
    if (type.type === CARD_TYPE.ROCKET) {
      rocketPlays.push(play);
    } else if (type.type === CARD_TYPE.BOMB) {
      bombPlays.push(play);
    } else {
      normalPlays.push(play);
    }
  }
  
  // 保守型：对手出大牌时，普通牌管不上就过（保留炸弹，不硬管）
  if (personality === 'conservative' && normalPlays.length > 0) {
    const lastType = detectType(lastPlay.cards);
    const lastRank = lastType ? lastType.rank : 0;
    // 如果对手出的牌很大（rank > 12），保守型倾向过牌保留炸弹
    if (lastRank > 12 && bombPlays.length > 0 && hand.length > 4 && Math.random() < 0.6) {
      return null;
    }
  }
  
  // 优先用普通牌管上，保留炸弹和火箭
  if (normalPlays.length > 0) {
    // 选择最小的能管上的牌（findValidPlays生成顺序是降序，取最后一个）
    const lastType = detectType(lastPlay.cards);
    if (lastType && lastType.type === CARD_TYPE.SINGLE) {
      // 找最小的单张
      return normalPlays[normalPlays.length - 1];
    }
    // 针对对子：用最小的对子管
    if (lastType && lastType.type === CARD_TYPE.PAIR) {
      return normalPlays[normalPlays.length - 1];
    }
    // 一般情况，用最小的管上
    return normalPlays[normalPlays.length - 1];
  }
  
  // 如果手牌很少（<=2张），可以考虑用炸弹抢出牌权
  if (hand.length <= 4 && bombPlays.length > 0) {
    return bombPlays[0];
  }
  
  // 如果对方只剩很少牌，用炸弹抢牌权
  // （简化版：不跟踪对手剩余牌数，直接判断）
  if (bombPlays.length > 0 && hand.length <= 6) {
    return bombPlays[0];
  }
  
  // 用炸弹（如果对方出的不是炸弹）
  const lastPlayType = lastPlay.type || detectType(lastPlay.cards);
  if (lastPlayType && lastPlayType.type !== CARD_TYPE.BOMB && lastPlayType.type !== CARD_TYPE.ROCKET) {
    if (bombPlays.length > 0) {
      // 使用最小的炸弹
      return bombPlays[bombPlays.length - 1];
    }
  } else if (lastPlayType && lastPlayType.type === CARD_TYPE.BOMB) {
    // 对方出炸弹，用更大的炸弹或火箭
    if (rocketPlays.length > 0) return rocketPlays[rocketPlays.length - 1];
    if (bombPlays.length > 0) return bombPlays[bombPlays.length - 1];
  }
  
  // 真的管不上，过牌
  return null;
}

/**
 * 获取AI出牌延迟（毫秒）
 */
function getAIDelay() {
  return 800 + Math.random() * 600;
}

/**
 * 获取AI叫牌延迟
 */
function getAIBidDelay() {
  return 500 + Math.random() * 500;
}