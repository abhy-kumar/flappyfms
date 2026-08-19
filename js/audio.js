/* ==========================================================================
   WEB AUDIO SYNTHESIZER - FLAPPY FMS
   Zero external audio files. Every sound is generated at runtime.

   Fixes vs. the previous build:
   - Sounds no longer swallow the FIRST play. The old code returned early when
     this.ctx was null, and ctx was only created by a separate document-level
     listener that ran after the canvas handler, so the first flap was silent.
     init() is now called before the guard.
   - A single master GainNode handles volume + mute instead of multiplying
     every gain by this.volume (which ignored live volume changes).
   - Mute/volume persist between sessions via Store.
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = Settings.get('muted');
    this.volume = Settings.get('volume');
    this.unlocked = false;
  }

  /* ---------------------------------------------------------------------- */
  /*  LIFECYCLE                                                              */
  /* ---------------------------------------------------------------------- */

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      try {
        this.ctx = new AudioCtx();
      } catch (e) {
        this.ctx = null;
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    // Browsers suspend the context until a user gesture happens.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => { this.unlocked = true; }).catch(() => {});
    } else {
      this.unlocked = true;
    }
    return true;
  }

  ready() {
    if (!this.ctx && !this.init()) return false;
    return !this.muted && this.ctx.state !== 'closed';
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    Settings.set('volume', this.volume);
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.01);
    }
    return this.volume;
  }

  setMuted(muted) {
    this.muted = !!muted;
    Settings.set('muted', this.muted);
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.01);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /* ---------------------------------------------------------------------- */
  /*  PRIMITIVES                                                             */
  /* ---------------------------------------------------------------------- */

  _tone({ type = 'sine', from, to, dur = 0.15, gain = 0.3, delay = 0, curve = 'exp' }) {
    if (!this.ready()) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to && to !== from) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + dur);
      else osc.frequency.linearRampToValueAtTime(to, now + dur);
    }

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + Math.min(0.015, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noise({ dur = 0.25, gain = 0.5, filterFrom = 800, filterTo = 40, type = 'lowpass' }) {
    if (!this.ready()) return;
    const now = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrom, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), now + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + dur);
  }

  /* ---------------------------------------------------------------------- */
  /*  GAME SOUNDS                                                            */
  /* ---------------------------------------------------------------------- */

  playFlap() {
    this._tone({ type: 'sine', from: 250, to: 550, dur: 0.12, gain: 0.22 });
    this._noise({ dur: 0.07, gain: 0.05, filterFrom: 1800, filterTo: 400, type: 'bandpass' });
  }

  /* Pitch rises with the combo so a streak audibly builds. */
  playScore(combo = 1) {
    const step = Math.min(11, Math.max(0, combo - 1));
    const base = 523.25 * Math.pow(2, step / 12);
    this._tone({ type: 'triangle', from: base, to: base * 1.5, dur: 0.13, gain: 0.16 });
    this._tone({ type: 'sine', from: base * 2, to: base * 3, dur: 0.1, gain: 0.07, delay: 0.05 });
  }

  playNearMiss() {
    this._noise({ dur: 0.16, gain: 0.12, filterFrom: 400, filterTo: 3500, type: 'bandpass' });
    this._tone({ type: 'sine', from: 1400, to: 2400, dur: 0.12, gain: 0.06 });
  }

  playPowerup(type) {
    const shapes = {
      feather: [400, 1400],
      shield:  [300, 900],
      slowmo:  [900, 300],
      magnet:  [500, 1100],
      double:  [600, 1600],
      ghost:   [700, 250]
    };
    const [from, to] = shapes[type] || [300, 1200];
    this._tone({ type: 'sine', from, to, dur: 0.24, gain: 0.2 });
    this._tone({ type: 'triangle', from: from * 1.5, to: to * 1.5, dur: 0.2, gain: 0.08, delay: 0.04 });
  }

  playShieldBreak() {
    this._tone({ type: 'square', from: 900, to: 120, dur: 0.22, gain: 0.14 });
    this._noise({ dur: 0.3, gain: 0.22, filterFrom: 3000, filterTo: 200, type: 'bandpass' });
  }

  playHit() {
    this._noise({ dur: 0.28, gain: 0.42, filterFrom: 800, filterTo: 40 });
    this._tone({ type: 'sawtooth', from: 180, to: 40, dur: 0.35, gain: 0.16 });
  }

  playClick() {
    this._tone({ type: 'sine', from: 800, to: 400, dur: 0.05, gain: 0.12 });
  }

  playAchievement() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone({ type: 'triangle', from: f, to: f, dur: 0.18, gain: 0.13, delay: i * 0.075 });
    });
  }

  playMedal() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone({ type: 'sine', from: f, to: f, dur: 0.3, gain: 0.11, delay: i * 0.1 });
    });
  }

  playPause() {
    this._tone({ type: 'sine', from: 600, to: 300, dur: 0.12, gain: 0.1 });
  }

  playResume() {
    this._tone({ type: 'sine', from: 300, to: 600, dur: 0.12, gain: 0.1 });
  }
}

const sounds = new SoundEngine();
