/* ==========================================================================
   APP CONTROLLER - FLAPPY EAGLE (FLAPPY FMS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const canvas           = document.getElementById('game-canvas');
  const scoreDisplay     = document.getElementById('score-val');
  const highScoreDisplay = document.getElementById('highscore-val');

  // Modals
  const menuModal     = document.getElementById('menu-modal');
  const gameOverModal = document.getElementById('gameover-modal');
  const statsModal    = document.getElementById('stats-modal');
  const tapHint       = document.getElementById('tap-hint');

  // Game-over stat fields
  const finalScoreEl     = document.getElementById('final-score');
  const finalHighScoreEl = document.getElementById('final-highscore');
  const finalDistanceEl  = document.getElementById('final-distance');
  const finalPowerupsEl  = document.getElementById('final-powerups');

  // Buttons
  const startBtn      = document.getElementById('start-btn');
  const restartBtn    = document.getElementById('restart-btn');
  const menuBtn       = document.getElementById('menu-btn');
  const soundToggle   = document.getElementById('sound-toggle');
  const statsToggle   = document.getElementById('stats-toggle');
  const statsClose    = document.getElementById('stats-close');

  // Power-up pills
  const shieldPill = document.getElementById('shield-pill');
  const slowmoPill = document.getElementById('slowmo-pill');

  // Mode buttons
  const modeBtns = document.querySelectorAll('.mode-btn');

  // Achievement toast
  const toast        = document.getElementById('achievement-toast');
  const toastTitle   = document.getElementById('achievement-title');
  const toastDesc    = document.getElementById('achievement-desc');

  // --- Initialise audio on first user interaction ---
  document.addEventListener('click',      () => sounds.init(), { once: true });
  document.addEventListener('keydown',    () => sounds.init(), { once: true });
  document.addEventListener('pointerdown',() => sounds.init(), { once: true });

  // Seed high-score display from storage
  highScoreDisplay.textContent = localStorage.getItem('flappy_eagle_highscore') || '0';

  /* -------------------------------------------------------------------- */
  /*  Game instance                                                         */
  /* -------------------------------------------------------------------- */

  const game = new FlappyGame(
    canvas,

    // onScoreUpdate(score, highScore)
    (score, highScore) => {
      scoreDisplay.textContent     = score;
      highScoreDisplay.textContent = highScore;
      refreshPowerupPills();
    },

    // onGameOver(stats)
    (stats) => {
      finalScoreEl.textContent     = stats.score;
      finalHighScoreEl.textContent = stats.highScore;
      finalDistanceEl.textContent  = stats.distance + 'm';
      finalPowerupsEl.textContent  = stats.powerups;

      tapHint.style.display = 'none';
      refreshPowerupPills();
      gameOverModal.classList.add('active');
    },

    // onAchievement(title, desc)
    (title, desc) => showAchievement(title, desc)
  );

  /* -------------------------------------------------------------------- */
  /*  UI helpers                                                            */
  /* -------------------------------------------------------------------- */

  function refreshPowerupPills() {
    shieldPill.style.display = game.activePowerups.shield ? 'flex' : 'none';
    slowmoPill.style.display = game.activePowerups.slowmo  ? 'flex' : 'none';
  }

  let achieveTimer = null;
  function showAchievement(title, desc) {
    toastTitle.textContent = title;
    toastDesc.textContent  = desc;
    toast.classList.add('show');
    clearTimeout(achieveTimer);
    achieveTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }

  function startGame() {
    menuModal.classList.remove('active');
    gameOverModal.classList.remove('active');
    tapHint.style.display = 'flex';
    refreshPowerupPills();
    game.resetGame();
  }

  /* -------------------------------------------------------------------- */
  /*  Button listeners                                                      */
  /* -------------------------------------------------------------------- */

  startBtn.addEventListener('click', () => {
    sounds.playClick();
    startGame();
  });

  restartBtn.addEventListener('click', () => {
    sounds.playClick();
    startGame();
  });

  menuBtn.addEventListener('click', () => {
    sounds.playClick();
    gameOverModal.classList.remove('active');
    tapHint.style.display = 'none';
    menuModal.classList.add('active');
  });

  soundToggle.addEventListener('click', () => {
    const muted = sounds.toggleMute();
    soundToggle.textContent = muted ? '🔇' : '🔊';
  });

  statsToggle.addEventListener('click', () => {
    sounds.playClick();
    statsModal.classList.add('active');
  });

  statsClose.addEventListener('click', () => {
    sounds.playClick();
    statsModal.classList.remove('active');
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sounds.playClick();
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      game.setMode(btn.dataset.mode);
    });
  });

  /* -------------------------------------------------------------------- */
  /*  Hide tap-hint on first actual flap input                             */
  /* -------------------------------------------------------------------- */

  function hideTapHint() {
    if (tapHint.style.display !== 'none') {
      tapHint.style.display = 'none';
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') hideTapHint();
  });

  canvas.addEventListener('pointerdown', hideTapHint);

  /* -------------------------------------------------------------------- */
  /*  Periodic power-up pill refresh (for slowmo countdown)               */
  /* -------------------------------------------------------------------- */

  setInterval(refreshPowerupPills, 250);
});
