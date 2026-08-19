// ==================== 斗地主 - 主入口 ====================

let game = null;
let renderer = null;
let isProcessing = false;
let hintPlays = [];
let hintIndex = 0;

// 人类玩家回合 30 秒超时（到时间未操作自动过牌/不叫）
const HUMAN_TURN_LIMIT = 30; // 秒
let humanTimer = null;       // 兜底定时器
let humanCountdown = null;   // 倒计时显示定时器

/**
 * 启动人类玩家回合倒计时（30秒）
 */
function startHumanTurnTimer() {
  clearHumanTurnTimer();
  let remain = HUMAN_TURN_LIMIT;
  updateHumanCountdown(remain);
  humanCountdown = setInterval(() => {
    remain--;
    if (remain <= 0) {
      clearHumanTurnTimer();
      autoHumanAction();
    } else {
      updateHumanCountdown(remain);
    }
  }, 1000);
  humanTimer = setTimeout(() => {
    clearHumanTurnTimer();
    autoHumanAction();
  }, HUMAN_TURN_LIMIT * 1000);
}

/**
 * 更新倒计时显示
 */
function updateHumanCountdown(remain) {
  if (!renderer || !game) return;
  const msg = game.phase === 'bidding' ? '请叫分' : '请出牌';
  renderer.showMessage(`⏳ 轮到你了，${msg}（${remain}s 后自动操作）`);
}

/**
 * 清除人类回合定时器
 */
function clearHumanTurnTimer() {
  if (humanTimer) { clearTimeout(humanTimer); humanTimer = null; }
  if (humanCountdown) { clearInterval(humanCountdown); humanCountdown = null; }
}

/**
 * 超时自动操作：出牌阶段能过就过，不能过就出最小可出牌；叫牌阶段自动不叫
 */
function autoHumanAction() {
  if (isProcessing) return;
  if (game.phase === 'bidding' && game.currentPlayer === 0) {
    handleHumanBid(0); // 超时自动不叫
  } else if (game.phase === 'playing' && game.currentPlayer === 0) {
    if (game.lastPlayer === 0 || game.lastPlayer === -1) {
      autoPlaySmallest(); // 首出/自由出：必须出牌，自动出最小一组
    } else {
      handleHumanPass(); // 超时自动不出
    }
  }
}

/**
 * 自动出最小的可出牌（自由出牌时超时的兜底）
 */
function autoPlaySmallest() {
  const validPlays = game.getValidPlays();
  if (validPlays.length > 0) {
    handleHumanPlay(validPlays[0]);
    return;
  }
  const hand = game.players[0].hand;
  if (hand.length > 0) {
    const smallest = hand.slice().sort((a, b) => a.rank - b.rank)[0];
    handleHumanPlay([smallest]);
  }
}

/**
 * 初始化游戏
 */
function initGame() {
  game = new Game();
  renderer = new Renderer();
  
  // 初始化语音
  initSpeech();
  
  // 监听父页面手势消息（用户点击🃏打开弹窗 = 用户手势）
  // 用于解除 iframe 音频自动播放限制，实现背景音乐默认打开
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'DOUDIZHU_USER_GESTURE') {
      tryStartBGM();
    }
  });
  
  // 设置回调
  game.onStateChange = (state) => {
    renderer.renderState(state);
    
    // 自动触发AI回合
    if (!isProcessing) {
      if (state.phase === 'bidding' && state.currentPlayer !== 0) {
        setTimeout(() => processAIBidding(), 100);
      } else if (state.phase === 'playing' && state.currentPlayer !== 0) {
        setTimeout(() => processAITurn(), 200);
      } else if (state.phase === 'bidding' && state.currentPlayer === 0) {
        // 轮到人类叫牌（开局），启动30秒倒计时
        startHumanTurnTimer();
      }
    }
  };
  
  game.onBidEnd = (landlordIndex) => {
    // 地主确定后说话
    setTimeout(() => {
      if (landlordIndex === 0) {
        speakHumanBid(3);
      } else {
        speakBid(game.players[landlordIndex].name, 3, game.players[landlordIndex].voice);
      }
    }, 500);
  };
  
  game.onGameEnd = (winnerIndex) => {
    // 语音播报（区分人类/AI）
    setTimeout(() => {
      const winner = game.players[winnerIndex];
      if (winnerIndex === 0) speakHumanWin();
      else speakWin(winner.name, winner.voice);
      
      // 输家说话
      for (let i = 0; i < 3; i++) {
        if (i !== winnerIndex) {
          setTimeout(() => {
            if (i === 0) speakHumanLose();
            else speakLose(game.players[i].name, game.players[i].voice);
          }, 1800);
        }
      }
    }, 500);
  };
  
  // 设置渲染器回调
  renderer.onPlay = (cards) => {
    handleHumanPlay(cards);
  };
  
  renderer.onPass = () => {
    handleHumanPass();
  };
  
  renderer.onBid = (score) => {
    handleHumanBid(score);
  };
  
  renderer.onHint = () => {
    handleHumanHint();
  };
  
  // 开始游戏
  game.startGame();
}

