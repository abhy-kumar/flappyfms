/* ==========================================================================
   APP CONTROLLER - FLAPPY FMS (v2.0)
   --------------------------------------------------------------------------
   Owns DOM concern: input routing, modal stack, HUD, toasts, settings,
   FMS Campus Leaderboard, Top 10 Pilot Name Entry, and PWA Installation.
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
    const leaderBtn = $('leaderboard-toggle');

    const tapHint = $('tap-hint');
    const pillBar = $('powerup-status-bar');

    const modals = {
      menu: $('menu-modal'),
      gameover: $('gameover-modal'),
      entry: $('leaderboard-entry-modal'),
      leaderboard: $('leaderboard-modal'),
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
        pauseBtn.innerHTML = s === 'PAUSED' ? '<i class="fa-solid fa-play" aria-hidden="true"></i>' : '<i class="fa-solid fa-pause" aria-hidden="true"></i>';
        pauseBtn.setAttribute('aria-label', s === 'PAUSED' ? 'Resume game' : 'Pause game');
        if (s !== 'READY') hideTapHint();
      },

      powerups(d) { renderPills(d); },

      achievement(d) { queueToast(d.icon || '<i class="fa-solid fa-trophy"></i>', d.title, d.desc); },

      record() { queueToast('<i class="fa-solid fa-ranking-star"></i>', 'NEW RECORD!', 'You just beat your personal best'); },

      mode(d) {
        modeChip.textContent = d.label;
        renderModeCards();
      },

      gameover(d) { handleGameOverFlow(d); }
    };

    const game = new FlappyGame(canvas, (type, data) => {
      const h = handlers[type];
      if (h) h(data);
    });

    /* ------------------------------------------------------------------ */
    /*  INPUT ROUTING                                                      */
    /* ------------------------------------------------------------------ */

    canvas.addEventListener('pointerdown', (e) => {
      if (anyOpen()) return;
      e.preventDefault();
      sounds.init();
      hideTapHint();
      game.handleFlap();
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const FLAP_KEYS = ['Space', 'ArrowUp', 'KeyW'];

    window.addEventListener('keydown', (e) => {
      if (e.repeat && FLAP_KEYS.indexOf(e.code) !== -1) { e.preventDefault(); return; }

      // Escape / P — pause, or close modal
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const t = top();
        if (t === 'pause') { resumeGame(); return; }
        if (t === 'help' || t === 'settings' || t === 'achievements' || t === 'leaderboard') {
          sounds.playClick(); closeModal(t); return;
        }
        if (!anyOpen()) pauseGame();
        return;
      }

      if (e.code === 'KeyM' && !anyOpen()) { e.preventDefault(); toggleSound(); return; }

      if (FLAP_KEYS.indexOf(e.code) !== -1) {
        e.preventDefault();
        if (anyOpen()) return;
        sounds.init();
        hideTapHint();
        game.handleFlap();
      }
    });

    // Modal focus trap
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

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    window.addEventListener('blur', () => pauseGame());

    /* ------------------------------------------------------------------ */
    /*  GAME FLOW                                                          */
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
    /*  HUD & PILLS                                                        */
    /* ------------------------------------------------------------------ */

    function showTapHint() { tapHint.classList.add('visible'); }
    function hideTapHint() { tapHint.classList.remove('visible'); }

    const PILL_META = {
      shield: { icon: '<i class="fa-solid fa-shield-halved"></i>', label: 'SHIELD' },
      slowmo: { icon: '<i class="fa-solid fa-hourglass-half"></i>', label: 'SLOW-MO' },
      magnet: { icon: '<i class="fa-solid fa-magnet"></i>',        label: 'MAGNET' },
      double: { icon: '<i class="fa-solid fa-gem"></i>',           label: '2× POINTS' },
      ghost:  { icon: '<i class="fa-solid fa-ghost"></i>',         label: 'GHOST' }
    };

    const pills = {};
    Object.keys(PILL_META).forEach(key => {
      const el = document.createElement('div');
      el.className = 'powerup-pill ' + key;
      el.setAttribute('role', 'status');
      el.innerHTML =
        `<span class="pill-icon" aria-hidden="true">${PILL_META[key].icon}</span>` +
        `<span class="pill-label">${PILL_META[key].label}</span>` +
        `<span class="pill-timer"><span class="pill-timer-bar"></span></span>`;
      pillBar.appendChild(el);
      pills[key] = { el, bar: el.querySelector('.pill-timer-bar') };
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
      toastIcon.innerHTML = item.icon;
      toastTitle.textContent = item.title;
      toastDesc.textContent = item.desc;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(nextToast, 320);
      }, 2600);
    }

    /* ------------------------------------------------------------------ */
    /*  GAME OVER & LEADERBOARD ENTRY FLOW                                 */
    /* ------------------------------------------------------------------ */

    const MEDAL_META = {
      bronze:   { icon: '<i class="fa-solid fa-medal" style="color:#cd7f32"></i>', label: 'BRONZE' },
      silver:   { icon: '<i class="fa-solid fa-medal" style="color:#c0c0c0"></i>', label: 'SILVER' },
      gold:     { icon: '<i class="fa-solid fa-medal" style="color:#ffd700"></i>', label: 'GOLD' },
      platinum: { icon: '<i class="fa-solid fa-gem"   style="color:#e2e8f0"></i>', label: 'PLATINUM' }
    };

    let lastResult = null;

    function handleGameOverFlow(d) {
      lastResult = d;
      const topCheck = Leaderboard.checkTop10(d.score, d.mode);

      if (topCheck.qualifies) {
        $('entry-rank-text').textContent = `You earned Rank #${topCheck.rank} in ${d.modeLabel}!`;
        const savedName = Settings.get('pilotName') || 'FMS_Pilot';
        $('pilot-name-input').value = savedName;
        openModal('entry', { focusDelay: 100 });
      } else {
        showGameOver(d);
      }
    }

    function saveLeaderboardEntry() {
      const input = $('pilot-name-input');
      const name = (input.value || Settings.get('pilotName') || 'FMS_Pilot').trim().slice(0, 18);
      Settings.set('pilotName', name);

      if (lastResult) {
        Leaderboard.addEntry({
          name: name,
          score: lastResult.score,
          mode: lastResult.mode,
          medal: lastResult.medal
        });
        game.unlock('top_pilot');
        queueToast('<i class="fa-solid fa-ranking-star"></i>', 'Spot Claimed!', `${name} is on the Campus Leaderboard`);
      }

      closeModal('entry');
      showGameOver(lastResult);
    }

    function showGameOver(d) {
      if (!d) return;
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
        $('medal-icon').innerHTML = m.icon;
        $('medal-label').textContent = m.label + ' MEDAL';
        $('medal-next').textContent = nextMedalText(d);
      } else {
        medalWrap.className = 'medal-wrap visible none';
        $('medal-icon').innerHTML = '<i class="fa-solid fa-feather" style="color:#94a3b8"></i>';
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
      return 'All medals earned in this mode!';
    }

    $('share-btn').addEventListener('click', async () => {
      sounds.playClick();
      if (!lastResult) return;
      const text = `I scored ${lastResult.score} in Flappy FMS (${lastResult.modeLabel})` +
        (lastResult.medal ? ` with the ${lastResult.medal.toUpperCase()} medal` : '') +
        `! Beat my score on the FMS Campus Leaderboard: https://flappyfms.vercel.app/`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Flappy FMS', text, url: 'https://flappyfms.vercel.app/' });
        } else {
          await navigator.clipboard.writeText(text);
          queueToast('<i class="fa-solid fa-clipboard-check"></i>', 'Copied!', 'Score copied to your clipboard');
        }
      } catch (e) { /* cancelled */ }
    });

    /* ------------------------------------------------------------------ */
    /*  CAMPUS LEADERBOARD MODAL                                           */
    /* ------------------------------------------------------------------ */

    let currentLeaderTab = 'all';

    function renderLeaderboard(filter = 'all') {
      currentLeaderTab = filter;
      const listEl = $('leaderboard-list');
      listEl.innerHTML = '';

      const entries = Leaderboard.getEntries(filter);

      if (!entries.length) {
        listEl.innerHTML = `<li class="leaderboard-empty">No scores registered in this mode yet. Be the first!</li>`;
        return;
      }

      entries.forEach((entry, idx) => {
        const rank = idx + 1;
        let rankBadge = `<span class="lb-rank num">${rank}</span>`;
        if (rank === 1) rankBadge = `<span class="lb-rank rank-1"><i class="fa-solid fa-crown"></i> 1</span>`;
        else if (rank === 2) rankBadge = `<span class="lb-rank rank-2"><i class="fa-solid fa-medal"></i> 2</span>`;
        else if (rank === 3) rankBadge = `<span class="lb-rank rank-3"><i class="fa-solid fa-award"></i> 3</span>`;

        const isMe = entry.name === Settings.get('pilotName');
        const li = document.createElement('li');
        li.className = 'leaderboard-row' + (isMe ? ' current-player' : '');

        let medalHtml = '';
        if (entry.medal && MEDAL_META[entry.medal]) {
          medalHtml = `<span class="lb-medal" title="${entry.medal.toUpperCase()} medal">${MEDAL_META[entry.medal].icon}</span>`;
        }

        li.innerHTML = `
          ${rankBadge}
          <div class="lb-pilot">
            <strong>${escapeHtml(entry.name)}</strong>
            <small>${entry.mode ? entry.mode.toUpperCase() : 'CLASSIC'} · ${entry.date || 'Campus'}</small>
          </div>
          <div class="lb-score-wrap">
            ${medalHtml}
            <span class="lb-score">${entry.score}</span>
          </div>
        `;
        listEl.appendChild(li);
      });
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    const leaderTabs = document.querySelectorAll('.tab-btn');
    leaderTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playClick();
        leaderTabs.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        renderLeaderboard(btn.dataset.tab);
      });
    });

    /* ------------------------------------------------------------------ */
    /*  MODE CARDS & LIFETIME STATS                                        */
    /* ------------------------------------------------------------------ */

    const modeBtns = document.querySelectorAll('.mode-btn');

    function renderModeCards() {
      const bests = Store.get('bests', {});
      modeBtns.forEach(btn => {
        const mode = btn.dataset.mode;
        const on = mode === game.mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
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
          `<span class="ach-icon" aria-hidden="true">${got ? a.icon : '<i class="fa-solid fa-lock"></i>'}</span>` +
          `<span class="ach-text"><strong>${a.title}</strong><em>${a.desc}</em></span>`;
        list.appendChild(li);
      });
      $('achievement-progress').textContent = owned.length + ' / ' + ACHIEVEMENTS.length + ' unlocked';
    }

    /* ------------------------------------------------------------------ */
    /*  SETTINGS                                                           */
    /* ------------------------------------------------------------------ */

    const pilotInput = $('opt-pilot');
    const volumeInput = $('opt-volume');
    const hapticsInput = $('opt-haptics');
    const shakeInput = $('opt-shake');
    const motionInput = $('opt-motion');

    function syncSettingsUI() {
      pilotInput.value = Settings.get('pilotName') || 'FMS_Pilot';
      volumeInput.value = Math.round(Settings.get('volume') * 100);
      hapticsInput.checked = Settings.get('haptics');
      shakeInput.checked = Settings.get('shake');
      motionInput.checked = Settings.get('reducedMotion');
      document.body.classList.toggle('reduced-motion', Settings.get('reducedMotion'));
      soundBtn.innerHTML = sounds.muted ? '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i>' : '<i class="fa-solid fa-volume-high" aria-hidden="true"></i>';
      soundBtn.setAttribute('aria-pressed', sounds.muted ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', sounds.muted ? 'Unmute sound' : 'Mute sound');
    }

    pilotInput.addEventListener('change', () => {
      const val = pilotInput.value.trim().slice(0, 18) || 'FMS_Pilot';
      Settings.set('pilotName', val);
      sounds.playClick();
      queueToast('<i class="fa-solid fa-id-badge"></i>', 'Call Sign Updated', val);
    });

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
      queueToast('<i class="fa-solid fa-trash-can"></i>', 'Progress cleared', 'Scores, stats and achievements reset');
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
    /*  PWA INSTALL PROMPT                                                 */
    /* ------------------------------------------------------------------ */

    let deferredInstallPrompt = null;
    const installBtn = $('menu-install');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        sounds.playClick();
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice.outcome === 'accepted') {
            installBtn.style.display = 'none';
            queueToast('<i class="fa-solid fa-check"></i>', 'App Installed!', 'Flappy FMS is on your home screen');
          }
          deferredInstallPrompt = null;
        } else {
          queueToast('<i class="fa-solid fa-mobile-screen"></i>', 'Install Tip', 'Use your browser menu -> Add to Home Screen');
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) installBtn.style.display = 'none';
      deferredInstallPrompt = null;
    });

    /* ------------------------------------------------------------------ */
    /*  BUTTON WIRING                                                      */
    /* ------------------------------------------------------------------ */

    const wire = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

    wire('start-btn', () => { sounds.init(); sounds.playClick(); startGame(); });
    wire('restart-btn', () => { sounds.playClick(); startGame(); });
    wire('menu-btn', () => { sounds.playClick(); toMenu(); });

    wire('entry-save-btn', () => { sounds.playClick(); saveLeaderboardEntry(); });
    wire('entry-skip-btn', () => { sounds.playClick(); closeModal('entry'); showGameOver(lastResult); });

    wire('pause-resume', () => { sounds.playClick(); resumeGame(); });
    wire('pause-restart', () => { sounds.playClick(); startGame(); });
    wire('pause-menu', () => { sounds.playClick(); toMenu(); });

    wire('pause-toggle', () => {
      sounds.playClick();
      if (game.state === 'PAUSED') resumeGame(); else pauseGame();
    });
    wire('sound-toggle', toggleSound);
    wire('help-toggle', () => { sounds.playClick(); openModal('help'); });
    function openLeaderboardModal() {
      sounds.playClick();
      renderLeaderboard(currentLeaderTab);
      openModal('leaderboard');
      Leaderboard.fetchRemote().then(() => {
        if (isOpen('leaderboard')) renderLeaderboard(currentLeaderTab);
      });
    }

    wire('leaderboard-toggle', openLeaderboardModal);
    wire('menu-leaderboard', openLeaderboardModal);
    wire('gameover-leaderboard', openLeaderboardModal);

    window.addEventListener('ffms_leaderboard_synced', () => {
      if (isOpen('leaderboard')) renderLeaderboard(currentLeaderTab);
    });

    // Close on dimmed backdrop click
    ['help', 'settings', 'achievements', 'leaderboard', 'entry'].forEach(name => {
      if (modals[name]) {
        modals[name].addEventListener('pointerdown', (e) => {
          if (e.target === modals[name]) {
            sounds.playClick();
            if (name === 'entry') { closeModal('entry'); showGameOver(lastResult); }
            else closeModal(name);
          }
        });
      }
    });

    /* ------------------------------------------------------------------ */
    /*  BOOT                                                               */
    /* ------------------------------------------------------------------ */

    ['pointerdown', 'keydown'].forEach(evt =>
      window.addEventListener(evt, () => sounds.init(), { once: true, capture: true }));

    syncSettingsUI();
    renderModeCards();
    game.resetGame();
    game.setState('MENU');
    hideTapHint();
    openModal('menu');

    window.FlappyFMS = { game, sounds, Store, Settings, Leaderboard };
  });
})();
