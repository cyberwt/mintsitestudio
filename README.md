# Mint Site Studio

Live:
- https://mintsitestudio.com/ — **Mint Puzzles**, six free daily puzzles (Word, Hive, Box, Sum, Mini Sudoku, Nonogram); www → apex
- https://seller.mintsitestudio.com/ — creator deal-feed pitch (moved from the apex 2026-10-21; apex /creators 301s here)
- https://demo.mintsitestudio.com/ — demo deal feed · /studio (card tool) · /creators

## Mint Puzzles

- Puzzles are generated in the browser from the date (`public/assets/mint.js`, seeded by `<game>:<YYYY-MM-DD>`), so there is no puzzle data to store. Each generator is solver-checked: Sum targets are built from the numbers, Sudoku keeps exactly one solution, Nonograms must be line-solvable.
- `/<game>/YYYY-MM-DD` is the same page with its own title + canonical (HTMLRewriter in the Worker); days before `LAUNCH` or in the future 404. `/sitemap.xml` lists every day since launch.
- Progress and streaks live in the player's localStorage only. No analytics or ads yet.
- Word, Hive and Box (added 2026-10-22) read the frozen word list `public/assets/words-v1.js`, built from SCOWL by `scripts/build-words.py` (credit + license in `/assets/scowl-copyright.txt`, linked from /about). Never rebuild v1; make words-v2.js with a cutover date. They are original takes on NYT's Wordle / Spelling Bee / Letter Boxed mechanics: keep our own names, colors (teal/orange, not green/yellow), emoji and messages.
- Changing a generator changes every past puzzle. Version it (e.g. a new seed prefix from a cutover date) instead of editing in place.
- Local preview: `npx wrangler@4 dev --port 8791` (localhost acts as the apex).

## Deal-feed demo

- One Cloudflare Worker (`src/worker.js`) + static assets (`public/`). Free plan, no paid APIs.
- `/api/draft` fetches a product page (og:title / JSON-LD), rejects bot-wall pages, and builds a Chinese deal card + WeChat text.
- Demo data: `public/demo/deals.json`. These are sample prices and the page says so.
- 2026-10-20: the old Netlify A/CNAME records were removed; the apex + www are Worker custom domains now. Kept: _domainconnect, pay (GoDaddy), _dmarc, shello.

Deploy: `npx wrangler@4 deploy` (account 629ea57d…, the weitong1129 account that owns the zone).
