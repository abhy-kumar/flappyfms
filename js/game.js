/* ==========================================================================
   GAME ENGINE - FLAPPY FMS
   --------------------------------------------------------------------------
   Simulation runs on a FIXED 60 Hz timestep behind a variable-rate render
   loop. The previous build mixed dt-scaled values with raw per-frame values,
   so on a 120/144 Hz display particles, clouds, wing animation and — worst of
   all — the Hardcore moving pipes all ran 2-2.4x too fast. Every constant in
   here is "per 60 Hz step", exactly matching the old numbers at 60 fps, so
   the flight feel is unchanged while the behaviour is now identical on any
   refresh rate.

   The engine owns simulation + rendering only. All DOM input is bound in
   app.js, which decides whether input is allowed (fixes flaps registering
   while a modal is open).
   ========================================================================== */

const STEP_MS  = 1000 / 60;
const STEP_SEC = 1 / 60;

/* --------------------------------------------------------------------------
   MODE CONFIGURATION
   Base physics values are IDENTICAL to the previous build. What is new is the
   difficulty ramp: speed creeps up and gaps/spacing tighten as the score
   climbs, then hard-stop at a floor so the game never becomes impossible.
   Zen has no ramp at all — it is meant to stay relaxed.
   -------------------------------------------------------------------------- */
const MODES = {
  classic: {
    label: 'CLASSIC',
    gravity: 0.42, jump: -8.5, pipeSpeed: 2.4,
    pipeGapFrac: 0.38, pipeSpacingPx: 320,
    movingPipes: false,
    rampScore: 40, rampSpeed: 0.35, gapShrink: 0.05, spacingShrink: 0.10,
    powerupChance: 0.30,
    medals: { bronze: 10, silver: 25, gold: 50, platinum: 100 }
  },
  hardcore: {
    label: 'HARDCORE',
    gravity: 0.50, jump: -9.0, pipeSpeed: 3.2,
    pipeGapFrac: 0.30, pipeSpacingPx: 270,
    movingPipes: true,
    rampScore: 30, rampSpeed: 0.40, gapShrink: 0.035, spacingShrink: 0.12,
    powerupChance: 0.36,
    medals: { bronze: 8, silver: 18, gold: 35, platinum: 70 }
  },
  zen: {
    label: 'ZEN',
    gravity: 0.30, jump: -7.8, pipeSpeed: 1.8,
    pipeGapFrac: 0.46, pipeSpacingPx: 370,
    movingPipes: false,
    rampScore: 0, rampSpeed: 0, gapShrink: 0, spacingShrink: 0,
    powerupChance: 0.26,
    medals: { bronze: 15, silver: 40, gold: 75, platinum: 150 }
  }
};

/* --------------------------------------------------------------------------
   POWER-UP DEFINITIONS
   -------------------------------------------------------------------------- */
const POWERUPS = {
  feather: { icon: '<i class="fa-solid fa-star"></i>',           color: '#ffb703', label: 'GOLDEN FEATHER', weight: 30, duration: 0 },
  shield:  { icon: '<i class="fa-solid fa-shield-halved"></i>',  color: '#00f2fe', label: 'SHIELD',         weight: 20, duration: 0 },
  slowmo:  { icon: '<i class="fa-solid fa-hourglass-half"></i>', color: '#a855f7', label: 'SLOW-MO',        weight: 16, duration: 6 },
  magnet:  { icon: '<i class="fa-solid fa-magnet"></i>',         color: '#f43f5e', label: 'MAGNET',         weight: 14, duration: 8 },
  double:  { icon: '<i class="fa-solid fa-gem"></i>',            color: '#22d3ee', label: '2× POINTS',      weight: 13, duration: 10 },
  ghost:   { icon: '<i class="fa-solid fa-ghost"></i>',          color: '#e2e8f0', label: 'GHOST',          weight: 7,  duration: 5 }
};

const NEAR_MISS_PX = 20;   // clearance under this counts as a close call
const MAX_MULT     = 5;

/* --------------------------------------------------------------------------
   SMALL HELPERS
   -------------------------------------------------------------------------- */
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }

function parseColor(str) {
  if (!str) return [255, 255, 255, 1.0];
  if (str.startsWith('#')) {
    const h = str.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [isNaN(r) ? 255 : r, isNaN(g) ? 255 : g, isNaN(b) ? 255 : b, 1.0];
  }
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] !== undefined ? parseFloat(match[4]) : 1.0
    ];
  }
  return [255, 255, 255, 1.0];
}

function mixColor(c1, c2, t) {
  const a = parseColor(c1), b = parseColor(c2);
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  const alpha = lerp(a[3], b[3], t);
  if (alpha >= 0.999) return `rgb(${r},${g},${bl})`;
  return `rgba(${r},${g},${bl},${alpha.toFixed(3)})`;
}

/* Sky palettes — 6 progressive atmospheric stages smoothly interpolated across high scores.
   Inspired by Alto's Odyssey & Journey: calming warm dusk → midnight → dawn progression */
const SKIES = [
  // 1. Stage 0 (0-50): Soft Indigo Night — gentle starlit sky, silver moon, calm deep blue
  {
    at: 0,
    top: '#0d0d2b', mid: '#1a1a4e', bot: '#2d2b6e',
    star: 1.0,
    mountainFar: '#151532',
    skylineMid: '#1e1c45',
    hillNear: '#252358',
    waterTop: 'rgba(30,28,80,0.85)',
    waterBot: 'rgba(13,13,43,0.95)',
    moonColor: '#f0f4ff',
    moonGlow: 'rgba(180,190,255,0.35)',
    aurora: 'rgba(130,140,255,0.10)',
    cloudTint: 'rgba(120,130,200,0.10)'
  },
  // 2. Stage 50 (50-150): Warm Dusk Amber — honey glow on the horizon, rose sky
  {
    at: 50,
    top: '#1a0d2e', mid: '#3d1f1f', bot: '#6b3030',
    star: 0.65,
    mountainFar: '#1f1020',
    skylineMid: '#311620',
    hillNear: '#472030',
    waterTop: 'rgba(80,35,40,0.80)',
    waterBot: 'rgba(30,12,20,0.95)',
    moonColor: '#ffd6b0',
    moonGlow: 'rgba(255,180,80,0.35)',
    aurora: 'rgba(255,140,100,0.12)',
    cloudTint: 'rgba(200,140,100,0.12)'
  },
  // 3. Stage 150 (150-350): Golden Twilight — warm amber and rose, soft brushstroke hills
  {
    at: 150,
    top: '#0e0820', mid: '#2a1535', bot: '#55306e',
    star: 0.80,
    mountainFar: '#190d28',
    skylineMid: '#281440',
    hillNear: '#3d1e5a',
    waterTop: 'rgba(60,30,85,0.80)',
    waterBot: 'rgba(18,10,35,0.95)',
    moonColor: '#ffe8f0',
    moonGlow: 'rgba(220,130,200,0.35)',
    aurora: 'rgba(200,100,220,0.13)',
    cloudTint: 'rgba(180,120,200,0.12)'
  },
  // 4. Stage 350 (350-650): Deep Peacock Night — teal & blue-green calm
  {
    at: 350,
    top: '#041218', mid: '#072535', bot: '#0c3d50',
    star: 1.0,
    mountainFar: '#051820',
    skylineMid: '#082d3e',
    hillNear: '#0b3d52',
    waterTop: 'rgba(10,50,65,0.80)',
    waterBot: 'rgba(4,18,24,0.95)',
    moonColor: '#d4f7ed',
    moonGlow: 'rgba(60,200,170,0.32)',
    aurora: 'rgba(40,200,160,0.13)',
    cloudTint: 'rgba(60,160,150,0.10)'
  },
  // 5. Stage 650 (650-1000): Sunrise Rose — first light, coral & peach above dark mountains
  {
    at: 650,
    top: '#100610', mid: '#28101e', bot: '#4e2040',
    star: 0.55,
    mountainFar: '#180a18',
    skylineMid: '#28102a',
    hillNear: '#3e183e',
    waterTop: 'rgba(65,25,60,0.80)',
    waterBot: 'rgba(18,8,20,0.95)',
    moonColor: '#fff0e8',
    moonGlow: 'rgba(255,200,150,0.45)',
    aurora: 'rgba(255,160,120,0.18)',
    cloudTint: 'rgba(220,160,140,0.13)'
  },
  // 6. Stage 1000+: Clear Pre-Dawn — deep violet fades to soft pearl horizon
  {
    at: 1000,
    top: '#08051a', mid: '#140e3a', bot: '#261a5e',
    star: 1.0,
    mountainFar: '#0d0a22',
    skylineMid: '#18123a',
    hillNear: '#221a50',
    waterTop: 'rgba(30,22,80,0.80)',
    waterBot: 'rgba(8,5,26,0.95)',
    moonColor: '#ffffff',
    moonGlow: 'rgba(200,180,255,0.50)',
    aurora: 'rgba(160,140,255,0.18)',
    cloudTint: 'rgba(160,150,230,0.12)'
  }
];

