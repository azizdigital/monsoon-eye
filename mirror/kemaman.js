/* Dashboard Cuaca Aziz - mirror of the JPS 5-minute readings of Daerah Kemaman, for the app's Water Level / Rainfall Kemaman pages.
   Folder kemaman/ of the branch "data":
     now.json          the gauges of the JPS tables (level, thresholds, time) + 26 hours of 5-minute levels, 7 days of hourly rain, 3 hours of 5-minute rain
     wl-<gid>.json     30 days of 5-minute water levels of one gauge      { v, gid, name, end, step: 5, s: [...] }
     rf-<gid>.json     30 days of rain, mm of each reading (5, 15 or 60 minutes) at its 5 minutes; value i is at end - (n - 1 - i) * 5 minutes; null = no reading
   Each run (~15 min) reads only the last hours of each gauge and adds them to the files of the run before; a gauge with no file, a short
   file or a full read more than a day old is read again for 30 days (spread over the day, so JPS gets a few of those per run). */
'use strict';
const P = require('./parse');

const MIN = 60000, HOUR = 3600000, DAY = 86400000, STEP = 5 * MIN, DAYS = 30, N = DAYS * 288;
const Q = 'https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/query/';
const pad = n => String(n).padStart(2, '0');
/* JPS wants Malaysia time: DD/MM/YYYY HH:MM */
function myt(t) { const d = new Date(t + 8 * HOUR); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
function url(kind, gid, from, to) {
  return Q + (kind === 'wl' ? 'searchresultwaterleveldtlead.php?station=' : 'searchresultrainfalldthourlylead.php?extra=&station=') + encodeURIComponent(gid) +
    '&from=' + encodeURIComponent(myt(from)) + '&to=' + encodeURIComponent(myt(to)) + '&datafreq=' + (kind === 'wl' ? 15 : 60);
}
const fileOf = (kind, gid) => kind + '-' + String(gid).replace(/[^A-Za-z0-9_-]/g, '_') + '.json';
const r2 = v => Math.round(v * 100) / 100;

/* the previous file moved onto the new 5-minute grid ending at "end" */
function shifted(prev, end) {
  const s = new Array(N).fill(null);
  if (!prev || !Array.isArray(prev.s) || !prev.end) return s;
  const off = Math.round((end - prev.end) / STEP), n = prev.s.length;
  for (let i = 0; i < n; i++) { const k = N - 1 - (n - 1 - i) - off; if (k >= 0 && k < N && prev.s[i] !== null && prev.s[i] !== undefined) s[k] = prev.s[i]; }
  return s;
}
/* readings {t, v} into the grid: water level = the reading at that time; rain = mm since the reading before, in its 5 minutes
   (a part read again gives the same values: they replace, not add; the first reading of a read has no step and keeps the old value) */
function put(s, pts, end, kind) {
  const seen = new Set();
  pts.forEach(p => {
    const k = N - 1 - Math.round((end - p.t) / STEP);
    if (k < 0 || k >= N) return;
    if (kind === 'wl') s[k] = r2(p.v);
    else if (p.v !== null) { s[k] = seen.has(k) ? Math.round((s[k] + p.v) * 10) / 10 : p.v; seen.add(k); }
  });
  return s;
}
function coverage(s) { let n = 0, first = -1; s.forEach((v, i) => { if (v !== null) { n++; if (first < 0) first = i; } }); return { n, first }; }
/* small, steady number from a gauge id: spreads the daily full reads over the day */
function spread(gid) { let h = 0; for (const c of String(gid)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 96) * 15 * MIN; }

async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

/* one gauge: { s, meta } (s = the 30-day grid) */
async function gauge(kind, st, ctx) {
  const { get, previous, now, end } = ctx;
  const file = fileOf(kind, st.gid), prev = await previous((ctx.folder || 'kemaman/') + file), meta0 = (ctx.prevMeta && ctx.prevMeta[file]) || {};
  let s = shifted(prev, end);
  const cov = coverage(s), lastFull = meta0.full || 0;
  /* read 30 days: no file, empty, once a day (spread), or the file starts late (at most every 6 hours, a new gauge may have less) */
  const full = !prev || cov.first < 0 || now - lastFull > DAY + spread(st.gid) || (cov.first > 288 && now - lastFull > 6 * HOUR);
  const from = full ? end - DAYS * DAY : Math.max(end - DAYS * DAY, (prev && prev.end ? prev.end : end) - 3 * HOUR);
  const meta = { name: st.name, full: lastFull, read: null, err: null, n: 0 };
  try {
    const txt = await get(url(kind, st.gid, from, now));
    const pts = kind === 'wl' ? P.wlSeries(txt) : P.rfReadings(txt);
    if (!pts.length && full) throw new Error('no readings');
    s = put(s, pts, end, kind);
    meta.read = now; if (full) meta.full = now;
  } catch (e) { meta.err = String(e.message || e).slice(0, 160); }
  meta.n = coverage(s).n;
  return { file, s, meta, full };
}

/* jps = the mirror's JPS answer for one state ({ water, rain: { stations } }); d = { district: JPS district name, folder: 'kemaman/' or 'd/<id>/',
   gids: optional list of gauge ids to keep (the district form of Monsoon EYE may pick only some) } */
async function district(jps, io, d) {
  const now = io.now || Date.now(), end = Math.floor(now / STEP) * STEP, folder = d.folder, name = String(d.district || '').toLowerCase();
  const pick = x => x.gid && (d.gids && d.gids.length ? d.gids.indexOf(x.gid) >= 0 : String(x.district || '').toLowerCase() === name);
  const W = ((jps && jps.water) || []).filter(pick);
  const R = ((jps && jps.rain && jps.rain.stations) || []).filter(pick);
  const prevNow = await io.previous(folder + 'now.json');
  const ctx = { get: io.get, previous: io.previous, now, end, folder, prevMeta: (prevNow && prevNow.files) || {} };
  const jobs = W.map(st => ['wl', st]).concat(R.map(st => ['rf', st]));
  const res = await pool(jobs, io.parallel || 4, ([kind, st]) => gauge(kind, st, ctx));
  const files = {}, by = {};
  res.forEach((r, i) => {
    const [kind, st] = jobs[i];
    io.write(folder + r.file, { v: 1, gid: st.gid, name: st.name, end, step: 5, s: r.s });
    files[r.file] = r.meta; by[kind + ':' + st.gid] = r.s;
  });
  const tail = (s, n) => s.slice(N - n);
  const hourly = s => { const out = []; for (let h = 168; h >= 1; h--) { let a = 0, any = false; for (let k = N - h * 12; k < N - (h - 1) * 12; k++) if (s[k] !== null) { a += s[k]; any = true; } out.push(any ? Math.round(a * 10) / 10 : null); } return out; };
  const keep = (o, ks) => { const x = {}; ks.forEach(k => { if (o[k] !== undefined) x[k] = o[k]; }); return x; };
  const out = {
    v: 1, at: new Date(now).toISOString(), end, step: 5, files,
    water: W.map(st => Object.assign(keep(st, ['id', 'name', 'gid', 'district', 'basin', 'subBasin', 'updated', 'level', 'normal', 'alert', 'warning', 'danger']), { s: tail(by['wl:' + st.gid], 26 * 12) })),
    rain: R.map(st => Object.assign(keep(st, ['id', 'name', 'gid', 'district', 'updated', 'daily', 'today', 'hour']), { h: hourly(by['rf:' + st.gid]), m: tail(by['rf:' + st.gid], 36) }))
  };
  io.write(folder + 'now.json', out);
  const bad = Object.values(files).filter(m => m.err).length;
  return { ok: bad < jobs.length, gauges: jobs.length, failed: bad, full: res.filter(r => r.full).length };
}
/* Daerah Kemaman (the first district, always mirrored) */
function kemaman(jps, io) { return district(jps, io, { district: 'Kemaman', folder: 'kemaman/' }); }
module.exports = { kemaman, district, url, shifted, put, N, STEP };
