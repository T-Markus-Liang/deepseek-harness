/**
 * 斗地主 Plugin Injector
 * 每次打开弹窗创建新 iframe，关闭时彻底销毁，避免资源泄漏。
 * 通过 postMessage 向 iframe 传递用户手势，解除音频自动播放限制。
 */
(function() {
  'use strict';

  if (window.__DOUDIZHU_INJECTED) return;
  window.__DOUDIZHU_INJECTED = true;

  let modalOpen = false;
  let modalEl = null;
  let iframeEl = null;
  let fabEl = null;

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
  }

  function closeModal() {
    if (!modalOpen) return;
    modalOpen = false;
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
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