/* ========================================================================== */

class FlappyGame {
  constructor(canvas, emit) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.emit = emit || function () {};

    this.birdImg = new Image();
    this.birdImgLoaded = false;
    this.loadBirdSprite();

    this.mode = Settings.get('mode') || 'classic';
    if (!MODES[this.mode]) this.mode = 'classic';

    /* MENU | READY | PLAYING | PAUSED | COUNTDOWN | DYING | GAMEOVER */
    this.state = 'MENU';

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.bird = {
      x: 0, y: 0, width: 52, height: 52,
      vy: 0, rotation: 0, radius: 20, wingPulse: 1.0
    };

    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.bgStars = [];
    this.clouds = [];
    this.ambientMotes = [];
    this.shootingStars = [];

    // Continuous smooth parallax scroll accumulators (never snap on speed changes)
    this.scrollFar = 0;
    this.scrollMid = 0;
    this.scrollNear = 0;
    this.scrollGround = 0;
    this.auroraPhase = 0;
    this.smoothedScore = 0;

    this.active = {};              // powerup -> steps remaining (shield = Infinity)
    this.resetRunState();

    this.frameCount = 0;
    this.shakeFrames = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.countdown = 0;
    this.dyingTicks = 0;
    this.accumulator = 0;
    this.running = true;
    this.fpsSamples = [];

