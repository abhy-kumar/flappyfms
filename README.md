# 🦅 Flappy FMS – Interactive Web Game & Digital Marketing Showcase

[![Play Game](https://img.shields.io/badge/Play%20Game-Live%20Demo-c0262d?style=for-the-badge&logo=google-chrome&logoColor=white)](https://abhy-kumar.github.io/flappyfms/)
[![GitHub repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/abhy-kumar/flappyfms)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Flappy FMS** (formerly Flappy Eagle) is a high-performance, 60 FPS HTML5 Canvas arcade browser game engineered around **Digital Marketing**, **Growth Hacking**, and **Technical SEO** principles. Powered by a custom transparent eagle sprite (`bird.png`), procedural Web Audio API synthesized sound effects, dynamic parallax background transitions, and responsive glassmorphic UI, it serves as an interactive showcase for digital marketing concepts.

---

## 🎯 Digital Marketing & Growth Engineering Core Concepts

### 1. Gamification Marketing & The Hook Model
Gamification leverages core human psychological drives (competition, mastery, and achievement) to dramatically boost **User Retention** and **Dwell Time** (average session duration).

```
   [ TRIGGER ] ─────────► [ ACTION ]
        ▲                      │
        │                      ▼
  [ INVESTMENT ] ◄─── [ VARIABLE REWARD ]
```

* **External & Internal Triggers**: Nostalgic arcade gameplay, high-contrast visual prompts ("TAP / SPACE TO FLAP").
* **Action**: Single-click/tap low-friction entrance into gameplay.
* **Variable Reward**: Unpredictable pipe gap positions, randomized power-up spawns (🛡️ *Shield*, ⏳ *Slow-Mo*, 🌟 *Golden Feather*), and dynamic sky gradient transitions (Dawn ➔ Sunset ➔ Cyber Night).
* **Investment**: Accumulating personal high scores saved in `localStorage` and unlocking achievement milestones ("First Flight", "Eagle Eyes", "Legend of FMS").

---

### 2. Search Engine Optimization (SEO) & Technical Marketing

#### A. On-Page & Semantic SEO
* **Target Keyword Strategy**: Primary keywords (`flappy fms`, `free browser game`, `online arcade game`) integrated naturally into title tags, headings (`<h1>`, `<h2>`), meta descriptions, and alt attributes.
* **Semantic HTML5 Architecture**: Implements `<header>`, `<main>`, `<section>`, `<canvas>`, and `<button>` elements with strict heading hierarchy to optimize accessibility (a11y) and crawlability.
* **Canonical URL Enforcement**: Uses `<link rel="canonical" href="https://abhy-kumar.github.io/flappyfms/">` to eliminate duplicate content issues across HTTP/HTTPS and subdomain variations.

#### B. Structured Data & Schema.org (Google Rich Snippets)
Implemented JSON-LD (JavaScript Object Notation for Linked Data) markup directly in the `<head>` to enable **Rich Snippets**, **Knowledge Panel** integration, and enhanced SERP (Search Engine Results Page) click-through rates (CTR):

```json
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Flappy FMS",
  "description": "Free online arcade browser game featuring 3 game modes, power-ups, and synthesized sound effects.",
  "url": "https://abhy-kumar.github.io/flappyfms/",
  "genre": "Arcade",
  "gamePlatform": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

#### C. Social Media Graph Protocols (Viral Growth Strategy)
* **Open Graph (OG) Protocol**: Meta tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) optimized for rich previews when shared on Facebook, LinkedIn, WhatsApp, and iMessage.
* **Twitter / X Cards**: Custom `summary_large_image` configuration with dedicated 512x512 thumbnail assets to maximize Social Click-Through Rates (S-CTR).

#### D. Crawlability & Indexing Infrastructure
* **`sitemap.xml`**: XML sitemap outlining canonical URLs, update frequency (`weekly`), priority (`1.0`), and last modified timestamps.
* **`robots.txt`**: Standard search engine crawler instructions pointing directly to the XML sitemap endpoint.

---

### 3. Bounce Rate Optimization & Performance Marketing

| Metric | Implementation Strategy | Business / SEO Impact |
|---|---|---|
| **Page Load Speed** | Zero third-party runtime frameworks (Vanilla JS, Native Canvas API, CSS3). | Near-100 Google PageSpeed Insights score; lowers immediate bounce rate. |
| **Audio Optimization** | Web Audio API procedural synthesis (zero external `.mp3` downloads). | Eliminates network latency & audio asset loading delays. |
| **Zero-Friction UX** | Instant play without sign-up, registration, or app store download. | Maximizes top-of-funnel conversion rate. |
| **Responsive Canvas** | Viewport-aware dynamic canvas scaling (`100vw` x `100vh`). | Flawless mobile & desktop experience, boosting mobile rank signals. |

---

### 4. Conversion Rate Optimization (CRO) & User Experience (UX)

* **Clear Calls-to-Action (CTAs)**: High-contrast crimson buttons with clear directional icons (`START FLIGHT ▶`, `TRY AGAIN 🔄`).
* **Visual Hierarchy & Glassmorphism**: Translucent backdrop filters (`backdrop-filter: blur(16px)`), modern typography (*Outfit* & *Press Start 2P* Google Fonts), and glowing neon highlights.
* **Accessibility (a11y)**: Explicit ARIA roles (`role="dialog"`, `aria-live="polite"`, `aria-label`), keyboard navigation support (Spacebar, Up Arrow), and high color contrast compliance.

---

## 🛠️ Technical Architecture

```
flappyfms/
├── index.html        # Main HTML layout, SEO meta tags, Open Graph & JSON-LD schema
├── styles.css        # Full-screen glassmorphism design system & CSS animations
├── sitemap.xml       # Search engine sitemap
├── robots.txt        # Crawler index permissions
├── bird.png          # Transparent high-res player eagle sprite
├── bird.jpeg         # Fallback sprite
├── js/
│   ├── store.js      # Crash-safe localStorage wrapper, settings & lifetime stats
│   ├── audio.js      # Web Audio API sound synthesizer (zero external sound files)
│   ├── game.js       # Fixed 60 Hz simulation, physics, collision, scoring & rendering
│   └── app.js        # Input routing, modal stack, HUD, achievements & settings UI
└── .agents/rules/    # Agent & developer project environment directives
```

---

## 🎮 Gameplay Systems

### Modes & difficulty curve
| Mode | Gravity | Flap | Speed | Gap | Ramp |
|---|---|---|---|---|---|
| **Classic** | 0.42 | -8.5 | 2.4 → 3.24 | 38% → 33% of height | over 40 points |
| **Hardcore** | 0.50 | -9.0 | 3.2 → 4.48 | 30% → 26.5%, moving pillars | over 30 points |
| **Zen** | 0.30 | -7.8 | 1.8 | 46% | none |

Gaps are a fraction of screen height (clamped to 145–300px) and pillar spacing is a
constant pixel distance, so difficulty is identical on a phone and an ultrawide monitor.

### Scoring
- 1 point per pillar × the combo multiplier.
- The multiplier rises one step every 5 consecutive pillars, capped at **×5**.
- Clearing a gap with <20px of clearance is a **close call**: +2 × multiplier.
- Crashing into a Shield resets the combo but saves the run.

### Power-ups
| | Effect | Duration |
|---|---|---|
| 🌟 Golden Feather | +5 points | instant |
| 🛡️ Shield | absorbs one crash | until used |
| ⏳ Slow-Mo | 45% slower world, 25% lighter gravity | 6s |
| 🧲 Magnet | pulls pickups within 190px | 8s |
| 💎 2× Points | doubles all scoring | 10s |
| 👻 Ghost | phase through pillars | 5s |

Pickups are anchored to their pillar, so they track vertically with Hardcore's moving pillars.

### Progression
Per-mode high scores, Bronze/Silver/Gold/Platinum medals scaled per mode,
17 permanent achievements, and lifetime stats (runs, distance flown, best combo).
All stored locally — nothing is uploaded.

---

## 🐛 Engineering Notes — Defects Fixed

| Area | Defect | Fix |
|---|---|---|
| Physics | Particles, clouds, wing animation and Hardcore's moving pillars advanced per *rendered frame*, so they ran 2–2.4× faster on 120/144 Hz displays | Fixed 60 Hz accumulator behind a variable-rate render loop |
| Input | `click` **and** `pointerdown` were both bound to the canvas, so every desktop click flapped twice | Single `pointerdown` path |
| Input | Spacebar flapped — and could even start a run — while a modal was open | Input gated on the modal stack |
| Audio | The first sound of every session was silent: the play guard returned before the AudioContext existed | `init()` runs before the guard, plus a capture-phase unlock |
| Achievements | Milestones used exact score equality, so a +5 Feather that jumped 8 → 13 permanently skipped the "10" award | Threshold (`>=`) checks |
| Power-ups | Pickups spawned at a fixed position while Hardcore pillars moved over them | Pickups ride their pillar |
| Rendering | The death explosion froze mid-air because the update loop returned early on game-over | Effects update in every state; added a tumble-and-fall death animation |
| Layout | Resizing mid-flight left pillars with gaps sized for the old viewport | World rescales on resize |
| Rendering | `devicePixelRatio` was cached once at construction, so zoom or a monitor change rendered blurry | Re-read on every resize |
| Storage | Unguarded `localStorage` threw in Safari private mode and sandboxed iframes | Crash-safe wrapper with in-memory fallback |
| Storage | One shared high score across all three modes | Per-mode bests, with migration from the old key |
| A11y | Hidden modals were only `opacity: 0`, so their buttons stayed in the tab order | `visibility: hidden` + `inert`, plus focus trapping |
| A11y | `aria-pressed` on the mode buttons was never updated; the HUD was `aria-hidden` while containing a live region | Both corrected |
| A11y | `user-scalable=no` blocked pinch zoom (WCAG 1.4.4) | Removed; added `viewport-fit=cover` for notch safe areas |
| Perf | Power-up pills were polled with `setInterval(…, 250)` | Event-driven updates |
| Perf | Google Fonts loaded twice — once via `<link>`, once via CSS `@import` | `@import` removed |
| UX | No pause; switching tabs let the bird fall to its death in the background | Esc/P pause, auto-pause on blur, 3-2-1 resume countdown |


---

## 🚀 Local Development & Setup

### Prerequisites
- Python 3.x installed on your machine.

### Running Locally
1. **Clone the repository**:
   ```bash
   git clone https://github.com/abhy-kumar/flappyfms.git
   cd flappyfms
   ```

2. **Set up & activate a Virtual Environment** (recommended):
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1
   # macOS / Linux:
   source .venv/bin/activate
   ```

3. **Start the local server**:
   ```bash
   python -m http.server 8080
   ```

4. **Play the game**: Open `http://localhost:8080` in your web browser.

---

## 🌐 Deployment

This project is deployed using **GitHub Pages** directly from the `main` branch.
- **Live URL**: [https://abhy-kumar.github.io/flappyfms/](https://abhy-kumar.github.io/flappyfms/)

---

## 👤 Author & Credits

**Abhishek Kumar**
- **GitHub**: [@abhy-kumar](https://github.com/abhy-kumar)
- **Email**: [abhiks177@gmail.com](mailto:abhiks177@gmail.com)

*Built with ❤️ for digital marketing excellence and web performance.*
