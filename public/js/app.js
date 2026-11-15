/**
 * Neon Arcade // Main Cyberpunk Game Portal Engine
 * Handles rendering, instant search, category filtering, favorites,
 * dynamic cyberpunk thumbnail generation, game player modal, and Web Audio SFX.
 */

(function() {
  'use strict';

  // State
  let currentCategory = 'all';
  let searchQuery = '';
  let activeQuickFilter = null;
  let sortBy = 'popular';
  let favorites = JSON.parse(localStorage.getItem('neon_favs') || '[]');
  let recentGames = JSON.parse(localStorage.getItem('neon_recent') || '[]');
  let soundEnabled = localStorage.getItem('neon_sound') !== 'false';
  let activeGame = null;
  let virtualGamepadInstance = null;

  // DOM Elements
  const gamesGrid = document.getElementById('gamesGrid');
  const gamesCountEl = document.getElementById('gamesCount');
  const categoryPills = document.querySelectorAll('.cat-pill');
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const sortSelect = document.getElementById('sortSelect');
  const filterChips = document.querySelectorAll('.filter-chip');
  const favCountBadge = document.getElementById('favCountBadge');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  // Game Player Modal Elements
  const gameModal = document.getElementById('gameModal');
  const modalBackBtn = document.getElementById('modalBackBtn');
  const modalGameTitle = document.getElementById('modalGameTitle');
  const modalGameMeta = document.getElementById('modalGameMeta');
  const modalIframe = document.getElementById('modalIframe');
  const modalFullscreenBtn = document.getElementById('modalFullscreenBtn');
  const modalShareBtn = document.getElementById('modalShareBtn');
  const modalFavBtn = document.getElementById('modalFavBtn');
  const modalGamepadBtn = document.getElementById('modalGamepadBtn');
  const modalSourceLink = document.getElementById('modalSourceLink');
  const modalLicense = document.getElementById('modalLicense');
  const modalInstructions = document.getElementById('modalInstructions');

  // Web Audio Synth for Cyber SFX
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playCyberSound(type = 'click') {
    if (!soundEnabled) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.05);
      } else if (type === 'open') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.14);
      } else if (type === 'fav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.07);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.15);
      }
    } catch (e) {}
  }

  // Draw Unique Cyberpunk Canvas Art for Each Game
  function renderCyberThumbnail(canvas, game) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0b16');
    grad.addColorStop(1, '#14182b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Category / Game Icon Glyph Art
    const color = game.color || '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    const cx = w / 2;
    const cy = h / 2 - 8;

    if (game.category === 'arcade') {
      // Alien / Retro arcade craft
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx + 24, cy + 14);
      ctx.lineTo(cx, cy + 8);
      ctx.lineTo(cx - 24, cy + 14);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(cx - 3, cy - 2, 6, 6);
    } else if (game.category === 'puzzle') {
      // Interlocking neural nodes
      ctx.strokeRect(cx - 20, cy - 14, 18, 18);
      ctx.strokeRect(cx + 2, cy - 4, 18, 18);
      ctx.fillRect(cx - 14, cy - 8, 6, 6);
      ctx.fillRect(cx + 8, cy + 2, 6, 6);
    } else if (game.category === 'action') {
      // Lightning bolt / blade
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 22);
      ctx.lineTo(cx - 14, cy);
      ctx.lineTo(cx + 2, cy);
      ctx.lineTo(cx - 4, cy + 22);
      ctx.lineTo(cx + 14, cy + 2);
      ctx.lineTo(cx - 2, cy + 2);
      ctx.closePath();
      ctx.stroke();
    } else if (game.category === 'casual') {
      // Pulsing energy star
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i * Math.PI) / 4);
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.restore();
      }
    } else if (game.category === 'board') {
      // Checkered tactical matrix
      ctx.strokeRect(cx - 18, cy - 18, 36, 36);
      ctx.fillRect(cx - 18, cy - 18, 18, 18);
      ctx.fillRect(cx, cy, 18, 18);
    } else if (game.category === 'racing') {
      // Dual speed trails & horizon
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy + 18);
      ctx.lineTo(cx, cy - 18);
      ctx.lineTo(cx + 28, cy + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 10, 0, Math.PI, true);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Game Title text at bottom of thumbnail
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#000';
    const shortTitle = game.title.split(':')[0].toUpperCase();
    ctx.fillText(shortTitle, cx, h - 12);
  }

  // Filter & Sort Logic
  function getFilteredGames() {
    const catalog = window.GAMES_CATALOG || [];
    let list = catalog;

    // Category Filter
    if (currentCategory === 'favorites') {
      list = list.filter(g => favorites.includes(g.id));
    } else if (currentCategory === 'recent') {
      list = list.filter(g => recentGames.includes(g.id));
    } else if (currentCategory !== 'all') {
      list = list.filter(g => g.category.toLowerCase() === currentCategory.toLowerCase());
    }

    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        (g.tags && g.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Quick Filters
    if (activeQuickFilter === 'touch') {
      list = list.filter(g => g.touchNative === true);
    } else if (activeQuickFilter === 'local') {
      list = list.filter(g => !!g.localUrl);
    }

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      // Popular (default by plays)
      const aPlays = typeof a.plays === 'number' ? a.plays : 0;
      const bPlays = typeof b.plays === 'number' ? b.plays : 0;
      return bPlays - aPlays;
    });

    return list;
  }

  // Update Dynamic Counts
  function updateDynamicCounts() {
    const totalCount = (window.GAMES_CATALOG || []).length;
    const headerGameCount = document.getElementById('headerGameCount');
    if (headerGameCount) headerGameCount.textContent = totalCount;
    const allCoresCount = document.getElementById('allCoresCount');
    if (allCoresCount) allCoresCount.textContent = `(${totalCount})`;
    if (searchInput) searchInput.placeholder = `Search ${totalCount} verified cyber games, tags, or genres...`;
  }

  // Render Games Grid
  let isFirstGridMount = true;
  function renderGrid() {
    const games = getFilteredGames();
    gamesCountEl.textContent = `${games.length} GAMES ONLINE`;
    favCountBadge.textContent = favorites.length;

    if (games.length === 0) {
      gamesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>NO CYBER CORES DETECTED</h3>
          <p>No games matched your current matrix search. Try clearing filters.</p>
        </div>
      `;
      return;
    }

    gamesGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    games.forEach((game, index) => {
      const card = document.createElement('div');
      card.className = 'game-card';
      if (isFirstGridMount) {
        card.classList.add('card-mount-anim');
        const staggerIdx = Math.min(index, 12);
        card.style.animationDelay = `${staggerIdx * 35}ms`;
      }
      card.dataset.id = game.id;

      const isFav = favorites.includes(game.id);
      const hasRealThumb = !!(game.thumbnail && game.thumbnailStatus === 'present');
      const thumbMarkup = hasRealThumb
        ? `<img src="${game.thumbnail}" loading="lazy" class="game-thumb-img" alt="${game.title}" onload="this.classList.add('loaded')">`
        : `<canvas class="game-thumb-canvas" width="220" height="138"></canvas>`;

      card.innerHTML = `
        <div class="game-thumb-wrapper">
          ${thumbMarkup}
          <div class="card-badges">
            <span class="badge-tag badge-${game.category}">${game.category}</span>
            <span class="badge-tag" style="color: #fcee0a; border-color: #fcee0a;">${game.license}</span>
          </div>
          <div class="badge-touch">${game.touchNative ? '👆 Touch' : '🎮 D-Pad'}</div>
          <button class="card-fav-btn ${isFav ? 'is-fav' : ''}" data-id="${game.id}" title="Toggle Favorite">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <div class="game-info">
          <div class="game-title" title="${game.title}">${game.title}</div>
          <div class="game-meta">
            <span class="plays-val">⚡ ${game.plays} plays</span>
          </div>
        </div>
      `;

      if (hasRealThumb) {
        const imgEl = card.querySelector('.game-thumb-img');
        if (imgEl && imgEl.complete) {
          imgEl.classList.add('loaded');
        }
      }

      // Render canvas thumbnail only if real thumbnail is missing
      if (!hasRealThumb) {
        const canvasEl = card.querySelector('.game-thumb-canvas');
        if (canvasEl) renderCyberThumbnail(canvasEl, game);
      }

      // Card click opens game
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-fav-btn')) return;
        launchGame(game);
      });

      // Fav button click
      const favBtn = card.querySelector('.card-fav-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(game.id);
      });

      fragment.appendChild(card);
    });

    gamesGrid.appendChild(fragment);
    isFirstGridMount = false;
  }

  // Toggle Favorite
  function toggleFavorite(id) {
    if (favorites.includes(id)) {
      favorites = favorites.filter(x => x !== id);
    } else {
      favorites.push(id);
    }
    localStorage.setItem('neon_favs', JSON.stringify(favorites));
    playCyberSound('fav');
    renderGrid();
  }

  // Launch Game in Modal Player
  function launchGame(game) {
    activeGame = game;
    playCyberSound('open');

    // Add to recent
    recentGames = [game.id, ...recentGames.filter(x => x !== game.id)].slice(0, 30);
    localStorage.setItem('neon_recent', JSON.stringify(recentGames));

    modalGameTitle.textContent = game.title;
    modalGameMeta.textContent = `${game.category.toUpperCase()} // ${game.license} LICENSE // BY ${game.author.toUpperCase()}`;
    modalInstructions.textContent = game.instructions;
    modalSourceLink.href = game.sourceUrl;
    modalLicense.textContent = `${game.license} Open Source`;

    // Target playable URL (prioritize localUrl, fallback to embedUrl)
    const playUrl = game.localUrl || game.embedUrl || `/games/snake/index.html`;
    modalIframe.src = playUrl;

    // Check favorite status for modal
    const isFav = favorites.includes(game.id);
    updateModalFavButton(isFav);

    // Virtual Gamepad handling
    if (!virtualGamepadInstance) {
      virtualGamepadInstance = new window.VirtualGamepad('virtualGamepad');
    }
    virtualGamepadInstance.setIframeTarget(modalIframe);

    // If mobile or needsTouchOverlay, show gamepad
    if (window.innerWidth <= 768 && game.needsTouchOverlay) {
      virtualGamepadInstance.show();
      modalGamepadBtn.classList.add('active');
    } else {
      virtualGamepadInstance.hide();
      modalGamepadBtn.classList.remove('active');
    }

    // Reset modal scroll position to top
    gameModal.scrollTop = 0;

    gameModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus iframe immediately upon load so keyboard works without first click
    modalIframe.onload = () => {
      try {
        modalIframe.focus();
        modalIframe.contentWindow?.focus();
      } catch (e) {
        // Cross-origin embed restrictions
      }
    };
    try {
      modalIframe.focus();
      modalIframe.contentWindow?.focus();
    } catch (e) {}
    setTimeout(() => {
      try {
        modalIframe.focus();
        modalIframe.contentWindow?.focus();
      } catch (e) {}
    }, 120);
  }

  // Update Favorite button in Player Modal
  function updateModalFavButton(isFav) {
    const iconEl = modalFavBtn.querySelector('.btn-icon');
    const textEl = modalFavBtn.querySelector('.btn-text');
    if (iconEl && textEl) {
      iconEl.textContent = isFav ? '★' : '☆';
      textEl.textContent = isFav ? 'FAVORITED' : 'FAVORITE';
    } else {
      modalFavBtn.innerHTML = `<span class="btn-icon">${isFav ? '★' : '☆'}</span><span class="btn-text">${isFav ? 'FAVORITED' : 'FAVORITE'}</span>`;
    }
    modalFavBtn.classList.toggle('active', isFav);
    modalFavBtn.title = isFav ? 'Favorited' : 'Favorite Game';
  }

  // Close Game Player Modal
  function closeGame() {
    gameModal.classList.remove('active');
    modalIframe.src = 'about:blank';
    activeGame = null;
    document.body.style.overflow = '';
    playCyberSound('click');
  }

  // Event Listeners
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat;
      playCyberSound('click');
      renderGrid();
    });
  });

  // Search input debounce
  let searchTimer = null;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchQuery = e.target.value;
    searchClearBtn.classList.toggle('visible', !!searchQuery);
    searchTimer = setTimeout(() => {
      renderGrid();
    }, 150);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.classList.remove('visible');
    renderGrid();
  });

  // Quick filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (activeQuickFilter === chip.dataset.filter) {
        activeQuickFilter = null;
        chip.classList.remove('active');
      } else {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeQuickFilter = chip.dataset.filter;
      }
      playCyberSound('click');
      renderGrid();
    });
  });

  sortSelect.addEventListener('change', e => {
    sortBy = e.target.value;
    playCyberSound('click');
    renderGrid();
  });

  // Sound Toggle Button
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('neon_sound', soundEnabled);
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    playCyberSound('click');
  });
  soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';

  // Floating Toast Notification
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('cyberToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Game Player Modal Actions
  modalBackBtn.addEventListener('click', closeGame);

  modalGamepadBtn.addEventListener('click', () => {
    if (virtualGamepadInstance) {
      const isVisible = virtualGamepadInstance.toggle();
      modalGamepadBtn.classList.toggle('active', isVisible);
    }
  });

  modalFavBtn.addEventListener('click', () => {
    if (activeGame) {
      toggleFavorite(activeGame.id);
      const isFav = favorites.includes(activeGame.id);
      updateModalFavButton(isFav);
    }
  });

  // Fullscreen button with vendor prefixes and refusal toast
  modalFullscreenBtn.addEventListener('click', () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (!isFs) {
      const req = gameModal.requestFullscreen || gameModal.webkitRequestFullscreen || gameModal.mozRequestFullScreen || gameModal.msRequestFullscreen;
      if (req) {
        try {
          const promise = req.call(gameModal);
          if (promise && promise.catch) {
            promise.catch(() => {
              showToast('Fullscreen is not available here');
            });
          }
        } catch (e) {
          showToast('Fullscreen is not available here');
        }
      } else {
        showToast('Fullscreen is not available here');
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) {
        try {
          exit.call(document);
        } catch (e) {}
      }
    }
  });

  // Track fullscreen state change
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      modalFullscreenBtn.classList.toggle('active', isFs);
    });
  });

  // Share button with Web Share API and Clipboard fallback
  modalShareBtn.addEventListener('click', async () => {
    if (!activeGame) return;
    const shareUrl = window.location.href;
    const shareData = {
      title: `${activeGame.title} - Neon Arcade`,
      text: `Play ${activeGame.title} on Neon Arcade!`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('Link shared');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      showToast('Link copied');
    } catch (e) {
      showToast('Link copied');
    }
  });

  // Mobile Bottom Navigation
  document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const action = item.dataset.nav;
      playCyberSound('click');

      if (action === 'home') {
        currentCategory = 'all';
        categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'all'));
        renderGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'favorites') {
        currentCategory = 'favorites';
        categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'favorites'));
        renderGrid();
      } else if (action === 'search') {
        searchInput.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // ESC to close modal
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && gameModal.classList.contains('active')) {
      closeGame();
    }
  });

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
      }).catch(err => {
        console.warn('SW registration:', err);
      });
    });
  }

  // PWA Install prompt handling
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'flex';
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaInstallBtn.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }

  // Initialize Dynamic Counts & Initial Grid
  updateDynamicCounts();
  renderGrid();
})();