    this.resizeCanvas();
    this.initBackgroundElements();
    window.addEventListener('resize', () => this.resizeCanvas());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resizeCanvas());
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------------------------------------------------------------- */
  /*  ASSETS                                                                 */
  /* ---------------------------------------------------------------------- */

  loadBirdSprite() {
    this.birdImg.onload = () => { this.birdImgLoaded = true; };
    this.birdImg.onerror = () => {
      // Only try the fallback once, otherwise a missing jpeg loops forever.
      if (!this._triedFallback) {
        this._triedFallback = true;
        this.birdImg.src = 'bird.jpeg';
      }
    };
    this.birdImg.src = 'bird.png';
  }

  /* ---------------------------------------------------------------------- */
  /*  SIZING                                                                 */
  /* ---------------------------------------------------------------------- */

  get groundY() {
    return this.height - Math.min(65, this.height * 0.14);
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);

    const prevW = this.width || w;
    const prevH = this.height || h;

    // devicePixelRatio is re-read every resize — the old build cached it once
    // in the constructor, so zooming or moving to another monitor rendered blurry.
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 3);

    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';

    // Rescale the live world so a mid-flight resize (mobile URL bar collapsing,
    // desktop window drag, orientation change) stays fair instead of leaving
    // pipes with gaps computed for the old height.
    const sx = w / prevW;
    const sy = h / prevH;
    if (sx !== 1 || sy !== 1) {
      this.pipes.forEach(p => {
        p.x *= sx;
        p.gapY *= sy;
        p.gapHeight *= sy;
      });
      this.powerups.forEach(p => { p.x *= sx; p.y *= sy; });
      this.bird.y *= sy;
    }

    this.bird.x = w * 0.22;
    if (this.state === 'MENU' || this.state === 'READY') this.bird.y = h * 0.45;
    this.bird.y = clamp(this.bird.y, this.bird.radius, this.groundY - this.bird.radius);

    this.initBackgroundElements(sx, sy);
  }

  initBackgroundElements(sx = 1, sy = 1) {
    const reduced = Settings.get('reducedMotion');
    const starCount = reduced ? 40 : 80;
    const starColors = ['#ffffff', '#e0f2fe', '#fef3c7', '#fed7aa', '#c7d2fe'];

    if (this.bgStars.length > 0 && sx !== 1) {
      this.bgStars.forEach(s => { s.x *= sx; s.y *= sy; });
      this.clouds.forEach(c => { c.x *= sx; c.y *= sy; });
      if (this.ambientMotes) this.ambientMotes.forEach(m => { m.x *= sx; m.y *= sy; });
      return;
    }

    this.bgStars = [];
    for (let i = 0; i < starCount; i++) {
      this.bgStars.push({
        x: Math.random() * (this.width || 400),
        y: Math.random() * ((this.height || 600) * 0.72),
        size: Math.random() * 2.2 + 0.6,
        alpha: Math.random() * 0.7 + 0.3,
        depth: Math.random() * 0.28 + 0.05,
        phase: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)]
      });
    }

    this.shootingStars = [];

    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random() * (this.width || 400),
        y: Math.random() * ((this.height || 600) * 0.42) + 25,
        speed: Math.random() * 0.35 + 0.15,
        scale: Math.random() * 0.65 + 0.55
      });
    }

    this.ambientMotes = [];
    if (!reduced) {
      const moteColors = ['#00f2fe', '#ffd700', '#f43f5e', '#a855f7', '#38bdf8'];
      for (let i = 0; i < 24; i++) {
        this.ambientMotes.push({
          x: Math.random() * (this.width || 400),
          y: Math.random() * (this.height || 600),
          vx: Math.random() * 0.35 + 0.15,
          vy: Math.random() * 0.3 + 0.1,
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.6 + 0.2,
          phase: Math.random() * Math.PI * 2,
          color: moteColors[Math.floor(Math.random() * moteColors.length)]
        });
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  DIFFICULTY                                                             */
  /* ---------------------------------------------------------------------- */

  get cfg() { return MODES[this.mode]; }

  /* 0 -> 1 progression through the mode's ramp window. */
  get ramp() {
    const c = this.cfg;
    return c.rampScore ? clamp(this.score / c.rampScore, 0, 1) : 0;
  }

  get pipeSpeed() {
    const c = this.cfg;
    return c.pipeSpeed * (1 + c.rampSpeed * this.ramp);
  }

  get pipeSpacing() {
    const c = this.cfg;
    return c.pipeSpacingPx * (1 - c.spacingShrink * this.ramp);
  }

  get pipeGapPx() {
    const c = this.cfg;
    const frac = c.pipeGapFrac - c.gapShrink * this.ramp;
    // Clamped so the gap stays a real challenge on tall desktop screens and
    // stays survivable on short landscape phones.
    return clamp(Math.round(this.height * frac), 145, 300);
  }

  get speedMult() { return this.active.slowmo ? 0.55 : 1.0; }

  /* ---------------------------------------------------------------------- */
  /*  RUN LIFECYCLE                                                          */
  /* ---------------------------------------------------------------------- */

  resetRunState() {
    this.score = 0;
    this.distance = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.nearMisses = 0;
    this.powerupsCollected = 0;
    this.shieldSaves = 0;
    this.ghostPasses = 0;
    this.pipesPassed = 0;
    this.runTicks = 0;
    this.beatBest = false;
    this.startingBest = this.best;   // snapshot so "new record" is judged against the run start
    this.active = { shield: false, slowmo: 0, magnet: 0, double: 0, ghost: 0 };
  }

  get bests() { return Store.get('bests', {}); }

  get best() { return this.bests[this.mode] || 0; }

  saveBest() {
    const bests = this.bests;
    if (this.score > (bests[this.mode] || 0)) {
      bests[this.mode] = this.score;
      Store.set('bests', bests);
      if (!this.beatBest && this.score > 0) {
        this.beatBest = true;
        // Only celebrate an actual overtake. On a mode's very first run there
        // is no previous record to beat, so the toast would be meaningless.
        if (this.startingBest > 0) this.emit('record', { score: this.score, mode: this.mode });
      }
    }
  }

  setMode(mode) {
    if (!MODES[mode]) return;
    this.mode = mode;
    Settings.set('mode', mode);
    this.emit('mode', { mode, label: MODES[mode].label, best: this.best });
  }

  resetGame() {
    this.pipes = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.resetRunState();

    this.bird.x = this.width * 0.22;
    this.bird.y = this.height * 0.45;
    this.bird.vy = 0;
    this.bird.rotation = 0;
    this.bird.wingPulse = 1;

    this.frameCount = 0;
    this.shakeFrames = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.countdown = 0;
    this.dyingTicks = 0;
    // ~200px of clear runway before the first pipe appears.
    this.distanceSinceLastPipe = Math.max(0, this.pipeSpacing - 200);

    this.setState('READY');
    this.pushScore();
    this.emit('powerups', this.powerupSnapshot());
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    if (typeof sounds !== 'undefined' && sounds.setGameState) {
      sounds.setGameState(next, this.mode);
    }
    this.emit('state', { state: next });
  }

  startPlay() {
    if (this.state === 'READY') this.setState('PLAYING');
  }

  pause() {
    if (this.state !== 'PLAYING' && this.state !== 'COUNTDOWN') return false;
    this.pausedFrom = 'PLAYING';
    this.setState('PAUSED');
    sounds.playPause();
    return true;
  }

  resume() {
    if (this.state !== 'PAUSED') return false;
    sounds.playResume();
    this.countdown = 3 * 45;      // 3 second countdown at 60Hz
    this.setState('COUNTDOWN');
    return true;
  }

  togglePause() {
    if (this.state === 'PAUSED') return this.resume();
    return this.pause();
  }

  /* ---------------------------------------------------------------------- */
  /*  INPUT (called by app.js)                                               */
  /* ---------------------------------------------------------------------- */

  handleFlap() {
    if (this.state === 'READY') {
      this.startPlay();
      this.flap();
      return true;
    }
    if (this.state === 'PLAYING') {
      this.flap();
      return true;
    }
    return false;
  }

  flap() {
    this.bird.vy = this.cfg.jump;
    this.bird.wingPulse = 1.35;
    sounds.playFlap();
    this.haptic(8);

    if (!Settings.get('reducedMotion')) {
      for (let i = 0; i < 7; i++) {
        this.particles.push({
          x: this.bird.x - 8,
          y: this.bird.y + (Math.random() * 12 - 6),
          vx: -Math.random() * 2.5 - 0.5,
          vy: Math.random() * 2 - 1,
          size: Math.random() * 4 + 2,
          color: `rgba(255,${Math.floor(Math.random() * 80 + 100)},100,0.85)`,
          life: 1.0, decay: 0.045, gravity: 0.1
        });
      }
    }
  }

  haptic(ms) {
    if (!Settings.get('haptics')) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ }
  }

  /* ---------------------------------------------------------------------- */
  /*  BACKGROUND SIMULATION                                                  */
  /* ---------------------------------------------------------------------- */

  updateBackground() {
    if (this.state === 'PAUSED') return;

    // Exponentially smoothed score prevents any color pops or discrete jumps
    this.smoothedScore += (this.score - this.smoothedScore) * 0.035;

    const moving = (this.state === 'PLAYING');
    const baseSpeed = moving ? this.pipeSpeed * this.speedMult : 0.8;

    this.scrollFar += baseSpeed * 0.08;
    this.scrollMid += baseSpeed * 0.22;
    this.scrollNear += baseSpeed * 0.50;
    this.scrollGround += baseSpeed;
    this.auroraPhase += 0.012;

    const w = this.width || 400;
    const h = this.height || 600;

    // Smooth starfield wrapping without jumping Y
    this.bgStars.forEach(s => {
      s.x -= baseSpeed * s.depth;
      if (s.x < -10) s.x += w + 20;
    });

    // Smooth volumetric cloud drifting
    this.clouds.forEach(c => {
      c.x -= c.speed * baseSpeed;
      if (c.x < -140 * c.scale) {
        c.x = w + 40;
        c.y = Math.random() * (h * 0.42) + 25;
      }
    });

    // Smooth ambient motes
    if (!Settings.get('reducedMotion')) {
      this.ambientMotes.forEach(m => {
        m.x -= m.vx * (moving ? this.speedMult : 0.35);
        m.y -= m.vy;
        if (m.x < -10) m.x = w + 10;
        if (m.y < -10) m.y = this.groundY;
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  SIMULATION — one fixed 60 Hz step                                      */
  /* ---------------------------------------------------------------------- */

  step() {
    this.frameCount++;

    if (this.shakeFrames > 0) this.shakeFrames--;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.05);

    this.updateBackground();

    if (this.state === 'PAUSED') return;

    // Particles and popups keep animating in every state — the old build
    // returned early on GAMEOVER, freezing the death explosion mid-air.
    this.updateParticles();
    this.updatePopups();

    if (this.state === 'COUNTDOWN') {
      this.countdown--;
      if (this.countdown <= 0) this.setState('PLAYING');
      return;
    }

    // The bird idles on the menu too, so the backdrop behind the start card
    // is alive rather than a frozen frame.
    if (this.state === 'READY' || this.state === 'MENU') {
      this.bird.y = this.height * 0.45 + Math.sin(this.frameCount * 0.07) * 9;
      this.bird.rotation = 0;
      return;
    }

    if (this.state === 'DYING') { this.stepDying(); return; }
    if (this.state !== 'PLAYING') return;

    if (this.hitStop > 0) { this.hitStop--; return; }

    this.runTicks++;
    this.stepPlaying();
  }

  stepPlaying() {
    const cfg = this.cfg;
    const mult = this.speedMult;
    const speed = this.pipeSpeed * mult;
    const groundY = this.groundY;

    this.distance += speed * 0.12;

    // --- timed power-ups (stored in steps, decremented once per step) ---
    let timedActive = false;
    let timedJustExpired = false;
    ['slowmo', 'magnet', 'double', 'ghost'].forEach(key => {
      if (this.active[key] > 0) {
        this.active[key]--;
        if (this.active[key] > 0) {
          timedActive = true;
        } else {
          timedJustExpired = true;
          if (key === 'slowmo' && typeof sounds !== 'undefined' && sounds.setTempoModifier) {
            sounds.setTempoModifier(1.0);
          }
        }
      }
    });

    if (timedActive || timedJustExpired) {
      this.emit('powerups', this.powerupSnapshot());
    }

    if (this.active.slowmo > 0 && typeof sounds !== 'undefined' && sounds.setTempoModifier) {
      sounds.setTempoModifier(0.65);
    }

    // --- bird physics (identical constants to the 60fps original) ---
    const gravityScale = this.active.slowmo ? 0.75 : 1.0;
    this.bird.vy = Math.min(this.bird.vy + cfg.gravity * gravityScale, 14);
    this.bird.y += this.bird.vy;

    if (this.bird.wingPulse > 1.0) this.bird.wingPulse = Math.max(1.0, this.bird.wingPulse - 0.05);

    if (this.bird.vy < 0) this.bird.rotation = Math.max(-0.45, this.bird.vy * 0.055);
    else this.bird.rotation = Math.min(1.3, this.bird.rotation + 0.05);

    // --- spawn pipes by distance travelled, not by frame count ---
    this.distanceSinceLastPipe += speed;
    const spacing = this.pipeSpacing;
    if (this.distanceSinceLastPipe >= spacing) {
      this.distanceSinceLastPipe -= spacing;
      this.spawnPipe();
    }

    // --- pipes ---
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= speed;

      if (pipe.moving) {
        pipe.gapY += Math.sin(this.frameCount * 0.045 + pipe.offset) * 1.2;
        const minGap = Math.round(this.height * 0.12);
        const maxGap = groundY - pipe.gapHeight - Math.round(this.height * 0.10);
        pipe.gapY = clamp(pipe.gapY, minGap, Math.max(minGap + 10, maxGap));
      }

      // Track the tightest clearance while the bird overlaps this pipe so a
      // near miss can be scored at the moment it is cleared.
      const br = this.hitRadius;
      if (this.bird.x + br > pipe.x && this.bird.x - br < pipe.x + pipe.width) {
        const clearTop = (this.bird.y - br) - pipe.gapY;
        const clearBot = (pipe.gapY + pipe.gapHeight) - (this.bird.y + br);
        pipe.minClear = Math.min(pipe.minClear, Math.max(0, Math.min(clearTop, clearBot)));
      }

      if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
        pipe.passed = true;
        this.onPipeCleared(pipe);
      }

      if (this.checkPipeCollision(pipe)) {
        if (this.active.ghost > 0) {
          if (!pipe.ghosted) { pipe.ghosted = true; this.ghostPasses++; }
        } else if (this.active.shield) {
          this.active.shield = false;
          this.shieldSaves++;
          this.combo = 0;
          pipe.alive = false;
          pipe.passed = true;
          this.pipes.splice(i, 1);
          sounds.playShieldBreak();
          this.haptic([15, 40, 15]);
          this.shake(8);
          this.hitStop = 4;
          this.createExplosion(this.bird.x, this.bird.y, POWERUPS.shield.color, 28);
          this.addPopup(this.bird.x, this.bird.y - 40, 'SHIELD SAVE!', POWERUPS.shield.color);
          this.unlock('shielded');
          if (this.shieldSaves >= 3) this.unlock('iron_shield');
          this.emit('powerups', this.powerupSnapshot());
          this.pushScore();
          continue;
        } else {
          this.triggerDeath();
          return;
        }
      }

      if (pipe.x + pipe.width < -10) {
        pipe.alive = false;
        this.pipes.splice(i, 1);
      }
    }

    // --- power-up pickups ---
    const magnetRange = this.active.magnet > 0 ? 190 : 0;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];

      if (p.pipe && p.pipe.alive && !p.magnetized) {
        // Ride with the pipe. The old build spawned pickups at a fixed world
        // position, so in Hardcore the moving pillar drifted over the pickup
        // and made it impossible (or lethal) to collect.
        p.x = p.pipe.x + p.pipe.width / 2;
        p.y = p.pipe.gapY + p.pipe.gapHeight / 2;
      } else {
        if (p.pipe && !p.pipe.alive) p.pipe = null;
        p.x -= speed;
      }

      const dx = this.bird.x - p.x;
      const dy = this.bird.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (magnetRange && dist < magnetRange) {
        p.magnetized = true;
        p.pipe = null;
        const pull = 4.2 * (1 - dist / magnetRange) + 1.2;
        p.x += (dx / (dist || 1)) * pull;
        p.y += (dy / (dist || 1)) * pull;
      }

      if (dist < this.bird.radius + p.radius) {
        this.applyPowerup(p.type, p.x, p.y);
        this.powerups.splice(i, 1);
        continue;
      }
      if (p.x + p.radius < -20) this.powerups.splice(i, 1);
    }

    // --- world bounds ---
    if (this.bird.y + this.hitRadius >= groundY) {
      this.bird.y = groundY - this.hitRadius;
      this.triggerDeath(true);
      return;
    }
    if (this.bird.y - this.hitRadius <= 0) {
      this.bird.y = this.hitRadius;
      this.bird.vy = 0;
    }

    if (this.runTicks === 1) this.emit('powerups', this.powerupSnapshot());
  }

  stepDying() {
    const groundY = this.groundY;
    this.dyingTicks++;
    this.bird.vy = Math.min(this.bird.vy + 0.55, 16);
    this.bird.y += this.bird.vy;
    this.bird.rotation += 0.14;

    if (this.bird.y + this.hitRadius >= groundY) {
      this.bird.y = groundY - this.hitRadius;
      this.bird.vy = 0;
      if (!this._landed) {
        this._landed = true;
        this.shake(10);
        this.createExplosion(this.bird.x, this.bird.y, '#c0262d', 14);
      }
    }

    if (this.dyingTicks > 55) this.finishGameOver();
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += (p.gravity || 0.1);
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    // Hard cap so a long run cannot accumulate thousands of particles.
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  updatePopups() {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 1.1;
      p.life -= 0.018;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  SCORING                                                                */
  /* ---------------------------------------------------------------------- */

  get multiplier() { return Math.min(MAX_MULT, 1 + Math.floor(this.combo / 5)); }

  get hitRadius() { return this.bird.radius * 0.82; }

  onPipeCleared(pipe) {
    this.pipesPassed++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const mult = this.multiplier;
    const doubled = this.active.double > 0 ? 2 : 1;
    let gained = mult * doubled;

    const nearMiss = pipe.minClear < NEAR_MISS_PX;
    if (nearMiss) {
      this.nearMisses++;
      const bonus = 2 * mult;
      gained += bonus;
      sounds.playNearMiss();
      this.addPopup(this.bird.x + 60, this.bird.y - 34, `CLOSE! +${bonus}`, '#f43f5e');
      this.haptic(12);
      if (this.nearMisses === 5) this.unlock('daredevil');
    }

    this.score += gained;
    this.addPopup(pipe.x + pipe.width, pipe.gapY + pipe.gapHeight / 2,
      `+${gained}${mult > 1 ? ` ×${mult}` : ''}`, mult > 1 ? '#ffb703' : '#ffffff');

    sounds.playScore(this.combo);
    this.saveBest();
    this.pushScore();
    this.checkRunAchievements();

    if (this.combo === 10) this.addPopup(this.bird.x, this.bird.y - 60, 'COMBO ×2!', '#ffb703');
    if (this.combo === 20) this.addPopup(this.bird.x, this.bird.y - 60, 'ON FIRE!', '#f43f5e');
  }

  pushScore() {
    this.emit('score', {
      score: this.score,
      best: Math.max(this.best, this.score),
      combo: this.combo,
      multiplier: this.multiplier,
      mode: this.mode
    });
  }

  addPopup(x, y, text, color) {
    if (Settings.get('reducedMotion')) return;
    // Stack popups that land on top of each other (e.g. a pickup grabbed in the
    // same instant a pillar is cleared) so the text stays readable.
    let ty = y;
    for (let pass = 0; pass < 4; pass++) {
      const clash = this.popups.some(q => Math.abs(q.x - x) < 100 && Math.abs(q.y - ty) < 24);
      if (!clash) break;
      ty -= 26;
    }
    this.popups.push({ x, y: ty, text, color, life: 1 });
    if (this.popups.length > 14) this.popups.shift();
  }

  shake(frames) {
    if (Settings.get('shake') && !Settings.get('reducedMotion')) this.shakeFrames = frames;
  }

  /* ---------------------------------------------------------------------- */
  /*  SPAWNING                                                               */
  /* ---------------------------------------------------------------------- */

  spawnPipe() {
    const cfg = this.cfg;
    const groundY = this.groundY;
    const pipeGap = this.pipeGapPx;

    const marginTop = Math.round(this.height * 0.12);
    const marginBottom = Math.round(this.height * 0.10);
    const minGapY = marginTop;
    const maxGapY = Math.max(minGapY + 10, groundY - pipeGap - marginBottom);

    let gapY = Math.random() * (maxGapY - minGapY) + minGapY;

    // Avoid two consecutive pipes demanding an impossible vertical jump.
    const prev = this.pipes[this.pipes.length - 1];
    if (prev) {
      const maxDelta = pipeGap * 1.15;
      gapY = clamp(gapY, prev.gapY - maxDelta, prev.gapY + maxDelta);
      gapY = clamp(gapY, minGapY, maxGapY);
    }

    const pipe = {
      x: this.width + 30,
      width: 62,
      gapY,
      gapHeight: pipeGap,
      passed: false,
      alive: true,
      ghosted: false,
      minClear: Infinity,
      moving: cfg.movingPipes,
      offset: Math.random() * Math.PI * 2
    };
    this.pipes.push(pipe);

    if (Math.random() < cfg.powerupChance) {
      const type = this.rollPowerupType();
      this.powerups.push({
        x: pipe.x + pipe.width / 2,
        y: gapY + pipeGap / 2,
        radius: 16,
        type,
        color: POWERUPS[type].color,
        pipe,
        magnetized: false
      });
    }
  }

  rollPowerupType() {
    const entries = Object.entries(POWERUPS).filter(([key]) => {
      if (key === 'shield' && this.active.shield) return false;  // never waste a shield
      return true;
    });
    const total = entries.reduce((sum, [, v]) => sum + v.weight, 0);
    let roll = Math.random() * total;
    for (const [key, v] of entries) {
      roll -= v.weight;
      if (roll <= 0) return key;
    }
    return 'feather';
  }

  /* ---------------------------------------------------------------------- */
  /*  COLLISION                                                              */
  /* ---------------------------------------------------------------------- */

  checkPipeCollision(pipe) {
    const bx = this.bird.x;
    const by = this.bird.y;
    const br = this.hitRadius;

    if (bx + br <= pipe.x || bx - br >= pipe.x + pipe.width) return false;
    if (by - br < pipe.gapY) return true;
    if (by + br > pipe.gapY + pipe.gapHeight) return true;
    return false;
  }

  /* ---------------------------------------------------------------------- */
  /*  POWER-UPS                                                              */
  /* ---------------------------------------------------------------------- */

  applyPowerup(type, x, y) {
    const def = POWERUPS[type];
    this.powerupsCollected++;
    sounds.playPowerup(type);
    this.haptic(15);
    this.createExplosion(x, y, def.color, 22);

    if (type === 'feather') {
      const gain = 5 * (this.active.double > 0 ? 2 : 1);
      this.score += gain;
      this.addPopup(x, y - 20, `+${gain}`, def.color);
      this.saveBest();
      this.pushScore();
    } else if (type === 'shield') {
      this.active.shield = true;
      this.addPopup(x, y - 20, 'SHIELD', def.color);
    } else {
      this.active[type] = def.duration * 60;   // seconds -> steps
      this.addPopup(x, y - 20, def.label, def.color);
    }

    if (this.powerupsCollected === 5) this.unlock('collector');
    this.emit('powerups', this.powerupSnapshot());
  }

  powerupSnapshot() {
    return {
      shield: this.active.shield,
      slowmo: { active: this.active.slowmo > 0, pct: this.active.slowmo / (POWERUPS.slowmo.duration * 60) },
      magnet: { active: this.active.magnet > 0, pct: this.active.magnet / (POWERUPS.magnet.duration * 60) },
      double: { active: this.active.double > 0, pct: this.active.double / (POWERUPS.double.duration * 60) },
      ghost:  { active: this.active.ghost  > 0, pct: this.active.ghost  / (POWERUPS.ghost.duration  * 60) }
    };
  }

  createExplosion(x, y, color, count = 22) {
    const n = Settings.get('reducedMotion') ? Math.round(count * 0.35) : count;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        color, life: 1.0, decay: 0.038, gravity: 0.1
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  DEATH / GAME OVER                                                      */
  /* ---------------------------------------------------------------------- */

  triggerDeath() {
    if (this.state === 'DYING' || this.state === 'GAMEOVER') return;
    this._landed = false;
    this.dyingTicks = 0;
    this.setState('DYING');
    sounds.playHit();
    this.haptic([25, 30, 60]);
    this.shake(18);
    this.flash = 0.8;
    this.createExplosion(this.bird.x, this.bird.y, '#c0262d', 30);
    this.bird.vy = -5;
  }

  medalFor(score) {
    const m = this.cfg.medals;
    if (score >= m.platinum) return 'platinum';
    if (score >= m.gold) return 'gold';
    if (score >= m.silver) return 'silver';
    if (score >= m.bronze) return 'bronze';
    return null;
  }

  finishGameOver() {
    if (this.state === 'GAMEOVER') return;
    this.setState('GAMEOVER');
    this.saveBest();

    // Lifetime stats
    const stats = Object.assign({}, DEFAULT_STATS, Store.get('stats', {}));
    stats.games += 1;
    stats.totalScore += this.score;
    stats.totalDistance += Math.round(this.distance);
    stats.totalPowerups += this.powerupsCollected;
    stats.nearMisses += this.nearMisses;
    stats.bestCombo = Math.max(stats.bestCombo, this.maxCombo);
    Store.set('stats', stats);

    this.checkLifetimeAchievements(stats);

    const medal = this.medalFor(this.score);
    if (medal) sounds.playMedal();

    this.emit('gameover', {
      score: this.score,
      best: this.best,
      distance: Math.round(this.distance),
      powerups: this.powerupsCollected,
      maxCombo: this.maxCombo,
      nearMisses: this.nearMisses,
      medal,
      newBest: this.beatBest,
      mode: this.mode,
      modeLabel: this.cfg.label,
      stats
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  ACHIEVEMENTS                                                           */
  /* ---------------------------------------------------------------------- */

  unlock(id) {
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    const owned = Store.get('achievements', []);
    if (owned.includes(id)) return;
    owned.push(id);
    Store.set('achievements', owned);
    sounds.playAchievement();
    this.emit('achievement', { id, title: def.title, desc: def.desc, icon: def.icon });
  }

  /* Score-threshold checks use >= ranges scaling up to high scores (1500+). */
  checkRunAchievements() {
    if (this.score >= 10)   this.unlock('first_flight');
    if (this.score >= 25)   this.unlock('cadet');
    if (this.score >= 50)   this.unlock('bronze_aviator');
    if (this.score >= 100)  this.unlock('silver_wings');
    if (this.score >= 200)  this.unlock('century_club');
    if (this.score >= 350)  this.unlock('sky_sovereign');
    if (this.score >= 500)  this.unlock('legend');
    if (this.score >= 750)  this.unlock('immortal');
    if (this.score >= 1000) this.unlock('cosmic_ascendant');
    if (this.score >= 1500) this.unlock('apex_predator');

    if (this.combo >= 5)   this.unlock('combo_5');
    if (this.combo >= 15)  this.unlock('combo_15');
    if (this.combo >= 30)  this.unlock('combo_30');
    if (this.combo >= 60)  this.unlock('combo_60');
    if (this.combo >= 100) this.unlock('combo_100');
    if (this.combo >= 150) this.unlock('combo_150');

    if (this.nearMisses >= 1)  this.unlock('close_call');
    if (this.nearMisses >= 5)  this.unlock('daredevil');
    if (this.nearMisses >= 15) this.unlock('edge_master');
    if (this.nearMisses >= 30) this.unlock('ghost_wire');

    if (this.mode === 'classic') {
      if (this.score >= 150) this.unlock('classic_veteran');
      if (this.score >= 400) this.unlock('classic_titan');
    } else if (this.mode === 'hardcore') {
      if (this.score >= 30)  this.unlock('hardcore_survivor');
      if (this.score >= 75)  this.unlock('iron_wings');
      if (this.score >= 150) this.unlock('hardcore_god');
    } else if (this.mode === 'zen') {
      if (this.score >= 200)  this.unlock('zen_wanderer');
      if (this.score >= 500)  this.unlock('zen_enlightenment');
      if (this.score >= 1000) this.unlock('zen_transcendence');
    }

    if (this.powerupsCollected >= 1)  this.unlock('first_pickup');
    if (this.powerupsCollected >= 10) this.unlock('collector');
    if (this.powerupsCollected >= 25) this.unlock('arsenal');
    if (this.score >= 50 && this.powerupsCollected === 0) this.unlock('purist');
    if (this.shieldSaves >= 1) this.unlock('shielded');
    if (this.shieldSaves >= 3) this.unlock('iron_shield');
    if (this.ghostPasses >= 5) this.unlock('ghost_walk');
  }

  checkLifetimeAchievements(stats) {
    if (stats.games >= 20) this.unlock('frequent_flyer');
    if (stats.games >= 50) this.unlock('persistent');
    if (stats.games >= 150) this.unlock('veteran_pilot');
    if (stats.totalDistance >= 25000) this.unlock('marathon');
    if (stats.totalDistance >= 75000) this.unlock('sky_nomad');
    if (stats.totalDistance >= 200000) this.unlock('orbital_voyager');
    const bests = this.bests;
    if (bests.classic > 0 && bests.hardcore > 0 && bests.zen > 0) this.unlock('all_modes');
  }

  /* ---------------------------------------------------------------------- */
  /*  RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

  render() {
    const ctx = this.ctx;
    ctx.save();

    if (this.shakeFrames > 0) {
      const m = this.shakeFrames / 18;
      ctx.translate((Math.random() - 0.5) * 9 * m, (Math.random() - 0.5) * 9 * m);
    }

    this.drawBackground();
    this.drawHills();
    this.drawPipes();
    this.drawPowerupItems();
    this.drawParticles();
    this.drawBird();
    this.drawGround();
    this.drawPopups();

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.40})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.state === 'COUNTDOWN') this.drawCountdown();
    if (this.active.slowmo > 0) this.drawSlowmoVignette();
  }

  skyColors() {
    const s = Math.max(0, this.smoothedScore || 0);
    let a = SKIES[0], b = SKIES[1];
    for (let i = 0; i < SKIES.length - 1; i++) {
      if (s >= SKIES[i].at) { a = SKIES[i]; b = SKIES[i + 1]; }
    }
    if (s >= SKIES[SKIES.length - 1].at) { a = b = SKIES[SKIES.length - 1]; }
    const span = (b.at - a.at) || 1;
    const t = clamp((s - a.at) / span, 0, 1);

    return {
      top: mixColor(a.top, b.top, t),
      mid: mixColor(a.mid, b.mid, t),
      bot: mixColor(a.bot, b.bot, t),
      mountainFar: mixColor(a.mountainFar, b.mountainFar, t),
      skylineMid: mixColor(a.skylineMid, b.skylineMid, t),
      hillNear: mixColor(a.hillNear, b.hillNear, t),
      waterTop: mixColor(a.waterTop || a.hillNear, b.waterTop || b.hillNear, t),
      waterBot: mixColor(a.waterBot || a.mountainFar, b.waterBot || b.mountainFar, t),
      moonColor: mixColor(a.moonColor, b.moonColor, t),
      moonGlow: mixColor(a.moonGlow, b.moonGlow, t),
      aurora: mixColor(a.aurora, b.aurora, t),
      cloudTint: mixColor(a.cloudTint || 'rgba(255,255,255,0.08)', b.cloudTint || 'rgba(255,255,255,0.08)', t),
      star: lerp(a.star, b.star, t)
    };
  }

  drawBackground() {
    const ctx = this.ctx;
    const c = this.skyColors();
    const reduced = Settings.get('reducedMotion');
    const w = this.width;
    const h = this.height;
    const t = this.frameCount;

    // ── 1. Deep atmospheric sky gradient (3-stop) ──────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, c.top);
    sky.addColorStop(0.5, c.mid);
    sky.addColorStop(1, c.bot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // ── 2. Soft atmospheric horizon glow (makes horizon feel warm & deep) ──
    if (!reduced) {
      const horizonY = this.groundY * 0.82;
      const hGrad = ctx.createRadialGradient(w * 0.5, horizonY, 0, w * 0.5, horizonY, w * 0.65);
      hGrad.addColorStop(0, c.aurora.replace('0.1', '0.08').replace('0.13', '0.06').replace('0.18', '0.07'));
      hGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // ── 3. Gentle aurora / sky wash (slow undulating ribbon) ───────────────
    if (!reduced) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      const a1 = Math.sin(this.auroraPhase * 0.7) * 0.04 * h;
      const a2 = Math.cos(this.auroraPhase * 0.5) * 0.03 * h;
      const aGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      aGrad.addColorStop(0, 'rgba(0,0,0,0)');
      aGrad.addColorStop(0.45, c.aurora);
      aGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aGrad;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.12 + a1);
      ctx.bezierCurveTo(w * 0.3, h * 0.05 + a2, w * 0.7, h * 0.20 - a1, w, h * 0.10 + a2);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ── 4. Moon — soft, calm, with gentle corona ───────────────────────────
    const moonX = w * 0.78;
    const moonY = Math.min(h * 0.19, 120);
    const moonR  = Math.min(28, w * 0.055);

    // Soft outer corona (2 layers for depth)
    const corona2 = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 3.5);
    corona2.addColorStop(0, c.moonGlow);
    corona2.addColorStop(0.5, c.moonGlow.replace(/[\d.]+\)$/, '0.08)'));
    corona2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = corona2;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Moon body
    ctx.fillStyle = c.moonColor;
    ctx.shadowColor = c.moonGlow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Crescent shadow — soft and subtle
    ctx.fillStyle = 'rgba(8, 6, 28, 0.38)';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.32, moonY - moonR * 0.12, moonR * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // ── 5. Parallax starfield — gentle twinkling, soft colors ──────────────
    this.bgStars.forEach(s => {
      const twinkle = reduced ? 1 : (0.65 + Math.sin(t * 0.03 + s.phase) * 0.35);
      ctx.globalAlpha = s.alpha * twinkle * c.star;
      ctx.fillStyle = s.color || '#ffffff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.globalAlpha = 1;

    // ── 6. Shooting stars / meteor streaks ─────────────────────────────────
    if (!reduced && this.state !== 'PAUSED') {
      if (Math.random() < 0.006 && this.shootingStars.length < 2) {
        this.shootingStars.push({
          x: Math.random() * w * 0.75 + w * 0.15,
          y: Math.random() * h * 0.22 + 15,
          len: Math.random() * 50 + 30,
          speed: Math.random() * 7 + 8,
          alpha: 1.0
        });
      }
      ctx.lineWidth = 1.5;
      for (let i = this.shootingStars.length - 1; i >= 0; i--) {
        const star = this.shootingStars[i];
        star.x -= star.speed;
        star.y += star.speed * 0.4;
        star.alpha -= 0.028;
        if (star.alpha <= 0 || star.x < -100 || star.y > h) {
          this.shootingStars.splice(i, 1);
          continue;
        }
        const trail = ctx.createLinearGradient(star.x, star.y, star.x + star.len, star.y - star.len * 0.4);
        trail.addColorStop(0, `rgba(255,255,255,${star.alpha})`);
        trail.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = trail;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x + star.len, star.y - star.len * 0.4);
        ctx.stroke();
      }
    }

    // ── 7. Soft volumetric clouds — puff clusters, fade in/out smoothly ────
    this.clouds.forEach(cl => {
      // Fade clouds in when they enter from the right, out as they leave left
      const fadeR = Math.min(1, (cl.x - (-120 * cl.scale)) / (80 * cl.scale));
      const fadeL = Math.min(1, (w + 60 - cl.x) / (80 * cl.scale));
      const cloudAlpha = Math.min(fadeR, fadeL);
      if (cloudAlpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = cloudAlpha;

      // Draw 4-5 overlapping soft circles per cloud for a fluffy watercolor feel
      const puffs = [
        { dx: 0,            dy: 0,            r: 28 * cl.scale },
        { dx: 26 * cl.scale, dy: -13 * cl.scale, r: 34 * cl.scale },
        { dx: 52 * cl.scale, dy: 0,            r: 25 * cl.scale },
        { dx: 32 * cl.scale, dy: 9 * cl.scale,  r: 20 * cl.scale },
        { dx: 14 * cl.scale, dy: 12 * cl.scale, r: 16 * cl.scale },
      ];
      puffs.forEach(p => {
        const pGrad = ctx.createRadialGradient(
          cl.x + p.dx, cl.y + p.dy, p.r * 0.1,
          cl.x + p.dx, cl.y + p.dy, p.r
        );
        pGrad.addColorStop(0, 'rgba(255,255,255,0.09)');
        pGrad.addColorStop(0.6, 'rgba(255,255,255,0.04)');
        pGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(cl.x + p.dx, cl.y + p.dy, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });

    // ── 8. Subtle ambient dust motes — barely visible, very calming ─────────
    if (!reduced) {
      ctx.save();
      this.ambientMotes.forEach(m => {
        const pulse = 0.4 + Math.sin(t * 0.04 + m.phase) * 0.4;
        ctx.fillStyle = m.color;
        ctx.globalAlpha = m.alpha * pulse * 0.5; // keep subtle
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  drawHills() {
    const ctx = this.ctx;
    const c = this.skyColors();
    const groundY = this.groundY;
    const w = this.width;
    const h = this.height;

    // Helper: draw a smooth Bézier hill silhouette using quadratic curves
    // This produces perfectly smooth, continuous rounded hills — no steps, no lineTo jaggies
    const drawHillLayer = (fillStyle, scrollX, freq1, amp1, freq2, amp2, baseH) => {
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      // Sample points, then connect with quadratic curves for butter-smooth result
      const step = 40;
      const pts = [];
      for (let x = -step; x <= w + step * 2; x += step) {
        const wx = x + scrollX;
        const y = groundY - baseH
          - Math.sin(wx * freq1) * amp1
          - Math.cos(wx * freq2 + 1.2) * amp2;
        pts.push({ x, y });
      }
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(w, groundY);
      ctx.lineTo(0, groundY);
      ctx.closePath();
      ctx.fill();
    };

    // Layer 1: Distant soft mountains (barely perceptible parallax 0.08x, very gentle)
    drawHillLayer(
      c.mountainFar,
      this.scrollFar,
      0.0028, h * 0.10,
      0.007,  h * 0.05,
      h * 0.16
    );

    // Layer 2: Mid-distance rolling hills (parallax 0.22x, gentle undulations)
    drawHillLayer(
      c.skylineMid,
      this.scrollMid,
      0.0048, h * 0.07,
      0.011,  h * 0.035,
      h * 0.09
    );
    // Soft rim light on mid hills — Alto's Odyssey style subtle edge glow
    ctx.strokeStyle = c.aurora.replace(/[\d.]+\)$/, '0.12)');
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Layer 3: Foreground hills (parallax 0.50x, more pronounced)
    drawHillLayer(
      c.hillNear,
      this.scrollNear,
      0.008,  h * 0.048,
      0.017,  h * 0.026,
      h * 0.055
    );
    // Gentle white rim on foreground hills
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // ── Water shimmer strip — calm reflective water at base of hills ────────
    const waterY = groundY - h * 0.032;
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, groundY);
    waterGrad.addColorStop(0, c.waterTop || 'rgba(20,20,60,0.7)');
    waterGrad.addColorStop(1, c.waterBot || 'rgba(8,8,28,0.95)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, w, groundY - waterY);

    // Gentle ripple reflections
    if (!Settings.get('reducedMotion')) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ry = waterY + (groundY - waterY) * (0.2 + i * 0.2);
        const offset = (this.scrollGround * 0.15 + i * 37) % w;
        ctx.beginPath();
        for (let x = -offset; x < w + 30; x += 30) {
          const wave = Math.sin((x + this.scrollGround * 0.2 + i * 18) * 0.055) * 3;
          if (x === -offset) ctx.moveTo(x, ry + wave);
          else ctx.lineTo(x, ry + wave);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  

  drawPipes() {
    const ctx = this.ctx;
    const groundY = this.groundY;
    const ghosting = this.active.ghost > 0;

    this.pipes.forEach(pipe => {
      ctx.save();
      if (ghosting) ctx.globalAlpha = 0.42;

      const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
      grad.addColorStop(0, '#1a2540');
      grad.addColorStop(0.35, '#2e4060');
      grad.addColorStop(0.65, '#3a5070');
      grad.addColorStop(1, '#0e1830');

      const edge = ghosting ? '#e2e8f0' : '#00f2fe';

      // top pipe
      ctx.fillStyle = grad;
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(pipe.x - 5, pipe.gapY - 22, pipe.width + 10, 22);
      ctx.fillStyle = edge;
      ctx.shadowColor = edge;
      ctx.shadowBlur = 8;
      ctx.fillRect(pipe.x - 5, pipe.gapY - 4, pipe.width + 10, 4);
      ctx.shadowBlur = 0;

      // bottom pipe
      const bottomTop = pipe.gapY + pipe.gapHeight;
      ctx.fillStyle = grad;
      ctx.fillRect(pipe.x, bottomTop, pipe.width, Math.max(0, groundY - bottomTop));
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(pipe.x - 5, bottomTop, pipe.width + 10, 22);
      ctx.fillStyle = edge;
      ctx.shadowColor = edge;
      ctx.shadowBlur = 8;
      ctx.fillRect(pipe.x - 5, bottomTop, pipe.width + 10, 4);
      ctx.shadowBlur = 0;

      ctx.restore();
    });
  }

  drawPowerupItems() {
    const ctx = this.ctx;
    this.powerups.forEach(p => {
      ctx.save();
      const floatY = Settings.get('reducedMotion') ? 0 : Math.sin(this.frameCount * 0.11) * 4;
      ctx.translate(p.x, p.y + floatY);

      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2);
      halo.addColorStop(0, p.color + 'cc');
      halo.addColorStop(0.5, p.color + '44');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw custom vector glyphs
      ctx.fillStyle = '#ffffff';
      switch (p.type) {
        case 'feather':
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const rot = (Math.PI / 2) * 3 + (k * Math.PI) / 2.5;
            const ox = Math.cos(rot) * 6;
            const oy = Math.sin(rot) * 6;
            if (k === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
            const inRot = rot + Math.PI / 5;
            ctx.lineTo(Math.cos(inRot) * 2.8, Math.sin(inRot) * 2.8);
          }
          ctx.closePath();
          ctx.fill();
          break;

        case 'shield':
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(5.5, -3);
          ctx.lineTo(4.2, 3.5);
          ctx.lineTo(0, 7);
          ctx.lineTo(-4.2, 3.5);
          ctx.lineTo(-5.5, -3);
          ctx.closePath();
          ctx.fill();
          break;

        case 'slowmo':
          ctx.beginPath();
          ctx.moveTo(-4.5, -5.5);
          ctx.lineTo(4.5, -5.5);
          ctx.lineTo(0, 0);
          ctx.lineTo(4.5, 5.5);
          ctx.lineTo(-4.5, 5.5);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          break;

        case 'magnet':
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, -1.5, 4.5, Math.PI, 0, false);
          ctx.lineTo(4.5, 4.5);
          ctx.moveTo(-4.5, -1.5);
          ctx.lineTo(-4.5, 4.5);
          ctx.stroke();
          break;

        case 'double':
          ctx.beginPath();
          ctx.moveTo(0, -6.5);
          ctx.lineTo(5.5, 0);
          ctx.lineTo(0, 6.5);
          ctx.lineTo(-5.5, 0);
          ctx.closePath();
          ctx.fill();
          break;

        case 'ghost':
          ctx.beginPath();
          ctx.arc(0, -2, 6.5, Math.PI, 0, false);
          ctx.lineTo(6.5, 6.5);
          ctx.lineTo(3.2, 4);
          ctx.lineTo(0, 6.5);
          ctx.lineTo(-3.2, 4);
          ctx.lineTo(-6.5, 6.5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(-2.2, -2, 1.4, 0, Math.PI * 2);
          ctx.arc(2.2, -2, 1.4, 0, Math.PI * 2);
          ctx.fill();
          break;

        default:
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
      }

      ctx.restore();
    });
  }

  drawBird() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(this.bird.rotation);
    ctx.scale(this.bird.wingPulse, this.bird.wingPulse);

    if (this.active.ghost > 0) ctx.globalAlpha = 0.5;

    if (this.active.shield) {
      const pulse = 1 + Math.sin(this.frameCount * 0.15) * 0.05;
      ctx.strokeStyle = POWERUPS.shield.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = POWERUPS.shield.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, (this.bird.radius + 10) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (this.active.magnet > 0) {
      ctx.strokeStyle = POWERUPS.magnet.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, this.bird.radius + 22 + Math.sin(this.frameCount * 0.08) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = this.active.ghost > 0 ? 0.5 : 1;
    }

    if (this.birdImgLoaded) {
      ctx.drawImage(this.birdImg, -this.bird.width / 2, -this.bird.height / 2, this.bird.width, this.bird.height);
    } else {
      ctx.fillStyle = '#c0262d';
      ctx.beginPath();
      ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.active.double > 0) {
      ctx.fillStyle = POWERUPS.double.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('×2', 0, -this.bird.height / 2 - 6);
    }

    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawPopups() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.popups.forEach(p => {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.font = '800 18px Outfit, system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  drawGround() {
    const ctx = this.ctx;
    const groundY = this.groundY;

    const grad = ctx.createLinearGradient(0, groundY, 0, this.height);
    grad.addColorStop(0, '#121a2e');
    grad.addColorStop(1, '#080c18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, this.width, this.height - groundY);

    ctx.fillStyle = '#c0262d';
    ctx.shadowColor = '#c0262d';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, groundY, this.width, 4);
    ctx.shadowBlur = 0;

    const offset = this.scrollGround % 24;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = -offset; x < this.width + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 4);
      ctx.lineTo(x - 28, this.height);
      ctx.stroke();
    }
  }

  drawSlowmoVignette() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.3,
      this.width / 2, this.height / 2, this.height * 0.8
    );
    g.addColorStop(0, 'rgba(168,85,247,0)');
    g.addColorStop(1, 'rgba(168,85,247,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawCountdown() {
    const ctx = this.ctx;
    const n = Math.ceil(this.countdown / 45);
    const phase = (this.countdown % 45) / 45;
    ctx.save();
    ctx.globalAlpha = clamp(phase * 1.4, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 92px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(n, this.width / 2, this.height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(n, this.width / 2, this.height / 2);
    ctx.restore();
  }

  /* ---------------------------------------------------------------------- */
  /*  MAIN LOOP — variable render rate, fixed 60 Hz simulation               */
  /* ---------------------------------------------------------------------- */

  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    let delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Returning from a background tab: drop the backlog instead of
    // fast-forwarding the simulation through it.
    if (delta > 250) delta = STEP_MS;

    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < 5) {
      this.step();
      this.accumulator -= STEP_MS;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.render();
  }
}

/* --------------------------------------------------------------------------
   ACHIEVEMENT CATALOGUE (43 Balanced High-Tier Awards)
   -------------------------------------------------------------------------- */
const ACHIEVEMENTS = [
  // --- SCORE MILESTONES (Progressive from Novice to Grandmaster) ---
  { id: 'first_flight',       icon: '<i class="fa-solid fa-feather"></i>',           title: 'First Flight',        desc: 'Score 10 points in a single run' },
  { id: 'cadet',              icon: '<i class="fa-solid fa-plane"></i>',             title: 'Flight Cadet',        desc: 'Score 25 points in a single run' },
  { id: 'bronze_aviator',     icon: '<i class="fa-solid fa-eye"></i>',               title: 'Bronze Aviator',      desc: 'Score 50 points in a single run' },
  { id: 'silver_wings',       icon: '<i class="fa-solid fa-wind"></i>',              title: 'Silver Wings',        desc: 'Score 100 points in a single run' },
  { id: 'century_club',       icon: '<i class="fa-solid fa-award"></i>',             title: 'Double Century',      desc: 'Score 200 points in a single run' },
  { id: 'sky_sovereign',      icon: '<i class="fa-solid fa-crown"></i>',             title: 'Sky Sovereign',       desc: 'Score 350 points in a single run' },
  { id: 'legend',             icon: '<i class="fa-solid fa-trophy"></i>',            title: 'Legend of FMS',       desc: 'Score 500 points in a single run' },
  { id: 'immortal',           icon: '<i class="fa-solid fa-infinity"></i>',          title: 'Sky Immortal',        desc: 'Score 750 points in a single run' },
  { id: 'cosmic_ascendant',   icon: '<i class="fa-solid fa-meteor"></i>',            title: 'Cosmic Ascendant',    desc: 'Score 1,000 points in a single run' },
  { id: 'apex_predator',      icon: '<i class="fa-solid fa-fire-flame-curved"></i>', title: 'Apex Predator',      desc: 'Score 1,500 points in a single run' },

  // --- COMBOS & STREAKS ---
  { id: 'combo_5',            icon: '<i class="fa-solid fa-bolt-lightning"></i>',    title: 'Spark',               desc: 'Reach a 5-pillar combo' },
  { id: 'combo_15',           icon: '<i class="fa-solid fa-fire"></i>',              title: 'Heating Up',          desc: 'Reach a 15-pillar combo' },
  { id: 'combo_30',           icon: '<i class="fa-solid fa-volcano"></i>',           title: 'Unbroken Flow',       desc: 'Reach a 30-pillar combo' },
  { id: 'combo_60',           icon: '<i class="fa-solid fa-sun"></i>',               title: 'Solar Flare',         desc: 'Reach a 60-pillar combo' },
  { id: 'combo_100',          icon: '<i class="fa-solid fa-atom"></i>',              title: 'Hyper Drive',         desc: 'Reach a 100-pillar combo' },
  { id: 'combo_150',          icon: '<i class="fa-solid fa-dna"></i>',               title: 'Singularity',         desc: 'Reach a 150-pillar combo' },

  // --- PRECISION & CLOSE CALLS ---
  { id: 'close_call',         icon: '<i class="fa-solid fa-angles-right"></i>',      title: 'Razor Edge',          desc: 'Execute 1 close call near a pillar' },
  { id: 'daredevil',          icon: '<i class="fa-solid fa-bolt"></i>',              title: 'Daredevil',           desc: '5 close calls in a single run' },
  { id: 'edge_master',        icon: '<i class="fa-solid fa-crosshairs"></i>',        title: 'Precision Ace',       desc: '15 close calls in a single run' },
  { id: 'ghost_wire',         icon: '<i class="fa-solid fa-bullseye"></i>',          title: 'Ghostwire Master',    desc: '30 close calls in a single run' },

  // --- MODE MASTERY ---
  { id: 'classic_veteran',    icon: '<i class="fa-solid fa-medal"></i>',             title: 'Classic Veteran',     desc: 'Score 150+ in Classic Mode' },
  { id: 'classic_titan',      icon: '<i class="fa-solid fa-gem"></i>',               title: 'Classic Titan',       desc: 'Score 400+ in Classic Mode' },
  { id: 'hardcore_survivor',  icon: '<i class="fa-solid fa-shield-virus"></i>',      title: 'Hardcore Survivor',   desc: 'Score 30+ in Hardcore Mode' },
  { id: 'iron_wings',         icon: '<i class="fa-solid fa-skull"></i>',             title: 'Iron Wings',          desc: 'Score 75+ in Hardcore Mode' },
  { id: 'hardcore_god',       icon: '<i class="fa-solid fa-dragon"></i>',            title: 'Hardcore God',        desc: 'Score 150+ in Hardcore Mode' },
  { id: 'zen_wanderer',       icon: '<i class="fa-solid fa-feather-pointed"></i>',   title: 'Zen Wanderer',        desc: 'Score 200+ in Zen Mode' },
  { id: 'zen_enlightenment',  icon: '<i class="fa-solid fa-moon"></i>',              title: 'Zen Enlightenment',   desc: 'Score 500+ in Zen Mode' },
  { id: 'zen_transcendence',  icon: '<i class="fa-solid fa-spa"></i>',               title: 'Zen Transcendence',   desc: 'Score 1,000+ in Zen Mode' },
  { id: 'all_modes',          icon: '<i class="fa-solid fa-compass"></i>',           title: 'Well Travelled',      desc: 'Set a score in all 3 game modes' },

  // --- SKILL & POWER-UP TACTICS ---
  { id: 'first_pickup',       icon: '<i class="fa-solid fa-star"></i>',              title: 'First Pickup',        desc: 'Collect your first power-up' },
  { id: 'collector',          icon: '<i class="fa-solid fa-gift"></i>',              title: 'Collector',           desc: 'Grab 10 power-ups in one run' },
  { id: 'arsenal',            icon: '<i class="fa-solid fa-boxes-stacked"></i>',     title: 'Sky Arsenal',         desc: 'Grab 25 power-ups in one run' },
  { id: 'purist',             icon: '<i class="fa-solid fa-shield"></i>',            title: 'Purist Aviator',      desc: 'Score 50 without collecting any power-ups' },
  { id: 'shielded',           icon: '<i class="fa-solid fa-shield-halved"></i>',     title: 'Bounced',             desc: 'Survive a lethal crash with a shield' },
  { id: 'iron_shield',        icon: '<i class="fa-solid fa-shield-heart"></i>',      title: 'Aegis Sentinel',      desc: 'Survive 3 shield saves in one run' },
  { id: 'ghost_walk',         icon: '<i class="fa-solid fa-ghost"></i>',             title: 'Ghost Walk',          desc: 'Phase straight through 5 pillars in one run' },

  // --- CAMPUS PRESTIGE & DEDICATION ---
  { id: 'top_pilot',          icon: '<i class="fa-solid fa-ranking-star"></i>',      title: 'Campus Legend',       desc: 'Enter the FMS Campus Leaderboard' },
  { id: 'frequent_flyer',     icon: '<i class="fa-solid fa-plane-up"></i>',          title: 'Frequent Flyer',      desc: 'Complete 20 total flight runs' },
  { id: 'persistent',         icon: '<i class="fa-solid fa-rotate-right"></i>',      title: 'Persistent',          desc: 'Complete 50 total flight runs' },
  { id: 'veteran_pilot',      icon: '<i class="fa-solid fa-user-astronaut"></i>',    title: 'Veteran Aviator',     desc: 'Complete 150 total runs' },
  { id: 'marathon',           icon: '<i class="fa-solid fa-plane-departure"></i>',   title: 'Marathon',            desc: 'Fly 25,000m total distance' },
  { id: 'sky_nomad',          icon: '<i class="fa-solid fa-globe"></i>',             title: 'Sky Nomad',           desc: 'Fly 75,000m total distance' },
  { id: 'orbital_voyager',    icon: '<i class="fa-solid fa-satellite"></i>',         title: 'Orbital Voyager',     desc: 'Fly 200,000m total distance' }
];
