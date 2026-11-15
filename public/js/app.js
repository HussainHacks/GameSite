/**
 * Neon Arcade // Main Cyberpunk Game Portal Engine
 * Handles rendering, routing (/game/:id), instant search, category filtering,
 * favorites, local play tracking, game player modal with loading/error states,
 * virtual gamepad, and Web Audio SFX.
 */

(function() {
  'use strict';

  // Safe Storage wrapper
  const storage = window.safeStorage || {
    getItem(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch(e) {} }
  };

  // State
  let currentCategory = 'all';
  let searchQuery = '';
  let activeQuickFilter = null;
  let sortBy = 'popular';

  let favorites = [];
  try { favorites = JSON.parse(storage.getItem('neon_favs') || '[]'); } catch(e) { favorites = []; }
  let recentGames = [];
  try { recentGames = JSON.parse(storage.getItem('neon_recent') || '[]'); } catch(e) { recentGames = []; }
  let playCounts = {};
  try { playCounts = JSON.parse(storage.getItem('neon_arcade_plays') || '{}'); } catch(e) { playCounts = {}; }

  let soundEnabled = storage.getItem('neon_sound') !== 'false';
  let activeGame = null;
  let lastFocusedElement = null;
  let virtualGamepadInstance = null;
  let launchTimeoutTimer = null;
  let lastLaunchGameId = null;
  let lastLaunchTime = 0;

  // Allowed external domains for iframe security
  const ALLOWED_EXTERNAL_ORIGINS = [
    'https://octokatherine.github.io',
    'https://ellisonleao.github.io'
  ];

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

  // Loading & Error Elements
  const modalLoader = document.getElementById('modalLoader');
  const loaderTitle = document.getElementById('loaderTitle');
  const modalError = document.getElementById('modalError');
  const modalErrorMsg = document.getElementById('modalErrorMsg');
  const modalRetryBtn = document.getElementById('modalRetryBtn');
  const modalReturnBtn = document.getElementById('modalReturnBtn');

  // Web Audio Synth for Cyber SFX
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    return audioCtx;
  }

  function playCyberSound(type = 'click') {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.05);
      } else if (type === 'open') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.14);
      } else if (type === 'fav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.07);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.15);
      }
    } catch (e) {}
  }

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

  // Get Play Count for a Game
  function getGamePlays(id) {
    return playCounts[id] || 0;
  }

  // Record an actual Game Play
  function recordGamePlay(id) {
    try {
      const now = Date.now();
      if (lastLaunchGameId === id && (now - lastLaunchTime) < 3000) {
        return; // Prevent duplicate counts on quick refresh/reopen
      }
      lastLaunchGameId = id;
      lastLaunchTime = now;
      playCounts[id] = (playCounts[id] || 0) + 1;
      storage.setItem('neon_arcade_plays', JSON.stringify(playCounts));
    } catch (e) {}
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
      list = list.filter(g => !g.isExternal && !!g.localUrl);
    }

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'added') {
        return (b.addedAt || '').localeCompare(a.addedAt || '');
      }
      if (sortBy === 'favorites') {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return a.title.localeCompare(b.title);
      }
      // Default: 'popular' by actual local play counts
      const aPlays = getGamePlays(a.id);
      const bPlays = getGamePlays(b.id);
      if (bPlays !== aPlays) return bPlays - aPlays;
      return a.title.localeCompare(b.title);
    });

    return list;
  }

  // Update Dynamic Counts across Navigation & Header
  function updateDynamicCounts() {
    const catalog = window.GAMES_CATALOG || [];
    const totalCount = catalog.length;

    const headerGameCount = document.getElementById('headerGameCount');
    if (headerGameCount) headerGameCount.textContent = totalCount;

    const allCoresCount = document.getElementById('allCoresCount');
    if (allCoresCount) allCoresCount.textContent = `(${totalCount})`;

    // Category counts
    const catMap = {};
    catalog.forEach(g => {
      catMap[g.category] = (catMap[g.category] || 0) + 1;
    });

    const arcadeEl = document.getElementById('arcadeCount');
    if (arcadeEl) arcadeEl.textContent = `(${catMap['arcade'] || 0})`;
    const puzzleEl = document.getElementById('puzzleCount');
    if (puzzleEl) puzzleEl.textContent = `(${catMap['puzzle'] || 0})`;
    const actionEl = document.getElementById('actionCount');
    if (actionEl) actionEl.textContent = `(${catMap['action'] || 0})`;
    const boardEl = document.getElementById('boardCount');
    if (boardEl) boardEl.textContent = `(${catMap['board'] || 0})`;
    const casualEl = document.getElementById('casualCount');
    if (casualEl) casualEl.textContent = `(${catMap['casual'] || 0})`;

    if (searchInput) {
      searchInput.placeholder = `Search ${totalCount} verified cyber games, tags, or genres...`;
    }
  }

  // Render Games Grid
  let isFirstGridMount = true;
  function renderGrid() {
    const games = getFilteredGames();
    if (gamesCountEl) gamesCountEl.textContent = `${games.length} GAMES ONLINE`;
    if (favCountBadge) favCountBadge.textContent = favorites.length;

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
      const card = document.createElement('article');
      card.className = 'game-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Play ${game.title}`);
      if (isFirstGridMount) {
        card.classList.add('card-mount-anim');
        const staggerIdx = Math.min(index, 12);
        card.style.animationDelay = `${staggerIdx * 35}ms`;
      }
      card.dataset.id = game.id;

      const isFav = favorites.includes(game.id);
      const thumbSrc = game.thumbnail || '/assets/thumbs/fallback.svg';
      const plays = getGamePlays(game.id);

      card.innerHTML = `
        <div class="game-thumb-wrapper">
          <img src="${thumbSrc}" loading="lazy" class="game-thumb-img" alt="${game.title}"
               onerror="this.onerror=null; this.src='/assets/thumbs/fallback.svg';"
               onload="this.classList.add('loaded')">
          <div class="card-badges">
            <span class="badge-tag badge-${game.category}">${game.category}</span>
            <span class="badge-tag" style="color: #fcee0a; border-color: #fcee0a;">${game.license}</span>
          </div>
          <div class="badge-touch">${game.touchNative ? '👆 Touch' : '🎮 D-Pad'}</div>
          <button class="card-fav-btn ${isFav ? 'is-fav' : ''}" data-id="${game.id}" title="Toggle Favorite" aria-label="Favorite ${game.title}" type="button">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <div class="game-info">
          <div class="game-title" title="${game.title}">${game.title}</div>
          <div class="game-meta">
            <span class="plays-val">⚡ ${plays} plays</span>
          </div>
        </div>
      `;

      const imgEl = card.querySelector('.game-thumb-img');
      if (imgEl && imgEl.complete) {
        imgEl.classList.add('loaded');
      }

      // Card click / Enter / Space opens game
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-fav-btn')) return;
        launchGame(game);
      });

      card.addEventListener('keydown', (e) => {
        if (e.target.closest('.card-fav-btn')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          launchGame(game);
        }
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
    try {
      storage.setItem('neon_favs', JSON.stringify(favorites));
    } catch (e) {}
    playCyberSound('fav');
    renderGrid();
  }

  // Launch Game in Modal Player
  function launchGame(game, updateHistory = true) {
    if (!game) return;
    activeGame = game;
    lastFocusedElement = document.activeElement;
    playCyberSound('open');

    // Record real launch play count
    recordGamePlay(game.id);

    // Add to recent
    try {
      recentGames = [game.id, ...recentGames.filter(x => x !== game.id)].slice(0, 30);
      storage.setItem('neon_recent', JSON.stringify(recentGames));
    } catch (e) {}

    // Update URL routing
    if (updateHistory) {
      try {
        history.pushState({ gameId: game.id }, `${game.title} - Neon Arcade`, `/game/${game.id}`);
      } catch (e) {
        // Fallback for sandboxed frames or hash routing
        window.location.hash = `game=${game.id}`;
      }
    }
    document.title = `${game.title} // NEON ARCADE`;

    // Populate modal metadata
    modalGameTitle.textContent = game.title;
    modalGameMeta.textContent = `${game.category.toUpperCase()} // ${game.license} LICENSE // BY ${game.author.toUpperCase()}`;
    modalInstructions.textContent = game.instructions;
    modalSourceLink.href = game.sourceUrl;
    modalLicense.textContent = `${game.license} Open Source`;

    // Security check and sandbox configuration
    let playUrl;
    if (game.isExternal) {
      // Validate external URL origin
      const isValidOrigin = ALLOWED_EXTERNAL_ORIGINS.some(allowed => game.embedUrl && game.embedUrl.startsWith(allowed));
      if (!isValidOrigin) {
        showLaunchError('Security violation: External game origin is not whitelisted.');
        return;
      }
      playUrl = game.embedUrl;
      // Stricter sandbox for external untrusted embeds: NO allow-same-origin!
      modalIframe.setAttribute('sandbox', 'allow-scripts');
    } else {
      playUrl = game.localUrl || `/games/snake/index.html`;
      // Safe sandbox for local first-party games
      modalIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    }

    // Check offline capability
    if (!navigator.onLine && game.isExternal) {
      showLaunchError('OFFLINE MODE: This external core requires an active internet connection.');
      return;
    }

    // Show loading state
    showLoadingState(game.title);

    // Reset iframe opacity while loading
    modalIframe.style.opacity = '0';
    modalIframe.src = playUrl;

    // Launch timeout handler (8 seconds)
    clearTimeout(launchTimeoutTimer);
    launchTimeoutTimer = setTimeout(() => {
      if (modalLoader && !modalLoader.classList.contains('hidden')) {
        showLaunchError('Game launch timed out. Connection compromised or core unresponsive.');
      }
    }, 8000);

    // Iframe load listener
    modalIframe.onload = () => {
      clearTimeout(launchTimeoutTimer);
      hideLoadingState();
      modalIframe.style.opacity = '1';
      focusIframe();
    };

    modalIframe.onerror = () => {
      clearTimeout(launchTimeoutTimer);
      showLaunchError('Failed to load game assets.');
    };

    // Check favorite status for modal
    const isFav = favorites.includes(game.id);
    updateModalFavButton(isFav);

    // Virtual Gamepad handling
    if (!virtualGamepadInstance) {
      virtualGamepadInstance = new window.VirtualGamepad('virtualGamepad');
    }
    virtualGamepadInstance.setIframeTarget(modalIframe);

    // Show gamepad if needed
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
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Move focus into player
    focusIframe();
  }

  function focusIframe() {
    try {
      modalIframe.focus();
      modalIframe.contentWindow?.focus();
    } catch (e) {}
    setTimeout(() => {
      try {
        modalIframe.focus();
        modalIframe.contentWindow?.focus();
      } catch (e) {}
    }, 150);
  }

  function showLoadingState(title) {
    if (modalLoader) {
      modalLoader.classList.remove('hidden');
      if (loaderTitle) loaderTitle.textContent = `INITIALIZING ${title.toUpperCase()}...`;
    }
    if (modalError) modalError.classList.add('hidden');
  }

  function hideLoadingState() {
    if (modalLoader) modalLoader.classList.add('hidden');
  }

  function showLaunchError(message) {
    hideLoadingState();
    if (modalError) {
      modalError.classList.remove('hidden');
      if (modalErrorMsg) modalErrorMsg.textContent = message;
    }
  }

  // Update Favorite button in Player Modal
  function updateModalFavButton(isFav) {
    if (!modalFavBtn) return;
    const textEl = modalFavBtn.querySelector('.btn-text');
    if (textEl) textEl.textContent = isFav ? 'FAVORITED' : 'FAVORITE';
    modalFavBtn.classList.toggle('active', isFav);
    modalFavBtn.title = isFav ? 'Favorited' : 'Favorite Game';
  }

  // Close Game Player Modal
  function closeGame(updateHistory = true) {
    clearTimeout(launchTimeoutTimer);
    gameModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    modalIframe.src = 'about:blank';
    hideLoadingState();
    if (modalError) modalError.classList.add('hidden');
    activeGame = null;
    playCyberSound('click');

    // Restore page title and URL
    document.title = 'NEON ARCADE // Cyberpunk Web Gaming Portal';
    if (updateHistory) {
      try {
        history.pushState({}, 'Neon Arcade', '/');
      } catch (e) {
        window.location.hash = '';
      }
    }

    // Restore focus to triggering card
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  // Retry Launch Button
  modalRetryBtn?.addEventListener('click', () => {
    if (activeGame) {
      launchGame(activeGame, false);
    }
  });

  // Return to Arcade Button
  modalReturnBtn?.addEventListener('click', () => {
    closeGame();
  });

  // Event Listeners for Categories
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
    storage.setItem('neon_sound', soundEnabled);
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    playCyberSound('click');
  });
  soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';

  // Game Player Modal Actions
  modalBackBtn.addEventListener('click', () => closeGame(true));

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

  // Fullscreen button
  modalFullscreenBtn.addEventListener('click', () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (!isFs) {
      const req = gameModal.requestFullscreen || gameModal.webkitRequestFullscreen || gameModal.mozRequestFullScreen || gameModal.msRequestFullscreen;
      if (req) {
        try {
          const promise = req.call(gameModal);
          if (promise && promise.catch) {
            promise.catch(() => showToast('Fullscreen unavailable in this context'));
          }
        } catch (e) {
          showToast('Fullscreen unavailable in this context');
        }
      } else {
        showToast('Fullscreen unavailable in this context');
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) {
        try { exit.call(document); } catch (e) {}
      }
    }
  });

  // Fullscreen state change
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      modalFullscreenBtn.classList.toggle('active', isFs);
    });
  });

  // Share button with exact Game URL
  modalShareBtn.addEventListener('click', async () => {
    if (!activeGame) return;
    const shareUrl = `${window.location.origin}/game/${activeGame.id}`;
    const shareData = {
      title: `${activeGame.title} - Neon Arcade`,
      text: `Play ${activeGame.title} on Neon Arcade!`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('Direct game link shared');
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
      showToast('Game link copied to clipboard');
    } catch (e) {
      showToast('Game link copied');
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

  // Keyboard navigation & ESC to close modal
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && gameModal.classList.contains('active')) {
      closeGame(true);
    }
  });

  // Handle Browser Back / Forward History Navigation
  window.addEventListener('popstate', (e) => {
    const path = window.location.pathname;
    const match = path.match(/^\/game\/([a-z0-9-]+)\/?$/i);
    const hashMatch = window.location.hash.match(/^#game=([a-z0-9-]+)/i);
    const gameId = (match && match[1]) || (hashMatch && hashMatch[1]);

    if (gameId) {
      const game = (window.GAMES_CATALOG || []).find(g => g.id === gameId);
      if (game) {
        launchGame(game, false);
      } else {
        closeGame(false);
      }
    } else {
      if (gameModal.classList.contains('active')) {
        closeGame(false);
      }
    }
  });

  // Initial Route Check (Launch game if URL points to /game/:id or #game=id)
  function handleInitialRoute() {
    const path = window.location.pathname;
    const match = path.match(/^\/game\/([a-z0-9-]+)\/?$/i);
    const hashMatch = window.location.hash.match(/^#game=([a-z0-9-]+)/i);
    const params = new URLSearchParams(window.location.search);
    const queryGameId = params.get('game');
    const targetGameId = (match && match[1]) || (hashMatch && hashMatch[1]) || queryGameId;

    if (targetGameId) {
      const game = (window.GAMES_CATALOG || []).find(g => g.id === targetGameId);
      if (game) {
        launchGame(game, false);
      } else {
        showToast(`CORE NOT FOUND // Game '${targetGameId}' does not exist.`);
        try { history.replaceState({}, '', '/'); } catch(e) {}
      }
    }
  }

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

  // Initialize
  updateDynamicCounts();
  renderGrid();
  handleInitialRoute();
})();
