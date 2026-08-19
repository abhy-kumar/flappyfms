# 🦅 Flappy Eagle – Free Browser Arcade Game

[![Play Now](https://img.shields.io/badge/▶%20Play%20Now-Live%20Demo-c0262d?style=for-the-badge&logo=google-chrome&logoColor=white)](https://abhy-kumar.github.io/flappyfms/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/abhy-kumar/flappyfms)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Flappy Eagle** (Flappy FMS) is a free, full-screen HTML5 Canvas arcade game. Guide a soaring red eagle through neon-lit pillar gaps, collect power-ups, earn medals, and chase a high score — no download, no sign-up, instant play in any modern browser.

This project is also a hands-on showcase of **Digital Marketing**, **Technical SEO**, **Generative Engine Optimization (GEO)**, and **Growth Hacking** concepts.

---

## 🎮 Game Features

### Three Game Modes
| Mode | Description | Gap Size | Pipe Speed |
|---|---|---|---|
| **Classic** | Steadily increasing challenge | 38% of screen height | 2.4 → ramps up |
| **Hardcore** | Moving pillars, tighter gaps | 30% of screen height | 3.2 → ramps up |
| **Zen** | Relaxed, no ramp-up | 46% of screen height | 1.8 (constant) |

### Six Power-Ups
| Power-Up | Effect | Duration |
|---|---|---|
| 🌟 Golden Feather | +5 bonus points instantly | Instant |
| 🛡️ Shield Orb | Absorbs one pillar collision | Until hit |
| ⏳ Slow-Mo Clock | Slows everything by 45% | 6 seconds |
| 🧲 Magnet | Attracts nearby collectibles | 8 seconds |
| 💎 2× Points | Doubles scoring multiplier | 10 seconds |
| 👻 Ghost | Pass through one pillar | 5 seconds |

### Medal System
Earn **Bronze**, **Silver**, **Gold**, or **Platinum** medals by hitting score thresholds that vary per game mode. Medal targets are tighter in Hardcore and more generous in Zen.

### Score Multiplier / Combo System
Consecutive near-misses and power-up chains build a combo multiplier (up to ×5), shown as a HUD chip. It drives exponential high-score growth and encourages aggressive play.

### Other Features
- **Achievements system** — unlockable milestones persisted across sessions
- **Pause / Resume** — Escape or P key, or the ⏸ HUD button
- **Share button** — native share sheet on mobile, clipboard fallback on desktop
- **Auto-pause** on tab switch or window blur
- **Per-mode high scores** stored via the `Store` module (safe `localStorage` wrapper)
- **Lifetime stats** — total games, distance, best combo, near-misses
- **Settings panel** — volume slider, haptics, screen shake, reduced-motion toggle
- **Reduced-motion support** — respects `prefers-reduced-motion` OS preference
- **Dynamic sky** — background colour palette smoothly interpolates through 3 stages as score climbs
- **Background hills & parallax clouds** — scrolling at variable depth layers
- **Score popup floaters** — points bubble up from pipes as you clear them

---

## 🛠️ Technical Architecture

```
flappyfms/
├── index.html          # HTML shell, SEO meta, Open Graph, JSON-LD schema
├── styles.css          # Full-screen glassmorphism design system
├── sitemap.xml         # XML sitemap for search engine crawlers
├── robots.txt          # Crawler index permissions
├── llms.txt            # AI/LLM crawler discoverability (GEO standard)
├── bird.png            # Transparent eagle sprite (primary)
├── bird.jpeg           # Fallback sprite
└── js/
    ├── audio.js        # Web Audio API synthesizer — zero external sound files
    ├── store.js        # Safe localStorage wrapper with in-memory fallback + migration
    ├── game.js         # Fixed-timestep 60 Hz engine, physics, collision, rendering
    └── app.js          # DOM controller: modal stack, input routing, HUD, toasts, settings
```

### Engine Design Highlights (`game.js`)
- **Fixed 60 Hz timestep** behind a variable-rate render loop — physics behave identically on 60/120/144 Hz displays
- **Distance-based pipe spawning** — `pipeSpacingPx` guarantees constant pixel spacing regardless of screen width or frame rate, completely eliminating the "impossible wall" bug from frame-interval spawning
- **Proportional gap sizing** — `pipeGapFrac × canvasHeight` so gaps are always fair on any screen from mobile to ultrawide
- **Live resize handling** — `visualViewport` + `resize` events rescale the world mid-flight (mobile URL bar, orientation change) without repositioning the bird unfairly
- **DPR-aware canvas** — re-reads `devicePixelRatio` on every resize so zooming or moving to a HiDPI monitor stays crisp
- **Weighted power-up spawning** — each power-up has a `weight` property; rare items (Ghost, Magnet) appear far less often than common ones (Feather, Shield)
- **Per-mode difficulty ramp** — speed, gap size, and pipe spacing all tighten gradually as score climbs, then hard-stop at a floor so the game never becomes unplayable

### App Controller Design Highlights (`app.js`)
- **Modal stack** — proper stacking (`push`/`pop`), `inert` attribute on non-top modals, focus trapping, and focus restoration on close
- **Event-driven HUD** — the engine emits typed events (`score`, `state`, `powerups`, `achievement`, `gameover`) so the DOM is never polled
- **Single pointer event per flap** — `pointerdown` only (no `click`), preventing the old double-flap on desktop
- **Queued toast notifications** — achievements and new-record banners serialise through a queue so they never overlap
- **Zero inline styles** — all visibility managed via CSS classes (`visible`, `active`, `hot`, `expiring`)

### Storage (`store.js`)
- Wraps `localStorage` with a transparent **in-memory fallback** for Safari private mode, sandboxed iframes, and quota-exceeded scenarios — the game never throws
- **One-time migration** from the legacy `flappy_eagle_highscore` key to the new per-mode `ffms_bests` structure
- **`Settings` object** persists volume, mute, haptics, shake, reduced-motion, and last-used mode

---

## 📣 Digital Marketing Concepts Implemented

### 1. Gamification & The Hook Model
The game deliberately encodes the four-stage Hook Model to maximise **session depth** and **return visits**:

```
   [ TRIGGER ]  → Nostalgic arcade aesthetic, share links, achievement notifications
       ↓
   [ ACTION ]   → Single tap/click — lowest possible friction to enter the game loop
       ↓
   [ VARIABLE REWARD ] → Unpredictable gaps, random power-up types, medal surprises
       ↓
   [ INVESTMENT ] → Per-mode high scores, achievements, lifetime stats, combo mastery
```

Each investment hooks back into the trigger — a new personal best creates an internal drive to return.

### 2. Technical SEO
| Element | Implementation |
|---|---|
| **Title tag** | 43 characters — within Google's 50–60 char sweet spot |
| **Meta description** | 138 characters — within the 120–160 char display window |
| **Canonical URL** | Prevents duplicate-content penalties across HTTP/HTTPS/www variants |
| **Hreflang** | `en` + `x-default` for language/region targeting |
| **Single H1** | Enforced — one `<h1>` per page inside the crawlable `<article>` |
| **H2–H3 hierarchy** | "How to Play", "Game Modes", "Power-Ups", "Features", "About" — keyword-rich headings |
| **Text content** | 350+ word crawlable `<article>` (off-screen, not `display:none`) prevents "thin content" flag |
| **`sitemap.xml`** | Weekly change frequency, priority 1.0 |
| **`robots.txt`** | Points all crawlers to the sitemap |
| **No inline styles** | All visibility via CSS classes — passes the SEOptimer inline-style check |

### 3. Structured Data (Google Rich Results)
Three JSON-LD schemas in `<head>`:
- **`VideoGame`** — name, description, genre, platform, free offer, author — enables game cards in Google Search
- **`BreadcrumbList`** — structured navigation trail
- **`WebSite`** — site-level entity registration for Knowledge Graph

### 4. Social Graph Optimisation
- **Open Graph** (`og:title`, `og:description`, `og:image`, `og:url`) — rich link previews on Facebook, LinkedIn, WhatsApp, iMessage
- **Twitter/X Cards** (`summary_large_image`) — large image preview cards on Twitter/X
- **Share button** in the game-over screen with native `navigator.share` (mobile) and clipboard fallback (desktop) — turns every score into a potential viral share

### 5. Generative Engine Optimisation (GEO)
- **`llms.txt`** — structured, markdown-format description of the game for AI search engines (Perplexity, ChatGPT Search, Gemini) following the emerging `llms.txt` standard
- **`robots.txt`** configured to allow all major AI crawlers
- Semantic HTML with `<article>`, `<section>`, `<header>`, `<nav>` — LLMs parse semantic structure better than flat `<div>` soup

### 6. Performance Marketing (Core Web Vitals)
| Metric | Result |
|---|---|
| **Server response time** | 0.016s (Vercel edge network) |
| **Page load (all content)** | 0.2s |
| **Download size** | 0.10 MB |
| **Compression rate** | 46% (HTML 69%, CSS 74%, JS 72%) |
| **JavaScript errors** | Zero |
| **HTTP/2** | ✅ |
| **SSL/HTTPS** | ✅ |

Zero third-party runtime frameworks — Vanilla JS + native Canvas API + Web Audio API. No React, no jQuery, no build step.

### 7. Conversion Rate Optimisation (CRO)
- **Zero-friction entry** — no sign-up, no download, no app store. Click and play.
- **Clear primary CTA** — high-contrast crimson `START FLIGHT ▶` button with immediate visual feedback
- **Mobile-first responsive** — `100vw × 100vh` canvas, `pointer-events` touch handling, `contextmenu` suppressed
- **Reduced-motion support** — respects OS accessibility preferences, widening the accessible audience
- **Auto-pause** on blur — prevents return-to-dead-bird frustration that causes abandonment

---

## 🚀 Local Development

### Prerequisites
- Python 3.x (for local dev server)

### Setup
```bash
git clone https://github.com/abhy-kumar/flappyfms.git
cd flappyfms

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Serve locally
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

### Controls
| Action | Desktop | Mobile |
|---|---|---|
| Flap | `Space`, `↑`, `W` | Tap / Click |
| Pause | `Escape`, `P` | ⏸ button |
| Mute | `M` | 🔊 button |

---

## 🌐 Deployment

Deployed via **GitHub Pages** from the `main` branch.

- **Live URL**: [https://abhy-kumar.github.io/flappyfms/](https://abhy-kumar.github.io/flappyfms/)
- **Sitemap**: [https://abhy-kumar.github.io/flappyfms/sitemap.xml](https://abhy-kumar.github.io/flappyfms/sitemap.xml)
- **LLMs.txt**: [https://abhy-kumar.github.io/flappyfms/llms.txt](https://abhy-kumar.github.io/flappyfms/llms.txt)

> **Analytics**: Uncomment the Google Analytics 4 block in `<head>` of `index.html` and replace `G-XXXXXXXXXX` with your Measurement ID from [analytics.google.com](https://analytics.google.com).

---

## 👤 Author

**Abhishek Kumar**
- GitHub: [@abhy-kumar](https://github.com/abhy-kumar)
- Email: [abhiks177@gmail.com](mailto:abhiks177@gmail.com)

*Built with ❤️ — where game dev meets digital marketing.*
