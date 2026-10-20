// Mint Site Studio demo Worker (demo.mintsitestudio.com):
//   /          demo deal feed
//   /studio    card tool (POSTs to /api/draft)
//   /creators  pitch page for creators (public/creators.html, served as-is)

const DEMO_PATHS = {
  "/": "/demo/",
  "/studio": "/demo/studio",
  "/deals.json": "/demo/deals.json",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/draft") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      return draftCard(request);
    }

    const mapped = DEMO_PATHS[url.pathname];
    if (mapped) {
      const assetUrl = new URL(mapped, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    return env.ASSETS.fetch(request);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ---- Card drafting -------------------------------------------------------
// Input: { url, was, now, note, amazonTag }
// Best-effort fetch of the product page for title/brand/image/price, then a
// rule-based Chinese hook. No paid APIs; if the store blocks us, the creator
// fills the title by hand.

async function draftCard(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const raw = String(body.url || "").trim();
  let target;
  try {
    target = new URL(raw);
    if (!/^https?:$/.test(target.protocol)) throw new Error();
  } catch {
    return json({ error: "请粘贴一个以 http(s) 开头的商品链接" }, 400);
  }

  const meta = await fetchMeta(target);
  const was = num(body.was) ?? meta.listPrice ?? null;
  const now = num(body.now) ?? meta.price ?? null;
  const title = String(body.title || "").trim() || meta.title || "";
  const brand = meta.brand || prettyHost(target.hostname);
  const note = String(body.note || "").trim().slice(0, 40);

  const link = wrapLink(target, String(body.amazonTag || "").trim());
  const off = was && now && now < was ? now / was : null;

  const hook = makeHook({ off, note, brand });
  const priceLine = makePriceLine(was, now);
  const card = {
    hook,
    brand,
    title: title.slice(0, 80),
    priceLine,
    image: meta.image || null,
    link,
    fetched: meta.ok,
  };
  const wechat = [hook, title ? `${brand} ${title}` : brand, priceLine, link].filter(Boolean).join("\n");
  return json({ card, wechat });
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function prettyHost(h) {
  const base = h.replace(/^www\.|^shop\.|^m\./, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function zhe(ratio) {
  // 0.7 -> "7折", 0.55 -> "55折", 0.42 -> "42折"
  const n = Math.round(ratio * 100);
  return n % 10 === 0 ? `${n / 10}折` : `${n}折`;
}

function makeHook({ off, note, brand }) {
  const parts = [];
  if (off) {
    if (off <= 0.4) parts.push(`【骨折价！${zhe(off)}】`);
    else if (off <= 0.5) parts.push(`【史低级好价 ${zhe(off)}】`);
    else parts.push(`【${zhe(off)}】`);
  } else {
    parts.push(`【${brand} 好价】`);
  }
  if (note) parts.push(`【${note}】`);
  return parts.join("");
}

function makePriceLine(was, now) {
  const f = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (was && now && now < was) return `${f(was)} ➡️ ${f(now)}`;
  if (now) return f(now);
  return "";
}

function wrapLink(u, amazonTag) {
  const out = new URL(u.toString());
  if (amazonTag && /(^|\.)amazon\.com$/.test(out.hostname)) {
    out.searchParams.set("tag", amazonTag.replace(/[^a-zA-Z0-9-]/g, ""));
  }
  return out.toString();
}

async function fetchMeta(u) {
  const empty = { ok: false };
  try {
    const res = await fetch(u.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return empty;
    const html = (await res.text()).slice(0, 600_000);
    const og = (p) => matchMeta(html, p);
    const out = {
      ok: true,
      title: clean(og("og:title") || (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || ""),
      image: og("og:image") ? clean(og("og:image")) : null,
      brand: clean(og("og:site_name") || ""),
    };
    // Bot walls and interstitials come back 200 with a useless title.
    if (BLOCKED_TITLE.test(out.title)) return empty;
    const ld = parseProductLd(html);
    if (ld) {
      out.title = out.title || ld.name;
      out.brand = ld.brand || out.brand;
      out.price = ld.price;
      out.image = out.image || ld.image;
    }
    const metaPrice = num(og("product:price:amount") || og("og:price:amount"));
    if (!out.price && metaPrice) out.price = metaPrice;
    out.title = tidyTitle(out.title, out.brand || prettyHost(u.hostname));
    return out;
  } catch {
    return empty;
  }
}

function matchMeta(html, prop) {
  const esc = prop.replace(/[.:]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, "i");
  return (html.match(a) || html.match(b) || [])[1] || null;
}

function parseProductLd(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const body = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const items = [].concat(data["@graph"] || data);
    for (const it of items) {
      const type = [].concat(it && it["@type"]);
      if (!type.includes("Product")) continue;
      const offers = [].concat(it.offers || [])[0] || {};
      return {
        name: clean(it.name || ""),
        brand: clean(typeof it.brand === "string" ? it.brand : it.brand?.name || ""),
        price: num(offers.price ?? offers.lowPrice),
        image: [].concat(it.image || [])[0] || null,
      };
    }
  }
  return null;
}

const BLOCKED_TITLE = /hang tight|access denied|just a moment|attention required|are you a robot|captcha|robot check|pardon our interruption|page not found|404/i;

// "Amazon.com: Owala FreeSip ... : Sports & Outdoors" -> "Owala FreeSip ..."
// "COTTON FLEECE HOODIE | HEATHER GREY | SKIMS"     -> "COTTON FLEECE HOODIE | HEATHER GREY"
function tidyTitle(title, brand) {
  let t = title.replace(/^amazon\.com\s*:\s*/i, "").replace(/\s*:\s*[A-Z][\w &,'-]+$/, "");
  const b = brand.toLowerCase();
  const parts = t.split(/\s+[|–—-]\s+/);
  while (parts.length > 1 && parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "").includes(b.replace(/[^a-z0-9]/g, ""))) parts.pop();
  return parts.join(" | ").trim();
}

function clean(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
