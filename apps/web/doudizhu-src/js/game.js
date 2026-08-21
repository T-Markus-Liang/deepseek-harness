// ==================== 斗地主 - 游戏状态机 ====================

class Game {
  constructor() {
    this.reset();
    this.onStateChange = null; // 状态变更回调
    this.onBidEnd = null;      // 叫地主结束回调
    this.onPlayMade = null;    // 出牌回调
    this.onGameEnd = null;     // 游戏结束回调
  }

  reset() {
    // 每局随机抽取 2 个 AI 对手（带头像/性格/语音映射）
    const [opp1, opp2] = drawOpponents();
    // 积分从 localStorage 持久化读取（跨"再来一局"重载保留）；首次默认 1000，可扣为负值
    const saved = this._loadScores();
    this.players = [
      { name: '你', hand: [], isLandlord: false, role: 'farmer', avatar: '/avatars/you.jpg', personality: 'balanced', voice: 'you', charId: 'you', score: saved[0] },
      { name: opp1.name, hand: [], isLandlord: false, role: 'farmer', avatar: opp1.avatar, personality: opp1.personality, voice: opp1.voice, charId: opp1.id, tag: opp1.tag, score: saved[1] },
      { name: opp2.name, hand: [], isLandlord: false, role: 'farmer', avatar: opp2.avatar, personality: opp2.personality, voice: opp2.voice, charId: opp2.id, tag: opp2.tag, score: saved[2] }
    ];
    this.landlordCards = [];
    this.currentPlayer = 0;
    this.lastPlay = null;       // { player, cards, type, rank, length }
    this.lastPlayer = -1;       // 上一手出牌的人
    this.passCount = 0;         // 连续过牌次数
    this.phase = 'idle';        // idle | dealing | bidding | playing | ended
    this.bidHistory = [];       // [{ player, score }]
    this.bidCount = 0;          // 叫地主轮数
    this.landlord = -1;         // 地主索引
    this.winner = null;         // 赢家
    this.scoreDelta = [0, 0, 0]; // 本局积分变化
    this.playHistory = [];      // 出牌历史
    this.selectedCards = [];    // 当前选中牌
    this.validPlays = [];       // 当前可出的牌
    this.hintIndex = 0;         // 提示索引
    this.deck = [];
    this.dealt = false;
  }

  /**
   * 开始新游戏
   */
  startGame() {
    this.reset();
    this.phase = 'dealing';
    
    // 洗牌发牌
    this.deck = createDeck();
    const [p0, p1, p2, landlord] = deal(this.deck);
    this.players[0].hand = sortCards(p0);
    this.players[1].hand = sortCards(p1);
    this.players[2].hand = sortCards(p2);
    this.landlordCards = landlord;
    this.dealt = true;
    
    this._notifyState();
    
    // 进入叫地主阶段
    setTimeout(() => this.startBidding(), 800);
  }

  /**
   * 开始叫地主
   */
  startBidding() {
    this.phase = 'bidding';
    this.bidCount = 0;
    this.bidHistory = [];
    
    // 随机选择开始叫牌的玩家
    this.currentPlayer = Math.floor(Math.random() * 3);
    this._notifyState();
  }

  /**
   * 处理叫分
   * @param {number} playerIndex - 玩家索引
   * @param {number} score - 叫分 (0=不叫, 1=1分, 2=2分, 3=3分)
   */
  handleBid(playerIndex, score) {
    if (this.phase !== 'bidding') return false;
    if (playerIndex !== this.currentPlayer) return false;
    
    this.bidHistory.push({ player: playerIndex, score });
    this.bidCount++;
    
    // 如果叫了3分，直接成为地主
    if (score === 3) {
      this._setLandlord(playerIndex);
      return true;
    }
    
    // 检查是否所有人都叫过了
    if (this.bidCount >= 3) {
      // 找最高分
      const maxBid = this.bidHistory.reduce((max, b) => b.score > max.score ? b : max, { score: 0 });
      if (maxBid.score > 0) {
        this._setLandlord(maxBid.player);
      } else {
        // 没人叫地主，重新发牌
        this._notifyState();
        setTimeout(() => this.startGame(), 500);
        return true;
      }
      return true;
    }
    
    // 下一家
    this.currentPlayer = (this.currentPlayer + 1) % 3;
    this._notifyState();
    return true;
  }

  /**
   * 设置地主
   */
  _setLandlord(playerIndex) {
    this.landlord = playerIndex;
    this.players[playerIndex].isLandlord = true;
    this.players[playerIndex].role = 'landlord';
    
    // 地主获得底牌
    this.players[playerIndex].hand = sortCards([...this.players[playerIndex].hand, ...this.landlordCards]);
    
    this.phase = 'playing';
    this.currentPlayer = playerIndex;
    this.lastPlay = null;
    this.lastPlayer = -1;
    this.passCount = 0;
    
    this._notifyState();
    
    if (this.onBidEnd) {
      this.onBidEnd(playerIndex);
    }
  }

