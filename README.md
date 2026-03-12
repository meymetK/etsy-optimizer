# Etsy Optimizer + Pinterest Pinner

Automate your Etsy shop optimization workflow: scrape listings, optimize titles/tags/descriptions/alt-text, apply changes back to Etsy, and pin products to Pinterest.

Built with [Playwright](https://playwright.dev/) for browser automation.

## Features

- **Scrape** all listings from your Etsy shop dashboard
- **Optimize** titles (under 70 chars), tags (13 slots, no overlap with title), descriptions, and image alt text
- **Apply** optimizations back to Etsy via browser automation
- **Pin to Pinterest** via browser method (no API key) or Pinterest API

## Prerequisites

- Node.js 18+
- A Chromium-based browser (Chrome, Edge, Opera, Brave, etc.)
- An Etsy seller account

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/etsy-optimizer.git
cd etsy-optimizer
npm install
npx playwright install chromium
cp .env.example .env
```

Edit `.env` with your browser executable path and user data directory.

### Finding Your Browser Paths

**Chrome (Windows):**
```
BROWSER_EXE=C:/Program Files/Google/Chrome/Application/chrome.exe
BROWSER_USER_DATA=C:/Users/YOUR_USER/AppData/Local/Google/Chrome/User Data
```

**Edge (Windows):**
```
BROWSER_EXE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe
BROWSER_USER_DATA=C:/Users/YOUR_USER/AppData/Local/Microsoft/Edge/User Data
```

## Workflow

### 1. Scrape Listings

```bash
node scrape.js
```

Opens your browser, navigates to Etsy's listing manager, and scrapes all listing data (title, description, tags, price) into `listings_raw.json`.

### 2. Optimize

**Basic** (title + tags only):
```bash
node optimize.js
```

**Full** (title + tags + description + alt text):
```bash
node optimize_all.js
```

Outputs `listings_optimized.json`. Review the preview output and edit the optimization rules in the script to match your niche.

### 3. Apply Changes to Etsy

First, start your browser with remote debugging:
```bash
"path/to/browser.exe" --remote-debugging-port=9334
```

Then apply:
```bash
node apply.js
```

Progress is saved to `progress.json` — you can stop and resume anytime.

### 4. Pin to Pinterest

**Option A: Browser method (no API key needed)**

```bash
node pinterest_scrape.js   # Scrape listing images
node pin.js                # Pin via browser (must be logged in to Pinterest)
```

**Option B: Pinterest API**

1. Create a Pinterest app at https://developers.pinterest.com/apps/
2. Add `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET` to `.env`
3. Run:

```bash
node pinterest_auth.js     # OAuth flow — opens browser
node pinterest_board.js    # Create a board
node pinterest_scrape.js   # Scrape listing images
node pinterest_post.js     # Post pins via API
```

Use `--dry-run` to preview without posting:
```bash
node pinterest_post.js --dry-run
```

## Customization

The optimization scripts contain category-based logic for generating descriptions and tags. Edit `optimize_all.js` to:

- Add categories that match your product niche
- Customize description templates
- Adjust tag pools
- Modify the fixed description sections (sizing, shipping, etc.)

## File Overview

| File | Purpose |
|------|---------|
| `scrape.js` | Scrape all Etsy listings |
| `optimize.js` | Optimize titles + tags |
| `optimize_all.js` | Optimize titles + tags + descriptions + alt text |
| `apply.js` | Apply optimizations to Etsy |
| `pinterest_scrape.js` | Scrape listing images for Pinterest |
| `pin.js` | Pin to Pinterest via browser |
| `pinterest_auth.js` | Pinterest OAuth 2.0 (optional) |
| `pinterest_board.js` | Create Pinterest board (optional) |
| `pinterest_post.js` | Pin via Pinterest API (optional) |

## Notes

- All scripts are **resume-capable** — they save progress and skip already-processed listings
- Browser must be logged in to Etsy (and Pinterest for `pin.js`) before running
- The scraper uses Etsy's listing editor page, not the public storefront
- Rate limiting is built into Pinterest scripts to avoid bans

## License

MIT
