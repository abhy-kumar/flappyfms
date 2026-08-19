/* ==========================================================================
   WEB AUDIO SYNTHESIZER & PROCEDURAL MUSIC ENGINE - FLAPPY FMS
   Zero external audio files. 100% runtime synthesis (SFX + Synthwave BGM).
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.bgmFilter = null;

    this.muted = Settings.get('muted') || false;
    this.volume = Settings.get('volume') !== undefined ? Settings.get('volume') : 0.5;
    this.musicEnabled = Settings.get('musicEnabled') !== undefined ? Settings.get('musicEnabled') : true;
    this.musicVolume = Settings.get('musicVolume') !== undefined ? Settings.get('musicVolume') : 0.35;

    this.unlocked = false;

    // Music Sequencer State
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmBpm = 118;
    this.bgmState = 'MENU'; // 'MENU' | 'PLAYING' | 'PAUSED' | 'DYING'
    this.bgmTempoMod = 1.0;
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

      // Master output
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      // SFX sub-bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volume;
      this.sfxGain.connect(this.master);

      // BGM sub-bus with dynamic lowpass filter for pause effects
      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 18000;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.musicEnabled ? this.musicVolume : 0;

      this.bgmFilter.connect(this.bgmGain);
      this.bgmGain.connect(this.master);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.unlocked = true;
        if (this.musicEnabled && !this.bgmPlaying) this.startBgm();
      }).catch(() => {});
    } else {
      this.unlocked = true;
      if (this.musicEnabled && !this.bgmPlaying) this.startBgm();
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
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
    return this.volume;
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    Settings.set('musicVolume', this.musicVolume);
    if (this.bgmGain && this.ctx) {
      const target = this.musicEnabled ? this.musicVolume : 0;
      this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    return this.musicVolume;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    Settings.set('musicEnabled', this.musicEnabled);
    if (this.bgmGain && this.ctx) {
      const target = this.musicEnabled ? this.musicVolume : 0;
      this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
    if (this.musicEnabled && !this.bgmPlaying) {
      this.startBgm();
    }
    return this.musicEnabled;
  }

  setMuted(muted) {
    this.muted = !!muted;
    Settings.set('muted', this.muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /* ---------------------------------------------------------------------- */
  /*  PROCEDURAL SYNTHWAVE BGM ENGINE                                        */
  /* ---------------------------------------------------------------------- */

  startBgm() {
    if (this.bgmPlaying || !this.ctx) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;
    this._scheduleBgmLoop();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  setGameState(state, mode = 'classic') {
    this.bgmState = state;
    if (!this.ctx) return;

    if (state === 'PAUSED') {
      // Muffled lowpass filter on pause
      this.bgmFilter.frequency.setTargetAtTime(450, this.ctx.currentTime, 0.08);
    } else {
      this.bgmFilter.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.08);
    }

    if (mode === 'hardcore') {
      this.bgmBpm = 130;
    } else if (mode === 'zen') {
      this.bgmBpm = 106;
    } else {
      this.bgmBpm = 118;
    }
  }

  setTempoModifier(mod = 1.0) {
    this.bgmTempoMod = Math.max(0.5, Math.min(2.0, mod));
  }

  _scheduleBgmLoop() {
    if (!this.bgmPlaying || !this.ctx) return;

    const effectiveBpm = this.bgmBpm * this.bgmTempoMod;
    const stepDuration = 60 / effectiveBpm / 4; // 16th note in seconds

    // 32-step loop progression in A minor / F major / C major / G major
    const bassline = [
      // Bar 1 (Am)
      110.00, null, 110.00, null, 130.81, null, 110.00, 164.81,
      // Bar 2 (F)
      87.31, null, 87.31, null, 130.81, null, 87.31, 146.83,
      // Bar 3 (C)
      130.81, null, 130.81, null, 164.81, null, 130.81, 196.00,
      // Bar 4 (G/Em)
      98.00, null, 98.00, null, 146.83, null, 123.47, 164.81
    ];

    const leadMotif = [
      // Am
      440.00, null, 523.25, null, 659.25, null, 523.25, 440.00,
      // F
      349.23, 440.00, 523.25, null, 659.25, 523.25, 440.00, null,
      // C
      523.25, null, 659.25, 783.99, null, 659.25, 523.25, null,
      // G
      392.00, 493.88, 587.33, null, 659.25, null, 493.88, 392.00
    ];

    const chordPad = [
      // Am: A3, C4, E4
      [220.00, 261.63, 329.63],
      // F: F3, A3, C4
      [174.61, 220.00, 261.63],
      // C: C4, E4, G4
      [261.63, 329.63, 392.00],
      // G: G3, B3, D4
      [196.00, 246.94, 293.66]
    ];

    const step = this.bgmStep % 32;
    const now = this.ctx.currentTime;

    // Only play audio if enabled & context is active
    if (this.musicEnabled && !this.muted && this.ctx.state === 'running') {
      // 1. Bassline (Punchy analog synth)
      const bassFreq = bassline[step];
      if (bassFreq) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + stepDuration * 0.9);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.95);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.bgmFilter);

        osc.start(now);
        osc.stop(now + stepDuration);
      }

      // 2. Chords Pad (On every 8 steps / bar change)
      if (step % 8 === 0) {
        const chordIdx = Math.floor(step / 8);
        const freqs = chordPad[chordIdx];
        freqs.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.value = 1400;

          const barDur = stepDuration * 8;
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.06, now + 0.15);
          g.gain.setValueAtTime(0.05, now + barDur * 0.7);
          g.gain.exponentialRampToValueAtTime(0.001, now + barDur);

          osc.connect(filter);
          filter.connect(g);
          g.connect(this.bgmFilter);

          osc.start(now);
          osc.stop(now + barDur);
        });
      }

      // 3. Lead Chime Synth (During PLAYING & READY)
      if (this.bgmState === 'PLAYING' || this.bgmState === 'READY' || this.bgmState === 'MENU') {
        const leadFreq = leadMotif[step];
        if (leadFreq && (step % 2 === 0 || this.bgmState === 'PLAYING')) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(leadFreq, now);

          const dur = stepDuration * 1.5;
          const leadGain = (this.bgmState === 'PLAYING') ? 0.08 : 0.04;
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(leadGain, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + dur);

          osc.connect(g);
          g.connect(this.bgmFilter);

          osc.start(now);
          osc.stop(now + dur + 0.02);
        }
      }

      // 4. Subtle Hi-Hat & Snare rhythm (Only during PLAYING)
      if (this.bgmState === 'PLAYING') {
        if (step % 2 === 0) {
          // Closed Hi-Hat
          this._synthHat(now, step % 4 === 2 ? 0.04 : 0.02, 0.035);
        }
        if (step % 8 === 4) {
          // Soft Snare / Clap
          this._synthSnare(now, 0.06, 0.12);
        }
      }
    }

    this.bgmStep++;
    this.bgmTimer = setTimeout(() => this._scheduleBgmLoop(), stepDuration * 1000);
  }

  _synthHat(time, gain = 0.03, dur = 0.04) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.bgmFilter);

    src.start(time);
    src.stop(time + dur);
  }

  _synthSnare(time, gain = 0.06, dur = 0.12) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.bgmFilter);

    src.start(time);
    src.stop(time + dur);
  }

  /* ---------------------------------------------------------------------- */
  /*  SFX PRIMITIVES                                                         */
  /* ---------------------------------------------------------------------- */

  _tone({ type = 'sine', from, to, dur = 0.15, gain = 0.3, delay = 0, curve = 'exp' }) {
    if (!this.ready() || !this.sfxGain) return;
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
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _noise({ dur = 0.25, gain = 0.5, filterFrom = 800, filterTo = 40, type = 'lowpass' }) {
    if (!this.ready() || !this.sfxGain) return;
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
    g.connect(this.sfxGain);
    src.start(now);
    src.stop(now + dur);
  }

  /* ---------------------------------------------------------------------- */
  /*  SFX LIBRARY                                                            */
  /* ---------------------------------------------------------------------- */

  playFlap() {
    this._tone({ type: 'sine', from: 260, to: 580, dur: 0.12, gain: 0.22 });
    this._noise({ dur: 0.07, gain: 0.06, filterFrom: 2200, filterTo: 400, type: 'bandpass' });
  }

  playScore(combo = 1) {
    const step = Math.min(11, Math.max(0, combo - 1));
    const base = 523.25 * Math.pow(2, step / 12);
    this._tone({ type: 'triangle', from: base, to: base * 1.5, dur: 0.14, gain: 0.18 });
    this._tone({ type: 'sine', from: base * 2, to: base * 3, dur: 0.1, gain: 0.09, delay: 0.04 });
  }

  playNearMiss() {
    this._noise({ dur: 0.18, gain: 0.14, filterFrom: 400, filterTo: 4000, type: 'bandpass' });
    this._tone({ type: 'sine', from: 1400, to: 2600, dur: 0.14, gain: 0.08 });
  }

  playPowerup(type) {
    const shapes = {
      feather: [440, 1500],
      shield:  [320, 950],
      slowmo:  [950, 320],
      magnet:  [520, 1200],
      double:  [620, 1750],
      ghost:   [750, 260]
    };
    const [from, to] = shapes[type] || [320, 1300];
    this._tone({ type: 'sine', from, to, dur: 0.26, gain: 0.22 });
    this._tone({ type: 'triangle', from: from * 1.5, to: to * 1.5, dur: 0.22, gain: 0.1, delay: 0.04 });
  }

  playShieldBreak() {
    this._tone({ type: 'square', from: 900, to: 120, dur: 0.22, gain: 0.15 });
    this._noise({ dur: 0.32, gain: 0.25, filterFrom: 3200, filterTo: 180, type: 'bandpass' });
  }

  playHit() {
    this._noise({ dur: 0.3, gain: 0.45, filterFrom: 900, filterTo: 40 });
    this._tone({ type: 'sawtooth', from: 190, to: 40, dur: 0.38, gain: 0.18 });
  }

  playClick() {
    this._tone({ type: 'sine', from: 800, to: 400, dur: 0.05, gain: 0.12 });
  }

  playAchievement() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone({ type: 'triangle', from: f, to: f, dur: 0.2, gain: 0.14, delay: i * 0.075 });
    });
  }

  playMedal() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone({ type: 'sine', from: f, to: f, dur: 0.32, gain: 0.12, delay: i * 0.09 });
    });
  }

  playPause() {
    this._tone({ type: 'sine', from: 650, to: 320, dur: 0.13, gain: 0.12 });
  }

  playResume() {
    this._tone({ type: 'sine', from: 320, to: 650, dur: 0.13, gain: 0.12 });
  }
}

const sounds = new SoundEngine();
