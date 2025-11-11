const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simple proxy endpoint: /api/place-details?placeId=ID
app.get('/api/place-details', async (req, res) => {
  const placeId = req.query.placeId;
  if (!placeId) return res.status(400).json({ error: 'placeId query param required' });

  try {
    const target = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${encodeURIComponent(placeId)}`;
    const resp = await fetch(target, { method: 'GET' });
    const data = await resp.json();
    // allow cross-origin from local pages
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'proxy_fetch_failed', message: err.message });
  }
});

// Simple in-memory cache: map url -> {ts, data}
const CACHE_TTL_MS = 60 * 1000; // 60s
const cache = new Map();

// Basic per-IP rate limiter (very small, for dev)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 120; // requests per window per IP
const rateMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.start = now;
    rateMap.set(ip, entry);
    return true;
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

// Search endpoint: forwards to Roblox games listing/search and supports pagination
// Query params: query (string), limit (int), cursor (string)
app.get('/api/search-games', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'rate_limited' });

  const q = req.query.query || '';
  const limit = parseInt(req.query.limit, 10) || 10;
  const cursor = req.query.cursor || '';

  // Build Roblox games list URL. If Roblox changes this endpoint, the proxy will forward the response.
  // This URL mirrors the games listing API used by Roblox web UI.
  const params = new URLSearchParams();
  if (q) params.set('keyword', q);
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const target = `https://games.roblox.com/v1/games/list?${params.toString()}`;

  // Simple cache by target URL
  const now = Date.now();
  const cached = cache.get(target);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    res.set('Access-Control-Allow-Origin', '*');
    return res.json(cached.data);
  }

  try {
    const resp = await fetch(target, { method: 'GET' });
    const data = await resp.json();
    cache.set(target, { ts: now, data });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'proxy_fetch_failed', message: err.message });
  }
});

// Wiki summary endpoint: fetch short extract from Roblox Fandom (MediaWiki)
app.get('/api/wiki-summary', async (req, res) => {
  const title = req.query.title;
  if (!title) return res.status(400).json({ error: 'title query param required' });

  // normalize key
  const key = `wiki:${title}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.ts) < (CACHE_TTL_MS * 10)) { // longer TTL for wiki
    res.set('Access-Control-Allow-Origin', '*');
    return res.json(cached.data);
  }

  try {
    // Use MediaWiki API on the Roblox fandom wiki
    const apiUrl = `https://roblox.fandom.com/api.php?action=query&prop=extracts&exintro&explaintext&format=json&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(apiUrl, { method: 'GET' });
    const data = await resp.json();
    // parse page extract
    const pages = data && data.query && data.query.pages ? data.query.pages : null;
    let out = { title, extract: null };
    if (pages) {
      const page = Object.values(pages)[0];
      if (page && page.extract) {
        out.extract = page.extract;
        out.pageid = page.pageid;
      }
    }
    cache.set(key, { ts: now, data: out });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: 'wiki_fetch_failed', message: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Roblox proxy listening on http://localhost:${PORT}`));
