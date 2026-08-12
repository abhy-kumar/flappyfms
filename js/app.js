/* ==========================================================================
   APP CONTROLLER - FLAPPY EAGLE (FLAPPY FMS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const scoreDisplay = document.getElementById('score-val');
  const highScoreDisplay = document.getElementById('highscore-val');

  // Modals
  const menuModal = document.getElementById('menu-modal');
  const gameOverModal = document.getElementById('gameover-modal');
  const statsModal = document.getElementById('stats-modal');

  // Game over stat fields
  const finalScoreEl = document.getElementById('final-score');
  const finalHighScoreEl = document.getElementById('final-highscore');
  const finalDistanceEl = document.getElementById('final-distance');
  const finalPowerupsEl = document.getElementById('final-powerups');

  // UI Action Buttons
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const statsToggleBtn = document.getElementById('stats-toggle');
  const statsCloseBtn = document.getElementById('stats-close');
  const tapHint = document.getElementById('tap-hint');

  // Powerup Status Pills
  const shieldPill = document.getElementById('shield-pill');
  const slowmoPill = document.getElementById('slowmo-pill');

  // Mode Selection Buttons
  const modeBtns = document.querySelectorAll('.mode-btn');

  // Achievement Toast
  const toast = document.getElementById('achievement-toast');
  const toastTitle = document.getElementById('achievement-title');
  const toastDesc = document.getElementById('achievement-desc');

  let game = null;

  // Sound Engine initial trigger on any button click
  document.body.addEventListener('click', () => {
    sounds.init();
  }, { once: true });

  // Update UI High score initially
  const storedHighScore = localStorage.getItem('flappy_eagle_highscore') || '0';
  highScoreDisplay.textContent = storedHighScore;

  // Initialize Game Instance
  game = new FlappyGame(
    canvas,
    // On Score Update
    (score, highScore) => {
      scoreDisplay.textContent = score;
      highScoreDisplay.textContent = highScore;
      updatePowerupUI();
    },
    // On Game Over
    (stats) => {
      finalScoreEl.textContent = stats.score;
      finalHighScoreEl.textContent = stats.highScore;
      finalDistanceEl.textContent = `${stats.distance}m`;
      finalPowerupsEl.textContent = stats.powerups;

      gameOverModal.classList.add('active');
      tapHint.style.display = 'none';
      updatePowerupUI();
    },
    // On Achievement Unlocked
    (title, desc) => {
      showAchievement(title, desc);
    }
  );

  function updatePowerupUI() {
    if (game.activePowerups.shield) {
      shieldPill.style.display = 'flex';
    } else {
      shieldPill.style.display = 'none';
    }

    if (game.activePowerups.slowmo) {
      slowmoPill.style.display = 'flex';
    } else {
      slowmoPill.style.display = 'none';
    }
  }

  function showAchievement(title, desc) {
    sounds.playPowerup();
    toastTitle.textContent = title;
    toastDesc.textContent = desc;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Button Listeners
  startBtn.addEventListener('click', () => {
    sounds.playClick();
    menuModal.classList.remove('active');
    game.resetGame();
    tapHint.style.display = 'flex';
  });

  restartBtn.addEventListener('click', () => {
    sounds.playClick();
    gameOverModal.classList.remove('active');
    game.resetGame();
    tapHint.style.display = 'flex';
  });

  menuBtn.addEventListener('click', () => {
    sounds.playClick();
    gameOverModal.classList.remove('active');
    menuModal.classList.add('active');
    tapHint.style.display = 'none';
  });

  soundToggleBtn.addEventListener('click', () => {
    const isMuted = sounds.toggleMute();
    soundToggleBtn.textContent = isMuted ? '🔇' : '🔊';
  });

  statsToggleBtn.addEventListener('click', () => {
    sounds.playClick();
    statsModal.classList.add('active');
  });

  statsCloseBtn.addEventListener('click', () => {
    sounds.playClick();
    statsModal.classList.remove('active');
  });

  // Mode Selector Listeners
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sounds.playClick();
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selectedMode = btn.getAttribute('data-mode');
      game.setMode(selectedMode);
    });
  });

  // Hide tap hint on first tap
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (tapHint.style.display !== 'none') {
        tapHint.style.display = 'none';
      }
    }
  });

  canvas.parentElement.addEventListener('pointerdown', () => {
    if (tapHint.style.display !== 'none') {
      tapHint.style.display = 'none';
    }
  });
});
