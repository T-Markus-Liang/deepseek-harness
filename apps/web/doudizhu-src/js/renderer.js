// ==================== 斗地主 - UI 渲染 ====================

class Renderer {
  constructor() {
    // DOM 缓存
    this.el = {};
    this.el.gameTable = document.getElementById('game-table');
    this.el.playerAreas = [
      document.getElementById('player-0'),
      document.getElementById('player-1'),
      document.getElementById('player-2')
    ];
    this.el.playArea = document.getElementById('play-area');
    this.el.playFront0 = document.getElementById('play-front-0');
    this.el.playFront1 = document.getElementById('play-front-1');
    this.el.playFront2 = document.getElementById('play-front-2');
    this.el.landlordCards = document.getElementById('landlord-cards');
    this.el.handCards = document.getElementById('hand-cards');
    this.el.controls = document.getElementById('controls');
    this.el.bidControls = document.getElementById('bid-controls');
    this.el.gameStatus = document.getElementById('game-status');
    this.el.infoPanel = document.getElementById('info-panel');
    this.el.bgmToggle = document.getElementById('bgm-toggle');
    this.el.restartBtn = document.getElementById('restart-btn');
    this.el.playHistory = document.getElementById('history-list');
    
    // 本局出牌历史
    this._historyCleared = false;
    
    // 当前出牌区显示的牌（player + 牌key），用于判断是否需要更新（pass 时保留旧牌）
    this._displayedPlayKey = null;
    
    // 出牌堆永久累积，不清空（玩家出的牌一直留在桌上，直到新一局/游戏结束才收走）
    this._roundEnded = false;
    
    // 玩家信息DOM
    this.el.playerInfo = [
      this.el.playerAreas[0].querySelector('.player-info'),
      this.el.playerAreas[1].querySelector('.player-info'),
      this.el.playerAreas[2].querySelector('.player-info')
    ];
    
    // 出牌区：中间堆放容器（真实打牌，牌凌乱堆在桌中间）
    this.el.playStack = this.el.playArea.querySelector('#play-stack');
    
    // 回调
    this.onPlay = null;
    this.onPass = null;
    this.onBid = null;
    this.onHint = null;
    
    // 当前选中的牌
    this.selectedIndices = new Set();
    this.currentHand = [];
    
    // 音量滑块
    this.el.bgmVolume = document.getElementById('bgm-volume');
    
    // 绑定事件
    this._bindEvents();
  }

  /**
   * 渲染完整游戏状态
   */
  renderState(state) {
    this.renderPlayerInfo(0, state.players[0]);
    this.renderPlayerInfo(1, state.players[1]);
    this.renderPlayerInfo(2, state.players[2]);
    
    // 新一局开始时清空出牌历史
    if (state.phase === 'bidding') {
      if (!this._historyCleared) {
        this._historyCleared = true;
        this.clearPlayHistory();
      }
    } else {
      this._historyCleared = false;
    }
    
    // 底牌（只有地主确定后才显示）
    if (state.landlord !== -1) {
      this.renderLandlordCards(state.landlordCards, true);
    } else {
      this.renderLandlordCards(state.landlordCards, false);
    }
    
    // 玩家手牌
    this.renderPlayerHand(0, state.players[0].hand, state.currentPlayer === 0);
    
    // 出牌区
    this.renderPlayArea(state);
    
    // 状态消息
    this.updateStatus(state);
    
    // 高亮当前玩家
    this._highlightCurrentPlayer(state.currentPlayer, state.phase);
    
    // 显示叫地主UI
    if (state.phase === 'bidding' && state.currentPlayer === 0) {
      this.showBiddingUI(state);
    } else {
      this.hideBiddingUI();
    }
    
    // 显示/隐藏出牌UI
    if (state.phase === 'playing') {
      const isHuman = state.currentPlayer === 0;
      if (isHuman) {
        const validPlays = this._getValidPlaysForUI(state);
        this.showPlayingUI(validPlays);
      } else {
        this.hidePlayingUI();
      }
    } else {
      this.hidePlayingUI();
    }
    
    // 显示胜利信息
    if (state.phase === 'ended') {
      this.showWinner(state);
    }
  }

