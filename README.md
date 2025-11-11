Roblox Explorer — Local README

This workspace contains a small demo site about Roblox and a minimal Node/Express proxy to fetch Roblox place details (avoids CORS).

Files:
- `roblox.html` — main static page (open with a local server)
- `roblox.css` — styles
- `server.js` — minimal Node/Express proxy that forwards requests to Roblox's place-details endpoint
- `package.json` — dependencies and start script for the proxy

Search API
-------------
This proxy also exposes a paginated search endpoint for Roblox games:

- `GET /api/search-games?query=KEYWORD&limit=10&cursor=CURSOR`

The proxy forwards the request to Roblox's games listing/search endpoint and returns the JSON response. The response shape may vary; the client includes conservative parsing. If the response contains `nextPageCursor` or `nextCursor`, the client will show a "Load more" button to fetch the next page.

Usage notes
- If you run the proxy locally (see instructions below) the site will use it to fetch live player counts and to search Roblox for games by keyword, avoiding CORS issues. If the proxy is not running the site falls back to simulated counts and local curated list searches.

Wiki summaries
-------------
This project includes a small helper endpoint to fetch short extracts from the Roblox Fandom wiki so the client can show brief game info on demand.

- `GET /api/wiki-summary?title=GAME_TITLE` — returns a small JSON object with `title` and `extract` (plain text). The server uses the MediaWiki API on `roblox.fandom.com` and caches results locally for short periods.

Notes:
- Not every game has a wiki page. If no page is found the endpoint returns an object with `extract: null`.
- The proxy caches wiki extracts for a short duration to reduce load on the wiki.

How to run (PowerShell)

1. Serve the static site (from the folder that contains the `ROBLOX` folder). Example using Python (recommended):

```powershell
# from the folder that contains ROBLOX, e.g. Downloads\Websites
python -m http.server 8000
```

Open the page at:

http://localhost:8000/ROBLOX/roblox.html

2. Start the proxy server (in a separate terminal) so the page can fetch live Roblox data without CORS errors:

```powershell
cd ROBLOX
npm install
npm start
```

The proxy listens on http://localhost:3000 by default and exposes:
- `GET /api/place-details?placeId=PLACE_ID` — forwards to Roblox and returns JSON

Notes and troubleshooting
- If you don't run the proxy, the site will attempt to fetch live data directly and may fail due to CORS; the page will then show estimated (simulated) counts.
- The proxy is deliberately minimal. For production use you should add caching, rate-limiting, and API-key management.

How to add or edit videos / how-to steps
- Open `roblox.html` and find the `GAMES` array near the top of the script.
- Each entry can include `video` (a YouTube embed URL like `https://www.youtube.com/embed/VIDEO_ID`) and `howto` (an array of strings with steps).

Example:
{
  id: 123456,
  title: 'Example Game',
  video: 'https://www.youtube.com/embed/abcd1234',
  howto: ['Step 1', 'Step 2']
}

Search box / lookups
- The page includes a small search UI (in the Top Games tab) so you can enter a `placeId` to look up live details via the proxy, or search the local curated game list by name.

If you want, I can also:
- Add caching and API key support to the proxy,
- Deploy the proxy somewhere public (e.g. Render/Heroku) and update the client to hit that URL.
