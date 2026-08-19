/* ==========================================================================
   PERSISTENT STORAGE & CAMPUS LEADERBOARD - FLAPPY FMS
   Safe wrapper around localStorage with in-memory fallback + FMS Leaderboard.
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
    backend = null; // Safari private / iframe sandbox fallback
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
      try { backend.setItem(key, value); } catch (e) { /* quota exceeded */ }
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
      } catch (e) { /* ignore circular */ }
      return value;
    },

    patch(key, partial) {
      const current = api.get(key, {}) || {};
      const next = Object.assign({}, current, partial);
      api.set(key, next);
      return next;
    },

    migrate() {
      if (api.get('migrated', false)) return;
      let legacy = null;
      try { legacy = window.localStorage.getItem('flappy_eagle_highscore'); } catch (e) { /* noop */ }
      const parsed = parseInt(legacy || '0', 10);
      if (parsed > 0) {
        const bests = api.get('bests', {});
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
   DEFAULTS & SETTINGS
   --------------------------------------------------------------------------- */

const DEFAULT_SETTINGS = {
  muted: false,
  volume: 0.5,
  haptics: true,
  shake: true,
  reducedMotion: false,
  mode: 'classic',
  pilotName: 'FMS_Pilot'
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

try {
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      Store.get('settings', null) === null) {
    Settings.set('reducedMotion', true);
    Settings.set('shake', false);
  }
} catch (e) { /* matchMedia unsupported */ }

/* ---------------------------------------------------------------------------
   FMS CAMPUS LEADERBOARD (TOP 10 HALL OF FAME)
   --------------------------------------------------------------------------- */

const DEFAULT_LEADERBOARD = [
  { name: 'FMS_Maverick',    score: 84, mode: 'classic',  medal: 'platinum', date: '2026-08-15' },
  { name: 'RedBuildingAce',  score: 68, mode: 'hardcore', medal: 'platinum', date: '2026-08-16' },
  { name: 'FinanceHawk',     score: 52, mode: 'classic',  medal: 'gold',     date: '2026-08-17' },
  { name: 'ConsultingGuru',  score: 45, mode: 'zen',      medal: 'gold',     date: '2026-08-17' },
  { name: 'BatchOf26',       score: 38, mode: 'classic',  medal: 'silver',   date: '2026-08-18' },
  { name: 'MarketingWhiz',   score: 32, mode: 'hardcore', medal: 'gold',     date: '2026-08-18' },
  { name: 'NorthCampusFlyer',score: 28, mode: 'classic',  medal: 'silver',   date: '2026-08-18' },
  { name: 'ProfFlapper',     score: 22, mode: 'zen',      medal: 'silver',   date: '2026-08-19' },
  { name: 'EagleCommander',  score: 18, mode: 'classic',  medal: 'bronze',   date: '2026-08-19' },
  { name: 'DeanOfFlap',      score: 12, mode: 'hardcore', medal: 'bronze',   date: '2026-08-19' }
];

const Leaderboard = {
  getEntries(filterMode = 'all') {
    const list = Store.get('leaderboard', DEFAULT_LEADERBOARD);
    if (filterMode === 'all') {
      return list.slice().sort((a, b) => b.score - a.score).slice(0, 10);
    }
    return list
      .filter(entry => entry.mode === filterMode)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  },

  checkTop10(score, mode = 'classic') {
    if (!score || score <= 0) return { qualifies: false, rank: 0 };
    const entries = this.getEntries(mode);
    if (entries.length < 10) {
      const pos = entries.filter(e => e.score >= score).length + 1;
      return { qualifies: true, rank: pos };
    }
    const lowest = entries[entries.length - 1].score;
    if (score > lowest) {
      const pos = entries.filter(e => e.score >= score).length + 1;
      return { qualifies: true, rank: pos };
    }
    return { qualifies: false, rank: 0 };
  },

  addEntry({ name, score, mode, medal }) {
    if (!score || score <= 0) return null;
    const cleanName = (name || Settings.get('pilotName') || 'FMS_Pilot').trim().slice(0, 18) || 'FMS_Pilot';
    Settings.set('pilotName', cleanName);

    const now = new Date().toISOString().slice(0, 10);
    const list = Store.get('leaderboard', DEFAULT_LEADERBOARD);

    const newEntry = {
      name: cleanName,
      score: Number(score),
      mode: mode || 'classic',
      medal: medal || null,
      date: now
    };

    list.push(newEntry);
    list.sort((a, b) => b.score - a.score);

    // Keep top 50 in pool across all modes
    const trimmed = list.slice(0, 50);
    Store.set('leaderboard', trimmed);

    // Broadcast update across open tabs / windows
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ffms_leaderboard_sync');
        bc.postMessage({ type: 'NEW_SCORE', entry: newEntry });
        bc.close();
      }
    } catch (e) { /* ignore */ }

    const rankInMode = this.getEntries(mode).findIndex(e => e === newEntry || (e.name === cleanName && e.score === score && e.date === now)) + 1;
    return { entry: newEntry, rank: rankInMode > 0 ? rankInMode : 1 };
  }
};
