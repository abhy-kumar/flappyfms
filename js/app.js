/* ==========================================================================
   APP CONTROLLER - FLAPPY FMS
   --------------------------------------------------------------------------
   Owns every DOM concern: input routing, modal stack, HUD, toasts, settings.
   The engine no longer binds input itself, which is what let the old build
   flap (and even start a run) while a modal was open, and fire two flaps per
   mouse click because both `click` and `pointerdown` were wired up.
   ========================================================================== */

(function () {
  'use strict';

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  ready(() => {
    const $ = (id) => document.getElementById(id);

    /* ------------------------------------------------------------------ */
    /*  ELEMENTS                                                           */
    /* ------------------------------------------------------------------ */
    const canvas = $('game-canvas');

    const scoreVal = $('score-val');
    const bestVal = $('highscore-val');
    const comboChip = $('combo-chip');
    const comboVal = $('combo-val');
    const modeChip = $('mode-chip');

    const pauseBtn = $('pause-toggle');
    const soundBtn = $('sound-toggle');
    const helpBtn = $('help-toggle');

    const tapHint = $('tap-hint');
    const pillBar = $('powerup-status-bar');

    const modals = {
      menu: $('menu-modal'),
      gameover: $('gameover-modal'),
      help: $('help-modal'),
      settings: $('settings-modal'),
      achievements: $('achievements-modal'),
      pause: $('pause-modal')
    };

    const toast = $('achievement-toast');
    const toastIcon = $('achievement-icon');
    const toastTitle = $('achievement-title');
    const toastDesc = $('achievement-desc');

    /* ------------------------------------------------------------------ */
    /*  MODAL STACK                                                        */
    /* ------------------------------------------------------------------ */
    const stack = [];
    let lastFocus = null;

    function isOpen(name) { return stack.indexOf(name) !== -1; }
    function anyOpen() { return stack.length > 0; }
    function top() { return stack[stack.length - 1]; }

    function openModal(name, opts) {
      const el = modals[name];
      if (!el || isOpen(name)) return;
      if (!stack.length) lastFocus = document.activeElement;
      stack.push(name);
      el.classList.add('active');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('inert');
      const focusTarget = el.querySelector('[data-autofocus]') || el.querySelector('button, [href], input, select');
      if (focusTarget) {
        // Small delay so a key still being held cannot immediately re-trigger
        // the freshly focused button (e.g. holding SPACE into the game-over card).
        setTimeout(() => { try { focusTarget.focus({ preventScroll: true }); } catch (e) {} },
          (opts && opts.focusDelay) || 60);
      }
      updateInert();
    }

    function closeModal(name) {
      const idx = stack.indexOf(name);
      if (idx === -1) return;
      stack.splice(idx, 1);
      const el = modals[name];
      el.classList.remove('active');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      updateInert();
      if (!stack.length && lastFocus && document.contains(lastFocus)) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
        lastFocus = null;
      }
    }

    function closeAll() { stack.slice().reverse().forEach(closeModal); }

    /* Hidden modals used to keep their buttons in the tab order because they
       were only opacity:0. Everything not on top is inert. */
    function updateInert() {
      Object.keys(modals).forEach(name => {
        const el = modals[name];
        if (!el) return;
        if (name === top()) {
          el.removeAttribute('inert');
          el.removeAttribute('aria-hidden');
        } else {
          el.setAttribute('inert', '');
          el.setAttribute('aria-hidden', 'true');
        }
      });
      document.body.classList.toggle('modal-open', anyOpen());
    }

    // Start with everything closed and inert except the menu.
    Object.keys(modals).forEach(name => {
      if (!modals[name]) return;
      modals[name].classList.remove('active');
      modals[name].setAttribute('inert', '');
      modals[name].setAttribute('aria-hidden', 'true');
    });

    /* ------------------------------------------------------------------ */
    /*  GAME INSTANCE                                                      */
    /* ------------------------------------------------------------------ */
    const handlers = {
      score(d) {
        scoreVal.textContent = d.score;
        bestVal.textContent = d.best;
        if (d.multiplier > 1) {
          comboChip.classList.add('visible');
          comboVal.textContent = '×' + d.multiplier;
          comboChip.classList.toggle('hot', d.multiplier >= 4);
        } else {
          comboChip.classList.remove('visible', 'hot');
        }
      },

      state(d) {
        const s = d.state;
        document.body.dataset.gameState = s;
        pauseBtn.disabled = !(s === 'PLAYING' || s === 'PAUSED' || s === 'COUNTDOWN');
        pauseBtn.textContent = s === 'PAUSED' ? '▶' : '⏸';
        pauseBtn.setAttribute('aria-label', s === 'PAUSED' ? 'Resume game' : 'Pause game');
        if (s !== 'READY') hideTapHint();
      },

      powerups(d) { renderPills(d); },

      achievement(d) { queueToast(d.icon || '🏆', d.title, d.desc); },

      record() { queueToast('🥇', 'NEW RECORD!', 'You just beat your personal best'); },

      mode(d) {
        modeChip.textContent = d.label;
        renderModeCards();
      },

      gameover(d) { showGameOver(d); }
    };

    const game = new FlappyGame(canvas, (type, data) => {
      const h = handlers[type];
      if (h) h(data);
    });

    /* ------------------------------------------------------------------ */
    /*  INPUT                                                              */
    /* ------------------------------------------------------------------ */

    // One flap per gesture. `pointerdown` alone covers mouse, touch and pen —
    // the previous build also listened for `click`, which fires after
    // pointerdown on desktop and produced a double-strength flap.
    canvas.addEventListener('pointerdown', (e) => {
      if (anyOpen()) return;
      e.preventDefault();
      sounds.init();
      hideTapHint();
      game.handleFlap();
    }, { passive: false });

    // Suppress the ghost click / context menu that follows a touch.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const FLAP_KEYS = ['Space', 'ArrowUp', 'KeyW'];

    window.addEventListener('keydown', (e) => {
      if (e.repeat && FLAP_KEYS.indexOf(e.code) !== -1) { e.preventDefault(); return; }

      // Escape / P — pause, or back out of the top modal.
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const t = top();
        if (t === 'pause') { resumeGame(); return; }
        if (t === 'help' || t === 'settings' || t === 'achievements') { sounds.playClick(); closeModal(t); return; }
        if (!anyOpen()) pauseGame();
        return;
      }

      if (e.code === 'KeyM' && !anyOpen()) { e.preventDefault(); toggleSound(); return; }

      if (FLAP_KEYS.indexOf(e.code) !== -1) {
        e.preventDefault();               // stop the page scrolling on SPACE
        if (anyOpen()) return;            // never flap behind an open modal
        sounds.init();
        hideTapHint();
        game.handleFlap();
      }
    });

    // Keep focus trapped inside the visible modal.
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Tab' || !anyOpen()) return;
      const el = modals[top()];
      const items = Array.prototype.filter.call(
        el.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])'),
        (n) => !n.disabled && n.offsetParent !== null
      );
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Auto-pause when the tab or window loses focus — no more returning to a
    // dead run because the bird kept falling in the background.
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    window.addEventListener('blur', () => pauseGame());

    /* ------------------------------------------------------------------ */
    /*  FLOW                                                               */
    /* ------------------------------------------------------------------ */

    function startGame() {
      closeAll();
      game.resetGame();
      showTapHint();
    }

    function pauseGame() {
      if (anyOpen()) return;
      if (game.pause()) openModal('pause');
    }

    function resumeGame() {
      closeModal('pause');
      game.resume();
    }

    function toMenu() {
      closeAll();
      game.resetGame();
      game.setState('MENU');
      renderModeCards();
      openModal('menu');
      hideTapHint();
    }

    /* ------------------------------------------------------------------ */
    /*  HUD                                                                */
    /* ------------------------------------------------------------------ */

    function showTapHint() { tapHint.classList.add('visible'); }
    function hideTapHint() { tapHint.classList.remove('visible'); }

    const PILL_META = {
      shield: { icon: '🛡️', label: 'SHIELD' },
      slowmo: { icon: '⏳', label: 'SLOW-MO' },
      magnet: { icon: '🧲', label: 'MAGNET' },
      double: { icon: '💎', label: '2× POINTS' },
      ghost:  { icon: '👻', label: 'GHOST' }
    };

    // Pills are built once and updated by event, replacing the old
    // setInterval(…, 250) polling loop.
    const pills = {};
    Object.keys(PILL_META).forEach(key => {
      const el = document.createElement('div');
      el.className = 'powerup-pill ' + key;
      el.setAttribute('role', 'status');
      el.innerHTML =
        `<span class="pill-icon" aria-hidden="true">${PILL_META[key].icon}</span>` +
        `<span class="pill-label">${PILL_META[key].label}</span>` +
        `<span class="pill-timer"><i></i></span>`;
      pillBar.appendChild(el);
      pills[key] = { el, bar: el.querySelector('.pill-timer i') };
    });

    function renderPills(state) {
      Object.keys(PILL_META).forEach(key => {
        const p = pills[key];
        const v = state[key];
        const active = (key === 'shield') ? !!v : !!(v && v.active);
        p.el.classList.toggle('visible', active);
        if (key === 'shield') {
          p.el.classList.add('untimed');
        } else if (active) {
          p.bar.style.width = Math.round(Math.max(0, Math.min(1, v.pct)) * 100) + '%';
          p.el.classList.toggle('expiring', v.pct < 0.25);
        }
      });
    }

    /* ------------------------------------------------------------------ */
    /*  TOASTS                                                             */
    /* ------------------------------------------------------------------ */

    const toastQueue = [];
    let toastBusy = false;

    function queueToast(icon, title, desc) {
      toastQueue.push({ icon, title, desc });
      if (!toastBusy) nextToast();
    }

    function nextToast() {
      const item = toastQueue.shift();
      if (!item) { toastBusy = false; return; }
      toastBusy = true;
      toastIcon.textContent = item.icon;
      toastTitle.textContent = item.title;
      toastDesc.textContent = item.desc;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(nextToast, 320);
      }, 2600);
    }

    /* ------------------------------------------------------------------ */
    /*  GAME OVER                                                          */
    /* ------------------------------------------------------------------ */

    const MEDAL_META = {
      bronze:   { icon: '🥉', label: 'BRONZE' },
      silver:   { icon: '🥈', label: 'SILVER' },
      gold:     { icon: '🥇', label: 'GOLD' },
      platinum: { icon: '💎', label: 'PLATINUM' }
    };

    let lastResult = null;

    function showGameOver(d) {
      lastResult = d;

      $('final-score').textContent = d.score;
      $('final-highscore').textContent = d.best;
      $('final-distance').textContent = d.distance + 'm';
      $('final-powerups').textContent = d.powerups;
      $('final-combo').textContent = '×' + Math.max(1, Math.min(5, 1 + Math.floor(d.maxCombo / 5)));
      $('final-nearmiss').textContent = d.nearMisses;

      const medalWrap = $('medal-wrap');
      if (d.medal) {
        const m = MEDAL_META[d.medal];
        medalWrap.className = 'medal-wrap visible ' + d.medal;
        $('medal-icon').textContent = m.icon;
        $('medal-label').textContent = m.label + ' MEDAL';
        $('medal-next').textContent = nextMedalText(d);
      } else {
        medalWrap.className = 'medal-wrap visible none';
        $('medal-icon').textContent = '🪶';
        $('medal-label').textContent = 'NO MEDAL';
        $('medal-next').textContent = nextMedalText(d);
      }

      $('newbest-ribbon').classList.toggle('visible', !!d.newBest);
      $('gameover-mode').textContent = d.modeLabel;

      openModal('gameover', { focusDelay: 500 });
      renderModeCards();
    }

    function nextMedalText(d) {
      const tiers = MODES[d.mode].medals;
      const order = ['bronze', 'silver', 'gold', 'platinum'];
      for (const t of order) {
        if (d.score < tiers[t]) return `${tiers[t] - d.score} more for ${t.toUpperCase()}`;
      }
      return 'Every medal earned in this mode';
    }

    $('share-btn').addEventListener('click', async () => {
      sounds.playClick();
      if (!lastResult) return;
      const text = `I scored ${lastResult.score} in Flappy FMS (${lastResult.modeLabel})` +
        (lastResult.medal ? ` and took the ${lastResult.medal} medal` : '') +
        `. Beat it: https://abhy-kumar.github.io/flappyfms/`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Flappy FMS', text });
        } else {
          await navigator.clipboard.writeText(text);
          queueToast('📋', 'Copied!', 'Score copied to your clipboard');
        }
      } catch (e) { /* user cancelled the share sheet */ }
    });

    /* ------------------------------------------------------------------ */
    /*  MODE CARDS & STATS                                                 */
    /* ------------------------------------------------------------------ */

    const modeBtns = document.querySelectorAll('.mode-btn');

    function renderModeCards() {
      const bests = Store.get('bests', {});
      modeBtns.forEach(btn => {
        const mode = btn.dataset.mode;
        const on = mode === game.mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');   // was never updated before
        const badge = btn.querySelector('.mode-best');
        if (badge) badge.textContent = 'BEST ' + (bests[mode] || 0);
      });
      bestVal.textContent = bests[game.mode] || 0;
      modeChip.textContent = MODES[game.mode].label;
      renderLifetime();
    }

    function renderLifetime() {
      const s = Object.assign({}, DEFAULT_STATS, Store.get('stats', {}));
      const owned = Store.get('achievements', []);
      $('lt-games').textContent = s.games;
      $('lt-distance').textContent = s.totalDistance.toLocaleString() + 'm';
      $('lt-combo').textContent = s.bestCombo;
      $('lt-achievements').textContent = owned.length + '/' + ACHIEVEMENTS.length;
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playClick();
        game.setMode(btn.dataset.mode);
        renderModeCards();
      });
    });

    /* ------------------------------------------------------------------ */
    /*  ACHIEVEMENTS PANEL                                                 */
    /* ------------------------------------------------------------------ */

    function renderAchievements() {
      const owned = Store.get('achievements', []);
      const list = $('achievement-list');
      list.innerHTML = '';
      ACHIEVEMENTS.forEach(a => {
        const got = owned.indexOf(a.id) !== -1;
        const li = document.createElement('li');
        li.className = 'achievement-row' + (got ? ' unlocked' : ' locked');
        li.innerHTML =
          `<span class="ach-icon" aria-hidden="true">${got ? a.icon : '🔒'}</span>` +
          `<span class="ach-text"><strong>${a.title}</strong><em>${a.desc}</em></span>`;
        list.appendChild(li);
      });
      $('achievement-progress').textContent = owned.length + ' / ' + ACHIEVEMENTS.length + ' unlocked';
    }

    /* ------------------------------------------------------------------ */
    /*  SETTINGS                                                           */
    /* ------------------------------------------------------------------ */

    const volumeInput = $('opt-volume');
    const hapticsInput = $('opt-haptics');
    const shakeInput = $('opt-shake');
    const motionInput = $('opt-motion');

    function syncSettingsUI() {
      volumeInput.value = Math.round(Settings.get('volume') * 100);
      hapticsInput.checked = Settings.get('haptics');
      shakeInput.checked = Settings.get('shake');
      motionInput.checked = Settings.get('reducedMotion');
      document.body.classList.toggle('reduced-motion', Settings.get('reducedMotion'));
      soundBtn.textContent = sounds.muted ? '🔇' : '🔊';
      soundBtn.setAttribute('aria-pressed', sounds.muted ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', sounds.muted ? 'Unmute sound' : 'Mute sound');
    }

    volumeInput.addEventListener('input', () => {
      sounds.init();
      sounds.setVolume(volumeInput.value / 100);
      if (sounds.muted && volumeInput.value > 0) { sounds.setMuted(false); syncSettingsUI(); }
    });
    volumeInput.addEventListener('change', () => sounds.playClick());
    hapticsInput.addEventListener('change', () => { Settings.set('haptics', hapticsInput.checked); sounds.playClick(); });
    shakeInput.addEventListener('change', () => { Settings.set('shake', shakeInput.checked); sounds.playClick(); });
    motionInput.addEventListener('change', () => {
      Settings.set('reducedMotion', motionInput.checked);
      document.body.classList.toggle('reduced-motion', motionInput.checked);
      game.initBackgroundElements();
      sounds.playClick();
    });

    $('reset-data').addEventListener('click', () => {
      if (!confirmed) { confirmed = true; $('reset-data').textContent = 'TAP AGAIN TO CONFIRM'; setTimeout(resetConfirmTimeout, 4000); return; }
      Store.set('bests', {});
      Store.set('stats', Object.assign({}, DEFAULT_STATS));
      Store.set('achievements', []);
      renderModeCards();
      renderAchievements();
      resetConfirmTimeout();
      queueToast('🧹', 'Progress cleared', 'Scores, stats and achievements reset');
    });
    let confirmed = false;
    function resetConfirmTimeout() { confirmed = false; $('reset-data').textContent = 'RESET ALL PROGRESS'; }

    function toggleSound() {
      sounds.init();
      sounds.toggleMute();
      syncSettingsUI();
      if (!sounds.muted) sounds.playClick();
    }

    /* ------------------------------------------------------------------ */
    /*  BUTTON WIRING                                                      */
    /* ------------------------------------------------------------------ */

    const wire = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

    wire('start-btn', () => { sounds.init(); sounds.playClick(); startGame(); });
    wire('restart-btn', () => { sounds.playClick(); startGame(); });
    wire('menu-btn', () => { sounds.playClick(); toMenu(); });

    wire('pause-resume', () => { sounds.playClick(); resumeGame(); });
    wire('pause-restart', () => { sounds.playClick(); startGame(); });
    wire('pause-menu', () => { sounds.playClick(); toMenu(); });

    wire('pause-toggle', () => {
      sounds.playClick();
      if (game.state === 'PAUSED') resumeGame(); else pauseGame();
    });
    wire('sound-toggle', toggleSound);
    wire('help-toggle', () => { sounds.playClick(); openModal('help'); });

    wire('help-close', () => { sounds.playClick(); closeModal('help'); });
    wire('settings-close', () => { sounds.playClick(); closeModal('settings'); });
    wire('achievements-close', () => { sounds.playClick(); closeModal('achievements'); });

    wire('menu-help', () => { sounds.playClick(); openModal('help'); });
    wire('menu-settings', () => { sounds.playClick(); syncSettingsUI(); openModal('settings'); });
    wire('menu-achievements', () => { sounds.playClick(); renderAchievements(); openModal('achievements'); });
    wire('gameover-achievements', () => { sounds.playClick(); renderAchievements(); openModal('achievements'); });

    // Clicking the dimmed backdrop closes non-blocking dialogs.
    ['help', 'settings', 'achievements'].forEach(name => {
      modals[name].addEventListener('pointerdown', (e) => {
        if (e.target === modals[name]) { sounds.playClick(); closeModal(name); }
      });
    });

    /* ------------------------------------------------------------------ */
    /*  BOOT                                                               */
    /* ------------------------------------------------------------------ */

    // Unlock audio on the very first gesture anywhere (capture phase, so it
    // runs before the canvas handler that plays the first flap sound).
    ['pointerdown', 'keydown'].forEach(evt =>
      window.addEventListener(evt, () => sounds.init(), { once: true, capture: true }));

    syncSettingsUI();
    renderModeCards();
    game.resetGame();
    game.setState('MENU');
    hideTapHint();
    openModal('menu');

    // Expose for debugging / the console.
    window.FlappyFMS = { game, sounds, Store, Settings };
  });
})();
