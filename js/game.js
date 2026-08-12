/* ==========================================================================
   GAME ENGINE - FLAPPY EAGLE (FLAPPY FMS)
   ========================================================================== */

class FlappyGame {
  constructor(canvas, onScoreUpdate, onGameOver, onAchievement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.onAchievement = onAchievement;

    // Viewport scaling
    this.width = 400;
    this.height = 700;
    this.dpr = window.devicePixelRatio || 1;

    // Sprite loading
    this.birdImg = new Image();
    this.birdImgLoaded = false;
    this.loadBirdSprite();

    // Mode configuration
    this.mode = 'classic'; // classic, hardcore, zen
    
    // Physics constants per mode
    this.modesConfig = {
      classic: { gravity: 0.38, jump: -7.5, pipeSpeed: 2.3, pipeGap: 140, pipeInterval: 100 },
      hardcore: { gravity: 0.45, jump: -8.0, pipeSpeed: 3.2, pipeGap: 120, pipeInterval: 80, movingPipes: true },
      zen: { gravity: 0.30, jump: -6.5, pipeSpeed: 1.8, pipeGap: 170, pipeInterval: 120 }
    };

    // Game state
    this.state = 'MENU'; // MENU, READY, PLAYING, GAMEOVER
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('flappy_eagle_highscore') || '0', 10);
    this.distance = 0;
    this.feathersCollected = 0;
    this.powerupsCollected = 0;
    this.jumpsCount = 0;

    // Bird Properties
    this.bird = {
      x: 80,
      y: 300,
      width: 44,
      height: 44,
      vy: 0,
      rotation: 0,
      radius: 18,
      wingPulse: 1.0
    };

    // Power-up states
    this.activePowerups = {
      shield: false,
      shieldTime: 0,
      slowmo: false,
      slowmoTime: 0
    };

    // Game Entities
    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.bgStars = [];
    this.clouds = [];
    this.frameCount = 0;
    this.shakeTime = 0;

    this.resizeCanvas();
    this.initBackgroundElements();
    this.bindEvents();

    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loadBirdSprite() {
    this.birdImg.onload = () => {
      this.birdImgLoaded = true;
    };
    // Try bird.png first, fallback to bird.jpeg
    this.birdImg.src = 'bird.png';
    this.birdImg.onerror = () => {
      this.birdImg.src = 'bird.jpeg';
    };
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.width = container.clientWidth || 400;
    this.height = container.clientHeight || 700;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(this.dpr, this.dpr);
  }

