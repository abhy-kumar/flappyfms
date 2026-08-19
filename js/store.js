/* ==========================================================================
   PERSISTENT STORAGE - FLAPPY FMS
   Safe wrapper around localStorage. Never throws: Safari private mode,
   sandboxed iframes and disabled-cookie browsers all fall back to an
   in-memory map so the game keeps working (it just forgets between visits).
   ========================================================================== */

const Store = (() => {
  const PREFIX = 'ffms_';
  let backend = null;
  const memory = new Map();

  try {
    const probe = '__ffms_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    backend = window.localStorage;
  } catch (e) {
    backend = null; // quota exceeded / access denied — use memory
  }

  function rawGet(key) {
    if (backend) {
      try { return backend.getItem(key); } catch (e) { /* fall through */ }
    }
    return memory.has(key) ? memory.get(key) : null;
  }

  function rawSet(key, value) {
    memory.set(key, value);
    if (backend) {
      try { backend.setItem(key, value); } catch (e) { /* quota — memory only */ }
    }
  }

  const api = {
    available: !!backend,

    get(key, fallback) {
      const raw = rawGet(PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    set(key, value) {
      try {
        rawSet(PREFIX + key, JSON.stringify(value));
      } catch (e) { /* circular value — ignore */ }
      return value;
    },

    /* Merge an object into a stored object */
    patch(key, partial) {
      const current = api.get(key, {}) || {};
      const next = Object.assign({}, current, partial);
      api.set(key, next);
      return next;
    },

    /* One-time migration from the pre-1.0 key layout */
    migrate() {
      if (api.get('migrated', false)) return;
      let legacy = null;
      try { legacy = window.localStorage.getItem('flappy_eagle_highscore'); } catch (e) { /* noop */ }
      const parsed = parseInt(legacy || '0', 10);
      if (parsed > 0) {
        const bests = api.get('bests', {});
        // The old build kept a single shared best; classic is the fair home for it.
        if (!bests.classic || bests.classic < parsed) bests.classic = parsed;
        api.set('bests', bests);
      }
      api.set('migrated', true);
    }
  };

  api.migrate();
  return api;
})();

/* ---------------------------------------------------------------------------
   DEFAULTS
   --------------------------------------------------------------------------- */

const DEFAULT_SETTINGS = {
  muted: false,
  volume: 0.5,
  haptics: true,
  shake: true,
  reducedMotion: false,
  mode: 'classic'
};

const DEFAULT_STATS = {
  games: 0,
  totalScore: 0,
  totalDistance: 0,
  totalPowerups: 0,
  bestCombo: 0,
  nearMisses: 0
};

const Settings = {
  data: Object.assign({}, DEFAULT_SETTINGS, Store.get('settings', {})),
  get(key) { return this.data[key]; },
  set(key, value) {
    this.data[key] = value;
    Store.set('settings', this.data);
    return value;
  }
};

/* Respect the OS-level reduced-motion preference on first load. */
try {
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      Store.get('settings', null) === null) {
    Settings.set('reducedMotion', true);
    Settings.set('shake', false);
  }
} catch (e) { /* matchMedia unsupported */ }
