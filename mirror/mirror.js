/* Dashboard Cuaca Aziz - mirror run by GitHub every ~15 minutes (.github/workflows/mirror.yml).
   Reads the pages that do not let other web pages read them (JPS Public Infobanjir, Tide Forecast)
   and writes small JSON files that the app reads.
   usage: node mirror/mirror.js <outDir>        (Node 20+, no packages) */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./parse');
const K = require('./kemaman');

const OUT = path.resolve(process.argv[2] || 'out');
const REPO = process.env.GITHUB_REPOSITORY || 'azizdigital/monsoon-eye';
const PREV = 'https://raw.githubusercontent.com/' + REPO + '/data/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

/* districts with 5-minute history (30 days) for Monsoon EYE: mirror/districts.json (Kemaman is always there).
   Each: { "id": "dungun", "state": "TRG", "district": "Dungun", "gids": [optional gauge ids] } -> folder d/<id>/ of the branch "data".
   The form "Tambah daerah" in the app gives this text ("Salin config mirror"). */
let DISTRICTS = [];
try { DISTRICTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'districts.json'), 'utf8')).filter(d => d && /^[a-z0-9-]{1,40}$/.test(d.id) && d.id !== 'kemaman' && /^[A-Z]{3}$/.test(d.state || '') && d.district); }
catch (e) { DISTRICTS = []; }
/* JPS states mirrored (state codes of JPS Public Infobanjir): JPS_STATES (repo variable), plus the states of the districts above */
const STATES = Array.from(new Set((process.env.JPS_STATES || 'TRG').split(',').concat(DISTRICTS.map(d => d.state)).map(s => s.trim().toUpperCase()).filter(Boolean)));
/* Tide Forecast places: id -> page */
const TIDES = { cukai: 'https://www.tide-forecast.com/locations/Cukai/tides/latest' };

const jpsWaterUrl = st => 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=' + st + '&district=ALL&station=ALL&lang=en';
const jpsRainUrl = st => 'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=' + st + '&district=ALL&station=ALL&language=1&loginStatus=0';

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { last = e; await new Promise(res => setTimeout(res, 4000 * (i + 1))); }
  }
  throw last;
}
async function previous(file) {
  try { const r = await fetch(PREV + file + '?t=' + Date.now(), { signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
function write(file, data) { fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true }); fs.writeFileSync(path.join(OUT, file), JSON.stringify(data)); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const now = new Date().toISOString(), status = { at: now, sources: {} };

  for (const st of STATES) {
    const file = 'jps-' + st + '.json', prev = await previous(file);
    const out = { state: st, at: now, water: null, rain: null, waterAt: null, rainAt: null, waterUrl: jpsWaterUrl(st), rainUrl: jpsRainUrl(st), errors: {} };
    try {
      const w = P.jpsWater(await get(out.waterUrl));
      if (!w.length) throw new Error('no stations in the table');
      out.water = w; out.waterAt = now;
    } catch (e) { out.errors.water = String(e.message || e); if (prev) { out.water = prev.water; out.waterAt = prev.waterAt; } }
    try {
      const r = P.jpsRain(await get(out.rainUrl));
      if (!r.stations.length) throw new Error('no stations in the table');
      out.rain = r; out.rainAt = now;
    } catch (e) { out.errors.rain = String(e.message || e); if (prev) { out.rain = prev.rain; out.rainAt = prev.rainAt; } }
    write(file, out);
    if (st === 'TRG') {
      /* Daerah Kemaman: the JPS 5-minute readings of every gauge, 30 days (the app's Water Level / Rainfall Kemaman pages) */
      try { status.sources.kemaman = await K.kemaman(out, { get: u => get(u, 2), previous, write }); }
      catch (e) { status.sources.kemaman = { ok: false, error: String(e.message || e) }; }
    }
    for (const d of DISTRICTS.filter(x => x.state === st)) {
      try { status.sources['d-' + d.id] = await K.district(out, { get: u => get(u, 2), previous, write }, { district: d.district, folder: 'd/' + d.id + '/', gids: d.gids }); }
      catch (e) { status.sources['d-' + d.id] = { ok: false, error: String(e.message || e) }; }
    }
    status.sources['jps-' + st] = { water: !out.errors.water, rain: !out.errors.rain, errors: out.errors, stations: (out.water || []).length };
  }

  for (const [id, url] of Object.entries(TIDES)) {
    const file = 'tide-' + id + '.json', prev = await previous(file);
    const out = { place: id, at: now, url, events: null, eventsAt: null, error: null };
    try {
      const ev = P.tides(await get(url));
      if (ev.length < 4) throw new Error('no tide times on the page');
      out.events = ev; out.eventsAt = now;
    } catch (e) { out.error = String(e.message || e); if (prev) { out.events = prev.events; out.eventsAt = prev.eventsAt; } }
    write(file, out);
    status.sources['tide-' + id] = { ok: !out.error, error: out.error, events: (out.events || []).length };
  }

  write('status.json', status);
  console.log(JSON.stringify(status, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