  initBackgroundElements() {
    this.bgStars = [];
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({
        x: Math.random() * this.width,
        y: Math.random() * (this.height * 0.7),
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.8 + 0.2
      });
    }

    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.width,
        y: Math.random() * 250 + 50,
        speed: Math.random() * 0.4 + 0.2,
        scale: Math.random() * 0.5 + 0.5
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    const handleAction = (e) => {
      if (e.target.closest('.icon-btn') || e.target.closest('.modal-screen')) return;
      if (this.state === 'READY') {
        this.startPlay();
        this.flap();
      } else if (this.state === 'PLAYING') {
        this.flap();
      }
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction(e);
      }
    });

    this.canvas.parentElement.addEventListener('pointerdown', (e) => {
      handleAction(e);
    });
  }

  setMode(mode) {
    if (this.modesConfig[mode]) {
      this.mode = mode;
    }
  }

  resetGame() {
    const cfg = this.modesConfig[this.mode];
    this.bird.x = this.width * 0.25;
    this.bird.y = this.height * 0.4;
    this.bird.vy = 0;
    this.bird.rotation = 0;

    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.score = 0;
    this.distance = 0;
    this.frameCount = 0;
    this.shakeTime = 0;

    this.activePowerups.shield = false;
    this.activePowerups.slowmo = false;

    this.state = 'READY';
    this.onScoreUpdate(this.score, this.highScore);
  }

  startPlay() {
    this.state = 'PLAYING';
  }

  flap() {
    if (this.state !== 'PLAYING' && this.state !== 'READY') return;

    const cfg = this.modesConfig[this.mode];
    this.bird.vy = cfg.jump;
    this.bird.wingPulse = 1.3;
    this.jumpsCount++;

    sounds.playFlap();

    // Spawn flap particles
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: this.bird.x - 10,
        y: this.bird.y + (Math.random() * 10 - 5),
        vx: -Math.random() * 2 - 1,
        vy: Math.random() * 2 - 1,
        size: Math.random() * 4 + 2,
        color: 'rgba(255, 255, 255, 0.8)',
        life: 1.0,
        decay: 0.05
      });
    }
  }

  update(dt) {
    const cfg = this.modesConfig[this.mode];
    const speedMult = this.activePowerups.slowmo ? 0.6 : 1.0;
    const effectivePipeSpeed = cfg.pipeSpeed * speedMult;

    // Update screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
    }

    // Background clouds update
    this.clouds.forEach(c => {
      c.x -= c.speed * speedMult;
      if (c.x < -100) c.x = this.width + 50;
    });

    if (this.state === 'READY') {
      this.bird.y = (this.height * 0.4) + Math.sin(this.frameCount * 0.08) * 8;
      this.bird.rotation = 0;
      this.frameCount++;
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.frameCount++;
    this.distance += effectivePipeSpeed * 0.1;

    // Power-up durations
    if (this.activePowerups.slowmo) {
      this.activePowerups.slowmoTime -= dt;
      if (this.activePowerups.slowmoTime <= 0) {
        this.activePowerups.slowmo = false;
      }
    }

    // Bird Physics
    const effGravity = cfg.gravity * (this.activePowerups.slowmo ? 0.8 : 1.0);
    this.bird.vy += effGravity;
    this.bird.y += this.bird.vy;

    // Wing pulse decay
    if (this.bird.wingPulse > 1.0) {
      this.bird.wingPulse -= 0.04;
    }

    // Rotation based on velocity
    if (this.bird.vy < 0) {
      this.bird.rotation = Math.max(-0.4, this.bird.vy * 0.06);
    } else {
      this.bird.rotation = Math.min(1.2, this.bird.rotation + 0.04);
    }

    // Spawn Pipes
    if (this.frameCount % Math.round(cfg.pipeInterval / speedMult) === 0) {
      this.spawnPipe();
    }

    // Update Pipes & Collision
    const groundY = this.height - 70;

    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= effectivePipeSpeed;

      // Moving pipes feature in hardcore mode
      if (pipe.moving) {
        pipe.gapY += Math.sin(this.frameCount * 0.05 + pipe.offset) * 1.5;
      }

      // Score check
      if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
        pipe.passed = true;
        this.score++;
        sounds.playScore();

        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('flappy_eagle_highscore', this.highScore.toString());
        }

        this.onScoreUpdate(this.score, this.highScore);
        this.checkAchievements();
      }

      // Pipe collision check
      if (this.checkPipeCollision(pipe)) {
        if (this.activePowerups.shield) {
          // Shield absorbs hit
          this.activePowerups.shield = false;
          this.pipes.splice(i, 1);
          sounds.playHit();
          this.shakeTime = 200;
          this.createExplosion(this.bird.x, this.bird.y, '#00f2fe');
          continue;
        } else {
          this.gameOver();
          return;
        }
      }

      // Remove off-screen pipes
      if (pipe.x < -pipe.width) {
        this.pipes.splice(i, 1);
      }
    }

    // Update Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.x -= effectivePipeSpeed;

      // Check pickup
      const dx = p.x - this.bird.x;
      const dy = p.y - this.bird.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.bird.radius + p.radius) {
        this.applyPowerup(p.type);
        this.createExplosion(p.x, p.y, p.color);
        this.powerups.splice(i, 1);
        sounds.playPowerup();
        continue;
      }

      if (p.x < -30) {
        this.powerups.splice(i, 1);
      }
    }

    // Ground & Ceiling Collision
    if (this.bird.y + this.bird.radius >= groundY) {
      this.bird.y = groundY - this.bird.radius;
      this.gameOver();
      return;
    }

    if (this.bird.y - this.bird.radius <= 0) {
      this.bird.y = this.bird.radius;
      this.bird.vy = 0;
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= pt.decay;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnPipe() {
    const cfg = this.modesConfig[this.mode];
    const minHeight = 80;
    const maxHeight = this.height - 70 - cfg.pipeGap - minHeight;
    const gapY = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    const pipe = {
      x: this.width + 20,
      width: 64,
      gapY: gapY,
      gapHeight: cfg.pipeGap,
      passed: false,
      moving: cfg.movingPipes || false,
      offset: Math.random() * Math.PI * 2
    };

    this.pipes.push(pipe);

    // Chance to spawn power-up in gap
    if (Math.random() < 0.35) {
      const types = ['feather', 'shield', 'slowmo'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const colorMap = { feather: '#ffb703', shield: '#00f2fe', slowmo: '#a855f7' };

      this.powerups.push({
        x: pipe.x + pipe.width / 2,
        y: gapY + cfg.pipeGap / 2,
        radius: 14,
        type: chosenType,
        color: colorMap[chosenType]
      });
    }
  }

  checkPipeCollision(pipe) {
    const b = this.bird;
    const topPipeBottom = pipe.gapY;
    const bottomPipeTop = pipe.gapY + pipe.gapHeight;

    // Horizontal check
    if (b.x + b.radius > pipe.x && b.x - b.radius < pipe.x + pipe.width) {
      // Vertical check (top pipe OR bottom pipe)
      if (b.y - b.radius < topPipeBottom || b.y + b.radius > bottomPipeTop) {
        return true;
      }
    }
    return false;
  }

  applyPowerup(type) {
    this.powerupsCollected++;
    if (type === 'feather') {
      this.score += 5;
      this.feathersCollected += 5;
      this.onScoreUpdate(this.score, this.highScore);
    } else if (type === 'shield') {
      this.activePowerups.shield = true;
    } else if (type === 'slowmo') {
      this.activePowerups.slowmo = true;
      this.activePowerups.slowmoTime = 6.0; // 6 sec
    }
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        life: 1.0,
        decay: 0.04
      });
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    sounds.playHit();
    this.shakeTime = 350;
    this.createExplosion(this.bird.x, this.bird.y, '#c0262d');

    setTimeout(() => {
      this.onGameOver({
        score: this.score,
        highScore: this.highScore,
        distance: Math.round(this.distance),
        feathers: this.feathersCollected,
        powerups: this.powerupsCollected
      });
    }, 400);
  }

  checkAchievements() {
    if (this.score === 10) {
      this.onAchievement('First Flight', 'Reached a score of 10!');
    } else if (this.score === 25) {
      this.onAchievement('Eagle Master', 'Reached a score of 25!');
    } else if (this.score === 50) {
      this.onAchievement('Century Flight', 'Reached a score of 50!');
    }
  }

  /* RENDER METHODS */

  render() {
    this.ctx.save();

    // Screen Shake
    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * 8;
      const dy = (Math.random() - 0.5) * 8;
      this.ctx.translate(dx, dy);
    }

    this.drawBackground();
    this.drawPipes();
    this.drawPowerups();
    this.drawParticles();
    this.drawBird();
    this.drawGround();

    this.ctx.restore();
  }

  drawBackground() {
    // Dynamic Sky Theme based on score (Day -> Sunset -> Night)
    let skyGradient;
    if (this.score < 15) {
      // Dawn/Day
      skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
      skyGradient.addColorStop(0, '#0f172a');
      skyGradient.addColorStop(0.6, '#1e293b');
      skyGradient.addColorStop(1, '#0d1321');
    } else if (this.score < 35) {
      // Sunset Crimson
      skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
      skyGradient.addColorStop(0, '#2d0612');
      skyGradient.addColorStop(0.5, '#5c1d24');
      skyGradient.addColorStop(1, '#0d1321');
    } else {
      // Cyber Neon Night
      skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
      skyGradient.addColorStop(0, '#050515');
      skyGradient.addColorStop(0.5, '#120826');
      skyGradient.addColorStop(1, '#080512');
    }

    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Stars
    this.ctx.fillStyle = '#ffffff';
    this.bgStars.forEach(s => {
      this.ctx.globalAlpha = s.alpha * (0.8 + Math.sin(this.frameCount * 0.05 + s.x) * 0.2);
      this.ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    this.ctx.globalAlpha = 1.0;

    // Clouds
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    this.clouds.forEach(c => {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 25 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 20 * c.scale, c.y - 10 * c.scale, 30 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 45 * c.scale, c.y, 20 * c.scale, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawPipes() {
    const groundY = this.height - 70;

    this.pipes.forEach(pipe => {
      // Pipe Gradient
      const pipeGrad = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
      pipeGrad.addColorStop(0, '#1e293b');
      pipeGrad.addColorStop(0.3, '#334155');
      pipeGrad.addColorStop(0.7, '#475569');
      pipeGrad.addColorStop(1, '#0f172a');

      // Top Pipe
      this.ctx.fillStyle = pipeGrad;
      this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);
      // Top Pipe Rim
      this.ctx.fillStyle = '#64748b';
      this.ctx.fillRect(pipe.x - 3, pipe.gapY - 18, pipe.width + 6, 18);
      // Glowing cap line
      this.ctx.fillStyle = '#00f2fe';
      this.ctx.fillRect(pipe.x - 3, pipe.gapY - 3, pipe.width + 6, 3);

      // Bottom Pipe
      const bottomHeight = groundY - (pipe.gapY + pipe.gapHeight);
      this.ctx.fillStyle = pipeGrad;
      this.ctx.fillRect(pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, bottomHeight);
      // Bottom Pipe Rim
      this.ctx.fillStyle = '#64748b';
      this.ctx.fillRect(pipe.x - 3, pipe.gapY + pipe.gapHeight, pipe.width + 6, 18);
      // Glowing cap line
      this.ctx.fillStyle = '#00f2fe';
      this.ctx.fillRect(pipe.x - 3, pipe.gapY + pipe.gapHeight, pipe.width + 6, 3);
    });
  }

  drawPowerups() {
    this.powerups.forEach(p => {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);

      // Floating oscillation
      const floatY = Math.sin(this.frameCount * 0.1) * 3;
      this.ctx.translate(0, floatY);

      // Glow aura
      const auraGrad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 1.8);
      auraGrad.addColorStop(0, p.color);
      auraGrad.addColorStop(1, 'transparent');
      this.ctx.fillStyle = auraGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius * 1.8, 0, Math.PI * 2);
      this.ctx.fill();

      // Icon core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      let icon = '🌟';
      if (p.type === 'shield') icon = '🛡️';
      if (p.type === 'slowmo') icon = '⏳';

      this.ctx.fillText(icon, 0, 1);
      this.ctx.restore();
    });
  }

  drawBird() {
    this.ctx.save();
    this.ctx.translate(this.bird.x, this.bird.y);
    this.ctx.rotate(this.bird.rotation);
    this.ctx.scale(this.bird.wingPulse, this.bird.wingPulse);

    // Shield Orb Effect
    if (this.activePowerups.shield) {
      this.ctx.save();
      this.ctx.strokeStyle = '#00f2fe';
      this.ctx.lineWidth = 3;
      this.ctx.shadowColor = '#00f2fe';
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.bird.radius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (this.birdImgLoaded) {
      const drawW = this.bird.width;
      const drawH = this.bird.height;
      this.ctx.drawImage(this.birdImg, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Fallback Eagle Vector Shape
      this.ctx.fillStyle = '#c0262d';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  drawGround() {
    const groundY = this.height - 70;

    // Ground Base
    const groundGrad = this.ctx.createLinearGradient(0, groundY, 0, this.height);
    groundGrad.addColorStop(0, '#151c2c');
    groundGrad.addColorStop(1, '#090d16');

    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, groundY, this.width, 70);

    // Top Glowing Stripe
    this.ctx.fillStyle = '#c0262d';
    this.ctx.fillRect(0, groundY, this.width, 4);

    // Animated Grid Lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    const speedMult = this.activePowerups.slowmo ? 0.6 : 1.0;
    const gridOffset = (this.frameCount * 2 * speedMult) % 20;

    for (let x = -gridOffset; x < this.width; x += 20) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, groundY + 4);
      this.ctx.lineTo(x - 20, this.height);
      this.ctx.stroke();
    }
  }

  loop(timestamp) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