/**
 * 处理人类玩家出牌
 */
function handleHumanPlay(cards) {
  if (isProcessing) return;
  if (game.phase !== 'playing') return;
  if (game.currentPlayer !== 0) return;
  
  // 验证牌型
  const type = detectType(cards);
  if (!type) {
    renderer.showMessage('❌ 无效的牌型！');
    return;
  }
  
  // 检查是否能管上
  if (game.lastPlay && game.lastPlayer !== 0) {
    const lastPlayInfo = {
      cards: game.lastPlay.cards,
      type: game.lastPlay.type,
      rank: game.lastPlay.rank,
      length: game.lastPlay.length
    };
    if (!canBeat(cards, lastPlayInfo)) {
      renderer.showMessage('❌ 管不上！');
      return;
    }
  }
  
  isProcessing = true;
  
  // 先说话（TTS 预热后即时播放），再出牌动画，保证同步
  const playType = detectType(cards);
  speakHumanPlay();
  
  // 出牌动画
  renderer.animatePlayCards(0, cards);
  
  const success = game.handlePlay(0, cards);
  if (!success) {
    renderer.showMessage('❌ 出牌失败！');
    isProcessing = false;
    return;
  }
  
  renderer.clearHighlight();
  clearHumanTurnTimer(); // 人类已操作，清除倒计时
  
  // 检查游戏是否结束
  if (game.phase === 'ended') {
    isProcessing = false;
    return;
  }
  
  // AI 回合
  setTimeout(() => {
    isProcessing = false;
    processAITurn();
  }, 400);
}

/**
 * 处理人类玩家过牌
 */
function handleHumanPass() {
  if (isProcessing) return;
  if (game.phase !== 'playing') return;
  if (game.currentPlayer !== 0) return;
  if (game.lastPlayer === 0 || game.lastPlayer === -1) return;
  
  isProcessing = true;
  
  // 人类玩家过牌说话
  speakHumanPass();
  
  const success = game.handlePlay(0, []);
  if (!success) {
    isProcessing = false;
    return;
  }
  
  renderer.clearHighlight();
  clearHumanTurnTimer(); // 人类已操作，清除倒计时
  renderer.showMessage('不出');
  
  if (game.phase === 'ended') {
    isProcessing = false;
    return;
  }
  
  setTimeout(() => {
    isProcessing = false;
    processAITurn();
  }, 400);
}

/**
 * 处理人类玩家叫地主
 */
function handleHumanBid(score) {
  if (isProcessing) return;
  if (game.phase !== 'bidding') return;
  if (game.currentPlayer !== 0) return;
  
  isProcessing = true;
  
  // 人类玩家叫牌说话
  speakHumanBid(score);
  
  const success = game.handleBid(0, score);
  if (!success) {
    isProcessing = false;
    return;
  }
  
  clearHumanTurnTimer(); // 人类已操作，清除倒计时
  renderer.hideBiddingUI();
  
  if (score > 0) {
    renderer.showMessage(`你叫了 ${score} 分`);
  } else {
    renderer.showMessage('你不叫');
  }
  
  // 检查游戏是否进入出牌阶段
  if (game.phase === 'playing') {
    // 地主确定，开始出牌
    if (game.currentPlayer === 0) {
      isProcessing = false;
      startHumanTurnTimer(); // 轮到人类出牌，启动30秒倒计时
      return;
    } else {
      // AI 出牌
      setTimeout(() => {
        isProcessing = false;
        processAITurn();
      }, 500);
    }
    return;
  }
  
  // 继续叫地主（AI回合）
  setTimeout(() => {
    isProcessing = false;
    processAIBidding();
  }, 500);
}

/**
 * 处理人类玩家提示
 */
function handleHumanHint() {
  if (game.phase !== 'playing') return;
  if (game.currentPlayer !== 0) return;
  
  const validPlays = game.getValidPlays();
  
  if (validPlays.length === 0) {
    renderer.showMessage('没有能出的牌');
    return;
  }
  
  // 不选中任何牌，直接提示到下一组
  if (hintPlays.length === 0) {
    hintPlays = validPlays;
    hintIndex = 0;
  } else {
    hintIndex = (hintIndex + 1) % hintPlays.length;
  }
  
  const hintCards = hintPlays[hintIndex];
  renderer.highlightHint(hintCards);
  
  const type = detectType(hintCards);
  if (type) {
    renderer.showMessage(`提示: ${getTypeName(type.type)}`);
  }
}

/**
 * AI 叫地主流程
 */