  /**
   * 渲染玩家手牌
   */
  renderPlayerHand(playerIndex, cards, isCurrent) {
    if (playerIndex !== 0) return; // 只渲染人类玩家的手牌
    
    this.currentHand = cards;
    const container = this.el.handCards;
    container.innerHTML = '';
    
    if (!cards || cards.length === 0) return;
    
    const sorted = sortCards(cards);
    
    for (let i = 0; i < sorted.length; i++) {
      const card = sorted[i];
      const display = cardDisplay(card);
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.index = i;
      
      if (this.selectedIndices.has(i)) {
        cardEl.classList.add('selected');
      }
      
      const isRed = display.isRed;
      const colorClass = isRed ? 'card-red' : 'card-black';
      
      if (card.suit === 'joker') {
        cardEl.classList.add('card-joker', card.rank === 17 ? 'card-red' : 'card-black');
        cardEl.innerHTML = `
          <div class="card-corner top-left">
            <span class="card-rank">${display.display}</span>
          </div>
          <div class="card-center">${card.rank === 17 ? '🃏👑' : '🃏'}</div>
          <div class="card-corner bottom-right">
            <span class="card-rank">${display.display}</span>
          </div>
        `;
      } else {
        cardEl.innerHTML = `
          <div class="card-corner top-left ${colorClass}">
            <span class="card-rank">${display.display}</span>
            <span class="card-suit">${display.suitSymbol}</span>
          </div>
          <div class="card-center ${colorClass}">${display.suitSymbol}</div>
          <div class="card-corner bottom-right ${colorClass}">
            <span class="card-rank">${display.display}</span>
            <span class="card-suit">${display.suitSymbol}</span>
          </div>
        `;
      }
      
      cardEl.addEventListener('click', () => this._handleCardClick(i));
      cardEl.addEventListener('mouseenter', () => {
        if (!this.selectedIndices.has(i)) {
          cardEl.classList.add('hover');
        }
      });
      cardEl.addEventListener('mouseleave', () => {
        cardEl.classList.remove('hover');
      });
      
      container.appendChild(cardEl);
    }
  }

  /**
   * 渲染出牌区（真实打牌模拟）
   * 一轮内：每家出的牌停留在各自前方展示位（人类=下方/AI-1=右侧/AI-2=左侧），整轮可见；
   * 下一轮开始（两人 pass 触发 lastPlay 清空）时，把上一轮各家面前的牌归入桌子中心散乱牌堆。
   */
  renderPlayArea(state) {
    // 新一局（叫牌阶段）或游戏结束：清空出牌区
    if (state.phase === 'bidding' || state.phase === 'ended') {
      if (this._displayedPlayKey !== null) this.clearPlayArea();
      return;
    }
    const lastPlay = state.lastPlay || null;
    // 新一轮开始（上一轮结束，lastPlay 被清空）：把上一轮各家前方的牌归入中心牌堆
    if (!lastPlay) {
      if (this._roundFrontNotEmpty()) {
        this._collectFrontToStack();
      }
      return;
    }
    const key = this._playKey(lastPlay);
    if (key === this._displayedPlayKey) return; // 已在 animatePlayCards 流程中
    // lastPlay 变化但未经过 animatePlayCards（防御性）：走"前方展示"流程
    this.animatePlayCards(lastPlay.player, lastPlay.cards);
    this._displayedPlayKey = key;
  }

  /**
   * 计算一手牌的唯一标识（用于判断出牌区是否需要更新）
   * 使用排序后的牌，避免出牌顺序差异导致出牌区误重建（牌闪烁）
   */
  _playKey(play) {
    if (!play || !play.cards) return null;
    return play.player + '|' + this._cardsKey(play.cards);
  }

  /**
   * 生成排序后的牌标识（花色→点数）
   */
  _cardsKey(cards) {
    return [...cards]
      .sort((a, b) => (a.suit === b.suit ? a.rank - b.rank : String(a.suit).localeCompare(String(b.suit))))
      .map(c => c.suit + ':' + c.rank).join(',');
  }