  /**
   * 处理出牌
   * @param {number} playerIndex - 玩家索引
   * @param {Array} cards - 出的牌
   * @returns {boolean} 是否合法
   */
  handlePlay(playerIndex, cards) {
    if (this.phase !== 'playing') return false;
    if (playerIndex !== this.currentPlayer) return false;
    
    const isPass = !cards || cards.length === 0;
    
    if (isPass) {
      // 不能过牌（上一轮是自己出的，或者没人出牌）
      if (this.lastPlayer === playerIndex || this.lastPlayer === -1) {
        return false;
      }
      this.passCount++;
      this._notifyState();
      this._nextPlayer();
      return true;
    }
    
    // 验证牌是否在手牌中
    const handCopy = [...this.players[playerIndex].hand];
    for (const card of cards) {
      const idx = handCopy.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (idx === -1) return false;
      handCopy.splice(idx, 1);
    }
    
    // 检测牌型
    const type = detectType(cards);
    if (!type) return false;
    
    // 检查是否能管上
    const lastPlayObj = this.lastPlayer === playerIndex ? null : this.lastPlay;
    if (lastPlayObj && lastPlayObj.player !== playerIndex) {
      const lastPlayInfo = { cards: lastPlayObj.cards, type: lastPlayObj.type, rank: lastPlayObj.rank, length: lastPlayObj.length };
      if (!canBeat(cards, lastPlayInfo)) return false;
    }
    
    // 出牌合法，更新状态
    this.players[playerIndex].hand = handCopy;
    this.lastPlay = {
      player: playerIndex,
      cards: cards,
      type: type.type,
      rank: type.rank,
      length: type.length
    };
    this.lastPlayer = playerIndex;
    this.passCount = 0;
    this.playHistory.push({ player: playerIndex, cards, type: type.type });
    
    this._notifyState();
    
    // 检查是否出完
    if (this.players[playerIndex].hand.length === 0) {
      this.phase = 'ended';
      this.winner = playerIndex;
      this.settleScores(playerIndex);
      this._notifyState();
      if (this.onGameEnd) {
        this.onGameEnd(playerIndex);
      }
      return true;
    }
    
    this._nextPlayer();
    return true;
  }

  /**
   * 从 localStorage 读取持久化积分（跨"再来一局"重载保留）；无记录则首次 1000
   * @returns {Array<number>} 三个玩家的积分
   */
  _loadScores() {
    try {
      const raw = localStorage.getItem('doudizhu_scores');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 3) {
          return arr.map(v => (typeof v === 'number' ? v : 1000));
        }
      }
    } catch (e) { /* localStorage 不可用则默认 1000 */ }
    return [1000, 1000, 1000];
  }

  /**
   * 保存当前积分到 localStorage
   */
  _saveScores() {
    try {
      localStorage.setItem('doudizhu_scores', JSON.stringify(this.players.map(p => p.score)));
    } catch (e) { /* 忽略持久化失败 */ }
  }

  /**
   * 结算积分（经典斗地主规则，可扣为负值）
   * 底分按叫分倍数：地主赢 +2×倍数，农民各 -1×倍数；地主输 -2×倍数，农民各 +1×倍数
   * 记录每个玩家的本局积分变化到 scoreDelta（供 UI 显示）
   * @param {number} winnerIndex - 赢家索引
   */
  settleScores(winnerIndex) {
    if (this.landlord === -1) return;
    // 叫分倍数：取本局最高叫分（1/2/3），无叫分则 1
    let multiplier = 1;
    if (this.bidHistory && this.bidHistory.length > 0) {
      multiplier = Math.max(...this.bidHistory.map(b => b.score));
      if (multiplier < 1) multiplier = 1;
    }
    const landlordWon = winnerIndex === this.landlord;
    this.scoreDelta = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let delta;
      if (i === this.landlord) {
        delta = landlordWon ? 2 * multiplier : -2 * multiplier;
      } else {
        delta = landlordWon ? -1 * multiplier : 1 * multiplier;
      }
      this.players[i].score += delta;
      this.scoreDelta[i] = delta;
    }
    this._saveScores();
  }

  /**
   * 下一个玩家
   */
  _nextPlayer() {
    this.currentPlayer = (this.currentPlayer + 1) % 3;
    
    // 如果已经有两人过牌，且上一手出牌的人是自己，清空 lastPlay
    if (this.passCount >= 2) {
      this.lastPlayer = this.currentPlayer;
      this.lastPlay = null;
      this.passCount = 0;
    }
    
    this._notifyState();
  }

  /**
   * 获取当前状态快照
   */
  getState() {
    return {
      players: this.players.map(p => ({
        name: p.name,
        handCount: p.hand.length,
        hand: p.hand,
        isLandlord: p.isLandlord,
        role: p.role,
        avatar: p.avatar,
        personality: p.personality,
        voice: p.voice,
        tag: p.tag,
        charId: p.charId,
        score: p.score
      })),
      landlordCards: this.landlordCards,
      currentPlayer: this.currentPlayer,
      lastPlay: this.lastPlay,
      lastPlayer: this.lastPlayer,
      phase: this.phase,
      bidHistory: this.bidHistory,
      landlord: this.landlord,
      winner: this.winner,
      scoreDelta: this.scoreDelta,
      isCurrentPlayerHuman: this.currentPlayer === 0 && this.phase === 'playing'
    };
  }

  /**
   * 获取当前可出的牌（用于提示）
   */
  getValidPlays() {
    if (this.phase !== 'playing') return [];
    const hand = this.players[this.currentPlayer].hand;
    const lastPlay = this.lastPlayer === this.currentPlayer ? null : this.lastPlay;
    return findValidPlays(hand, lastPlay);
  }

  /**
   * 通知状态变更
   */
  _notifyState() {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}