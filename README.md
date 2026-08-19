# Flappy FMS – Free Online Arcade Flight Game

[![Live on Vercel](https://img.shields.io/badge/Play%20Now-flappyfms.vercel.app-c0262d?style=for-the-badge&logo=vercel&logoColor=white)](https://flappyfms.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/abhy-kumar/flappyfms)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20Offline-00f2fe?style=for-the-badge&logo=pwa&logoColor=white)](https://flappyfms.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Flappy FMS** is a high-performance, full-screen HTML5 Canvas arcade flight game built for the Faculty of Management Studies (FMS) community and web gamers worldwide. Guide a soaring red eagle through neon-lit obstacles, collect power-ups, earn medals, enter the **FMS Campus Leaderboard Top 10**, and unlock **43 unique achievements** — 100% free, zero ads, no sign-up, with instant offline PWA installability.

---

## Game Highlights

### 1. FMS Campus Leaderboard (Top 10 Hall of Fame)
- **Pilot Call Sign Entry**: When you achieve a Top 10 flight, claim your spot in the Hall of Fame with a custom pilot name (e.g. `FMS_Maverick`, `FinanceHawk`, `BatchOf26`).
- **Multi-Mode Rankings**: Filter rankings across `ALL`, `CLASSIC`, `HARDCORE`, and `ZEN`.
- **Zero-Cost Persistent Storage**: High scores and ranks are stored safely in local storage and synced across open tabs with zero server infrastructure costs.

### 2. Progressive Web App (PWA) Mobile Install
- **Install to Home Screen**: Install Flappy FMS as a native-feeling standalone app on Android, iOS (Safari), iPadOS, Windows, and macOS.
- **100% Offline Gameplay**: Service Worker (`sw.js`) caches all game assets, fonts, icons, and audio synthesis code.

### 3. Three Game Modes
| Mode | Description | Gap Clearance | Pipe Velocity | Difficulty Ramp |
|---|---|---|---|---|
| **Classic** | Balanced arcade flight | 38% screen height | 2.4 px/step | Speed & gap ramp up to 40 score |
| **Hardcore** | Moving obstacles & narrow gaps | 30% screen height | 3.2 px/step | Oscillating pillars, tight ramp |
| **Zen** | Relaxed, peaceful flight | 46% screen height | 1.8 px/step | Constant speed, no ramp |

### 4. Six Collectible Power-Ups
| Power-Up | Effect | Duration | Vector Icon |
|---|---|---|---|
| **Golden Feather** | +5 bonus points (+10 with 2x active) | Instant | Glowing 5-point star |
| **Shield Orb** | Absorbs one pillar collision | Until hit | Cyan armor shield |
| **Slow-Mo Clock** | Slows world by 45% & gravity by 25% | 6 seconds | Purple hourglass |
| **Magnet** | Pulls nearby pickups toward eagle | 8 seconds | Horseshoe magnet |
| **2x Points** | Doubles all score gains | 10 seconds | Cyan gemstone |
| **Ghost Phase** | Fly directly through solid pillars | 5 seconds | Silver ghost silhouette |

### 5. 43 Unlockable Achievements
- **Score Milestones (Up to 1,500 Points)**: First Flight (10), Flight Cadet (25), Bronze Aviator (50), Silver Wings (100), Double Century (200), Sky Sovereign (350), Legend of FMS (500), Sky Immortal (750), Cosmic Ascendant (1,000), Apex Predator (1,500).
- **Combos & Streaks**: Spark (5), Heating Up (15), Unbroken Flow (30), Solar Flare (60), Hyper Drive (100), Singularity (150).
- **Precision & Close Calls**: Razor Edge (1 near miss), Daredevil (5 near misses), Precision Ace (15 near misses), Ghostwire Master (30 near misses).
- **Mode Mastery**: Classic Veteran (150 Classic), Classic Titan (400 Classic), Hardcore Survivor (30 Hardcore), Iron Wings (75 Hardcore), Hardcore God (150 Hardcore), Zen Wanderer (200 Zen), Zen Enlightenment (500 Zen), Zen Transcendence (1,000 Zen), Well Travelled (All 3 modes).
- **Power-Up Mastery & Tactics**: First Pickup, Collector (10 pickups), Sky Arsenal (25 pickups), Purist Aviator (50 pts without pickups), Bounced (Shield save), Aegis Sentinel (3 Shield saves), Ghost Walk (Phase through 5 pillars).
- **Campus Prestige & Dedication**: Campus Legend (Enter FMS Top 10), Frequent Flyer (20 runs), Persistent (50 runs), Veteran Aviator (150 runs), Marathon (25,000m), Sky Nomad (75,000m), Orbital Voyager (200,000m).

---

## Technical Architecture

```
flappyfms/
├── index.html            # PWA shell, unified @graph SEO schemas, Open Graph, DOM UI & modals
├── styles.css            # Responsive glassmorphism styling & design system
├── manifest.webmanifest  # Web App Manifest for mobile installation
├── sw.js                 # Service Worker for offline asset caching (v2.4)
├── vercel.json           # Edge caching headers, security headers & clean URLs
├── sitemap.xml           # XML Image Sitemap targeting flappyfms.vercel.app
├── robots.txt            # Search engine & AI crawler permissions (GPTBot, Perplexity)
├── llms.txt              # Generative Engine Optimization (GEO) standard summary
├── llms-full.txt         # Complete machine-readable technical and design reference
├── og-image.png          # 1200x630 high-resolution social preview banner
├── bird.png              # Primary transparent eagle sprite
├── bird.jpeg             # Fallback sprite
└── js/
    ├── store.js          # Storage engine, settings & Campus Leaderboard module
    ├── audio.js          # Procedural Web Audio synthesizer (zero audio latency)
    ├── game.js           # Fixed 60 Hz physics engine, vector renderers, collision
    └── app.js            # Controller: modal stack, input, PWA prompt & HUD
```

---

## Digital Marketing & SEO Optimization (A+ Grade)

### 1. Technical SEO & Schema Authority
| SEO Factor | Implementation Details |
|---|---|
| **Primary Domain** | `https://flappyfms.vercel.app/` with exact canonical match |
| **Title Optimization** | 50 characters (ideal for Google mobile & desktop search results) |
| **Meta Description** | 145 characters (optimal SERP snippet display without truncation) |
| **Social Graph** | 1200×630 Open Graph & Twitter Cards (`og-image.png`) |
| **Structured Data** | Unified `@graph` JSON-LD (`VideoGame`, `WebSite`, `WebPage`, `HowTo`, `FAQPage`, `CollegeOrUniversity`, `Person`) |
| **Edge Performance** | `vercel.json` with 1-year immutable caching on static assets & security headers |
| **AI Search (GEO)** | Full `llms.txt` and `llms-full.txt` machine-readable context |
| **Single H1 Tag** | Clean semantic hierarchy with keyword-rich H2/H3 subsections |

### 2. Viral Growth & Engagement Loops
- **Campus Pride & Rivalry**: The Top 10 Hall of Fame drives healthy competition across FMS batches and departments.
- **Dynamic Social Sharing**: One-tap share button pre-fills custom run summaries with score, mode, and medal to invite challengers.
- **Hook Model Mastery**: Variable reward power-ups and progressive combo multipliers drive session depth and retention.

---

## Controls

| Action | Desktop Keyboard | Mobile / Tablet Touch |
|---|---|---|
| **Flap Wings** | `Space`, `↑`, `W` | Tap screen |
| **Pause Game** | `Escape`, `P` | Pause button (HUD) |
| **Toggle Audio** | `M` | Volume button (HUD) |
| **Leaderboard** | Click Top 10 | Ranking icon (HUD) |

---

## Local Development

```bash
git clone https://github.com/abhy-kumar/flappyfms.git
cd flappyfms

# Setup Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
source .venv/bin/activate      # macOS/Linux

# Start local test server
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080).

---

## Deployment & Verification

- **Live URL**: [https://flappyfms.vercel.app/](https://flappyfms.vercel.app/)
- **Sitemap**: [https://flappyfms.vercel.app/sitemap.xml](https://flappyfms.vercel.app/sitemap.xml)
- **Robots**: [https://flappyfms.vercel.app/robots.txt](https://flappyfms.vercel.app/robots.txt)
- **LLMs.txt**: [https://flappyfms.vercel.app/llms.txt](https://flappyfms.vercel.app/llms.txt)

---

## Author

**Abhishek Kumar**
- GitHub: [@abhy-kumar](https://github.com/abhy-kumar)
- Email: [abhiks177@gmail.com](mailto:abhiks177@gmail.com)
