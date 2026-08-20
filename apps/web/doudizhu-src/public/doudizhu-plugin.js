/**
 * 斗地主 Plugin Injector
 * 每次打开弹窗创建新 iframe，关闭时彻底销毁，避免资源泄漏。
 * 通过 postMessage 向 iframe 传递用户手势，解除音频自动播放限制。
 * 背景音乐在父页面播放（FAB 点击 = 真实用户手势，Safari/Chrome 均允许自动播放；
 * iframe 内 AudioContext 在 Safari 下无法通过父页面手势解锁）。
 */
(function() {
  'use strict';

  if (window.__DOUDIZHU_INJECTED) return;
  window.__DOUDIZHU_INJECTED = true;

  let modalOpen = false;
  let modalEl = null;
  let iframeEl = null;
  let fabEl = null;

  // ===== 父页面 BGM 播放器（Safari 自动播放兼容）=====
  let bgmAudio = null;       // HTMLAudioElement（父页面，FAB 手势解锁）
  let bgmVol = 0.35;         // 音量
  let bgmMutedByUser = false; // 用户手动静音（跨会话保留在父页面）

  function bgmInit() {
    if (bgmAudio) return;
    try {
      bgmAudio = new Audio('/dou_dizhu_bgm.mp3');
      bgmAudio.loop = true;
      bgmAudio.volume = bgmVol;
      bgmAudio.preload = 'auto';
    } catch (e) {
      bgmAudio = null;
    }
  }

  function bgmPlaying() {
    return !!bgmAudio && !bgmAudio.paused && !bgmAudio.ended;
  }

  function bgmPostState() {
    try {
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage({ type: 'DOUDIZHU_BGM_STATE', playing: bgmPlaying() && !bgmMutedByUser, volume: bgmVol }, '*');
      }
    } catch (e) {}
  }

  // 启动 BGM。必须在用户手势调用栈内调用（FAB 点击）才能通过自动播放策略。
  function bgmStart() {
    if (bgmMutedByUser) return false;
    bgmInit();
    if (!bgmAudio) return false;
    try {
      const p = bgmAudio.play();
      if (p && p.then) p.then(bgmPostState).catch(() => {});
      else bgmPostState();
      return true;
    } catch (e) {
      return false;
    }
  }

  function bgmStop() {
    if (bgmAudio) {
      try { bgmAudio.pause(); } catch (e) {}
      try { bgmAudio.currentTime = 0; } catch (e) {}
    }
    bgmPostState();
  }

  function bgmToggle() {
    if (bgmPlaying()) {
      bgmStop();
    } else {
      if (bgmMutedByUser) bgmMutedByUser = false; // 用户手动打开 → 解除静音
      bgmStart();
    }
  }

  function bgmSetVolume(v) {
    bgmVol = Math.max(0, Math.min(1, v));
    if (bgmAudio) bgmAudio.volume = bgmVol;
    bgmPostState();
  }

  // iframe → 父页面 BGM 控制
  function onIframeMessage(e) {
    const d = e.data;
    if (!d || d.type !== 'DOUDIZHU_BGM') return;
    switch (d.action) {
      case 'start': bgmStart(); break;
      case 'stop': bgmStop(); break;
      case 'toggle': bgmToggle(); break;
      case 'setVolume': bgmSetVolume(d.volume); break;
      case 'mute': bgmMutedByUser = true; bgmStop(); break;
      case 'unmute': bgmMutedByUser = false; bgmStart(); break;
    }
  }
  window.addEventListener('message', onIframeMessage);

  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #doudizhu-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #fff;
        font-size: 28px;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(255, 215, 0, 0.4);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        animation: doudizhu-fab-appear 0.5s ease-out;
      }
      #doudizhu-fab:hover {
        transform: scale(1.15);
        box-shadow: 0 6px 24px rgba(255, 215, 0, 0.6);
      }
      #doudizhu-fab:active {
        transform: scale(0.95);
      }
      @keyframes doudizhu-fab-appear {
        from { transform: scale(0); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      #doudizhu-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
        align-items: center;
        justify-content: center;
      }
      #doudizhu-modal.open {
        display: flex;
      }
      #doudizhu-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        font-size: 24px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 10001;
        line-height: 1;
      }
      #doudizhu-close:hover {
        background: rgba(255, 80, 80, 0.6);
        border-color: rgba(255, 80, 80, 0.8);
        transform: rotate(90deg);
      }
      #doudizhu-iframe {
        width: 100vw;
        height: 100vh;
        border: none;
        background: #1a1a2e;
      }
      @media (max-width: 768px) {
        #doudizhu-fab {
          bottom: 16px;
          right: 16px;
          width: 48px;
          height: 48px;
          font-size: 24px;
        }
        #doudizhu-close {
          top: 12px;
          right: 12px;
          width: 38px;
          height: 38px;
          font-size: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createFab() {
    if (fabEl) return;
    fabEl = document.createElement('button');
    fabEl.id = 'doudizhu-fab';
    fabEl.textContent = '🃏';
    fabEl.title = '斗地主';
    fabEl.addEventListener('click', openModal);
    document.body.appendChild(fabEl);
  }

  function createModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'doudizhu-modal';
    modalEl.addEventListener('click', function(e) {
      if (e.target === modalEl) closeModal();
    });
    document.body.appendChild(modalEl);
  }

  function createIframe() {
    destroyIframe();

    iframeEl = document.createElement('iframe');
    iframeEl.id = 'doudizhu-iframe';
    iframeEl.src = '/doudizhu.html?_t=' + Date.now();
    iframeEl.title = '斗地主';
    iframeEl.allow = 'autoplay; fullscreen';
    modalEl.appendChild(iframeEl);

    // 把用户手势传进 iframe，解除音频自动播放限制（背景音乐自动播放）
    iframeEl.addEventListener('load', function() {
      try {
        iframeEl.contentWindow.postMessage({ type: 'DOUDIZHU_USER_GESTURE' }, '*');
      } catch(e) {}
    });

    const closeBtn = document.createElement('button');
    closeBtn.id = 'doudizhu-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeModal);
    modalEl.appendChild(closeBtn);
  }

  function destroyIframe() {
    if (iframeEl) {
      if (iframeEl.parentNode) iframeEl.parentNode.removeChild(iframeEl);
      iframeEl.src = '';
      iframeEl = null;
    }
    if (modalEl) {
      while (modalEl.firstChild) modalEl.removeChild(modalEl.firstChild);
    }
  }

  function openModal() {
    if (modalOpen) return;
    modalOpen = true;
    createModal();
    createIframe();
    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
    // 在用户手势调用栈内启动 BGM（父页面 AudioContext/audio 元素，Safari 也允许）
    bgmStart();
  }

  function closeModal() {
    if (!modalOpen) return;
    modalOpen = false;
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
    bgmStop(); // 关闭弹窗停 BGM（下次打开重新播放）
    setTimeout(function() {
      if (!modalOpen) destroyIframe();
    }, 300);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalOpen) closeModal();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createStyles();
      createFab();
    });
  } else {
    createStyles();
    createFab();
  }
})();