function processAIBidding() {
  if (isProcessing) return;
  if (game.phase !== 'bidding') return;
  if (game.currentPlayer === 0) return;
  
  isProcessing = true;
  
  const playerIndex = game.currentPlayer;
  const player = game.players[playerIndex];
  const hand = player.hand;
  
  // 获取当前最高叫分
  const currentBid = game.bidHistory.length > 0 
    ? Math.max(...game.bidHistory.map(b => b.score))
    : 0;
  
  const score = decideBid(hand, currentBid, player.personality);
  
  const delay = getAIBidDelay();
  
  setTimeout(() => {
    if (game.phase !== 'bidding') {
      isProcessing = false;
      return;
    }
    
    const success = game.handleBid(playerIndex, score);
    if (!success) {
      isProcessing = false;
      return;
    }
    
    // AI 说话
    speakBid(player.name, score, player.voice);
    
    if (score > 0) {
      renderer.showMessage(`${player.name} 叫了 ${score} 分`);
    } else {
      renderer.showMessage(`${player.name} 不叫`);
    }
    
    if (game.phase === 'playing') {
      // 地主确定，开始出牌
      if (game.currentPlayer === 0) {
        isProcessing = false;
        startHumanTurnTimer(); // 轮到人类出牌，启动30秒倒计时
        return;
      } else {
        setTimeout(() => {
          isProcessing = false;
          processAITurn();
        }, 500);
      }
      return;
    }
    
    if (game.phase === 'bidding') {
      // 继续叫地主（可能是人类或AI）
      if (game.currentPlayer === 0) {
        isProcessing = false;
        startHumanTurnTimer(); // 轮到人类叫分，启动30秒倒计时
      } else {
        setTimeout(() => {
          isProcessing = false;
          processAIBidding();
        }, 300);
      }
    }
  }, delay);
}

/**
 * AI 出牌流程
 */
function processAITurn() {
  if (isProcessing) return;
  if (game.phase !== 'playing') return;
  if (game.currentPlayer === 0) return;
  
  isProcessing = true;
  
  const playerIndex = game.currentPlayer;
  const player = game.players[playerIndex];
  const hand = player.hand;
  const isLandlord = player.isLandlord;
  
  const lastPlay = game.lastPlayer === playerIndex ? null : game.lastPlay;
  const lastPlayer = game.lastPlayer;
  
  const delay = getAIDelay();
  
  setTimeout(() => {
    if (game.phase !== 'playing') {
      isProcessing = false;
      return;
    }
    
    const cards = choosePlay(hand, lastPlay, lastPlayer, isLandlord, playerIndex, game.landlord, player.personality);
    
    const isPass = !cards || cards.length === 0;
    
    if (isPass) {
      // 先说话再过牌
      speakPass(player.name, player.voice);
      
      const success = game.handlePlay(playerIndex, []);
      if (!success) {
        isProcessing = false;
        return;
      }
      
      renderer.showMessage(`${player.name}: 过`);
      
      if (game.phase === 'ended') {
        isProcessing = false;
        return;
      }
      
      if (game.currentPlayer === 0) {
        resetHintState();
        startHumanTurnTimer(); // 轮到人类出牌，启动30秒倒计时
        isProcessing = false;
      } else {
        setTimeout(() => {
          isProcessing = false;
          processAITurn();
        }, 500);
      }
    } else {
      // 先说话（TTS 即时播放）再出牌动画，保证同步
      const type = detectType(cards);
      speakPlay(player.name, type ? type.type : '', cards, player.voice);
      
      renderer.animatePlayCards(playerIndex, cards);
      
      const success = game.handlePlay(playerIndex, cards);
      if (!success) {
        isProcessing = false;
        return;
      }
      
      renderer.showMessage(`${player.name} 出牌`);
      
      if (game.phase === 'ended') {
        isProcessing = false;
        return;
      }
      
      if (game.currentPlayer === 0) {
        resetHintState();
        startHumanTurnTimer(); // 轮到人类出牌，启动30秒倒计时
        isProcessing = false;
      } else {
        setTimeout(() => {
          isProcessing = false;
          processAITurn();
        }, 500);
      }
    }
  }, delay);
}

/**
 * 重置提示状态
 */
function resetHintState() {
  hintPlays = [];
  hintIndex = 0;
}

/**
 * 尝试启动背景音乐（打开弹窗时自动调用）
 * 用户已手动静音（bgmUserMuted=true）时不得再播放
 */
function tryStartBGM() {
  if (isBGMUserMuted()) return; // 用户已静音，禁止自动播放
  if (!isBGMPlaying()) {
    startBGM();
    if (renderer) {
      renderer.el.bgmToggle.textContent = '🔊 音乐';
      if (renderer.el.bgmVolume) {
        renderer.el.bgmVolume.style.display = 'inline-block';
      }
    }
  }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});