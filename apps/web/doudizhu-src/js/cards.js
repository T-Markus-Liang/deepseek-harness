// ==================== 斗地主 - 牌定义与牌型检测 ====================

// 牌型常量
const CARD_TYPE = {
  SINGLE: 'SINGLE',           // 单张
  PAIR: 'PAIR',               // 对子
  TRIPLE: 'TRIPLE',           // 三条
  TRIPLE_ONE: 'TRIPLE_ONE',   // 三带一
  TRIPLE_TWO: 'TRIPLE_TWO',   // 三带二
  STRAIGHT: 'STRAIGHT',       // 顺子
  DOUBLE_STRAIGHT: 'DOUBLE_STRAIGHT', // 连对
  PLANE: 'PLANE',             // 飞机
  PLANE_SINGLE: 'PLANE_SINGLE', // 飞机带单
  PLANE_PAIR: 'PLANE_PAIR',   // 飞机带对
  BOMB: 'BOMB',               // 炸弹
  ROCKET: 'ROCKET',           // 火箭
  FOUR_TWO: 'FOUR_TWO'        // 四带二
};

// 花色
const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];

// 点数显示
const RANK_DISPLAY = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '小王', 17: '大王'
};

// 点数排序（用于顺子检测）
const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// 牌型名称（中文）
const TYPE_NAMES = {
  SINGLE: '单张',
  PAIR: '对子',
  TRIPLE: '三条',
  TRIPLE_ONE: '三带一',
  TRIPLE_TWO: '三带二',
  STRAIGHT: '顺子',
  DOUBLE_STRAIGHT: '连对',
  PLANE: '飞机',
  PLANE_SINGLE: '飞机带单',
  PLANE_PAIR: '飞机带对',
  BOMB: '炸弹',
  ROCKET: '火箭',
  FOUR_TWO: '四带二'
};

/**
 * 创建一副54张牌
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 3; rank <= 15; rank++) {
      deck.push({ suit, rank, display: RANK_DISPLAY[rank] });
    }
  }
  // 小王
  deck.push({ suit: 'joker', rank: 16, display: '小王' });
  // 大王
  deck.push({ suit: 'joker', rank: 17, display: '大王' });
  return deck;
}

/**
 * Fisher-Yates 洗牌
 */
function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 发牌
 * 返回 [player0Hand, player1Hand, player2Hand, landlordCards]
 */
function deal(deck) {
  const shuffled = shuffle(deck);
  return [
    shuffled.slice(0, 17),
    shuffled.slice(17, 34),
    shuffled.slice(34, 51),
    shuffled.slice(51, 54)
  ];
}

/**
 * 按 rank 从大到小排序
 */