  /**
   * 把一手牌凌乱地丢到牌桌中间（真实打牌模拟）
   * 整手牌带随机偏移与旋转；每张牌再带微小的随机偏移/旋转，模拟散落
   */
  _addToStack(playerIndex, cards, type) {
    if (!this.el.playStack || !cards) return;

    // 真实打牌：牌凌乱堆在桌中间。
    // 用行列基础位置（避免全叠成一团不可见）+ 每手大幅随机抖动/旋转（凌乱自然）
    const existing = this.el.playStack.querySelectorAll('.played-hand').length;
    const col = existing % 3;
    const row = Math.floor(existing / 3) % 2;
    const baseX = (col - 1) * 130;         // 列基础偏移：-130 / 0 / +130
    const baseY = (row === 0 ? -35 : 35);  // 行基础偏移：上排 -35 / 下排 +35
    const dx = baseX + (Math.random() - 0.5) * 90;   // 大幅随机抖动 ±45
    const dy = baseY + (Math.random() - 0.5) * 60;   // ±30
    const rot = (Math.random() - 0.5) * 28;          // -14° ~ +14° 随机旋转
    const hand = document.createElement('div');
    hand.className = 'played-hand';
    hand.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) rotate(${rot.toFixed(1)}deg)`;

    const inner = document.createElement('div');
    inner.className = 'played-hand-inner';

    for (const card of cards) {
      const display = cardDisplay(card);
      const isRed = display.isRed;
      const colorClass = isRed ? 'card-red' : 'card-black';
      const cardEl = document.createElement('div');
      cardEl.className = 'card card-small card-animate-in';

      // 每张牌微小的随机偏移与旋转（更凌乱自然）
      const crot = (Math.random() - 0.5) * 14;
      const cx = (Math.random() - 0.5) * 10;
      const cy = (Math.random() - 0.5) * 10;
      cardEl.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) rotate(${crot.toFixed(1)}deg)`;

      if (card.suit === 'joker') {
        cardEl.classList.add('card-joker', card.rank === 17 ? 'card-red' : 'card-black');
        cardEl.innerHTML = `
          <div class="card-corner top-left">
            <span class="card-rank">${display.display}</span>
          </div>
          <div class="card-center">${card.rank === 17 ? '🃏👑' : '🃏'}</div>
        `;
      } else {
        cardEl.innerHTML = `
          <div class="card-corner top-left ${colorClass}">
            <span class="card-rank">${display.display}</span>
            <span class="card-suit">${display.suitSymbol}</span>
          </div>
          <div class="card-center ${colorClass}">${display.suitSymbol}</div>
        `;
      }

