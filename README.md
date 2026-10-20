# Mint Site Studio: creator deal-feed demo

Live: https://mintsitestudio.com/ (pitch; www → apex) · https://demo.mintsitestudio.com/ (feed) · /studio (card tool) · /creators

- One Cloudflare Worker (`src/worker.js`) + static assets (`public/`). Free plan, no paid APIs.
- `/api/draft` fetches a product page (og:title / JSON-LD), rejects bot-wall pages, and builds a Chinese deal card + WeChat text.
- Demo data: `public/demo/deals.json`. These are sample prices and the page says so.
- 2026-10-20: the old Netlify A/CNAME records were removed; the apex + www are Worker custom domains now. Kept: _domainconnect, pay (GoDaddy), _dmarc, shello.

Deploy: `npx wrangler@4 deploy` (account 629ea57d…, the weitong1129 account that owns the zone).