function sortCards(cards) {
  return [...cards].sort((a, b) => b.rank - a.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
}

/**
 * 获取牌的张数统计 { rank: count }
 */
function getCountMap(cards) {
  const map = {};
  for (const c of cards) {
    map[c.rank] = (map[c.rank] || 0) + 1;
  }
  return map;
}

/**
 * 检测牌型
 * 返回 { type, rank, length } 或 null
 * - type: 牌型常量
 * - rank: 主牌等级（用于比较大小）
 * - length: 长度（对于顺子等）
 */
function detectType(cards) {
  if (!cards || cards.length === 0) return null;
  
  const n = cards.length;
  const sorted = sortCards(cards);
  const countMap = getCountMap(sorted);
  const ranks = Object.keys(countMap).map(Number).sort((a, b) => a - b);
  const counts = Object.values(countMap).sort((a, b) => a - b);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  
  // 火箭：小王+大王
  if (n === 2 && sorted[0].rank === 17 && sorted[1].rank === 16) {
    return { type: CARD_TYPE.ROCKET, rank: 17, length: 1 };
  }
  
  // 单张
  if (n === 1) {
    return { type: CARD_TYPE.SINGLE, rank: sorted[0].rank, length: 1 };
  }
  
  // 对子：2张同rank
  if (n === 2 && maxCount === 2) {
    return { type: CARD_TYPE.PAIR, rank: sorted[0].rank, length: 1 };
  }
  
  // 三条：3张同rank
  if (n === 3 && maxCount === 3) {
    return { type: CARD_TYPE.TRIPLE, rank: sorted[0].rank, length: 1 };
  }
  
  // 炸弹：4张同rank
  if (n === 4 && maxCount === 4 && ranks.length === 1) {
    return { type: CARD_TYPE.BOMB, rank: sorted[0].rank, length: 1 };
  }
  
  // 三带一：3张同rank + 1张
  if (n === 4 && maxCount === 3 && minCount === 1 && ranks.length === 2) {
    const tripleRank = Object.entries(countMap).find(([r, c]) => c === 3);
    return { type: CARD_TYPE.TRIPLE_ONE, rank: parseInt(tripleRank[0]), length: 1 };
  }
  
  // 三带二：3张同rank + 2张同rank
  if (n === 5 && maxCount === 3 && minCount === 2 && ranks.length === 2) {
    const tripleRank = Object.entries(countMap).find(([r, c]) => c === 3);
    return { type: CARD_TYPE.TRIPLE_TWO, rank: parseInt(tripleRank[0]), length: 1 };
  }
  
  // 顺子：5张或更多连续单牌（3-A，不能含2和王）
  if (n >= 5 && maxCount === 1 && minCount === 1) {
    if (isConsecutive(ranks) && ranks[ranks.length - 1] <= 14) {
      return { type: CARD_TYPE.STRAIGHT, rank: ranks[ranks.length - 1], length: n };
    }
  }
  
  // 连对：3对或更多连续对子
  if (n >= 6 && n % 2 === 0 && maxCount === 2 && minCount === 2) {
    if (isConsecutive(ranks) && ranks[ranks.length - 1] <= 14) {
      return { type: CARD_TYPE.DOUBLE_STRAIGHT, rank: ranks[ranks.length - 1], length: n / 2 };
    }
  }
  
  // 飞机：2个或更多连续三条
  if (n >= 6 && maxCount === 3) {
    const tripleRanks = Object.entries(countMap)
      .filter(([r, c]) => c === 3)
      .map(([r]) => parseInt(r))
      .sort((a, b) => a - b);
    
    if (tripleRanks.length >= 2 && isConsecutive(tripleRanks) && tripleRanks[tripleRanks.length - 1] <= 14) {
      const tripleCount = tripleRanks.length;
      const remainingCards = n - tripleCount * 3;
      
      // 纯飞机（无带牌）
      if (remainingCards === 0) {
        return { type: CARD_TYPE.PLANE, rank: tripleRanks[tripleRanks.length - 1], length: tripleCount };
      }
      
      // 飞机带单：每套带1张
      if (remainingCards === tripleCount) {
        return { type: CARD_TYPE.PLANE_SINGLE, rank: tripleRanks[tripleRanks.length - 1], length: tripleCount };
      }
      
      // 飞机带对：每套带1对
      if (remainingCards === tripleCount * 2) {
        // 检查带的牌是否都是对子
        const remainingRanks = Object.entries(countMap)
          .filter(([r, c]) => c !== 3 || !tripleRanks.includes(parseInt(r)))
          .map(([r, c]) => c);
        if (remainingRanks.every(c => c === 2)) {
          return { type: CARD_TYPE.PLANE_PAIR, rank: tripleRanks[tripleRanks.length - 1], length: tripleCount };
        }
      }
    }
  }
  
  // 四带二：4张同rank + 2张单牌（或2对）
  if (n === 6 && maxCount === 4) {
    const fourRank = Object.entries(countMap).find(([r, c]) => c === 4);
    if (fourRank) {
      return { type: CARD_TYPE.FOUR_TWO, rank: parseInt(fourRank[0]), length: 1 };
    }
  }
  if (n === 8 && maxCount === 4) {
    const fourRank = Object.entries(countMap).find(([r, c]) => c === 4);
    if (fourRank) {
      const remaining = Object.entries(countMap).filter(([r, c]) => c !== 4);
      if (remaining.every(([r, c]) => c === 2)) {
        return { type: CARD_TYPE.FOUR_TWO, rank: parseInt(fourRank[0]), length: 1 };
      }
    }
  }
  
  return null;
}

/**
 * 判断数组是否连续递增
 */
function isConsecutive(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) return false;
  }
  return true;
}

/**
 * 判断是否能管上
 * @param {Array} playCards - 要出的牌
 * @param {Object} lastPlay - 上一手牌的结果 { cards, type, rank, length }
 * @returns {boolean}
 */