      inner.appendChild(cardEl);
    }

    hand.appendChild(inner);

    // 牌型标签（提示出的什么牌型）
    if (type != null) {
      const typeName = getTypeName(type);
      const label = document.createElement('div');
      label.className = 'play-type-label';
      label.textContent = typeName;
      hand.appendChild(label);
    }

    this.el.playStack.appendChild(hand);
  }

  /**
   * 渲染底牌
   */
  renderLandlordCards(cards, showFace) {
    const container = this.el.landlordCards;
    container.innerHTML = '';
    
    if (!cards || cards.length === 0) return;
    
    for (const card of cards) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card card-small';
      
      if (showFace) {
        const display = cardDisplay(card);
        const isRed = display.isRed;
        const colorClass = isRed ? 'card-red' : 'card-black';
        
        if (card.suit === 'joker') {
          cardEl.classList.add('card-joker', card.rank === 17 ? 'card-red' : 'card-black');
          cardEl.innerHTML = `
            <div class="card-corner top-left">
              <span class="card-rank">${display.display}</span>
            </div>
            <div class="card-center">${card.rank === 17 ? '🃏👑' : '🃏'}</div>
          `;
        } else {
          cardEl.innerHTML = `
            <div class="card-corner top-left ${colorClass}">
              <span class="card-rank">${display.display}</span>
              <span class="card-suit">${display.suitSymbol}</span>
            </div>
            <div class="card-center ${colorClass}">${display.suitSymbol}</div>
          `;
        }
      } else {
        cardEl.classList.add('card-back');
        cardEl.innerHTML = '<div class="card-back-pattern">🂠</div>';
      }
      
      container.appendChild(cardEl);
    }
  }

  /**
   * 渲染玩家信息
   */
  renderPlayerInfo(playerIndex, player) {
    const info = this.el.playerInfo[playerIndex];
    if (!info) return;
    
    const roleIcon = player.role === 'landlord' ? '👑' : '🌾';
    const roleText = player.role === 'landlord' ? '地主' : '农民';
    const avatar = player.avatar || (playerIndex === 0 ? '😎' : '🤖');
    const isImage = avatar.startsWith('/') || avatar.startsWith('http');
    const tag = player.tag ? `<span class="player-tag">${player.tag}</span>` : '';
    const score = (typeof player.score === 'number') ? player.score : 1000;
    const scoreClass = score < 0 ? 'score-negative' : '';
    const avatarHtml = isImage
      ? `<img class="player-avatar-img" src="${avatar}" alt="${player.name}" onerror="this.style.display='none'">`
      : avatar;
    
    info.innerHTML = `
      <div class="player-avatar">
        ${avatarHtml}
      </div>
      <div class="player-details">
        <div class="player-name">${player.name} ${tag}</div>
        <div class="player-role">${roleIcon} ${roleText}</div>
        <div class="player-cards-count">剩余: ${player.handCount}张</div>
        <div class="player-score ${scoreClass}">💰 ${score}</div>
      </div>
    `;
  }

  /**
   * 显示叫地主UI
   */
  showBiddingUI(state) {
    const container = this.el.bidControls;
    container.style.display = 'flex';
    container.innerHTML = '';
    
    const title = document.createElement('div');
    title.className = 'bid-title';
    title.textContent = '叫地主';
    container.appendChild(title);
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'bid-buttons';
    
    // 不叫
    const passBtn = document.createElement('button');
    passBtn.className = 'btn btn-pass';
    passBtn.textContent = '不叫';
    passBtn.addEventListener('click', () => {
      if (this.onBid) this.onBid(0);
    });
    buttonsDiv.appendChild(passBtn);
    
    // 1分
    if (state.bidHistory.length === 0 || state.bidHistory.every(b => b.score < 1)) {
      const b1 = document.createElement('button');
      b1.className = 'btn btn-bid';
      b1.textContent = '1分';
      b1.addEventListener('click', () => {
        if (this.onBid) this.onBid(1);
      });
      buttonsDiv.appendChild(b1);
    }
    
    // 2分
    if (state.bidHistory.length === 0 || state.bidHistory.every(b => b.score < 2)) {
      const b2 = document.createElement('button');
      b2.className = 'btn btn-bid';
      b2.textContent = '2分';
      b2.addEventListener('click', () => {
        if (this.onBid) this.onBid(2);
      });
      buttonsDiv.appendChild(b2);
    }
    
    // 3分
    if (state.bidHistory.length === 0 || state.bidHistory.every(b => b.score < 3)) {
      const b3 = document.createElement('button');
      b3.className = 'btn btn-bid-high';
      b3.textContent = '3分';
      b3.addEventListener('click', () => {
        if (this.onBid) this.onBid(3);
      });
      buttonsDiv.appendChild(b3);
    }
    
    container.appendChild(buttonsDiv);
    
    // 显示叫牌历史
    const historyDiv = document.createElement('div');
    historyDiv.className = 'bid-history';
    for (const bid of state.bidHistory) {
      const p = document.createElement('span');
      p.textContent = `${state.players[bid.player].name}: ${bid.score > 0 ? bid.score + '分' : '不叫'}`;
      historyDiv.appendChild(p);
    }
    container.appendChild(historyDiv);
  }

  /**
   * 隐藏叫地主UI
   */
  hideBiddingUI() {
    this.el.bidControls.style.display = 'none';
  }

  /**
   * 显示出牌UI
   */
  showPlayingUI(validPlays) {
    const container = this.el.controls;
    container.style.display = 'flex';
    container.innerHTML = '';
    
    // 出牌按钮
    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-play';
    playBtn.textContent = '出牌';
    playBtn.addEventListener('click', () => {
      if (this.selectedIndices.size === 0) return;
      const selectedCards = this._getSelectedCards();
      if (this.onPlay) this.onPlay(selectedCards);
    });
    container.appendChild(playBtn);
    
    // 不出按钮
    const passBtn = document.createElement('button');
    passBtn.className = 'btn btn-pass';
    passBtn.textContent = '不出';
    passBtn.addEventListener('click', () => {
      if (this.onPass) this.onPass();
    });
    container.appendChild(passBtn);
    
    // 提示按钮
    const hintBtn = document.createElement('button');
    hintBtn.className = 'btn btn-hint';
    hintBtn.textContent = '提示';
    hintBtn.addEventListener('click', () => {
      if (this.onHint) this.onHint();
    });
    container.appendChild(hintBtn);
  }

  /**
   * 隐藏出牌UI
   */
  hidePlayingUI() {
    this.el.controls.style.display = 'none';
  }

  /**
   * 显示消息
   */
  showMessage(text) {
    this.el.gameStatus.textContent = text;
    this.el.gameStatus.classList.add('show');
  }

  /**
   * 显示胜利信息
   */
  showWinner(state) {
    const winner = state.winner;
    if (winner === null) return;
    
    const winnerName = state.players[winner].name;
    const isLandlordWin = state.players[winner].isLandlord;
    const team = isLandlordWin ? '地主' : '农民';
    
    this.showMessage(`🎉 ${winnerName} 获胜！${team}方胜利！🎉`);
    
    // 创建胜利动画
    const overlay = document.createElement('div');
    overlay.className = 'victory-overlay';
    overlay.innerHTML = `
      <div class="victory-content">
        <div class="victory-icon">🏆</div>
        <div class="victory-title">${winnerName} 获胜！</div>
        <div class="victory-team">${team}方赢了！</div>
        <button class="btn btn-restart" onclick="location.reload()">再来一局</button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // 创建彩纸效果
    this._createConfetti();
  }

  /**
   * 更新状态消息
   */
  updateStatus(state) {
    let msg = '';
    
    switch (state.phase) {
      case 'idle':
        msg = '点击"开始游戏"';
        break;
      case 'dealing':
        msg = '发牌中...';
        break;
      case 'bidding': {
        const currentName = state.players[state.currentPlayer].name;
        msg = `叫地主阶段 - ${currentName} 叫分`;
        break;
      }
      case 'playing': {
        const currentName = state.players[state.currentPlayer].name;
        const landlordName = state.landlord !== -1 ? state.players[state.landlord].name : '';
        msg = `${landlordName}是地主 | 当前: ${currentName} 出牌`;
        break;
      }
      case 'ended':
        msg = '游戏结束';
        break;
    }
    
    this.showMessage(msg);
  }

  /**
   * 出牌动画（复刻真实打牌）：
   * 1) 牌出现在出牌者前方（人类=下方 / AI-1=右侧 / AI-2=左侧）展示这一手
   * 2) 整轮停留在各自前方（不清空、不自动消失）
   * 3) 下一轮开始时由 renderPlayArea 统一归入中心散乱牌堆
   */
  animatePlayCards(playerIndex, cards) {
    if (this.el.playStack == null) return;
    
    // 记录到顶部出牌历史
    this.addToHistory(playerIndex, cards);
    
    // 在出牌者前方展示这一手（覆盖该玩家上一轮已归堆的旧牌，只保留当前这手）
    const frontEl = this.el['playFront' + playerIndex];
    if (frontEl) {
      this._showPlayFront(frontEl, cards);
    }
    // 记录已展示，避免 renderPlayArea 重复触发同一手
    this._displayedPlayKey = playerIndex + '|' + this._cardsKey(cards);
  }

  /**
   * 在玩家前方展示位显示这一手牌
   */
  _showPlayFront(frontEl, cards) {
    frontEl.innerHTML = '';
    for (const card of cards) {
      const display = cardDisplay(card);
      const isRed = display.isRed;
      const colorClass = isRed ? 'card-red' : 'card-black';
      const cardEl = document.createElement('div');
      cardEl.className = 'card card-animate-in';
      // 记录牌数据，供新一轮归堆时 _readFrontCards 反解
      cardEl.setAttribute('data-rank', String(card.rank));
      cardEl.setAttribute('data-suit', card.suit);
      if (card.suit === 'joker') {
        cardEl.classList.add('card-joker', card.rank === 17 ? 'card-red' : 'card-black');
        cardEl.innerHTML = `
          <div class="card-corner top-left"><span class="card-rank">${display.display}</span></div>
          <div class="card-center">${card.rank === 17 ? '🃏👑' : '🃏'}</div>
          <div class="card-corner bottom-right"><span class="card-rank">${display.display}</span></div>
        `;
      } else {
        cardEl.innerHTML = `
          <div class="card-corner top-left ${colorClass}">
            <span class="card-rank">${display.display}</span>
            <span class="card-suit">${display.suitSymbol}</span>
          </div>
          <div class="card-center ${colorClass}">${display.suitSymbol}</div>
          <div class="card-corner bottom-right ${colorClass}">
            <span class="card-rank">${display.display}</span>
            <span class="card-suit">${display.suitSymbol}</span>
          </div>
        `;
      }
      frontEl.appendChild(cardEl);
    }
    frontEl.classList.add('show');
  }

  /**
   * 检查是否还有玩家前方展示着本轮的牌
   */
  _roundFrontNotEmpty() {
    for (let i = 0; i < 3; i++) {
      const frontEl = this.el['playFront' + i];
      if (frontEl && frontEl.querySelectorAll('.card').length > 0) return true;
    }
    return false;
  }

  /**
   * 把各家前方展示的牌归入中心散乱牌堆（下一轮开始调用）
   * 依次加入中心堆（随机位置/旋转散乱堆叠），然后清空所有前方展示位
   */
  _collectFrontToStack() {
    for (let i = 0; i < 3; i++) {
      const frontEl = this.el['playFront' + i];
      if (!frontEl) continue;
      const cards = this._readFrontCards(frontEl);
      if (cards.length > 0) {
        const t = detectType(cards);
        this._addToStack(i, cards, t ? t.type : null);
      }
      frontEl.classList.remove('show');
      frontEl.innerHTML = '';
    }
    // 牌堆上限控制
    this._trimStack();
  }

  /**
   * 从前方展示位读取牌数据（从 DOM 反解，补充 display 字段供 cardDisplay 显示）
   */
  _readFrontCards(frontEl) {
    const cards = [];
    const cardEls = frontEl.querySelectorAll('.card');
    for (const el of cardEls) {
      const rank = el.getAttribute('data-rank');
      const suit = el.getAttribute('data-suit');
      if (rank != null && suit != null) {
        const r = parseInt(rank, 10);
        cards.push({ rank: r, suit, display: RANK_DISPLAY[r] || (r === 16 ? '小王' : r === 17 ? '大王' : String(r)) });
      }
    }
    return cards;
  }

  /**
   * 牌堆上限控制：超过 15 手时最旧一手淡出移除
   * （一局最多 3 人 × 手牌 20 张，通常 15-20 手；保留最近 15 手足够看清）
   */
  _trimStack() {
    if (!this.el.playStack) return;
    const MAX_HANDS = 15;
    const hands = this.el.playStack.querySelectorAll('.played-hand');
    if (hands.length <= MAX_HANDS) return;
    const oldest = hands[0];
    oldest.classList.add('played-hand-fade-out');
    oldest.addEventListener('animationend', () => oldest.remove(), { once: true });
    // 兜底：动画未触发也移除
    setTimeout(() => { if (oldest.parentNode) oldest.remove(); }, 700);
  }

  /**
   * 清空出牌区（牌堆 + 玩家前方展示位）
   */
  clearPlayArea() {
    this._displayedPlayKey = null;
    if (this.el.playStack) {
      this.el.playStack.innerHTML = '';
    }
    for (let i = 0; i < 3; i++) {
      const frontEl = this.el['playFront' + i];
      if (frontEl) {
        frontEl.classList.remove('show');
        frontEl.innerHTML = '';
      }
    }
  }

  /**
   * 添加一手牌到顶部出牌历史（明示出过的牌）
   * @param {number} playerIndex - 玩家索引（0=你 1=小呆 2=老胡）
   * @param {Array} cards - 出的牌
   */
  addToHistory(playerIndex, cards) {
    if (!this.el.playHistory || !cards || cards.length === 0) return;
    
    const names = ['你', '小呆', '老胡'];
    const row = document.createElement('div');
    row.className = 'history-row';
    
    const nameEl = document.createElement('span');
    nameEl.className = 'history-player-name';
    nameEl.textContent = names[playerIndex] || ('P' + playerIndex);
    row.appendChild(nameEl);
    
    for (const card of cards) {
      const tiny = document.createElement('span');
      tiny.className = 'card-tiny';
      
      if (card.suit === 'joker') {
        const isBig = card.rank === 17;
        tiny.classList.add(isBig ? 'joker-big' : 'joker-small');
        tiny.textContent = isBig ? '🃏' : '🃏';
      } else {
        const display = cardDisplay(card);
        tiny.classList.add(display.isRed ? 'red' : 'black');
        tiny.textContent = display.display;
      }
      row.appendChild(tiny);
    }
    
    this.el.playHistory.appendChild(row);
    
    // 滚动到最新（保持最右侧/最新可见）
    this.el.playHistory.scrollTop = this.el.playHistory.scrollHeight;
  }

  /**
   * 清空出牌历史（新一局开始时调用）
   */
  clearPlayHistory() {
    if (this.el.playHistory) {
      this.el.playHistory.innerHTML = '';
    }
  }

  /**
   * 高亮提示牌
   */
  highlightHint(cards) {
    // 清除所有选中
    this.selectedIndices.clear();
    
    if (!cards || cards.length === 0) return;
    
    // 在高亮前先清除所有选中
    const cardElements = this.el.handCards.querySelectorAll('.card');
    cardElements.forEach(el => el.classList.remove('selected', 'hint-highlight'));
    
    // 找到这些牌对应的索引并选中
    for (const card of cards) {
      for (let i = 0; i < this.currentHand.length; i++) {
        const hc = this.currentHand[i];
        if (hc.suit === card.suit && hc.rank === card.rank) {
          this.selectedIndices.add(i);
          const cardEl = cardElements[i];
          if (cardEl) {
            cardEl.classList.add('selected', 'hint-highlight');
          }
          break;
        }
      }
    }
  }

  /**
   * 清除高亮
   */
  clearHighlight() {
    this.selectedIndices.clear();
    const cardElements = this.el.handCards.querySelectorAll('.card');
    cardElements.forEach(el => el.classList.remove('selected', 'hint-highlight'));
  }

  /**
   * 绑定事件
   */
  _bindEvents() {
    // BGM 切换（唯一控制入口：右上角按钮）
    // 打开弹窗时的手势解锁（main.js 的 tryStartBGM）负责"默认打开"，
    // 但用户手动关闭(mute)后，此按钮是唯一能重新打开的入口
    this.el.bgmToggle.addEventListener('click', () => {
      // 若 isPlaying 但 AudioContext 实际 suspended（postMessage 自动播放被浏览器拒绝），
      // 真实点击手势下先解锁恢复播放，而不是走 toggle 的关闭分支
      if (isBGMPlaying() && getAudioCtxState() === 'suspended') {
        retryBGMUnlock();
      } else {
        toggleBGM(); // 正常播放中 → 关闭；静音中 → 打开
      }
      this.el.bgmToggle.textContent = isBGMPlaying() ? '🔊 音乐' : '🔇 音乐';
      if (this.el.bgmVolume) {
        this.el.bgmVolume.style.display = isBGMPlaying() ? 'inline-block' : 'none';
      }
    });
    
    // 音量滑块（仅当音乐播放时显示）
    if (this.el.bgmVolume) {
      this.el.bgmVolume.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        setBGMVolume(vol);
      });
    }
    
    // 重新开始
    this.el.restartBtn.addEventListener('click', () => {
      location.reload();
    });
  }

  /**
   * 处理牌点击
   */
  _handleCardClick(index) {
    if (this.selectedIndices.has(index)) {
      this.selectedIndices.delete(index);
    } else {
      this.selectedIndices.add(index);
    }
    
    const cardElements = this.el.handCards.querySelectorAll('.card');
    cardElements.forEach((el, i) => {
      el.classList.remove('hover');
      if (this.selectedIndices.has(i)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  /**
   * 获取选中的牌
   */
  _getSelectedCards() {
    const cards = [];
    for (const idx of this.selectedIndices) {
      if (this.currentHand[idx]) {
        cards.push(this.currentHand[idx]);
      }
    }
    return cards;
  }

  /**
   * 获取UI上有效的牌型
   */
  _getValidPlaysForUI(state) {
    // 通过全局的findValidPlays获取
    const hand = state.players[0].hand;
    const lastPlay = state.lastPlayer === 0 ? null : state.lastPlay;
    return findValidPlays(hand, lastPlay);
  }

  /**
   * 高亮当前玩家
   */
  _highlightCurrentPlayer(playerIndex, phase) {
    for (let i = 0; i < 3; i++) {
      const area = this.el.playerAreas[i];
      if (phase === 'playing' && i === playerIndex) {
        area.classList.add('active-player');
      } else {
        area.classList.remove('active-player');
      }
    }
  }

  /**
   * 获取头像颜色
   */
  _getAvatarColor(index) {
    const colors = ['#4CAF50', '#2196F3', '#FF9800'];
    return colors[index];
  }

  /**
   * 创建彩纸效果
   */
  _createConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#ff0088'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDuration = (2 + Math.random() * 3) + 's';
      confetti.style.animationDelay = Math.random() * 2 + 's';
      confetti.style.width = (5 + Math.random() * 10) + 'px';
      confetti.style.height = (5 + Math.random() * 10) + 'px';
      document.body.appendChild(confetti);
      
      // 自动移除
      setTimeout(() => confetti.remove(), 5000);
    }
  }
}