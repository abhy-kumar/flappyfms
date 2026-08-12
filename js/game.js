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

    // Sprite loading
    this.birdImg = new Image();
    this.birdImgLoaded = false;
    this.loadBirdSprite();

    // Mode configuration
    this.mode = 'classic'; // classic, hardcore, zen

    // Physics constants per mode
    this.modesConfig = {
      classic:  { gravity: 0.45,  jump: -9,   pipeSpeed: 2.8,  pipeGap: 145, pipeIntervalFrames: 90 },
      hardcore: { gravity: 0.52,  jump: -9.5, pipeSpeed: 3.8,  pipeGap: 120, pipeIntervalFrames: 70,  movingPipes: true },
      zen:      { gravity: 0.32,  jump: -8,   pipeSpeed: 2.0,  pipeGap: 180, pipeIntervalFrames: 110 }
    };

    // Game state
    this.state = 'MENU'; // MENU, READY, PLAYING, GAMEOVER
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('flappy_eagle_highscore') || '0', 10);
    this.distance = 0;
    this.feathersCollected = 0;
    this.powerupsCollected = 0;

    // Dimensions (set by resizeCanvas)
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    // Bird Properties
    this.bird = {
      x: 0, y: 0,
      width: 52, height: 52,
      vy: 0, rotation: 0, radius: 20,
      wingPulse: 1.0
    };

    // Power-up states (slowmoTime in SECONDS)
    this.activePowerups = {
      shield: false,
      slowmo: false,
      slowmoTime: 0  // seconds remaining
    };

    // Game Entities
    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.bgStars = [];
    this.clouds = [];
    this.frameCount = 0;  // logical game frames (60 fps target)
    this.shakeFrames = 0; // frames of shake remaining

    this.resizeCanvas();
    this.initBackgroundElements();
    this.bindEvents();

    // Start render/update loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------------------------------------------------------------- */
  /*  ASSET LOADING                                                           */
  /* ---------------------------------------------------------------------- */

  loadBirdSprite() {
    this.birdImg.onload = () => { this.birdImgLoaded = true; };
    this.birdImg.onerror = () => { this.birdImg.src = 'bird.jpeg'; };
    this.birdImg.src = 'bird.png';
  }

  /* ---------------------------------------------------------------------- */
  /*  CANVAS SIZING                                                           */
  /* ---------------------------------------------------------------------- */

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.width  = w;
    this.height = h;

    // Physical pixels
    this.canvas.width  = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // CSS pixels
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';

    // Reset transform and scale once
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Reposition bird to centre-left after resize
    if (this.state === 'MENU' || this.state === 'READY') {
      this.bird.x = w * 0.22;
      this.bird.y = h * 0.45;
    }

    // Regenerate bg elements if needed
    this.initBackgroundElements();
  }

  /* ---------------------------------------------------------------------- */
  /*  BACKGROUND ELEMENTS                                                     */
  /* ---------------------------------------------------------------------- */

  initBackgroundElements() {
    this.bgStars = [];
    for (let i = 0; i < 55; i++) {
      this.bgStars.push({
        x:     Math.random() * this.width,
        y:     Math.random() * this.height * 0.75,
        size:  Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x:     Math.random() * this.width,
        y:     Math.random() * (this.height * 0.45) + 40,
        speed: Math.random() * 0.5 + 0.25,
        scale: Math.random() * 0.6 + 0.55
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  INPUT BINDING                                                           */
  /* ---------------------------------------------------------------------- */

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Keyboard: Space or ArrowUp
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this._handleFlap();
      }
    });

    // Mouse click on the canvas area
    this.canvas.addEventListener('click', (e) => {
      this._handleFlap();
    });

    // Touch / pointer on canvas
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._handleFlap();
    });
  }

  _handleFlap() {
    if (this.state === 'READY') {
      this.startPlay();
      this.flap();
    } else if (this.state === 'PLAYING') {
      this.flap();
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  PUBLIC API                                                              */
  /* ---------------------------------------------------------------------- */

  setMode(mode) {
    if (this.modesConfig[mode]) this.mode = mode;
  }

  resetGame() {
    this.bird.x  = this.width  * 0.22;
    this.bird.y  = this.height * 0.45;
    this.bird.vy = 0;
    this.bird.rotation = 0;

    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.score = 0;
    this.distance = 0;
    this.frameCount = 0;
    this.shakeFrames = 0;
    this.feathersCollected = 0;
    this.powerupsCollected = 0;

    this.activePowerups.shield = false;
    this.activePowerups.slowmo = false;
    this.activePowerups.slowmoTime = 0;

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
    this.bird.wingPulse = 1.35;

    sounds.playFlap();

    // Feather particle trail
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: this.bird.x - 8,
        y: this.bird.y + (Math.random() * 12 - 6),
        vx: -Math.random() * 2.5 - 0.5,
        vy: Math.random() * 2 - 1,
        size: Math.random() * 4 + 2,
        color: `rgba(255,${Math.floor(Math.random()*80+100)},100,0.85)`,
        life: 1.0,
        decay: 0.045
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  UPDATE LOOP (called every frame)                                        */
  /* ---------------------------------------------------------------------- */

  update(dt) {
    // dt is in milliseconds; clamp to prevent large jumps on tab switch
    const dtSec = Math.min(dt, 50) / 1000;
    const cfg = this.modesConfig[this.mode];
    const speedMult = this.activePowerups.slowmo ? 0.55 : 1.0;

    // --- Screen shake ---
    if (this.shakeFrames > 0) this.shakeFrames--;

    // --- Background clouds ---
    this.clouds.forEach(c => {
      c.x -= c.speed * speedMult;
      if (c.x < -120) c.x = this.width + 60;
    });

    // --- READY state: bird bobs in place ---
    if (this.state === 'READY') {
      this.bird.y = this.height * 0.45 + Math.sin(this.frameCount * 0.07) * 9;
      this.bird.rotation = 0;
      this.frameCount++;
      this.updateParticles();
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.frameCount++;
    this.distance += cfg.pipeSpeed * speedMult * dtSec * 60 * 0.12;

    // --- Slow-mo countdown (in seconds) ---
    if (this.activePowerups.slowmo) {
      this.activePowerups.slowmoTime -= dtSec;
      if (this.activePowerups.slowmoTime <= 0) {
        this.activePowerups.slowmo = false;
      }
    }

    // --- Bird physics (pixel/frame at 60fps, scaled by dtSec) ---
    const gravityScale = this.activePowerups.slowmo ? 0.75 : 1.0;
    this.bird.vy += cfg.gravity * gravityScale * (dtSec * 60);
    this.bird.vy  = Math.min(this.bird.vy, 14);   // terminal velocity
    this.bird.y  += this.bird.vy * (dtSec * 60);

    // Wing pulse decay
    if (this.bird.wingPulse > 1.0) this.bird.wingPulse = Math.max(1.0, this.bird.wingPulse - 0.05);

    // Rotation
    if (this.bird.vy < 0) {
      this.bird.rotation = Math.max(-0.45, this.bird.vy * 0.055);
    } else {
      this.bird.rotation = Math.min(1.3, this.bird.rotation + 0.05 * (dtSec * 60));
    }

    // --- Spawn pipes on frame interval ---
    const interval = Math.round(cfg.pipeIntervalFrames / speedMult);
    if (this.frameCount % interval === 0 || this.frameCount === 1) {
      this.spawnPipe();
    }

    // --- Update & collide pipes ---
    const groundY = this.height - 65;

    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= cfg.pipeSpeed * speedMult * (dtSec * 60);

      // Moving pipes (hardcore)
      if (pipe.moving) {
        pipe.gapY += Math.sin(this.frameCount * 0.045 + pipe.offset) * 1.2;
        // Clamp so gap stays on screen
        const minGap = 60;
        const maxGap = groundY - cfg.pipeGap - 60;
        pipe.gapY = Math.max(minGap, Math.min(maxGap, pipe.gapY));
      }

      // Score: passed the pipe
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

      // Collision
      if (this.checkPipeCollision(pipe)) {
        if (this.activePowerups.shield) {
          this.activePowerups.shield = false;
          this.pipes.splice(i, 1);
          sounds.playHit();
          this.shakeFrames = 12;
          this.createExplosion(this.bird.x, this.bird.y, '#00f2fe');
          this.onScoreUpdate(this.score, this.highScore); // refresh UI
          continue;
        } else {
          this.triggerGameOver();
          return;
        }
      }

      // Remove off-screen pipes
      if (pipe.x + pipe.width < -10) this.pipes.splice(i, 1);
    }

    // --- Update power-up items ---
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.x -= cfg.pipeSpeed * speedMult * (dtSec * 60);

      const dx = p.x - this.bird.x;
      const dy = p.y - this.bird.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.bird.radius + p.radius) {
        this.applyPowerup(p.type);
        this.createExplosion(p.x, p.y, p.color);
        this.powerups.splice(i, 1);
        sounds.playPowerup();
        continue;
      }
      if (p.x + p.radius < 0) this.powerups.splice(i, 1);
    }

    // --- Ground & ceiling collision ---
    if (this.bird.y + this.bird.radius >= groundY) {
      this.bird.y = groundY - this.bird.radius;
      this.triggerGameOver();
      return;
    }
    if (this.bird.y - this.bird.radius <= 0) {
      this.bird.y = this.bird.radius;
      this.bird.vy = 0;
    }

    this.updateParticles();
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x   += pt.vx;
      pt.y   += pt.vy;
      pt.vy  += 0.1; // slight gravity on particles
      pt.life -= pt.decay;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  PIPE SPAWNING                                                           */
  /* ---------------------------------------------------------------------- */

  spawnPipe() {
    const cfg   = this.modesConfig[this.mode];
    const groundY = this.height - 65;
    const minGapY  = 70;
    const maxGapY  = groundY - cfg.pipeGap - 60;
    const gapY     = Math.random() * (maxGapY - minGapY) + minGapY;

    this.pipes.push({
      x:         this.width + 30,
      width:     68,
      gapY:      gapY,
      gapHeight: cfg.pipeGap,
      passed:    false,
      moving:    cfg.movingPipes || false,
      offset:    Math.random() * Math.PI * 2
    });

    // 30% chance to place a power-up in the gap centre
    if (Math.random() < 0.30) {
      const types    = ['feather', 'shield', 'slowmo'];
      const type     = types[Math.floor(Math.random() * types.length)];
      const colorMap = { feather: '#ffb703', shield: '#00f2fe', slowmo: '#a855f7' };
      this.powerups.push({
        x:      this.width + 30 + 34,   // centred on pipe
        y:      gapY + cfg.pipeGap / 2,
        radius: 15,
        type,
        color:  colorMap[type]
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  COLLISION DETECTION                                                     */
  /* ---------------------------------------------------------------------- */

  checkPipeCollision(pipe) {
    const bx = this.bird.x;
    const by = this.bird.y;
    const br = this.bird.radius * 0.82; // slight forgiveness margin

    // Quick horizontal rejection
    if (bx + br <= pipe.x || bx - br >= pipe.x + pipe.width) return false;

    // Hit top pipe?
    if (by - br < pipe.gapY) return true;
    // Hit bottom pipe?
    if (by + br > pipe.gapY + pipe.gapHeight) return true;

    return false;
  }

  /* ---------------------------------------------------------------------- */
  /*  POWER-UPS                                                               */
  /* ---------------------------------------------------------------------- */

  applyPowerup(type) {
    this.powerupsCollected++;
    if (type === 'feather') {
      this.score += 5;
      this.feathersCollected += 5;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('flappy_eagle_highscore', this.highScore.toString());
      }
      this.onScoreUpdate(this.score, this.highScore);
    } else if (type === 'shield') {
      this.activePowerups.shield = true;
    } else if (type === 'slowmo') {
      this.activePowerups.slowmo = true;
      this.activePowerups.slowmoTime = 6; // 6 seconds
    }
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size:  Math.random() * 5 + 2,
        color,
        life:  1.0,
        decay: 0.038
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  GAME OVER                                                               */
  /* ---------------------------------------------------------------------- */

  triggerGameOver() {
    this.state = 'GAMEOVER';
    sounds.playHit();
    this.shakeFrames = 18;
    this.createExplosion(this.bird.x, this.bird.y, '#c0262d');

    setTimeout(() => {
      this.onGameOver({
        score:     this.score,
        highScore: this.highScore,
        distance:  Math.round(this.distance),
        powerups:  this.powerupsCollected
      });
    }, 500);
  }

  /* ---------------------------------------------------------------------- */
  /*  ACHIEVEMENTS                                                            */
  /* ---------------------------------------------------------------------- */

  checkAchievements() {
    const milestones = {
      5:  ['First Flight',    'You scored 5 — the journey begins!'],
      10: ['Eagle Eyes',      'Reached 10! Eyes sharp as an eagle.'],
      25: ['Storm Rider',     'Score of 25 — riding the storm!'],
      50: ['Sky Sovereign',   'Score of 50 — you rule the skies!'],
      100:['Legend of FMS',   'Score of 100 — an absolute legend!']
    };
    if (milestones[this.score]) {
      const [title, desc] = milestones[this.score];
      this.onAchievement(title, desc);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  render() {
    this.ctx.save();

    if (this.shakeFrames > 0) {
      this.ctx.translate(
        (Math.random() - 0.5) * 7,
        (Math.random() - 0.5) * 7
      );
    }

    this.drawBackground();
    this.drawPipes();
    this.drawPowerupItems();
    this.drawParticles();
    this.drawBird();
    this.drawGround();

    this.ctx.restore();
  }

  drawBackground() {
    let top, mid, bot;
    if (this.score < 15) {
      top = '#0a0f1e'; mid = '#162033'; bot = '#0d1321';
    } else if (this.score < 35) {
      top = '#1a0208'; mid = '#4a1520'; bot = '#0d1321';
    } else {
      top = '#03030e'; mid = '#0d0520'; bot = '#050210';
    }

    const sky = this.ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0,   top);
    sky.addColorStop(0.6, mid);
    sky.addColorStop(1,   bot);
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Stars
    this.bgStars.forEach(s => {
      this.ctx.globalAlpha = s.alpha * (0.7 + Math.sin(this.frameCount * 0.04 + s.x * 0.01) * 0.3);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    this.ctx.globalAlpha = 1;

    // Clouds
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
    this.clouds.forEach(c => {
      this.ctx.beginPath();
      this.ctx.arc(c.x,             c.y,               28 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 22*c.scale, c.y - 11*c.scale, 33 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 48*c.scale, c.y,               22 * c.scale, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawPipes() {
    const groundY = this.height - 65;

    this.pipes.forEach(pipe => {
      const grad = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
      grad.addColorStop(0,   '#1a2540');
      grad.addColorStop(0.35,'#2e4060');
      grad.addColorStop(0.65,'#3a5070');
      grad.addColorStop(1,   '#0e1830');

      // ---- Top Pipe ----
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);

      // Rim cap
      this.ctx.fillStyle = '#546e7a';
      this.ctx.fillRect(pipe.x - 5, pipe.gapY - 22, pipe.width + 10, 22);

      // Glowing edge
      this.ctx.fillStyle = '#00f2fe';
      this.ctx.shadowColor  = '#00f2fe';
      this.ctx.shadowBlur   = 8;
      this.ctx.fillRect(pipe.x - 5, pipe.gapY - 4, pipe.width + 10, 4);
      this.ctx.shadowBlur = 0;

      // ---- Bottom Pipe ----
      const bottomTop    = pipe.gapY + pipe.gapHeight;
      const bottomHeight = groundY - bottomTop;

      this.ctx.fillStyle = grad;
      this.ctx.fillRect(pipe.x, bottomTop, pipe.width, bottomHeight);

      // Rim cap
      this.ctx.fillStyle = '#546e7a';
      this.ctx.fillRect(pipe.x - 5, bottomTop, pipe.width + 10, 22);

      // Glowing edge
      this.ctx.fillStyle = '#00f2fe';
      this.ctx.shadowColor = '#00f2fe';
      this.ctx.shadowBlur  = 8;
      this.ctx.fillRect(pipe.x - 5, bottomTop, pipe.width + 10, 4);
      this.ctx.shadowBlur = 0;
    });
  }

  drawPowerupItems() {
    this.powerups.forEach(p => {
      this.ctx.save();
      const floatY = Math.sin(this.frameCount * 0.11) * 4;
      this.ctx.translate(p.x, p.y + floatY);

      // Glow halo
      const halo = this.ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2);
      halo.addColorStop(0,   p.color + 'cc');
      halo.addColorStop(0.5, p.color + '44');
      halo.addColorStop(1,   'transparent');
      this.ctx.fillStyle = halo;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Emoji icon
      this.ctx.font = '16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const icon = p.type === 'shield' ? '🛡️' : p.type === 'slowmo' ? '⏳' : '🌟';
      this.ctx.fillText(icon, 0, 1);

      this.ctx.restore();
    });
  }

  drawBird() {
    this.ctx.save();
    this.ctx.translate(this.bird.x, this.bird.y);
    this.ctx.rotate(this.bird.rotation);
    this.ctx.scale(this.bird.wingPulse, this.bird.wingPulse);

    // Shield ring
    if (this.activePowerups.shield) {
      this.ctx.strokeStyle  = '#00f2fe';
      this.ctx.lineWidth    = 3;
      this.ctx.shadowColor  = '#00f2fe';
      this.ctx.shadowBlur   = 18;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.bird.radius + 10, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    if (this.birdImgLoaded) {
      const hw = this.bird.width  / 2;
      const hh = this.bird.height / 2;
      this.ctx.drawImage(this.birdImg, -hw, -hh, this.bird.width, this.bird.height);
    } else {
      // Fallback circle
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
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle   = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  drawGround() {
    const groundY = this.height - 65;

    const grad = this.ctx.createLinearGradient(0, groundY, 0, this.height);
    grad.addColorStop(0, '#121a2e');
    grad.addColorStop(1, '#080c18');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, groundY, this.width, this.height - groundY);

    // Crimson stripe
    this.ctx.fillStyle    = '#c0262d';
    this.ctx.shadowColor  = '#c0262d';
    this.ctx.shadowBlur   = 10;
    this.ctx.fillRect(0, groundY, this.width, 4);
    this.ctx.shadowBlur = 0;

    // Scrolling grid perspective lines
    const speedMult = this.activePowerups.slowmo ? 0.55 : 1.0;
    const offset = (this.frameCount * 2.5 * speedMult) % 24;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    this.ctx.lineWidth   = 1;
    for (let x = -offset; x < this.width + 24; x += 24) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, groundY + 4);
      this.ctx.lineTo(x - 28, this.height);
      this.ctx.stroke();
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  MAIN LOOP                                                               */
  /* ---------------------------------------------------------------------- */

  loop(timestamp) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}