function canBeat(playCards, lastPlay) {
  if (!playCards || playCards.length === 0) return false;
  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) return true;
  
  const playType = detectType(playCards);
  const lastType = lastPlay.type ? lastPlay : detectType(lastPlay.cards);
  
  if (!playType) return false;
  
  // 火箭可以管一切
  if (playType.type === CARD_TYPE.ROCKET) return true;
  
  // 炸弹可以管非火箭的其他牌型
  if (playType.type === CARD_TYPE.BOMB) {
    if (lastType.type === CARD_TYPE.ROCKET) return false;
    if (lastType.type === CARD_TYPE.BOMB) return playType.rank > lastType.rank;
    return true;
  }
  
  // 非炸弹/火箭，必须同类型且同长度，且rank更大
  if (playType.type === lastType.type && playType.length === lastType.length) {
    return playType.rank > lastType.rank;
  }
  
  return false;
}

/**
 * 从手牌中找出所有能出的牌型（用于提示功能）
 * @param {Array} hand - 手牌
 * @param {Object|null} lastPlay - 上一手牌
 * @returns {Array<Array>} 所有合法出牌
 */
function findValidPlays(hand, lastPlay) {
  const sorted = sortCards(hand);
  const countMap = getCountMap(sorted);
  const rankGroups = {};
  for (const c of sorted) {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  }
  
  let allPlays = [];
  
  // 如果不是跟牌（自由出牌），生成所有可能的牌型
  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
    // 单张
    for (const c of sorted) {
      allPlays.push([c]);
    }
    
    // 对子
    for (const [rank, group] of Object.entries(rankGroups)) {
      if (group.length >= 2) {
        allPlays.push(group.slice(0, 2));
      }
    }
    
    // 三条
    for (const [rank, group] of Object.entries(rankGroups)) {
      if (group.length >= 3) {
        allPlays.push(group.slice(0, 3));
      }
    }
    
    // 三带一
    for (const [rank, group] of Object.entries(rankGroups)) {
      if (group.length >= 3) {
        const triple = group.slice(0, 3);
        for (const c of sorted) {
          if (c.rank !== parseInt(rank)) {
            allPlays.push([...triple, c]);
          }
        }
      }
    }
    
    // 三带二
    for (const [rank1, group1] of Object.entries(rankGroups)) {
      if (group1.length >= 3) {
        const triple = group1.slice(0, 3);
        for (const [rank2, group2] of Object.entries(rankGroups)) {
          if (parseInt(rank2) !== parseInt(rank1) && group2.length >= 2) {
            allPlays.push([...triple, ...group2.slice(0, 2)]);
          }
        }
      }
    }
    
    // 顺子
    for (let start = 3; start <= 10; start++) {
      for (let len = 5; len <= 12 && start + len - 1 <= 14; len++) {
        const straight = [];
        let valid = true;
        for (let r = start; r < start + len; r++) {
          if (!rankGroups[r] || rankGroups[r].length < 1) {
            valid = false;
            break;
          }
          straight.push(rankGroups[r][0]);
        }
        if (valid) {
          allPlays.push(straight);
        }
      }
    }
    
    // 连对
    for (let start = 3; start <= 12; start++) {
      for (let len = 3; len <= 10 && start + len - 1 <= 14; len++) {
        const doubleStraight = [];
        let valid = true;
        for (let r = start; r < start + len; r++) {
          if (!rankGroups[r] || rankGroups[r].length < 2) {
            valid = false;
            break;
          }
          doubleStraight.push(...rankGroups[r].slice(0, 2));
        }
        if (valid) {
          allPlays.push(doubleStraight);
        }
      }
    }
    
    // 飞机
    for (let start = 3; start <= 13; start++) {
      for (let len = 2; len <= 6 && start + len - 1 <= 14; len++) {
        const plane = [];
        let valid = true;
        for (let r = start; r < start + len; r++) {
          if (!rankGroups[r] || rankGroups[r].length < 3) {
            valid = false;
            break;
          }
          plane.push(...rankGroups[r].slice(0, 3));
        }
        if (valid) {
          // 纯飞机
          allPlays.push(plane);
          
          // 飞机带单
          const remaining = sorted.filter(c => !plane.includes(c));
          if (remaining.length >= len) {
            const kickers = remaining.slice(0, len);
            allPlays.push([...plane, ...kickers]);
          }
          
          // 飞机带对
          const remainingCountMap = getCountMap(remaining);
          const pairRanks = Object.entries(remainingCountMap).filter(([r, c]) => c >= 2);
          if (pairRanks.length >= len) {
            const kickers = pairRanks.slice(0, len).flatMap(([r]) => {
              const cards = rankGroups[parseInt(r)].filter(c => !plane.includes(c));
              return cards.slice(0, 2);
            });
            if (kickers.length === len * 2) {
              allPlays.push([...plane, ...kickers]);
            }
          }
        }
      }
    }
    
    // 炸弹
    for (const [rank, group] of Object.entries(rankGroups)) {
      if (group.length === 4) {
        allPlays.push(group);
      }
    }
    
    // 火箭
    if (rankGroups[16] && rankGroups[17]) {
      allPlays.push([rankGroups[16][0], rankGroups[17][0]]);
    }
    
    // 四带二
    for (const [rank, group] of Object.entries(rankGroups)) {
      if (group.length === 4) {
        const remaining = sorted.filter(c => c.rank !== parseInt(rank));
        // 四带二单
        if (remaining.length >= 2) {
          allPlays.push([...group, ...remaining.slice(0, 2)]);
        }
        // 四带二对
        const remainingCountMap = getCountMap(remaining);
        const pairRanks = Object.entries(remainingCountMap).filter(([r, c]) => c >= 2);
        if (pairRanks.length >= 2) {
          const kickers = pairRanks.slice(0, 2).flatMap(([r]) => {
            return rankGroups[parseInt(r)].slice(0, 2);
          });
          allPlays.push([...group, ...kickers]);
        }
      }
    }
  } else {
    // 跟牌模式：需要管上
    const lastType = lastPlay.type ? lastPlay : detectType(lastPlay.cards);
    if (!lastType) return [];
    
    switch (lastType.type) {
      case CARD_TYPE.SINGLE:
        for (const c of sorted) {
          if (c.rank > lastType.rank) {
            allPlays.push([c]);
          }
        }
        break;
        
      case CARD_TYPE.PAIR:
        for (const [rank, group] of Object.entries(rankGroups)) {
          if (group.length >= 2 && parseInt(rank) > lastType.rank) {
            allPlays.push(group.slice(0, 2));
          }
        }
        break;
        
      case CARD_TYPE.TRIPLE:
        for (const [rank, group] of Object.entries(rankGroups)) {
          if (group.length >= 3 && parseInt(rank) > lastType.rank) {
            allPlays.push(group.slice(0, 3));
          }
        }
        break;
        
      case CARD_TYPE.TRIPLE_ONE: {
        const tripleRanks = Object.entries(rankGroups)
          .filter(([r, g]) => g.length >= 3 && parseInt(r) > lastType.rank)
          .map(([r]) => parseInt(r));
        for (const tr of tripleRanks) {
          const triple = rankGroups[tr].slice(0, 3);
          const remaining = sorted.filter(c => c.rank !== tr);
          if (remaining.length >= 1) {
            allPlays.push([...triple, remaining[0]]);
          }
        }
        break;
      }
        
      case CARD_TYPE.TRIPLE_TWO: {
        const tripleRanks = Object.entries(rankGroups)
          .filter(([r, g]) => g.length >= 3 && parseInt(r) > lastType.rank)
          .map(([r]) => parseInt(r));
        for (const tr of tripleRanks) {
          const triple = rankGroups[tr].slice(0, 3);
          const remaining = sorted.filter(c => c.rank !== tr);
          const remainingCountMap = getCountMap(remaining);
          const pairRank = Object.entries(remainingCountMap).find(([r, c]) => c >= 2);
          if (pairRank) {
            const pair = rankGroups[parseInt(pairRank[0])].slice(0, 2);
            allPlays.push([...triple, ...pair]);
          }
        }
        break;
      }
        
      case CARD_TYPE.STRAIGHT: {
        const len = lastType.length;
        for (let start = 3; start + len - 1 <= 14; start++) {
          if (start + len - 1 > lastType.rank) {
            const straight = [];
            let valid = true;
            for (let r = start; r < start + len; r++) {
              if (!rankGroups[r] || rankGroups[r].length < 1) {
                valid = false;
                break;
              }
              straight.push(rankGroups[r][0]);
            }
            if (valid) {
              allPlays.push(straight);
            }
          }
        }
        break;
      }
        
      case CARD_TYPE.DOUBLE_STRAIGHT: {
        const len = lastType.length;
        for (let start = 3; start + len - 1 <= 14; start++) {
          if (start + len - 1 > lastType.rank) {
            const ds = [];
            let valid = true;
            for (let r = start; r < start + len; r++) {
              if (!rankGroups[r] || rankGroups[r].length < 2) {
                valid = false;
                break;
              }
              ds.push(...rankGroups[r].slice(0, 2));
            }
            if (valid) {
              allPlays.push(ds);
            }
          }
        }
        break;
      }
        
      case CARD_TYPE.PLANE:
      case CARD_TYPE.PLANE_SINGLE:
      case CARD_TYPE.PLANE_PAIR: {
        const len = lastType.length;
        const needKickers = lastType.type === CARD_TYPE.PLANE_SINGLE ? len :
                           lastType.type === CARD_TYPE.PLANE_PAIR ? len * 2 : 0;
        for (let start = 3; start + len - 1 <= 14; start++) {
          if (start + len - 1 > lastType.rank) {
            const plane = [];
            let valid = true;
            for (let r = start; r < start + len; r++) {
              if (!rankGroups[r] || rankGroups[r].length < 3) {
                valid = false;
                break;
              }
              plane.push(...rankGroups[r].slice(0, 3));
            }
            if (valid) {
              if (needKickers === 0) {
                allPlays.push(plane);
              } else {
                const remaining = sorted.filter(c => !plane.includes(c));
                if (needKickers === len) {
                  // 飞机带单
                  if (remaining.length >= needKickers) {
                    allPlays.push([...plane, ...remaining.slice(0, needKickers)]);
                  }
                } else if (needKickers === len * 2) {
                  // 飞机带对
                  const remainingCountMap = getCountMap(remaining);
                  const pairRanks = Object.entries(remainingCountMap).filter(([r, c]) => c >= 2);
                  if (pairRanks.length >= len) {
                    const kickers = pairRanks.slice(0, len).flatMap(([r]) => {
                      return rankGroups[parseInt(r)].filter(c => !plane.includes(c)).slice(0, 2);
                    });
                    if (kickers.length === needKickers) {
                      allPlays.push([...plane, ...kickers]);
                    }
                  }
                }
              }
            }
          }
        }
        break;
      }
        
      case CARD_TYPE.BOMB: {
        // 更大的炸弹
        for (const [rank, group] of Object.entries(rankGroups)) {
          if (group.length === 4 && parseInt(rank) > lastType.rank) {
            allPlays.push(group);
          }
        }
        break;
      }
        
      case CARD_TYPE.FOUR_TWO: {
        for (const [rank, group] of Object.entries(rankGroups)) {
          if (group.length === 4 && parseInt(rank) > lastType.rank) {
            const remaining = sorted.filter(c => c.rank !== parseInt(rank));
            if (remaining.length >= 2) {
              allPlays.push([...group, ...remaining.slice(0, 2)]);
            }
          }
        }
        break;
      }
    }
    
    // 炸弹和火箭可以管任何牌（除了被火箭管）
    if (lastType.type !== CARD_TYPE.ROCKET && lastType.type !== CARD_TYPE.BOMB) {
      // 炸弹
      for (const [rank, group] of Object.entries(rankGroups)) {
        if (group.length === 4) {
          allPlays.push(group);
        }
      }
      // 火箭
      if (rankGroups[16] && rankGroups[17]) {
        allPlays.push([rankGroups[16][0], rankGroups[17][0]]);
      }
    } else if (lastType.type === CARD_TYPE.BOMB) {
      // 更大的炸弹
      for (const [rank, group] of Object.entries(rankGroups)) {
        if (group.length === 4 && parseInt(rank) > lastType.rank) {
          allPlays.push(group);
        }
      }
    }
  }
  
  // 去重（比较牌面）
  const uniquePlays = [];
  const seen = new Set();
  for (const play of allPlays) {
    const key = play.map(c => `${c.suit}-${c.rank}`).sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlays.push(play);
    }
  }
  
  return uniquePlays;
}

/**
 * 获取牌显示字符串
 */
function cardDisplay(card) {
  const suitSymbols = {
    spades: '♠',
    hearts: '♥',
    clubs: '♣',
    diamonds: '♦',
    joker: ''
  };
  const suitSymbol = suitSymbols[card.suit] || '';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds' || (card.suit === 'joker' && card.rank === 17);
  return { suitSymbol, display: card.display, isRed };
}

/**
 * 获取牌型名称
 */
function getTypeName(type) {
  return TYPE_NAMES[type] || '未知';
}