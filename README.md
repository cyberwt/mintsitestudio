# Mint Site Studio: creator deal-feed demo

Live: https://demo.mintsitestudio.com/ (feed) · /studio (card tool) · /creators (pitch page)

- One Cloudflare Worker (`src/worker.js`) + static assets (`public/`). Free plan, no paid APIs.
- `/api/draft` fetches a product page (og:title / JSON-LD), rejects bot-wall pages, and builds a Chinese deal card + WeChat text.
- Demo data: `public/demo/deals.json`. These are sample prices and the page says so.
- The apex `mintsitestudio.com` still points at the older Netlify page (its TLS cert has expired). It isn't routed here.

Deploy: `npx wrangler@4 deploy` (account 629ea57d…, the weitong1129 account that owns the zone).
