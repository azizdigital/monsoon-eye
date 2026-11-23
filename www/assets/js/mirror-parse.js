/* Dashboard Cuaca Aziz - readers for JPS Public Infobanjir and Tide Forecast pages.
   Plain functions, no packages: used by the GitHub mirror (mirror/mirror.js), by the app when it reads the
   pages live through the relay, and by the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MCParse = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function text(h) {
  return String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (all, e) => {
      if (ENT[e.toLowerCase()] !== undefined) return ENT[e.toLowerCase()];
      if (e[0] === '#') { const n = /x/i.test(e[1]) ? parseInt(e.slice(2), 16) : +e.slice(1); return n ? String.fromCharCode(n) : ''; }
      return all;
    }).replace(/\s+/g, ' ').trim();
}

/* Table rows as arrays of cell texts. JPS pages leave out many <tr> tags, so a row also starts at a cell marked data-th='No'. */
function rows(html) {
  html = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const out = []; let row = [];
  const re = /<tr\b[^>]*>|<t[dh]\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/?tr\b|<\/table|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/^<tr/i.test(m[0])) { if (row.length) out.push(row); row = []; continue; }
    if (/data-th\s*=\s*["']?No["'\s>]/i.test(m[1] || '') && row.length) { out.push(row); row = []; }
    row.push(text(m[2].replace(/<\/t[dh]>[\s\S]*$/i, '')));
  }
  if (row.length) out.push(row);
  return out;
}

function num(v) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(v === undefined || v === null ? '' : v));
  if (!m) return null;
  const n = +m[0];
  return n <= -999 ? null : n;                 /* -9999 = no reading */
}
/* "20/11/2026 21:15" or "20/11/2026 21:00:00" (Malaysia time) -> "2026-11-20T21:15:00+08:00" */
function mytIso(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s || ''));
  if (!m) return null;
  const p = n => String(n).padStart(2, '0');
  return m[3] + '-' + p(m[2]) + '-' + p(m[1]) + 'T' + p(m[4] || 0) + ':' + p(m[5] || 0) + ':' + p(m[6] || 0) + '+08:00';
}
function isoDate(s) { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '')); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : null; }

/* JPS water level: No | Station ID | Station Name | District | Main Basin | Sub River Basin | Last Updated | Water Level (m) | Normal | Alert | Warning | Danger */
function jpsWater(html) {
  const seen = new Set(), out = [];
  /* the level cell links to the station's graph page: /wl-graph/?stationid=25318 (that id gives the 5-minute history) */
  const gid = {};
  String(html || '').split(/data-th\s*=\s*["']?No["'\s>]/i).forEach(chunk => {
    const n = /data-th\s*=\s*["']?Station Name["']?\s*>([\s\S]*?)<\/td>/i.exec(chunk), g = /stationid=([A-Za-z0-9_-]+)/i.exec(chunk);
    if (n && g && !gid[text(n[1])]) gid[text(n[1])] = g[1];
  });
  for (const r of rows(html)) {
    if (r.length < 12 || !/^\d+$/.test(r[0]) || !r[2]) continue;
    const key = r[1] + '|' + r[2];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ no: +r[0], id: r[1], name: r[2], district: r[3], basin: r[4], subBasin: r[5], updated: mytIso(r[6]),
      level: num(r[7]), normal: num(r[8]), alert: num(r[9]), warning: num(r[10]), danger: num(r[11]), gid: gid[r[2]] || null });
  }
  return out;
}

/* one station's history (JPS graph page data, JSON): {"info": {...}, "values": [{"dt":"20/11/2026 00:05","final":"15.28"}, ...]}
   -> [{ t: ms, v: metres }] oldest first; -9999 and empty readings dropped */
/* one rain gauge's history (JPS graph page data): 5-minute "clean" mm -> hourly totals [{ t: start of hour ms, v: mm }] */
/* JPS rain gauge graph data -> the rain of each hour [{t: start of the hour, v: mm}].
   "clean" / "chourly" are the rain of the last 60 minutes (a moving total), so they are not added up; the rain of one reading is
   the step of the year's counter "cyearly" (see rfReadings) */
function rfSeries(body) {
  const hours = new Map();
  rfReadings(body).forEach(p => {
    if (p.v === null) return;
    /* a reading at hh:05 .. (hh+1):00 is rain in the hour that started at hh:00 */
    const t = Math.floor((p.t - 1) / 3600000) * 3600000;
    hours.set(t, (hours.get(t) || 0) + p.v);
  });
  return [...hours.entries()].sort((a, b) => a[0] - b[0]).map(e => ({ t: e[0], v: Math.round(e[1] * 10) / 10 }));
}

/* rain gauge graph data, one value per reading: mm since the reading before (5, 15 or 60 minutes).
   From the year's counter "cyearly" (a small dip = a correction, not counted twice; a big drop = new year); the first reading
   has no step (null). Without "cyearly": the day's counter "cdaily". */
function rfReadings(body) {
  let j = body;
  if (typeof body === 'string') {
    const a = body.search(/\{\s*"info"/), b = body.lastIndexOf('}');
    try { j = JSON.parse(a >= 0 && b > a ? body.slice(a, b + 1) : body.trim()); } catch (e) { return []; }
  }
  const rows = [];
  ((j && j.values) || []).forEach(x => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})/.exec(String(x.dt || ''));
    if (!m) return;
    rows.push({ t: Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 8, +m[5]), y: num(x.cyearly), d: num(x.cdaily), c: num(x.clean !== undefined ? x.clean : x.raw) });
  });
  rows.sort((a, b) => a.t - b.t);
  const useY = rows.filter(r => r.y !== null && r.y >= 0).length >= rows.length / 2;
  let top = null, prevD = null, prevDay = null;
  return rows.map(r => {
    let v = null;
    if (useY) {
      if (r.y === null || r.y < 0) return { t: r.t, v: null };
      if (top === null) top = r.y;
      else if (r.y < top - 20) { v = r.y; top = r.y; }          /* the counter started again (1 January) */
      else { v = Math.max(0, r.y - top); top = Math.max(top, r.y); }
    } else if (r.d !== null && r.d >= 0) {
      const day = Math.floor((r.t + 8 * 3600000 - 60000) / 86400000);   /* the reading at 00:00 still belongs to the day before */
      v = prevD === null ? null : day !== prevDay || r.d < prevD - 0.01 ? r.d : Math.max(0, r.d - prevD);
      prevD = r.d; prevDay = day;
    }
    return { t: r.t, v: v === null ? null : Math.round(v * 10) / 10 };
  });
}

function wlSeries(body) {
  let j = body;
  if (typeof body === 'string') {
    /* through the relay the answer may start with the relay's own <style>/<script>: read from {"info" to the last } */
    const a = body.search(/\{\s*"info"/), b = body.lastIndexOf('}');
    try { j = JSON.parse(a >= 0 && b > a ? body.slice(a, b + 1) : body.trim()); } catch (e) { return []; }
  }
  const out = [];
  ((j && j.values) || []).forEach(x => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})/.exec(String(x.dt || ''));
    const v = num(x.final !== undefined ? x.final : x.clean);
    if (!m || v === null || v < -100) return;
    out.push({ t: Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 8, +m[5]), v });
  });
  return out.sort((a, b) => a.t - b.t);
}

/* JPS rainfall: No | Station ID | Station | District | Last Updated | 6 x daily | Rainfall from Midnight | Total 1 Hour */
function jpsRain(html) {
  const all = rows(html), seen = new Set(), stations = [];
  let days = [], today = null;
  for (const r of all) {
    const dates = r.map(isoDate).filter(Boolean);
    if (!/^\d+$/.test(r[0] || '') && dates.length >= 6 && !days.length) days = dates.slice(0, 6);
    const mid = r.find(c => /midnight/i.test(c));
    if (mid && !today) today = isoDate(mid);
  }
  /* the "from midnight" cell links to the gauge's graph page: /rf-graph/?stationid=_TSET0074 (the 5-minute history) */
  const gid = {};
  String(html || '').split(/data-th\s*=\s*["']?No["'\s>]/i).forEach(chunk => {
    const n = /data-th\s*=\s*["']?Station ID["']?\s*>([\s\S]*?)<\/td>/i.exec(chunk), g = /stationid=([A-Za-z0-9_-]+)/i.exec(chunk);
    if (n && g && !gid[text(n[1])]) gid[text(n[1])] = g[1];
  });
  for (const r of all) {
    if (r.length < 13 || !/^\d+$/.test(r[0]) || !r[2]) continue;
    const key = r[1] + '|' + r[2];
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push({ no: +r[0], id: r[1], name: r[2], district: r[3], updated: mytIso(r[4]),
      daily: r.slice(5, 11).map(num), today: num(r[11]), hour: num(r[12]), gid: gid[r[1]] || null });
  }
  if (!today && stations.length && stations[0].updated) today = stations[0].updated.slice(0, 10);
  return { days, today, stations };
}

/* Tide Forecast page: every "High Tide / Low Tide" row with its time, date and height in metres */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function tides(html, nowMs) {
  html = String(html || '');
  const now = new Date((nowMs || Date.now()) + 8 * 3600000);        /* Malaysia time */
  const y0 = now.getUTCFullYear(), m0 = now.getUTCMonth();
  const out = [], seen = new Set();
  const re = /<tr>\s*<td>\s*(High|Low) Tide\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(html))) {
    const when = text(m[2]), h = text(m[3]);
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(when), d = /(\d{1,2})\s+([A-Za-z]+)\)/.exec(when), mt = /\((-?\d+(?:\.\d+)?)\s*m\)/.exec(h);
    if (!t || !d || !mt) continue;
    const mon = MONTHS.indexOf(d[2].toLowerCase());
    if (mon < 0) continue;
    let year = y0;
    if (mon < m0 - 6) year++; else if (mon > m0 + 6) year--;      /* December page showing January, and the reverse */
    let hr = +t[1] % 12; if (/pm/i.test(t[3])) hr += 12;
    const p = n => String(n).padStart(2, '0');
    const iso = year + '-' + p(mon + 1) + '-' + p(+d[1]) + 'T' + p(hr) + ':' + t[2] + ':00+08:00';
    if (seen.has(iso)) continue;
    seen.add(iso);
    out.push({ type: m[1].toLowerCase() === 'high' ? 'high' : 'low', time: iso, m: +mt[1] });
  }
  return out.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

return { text: text, rows: rows, num: num, mytIso: mytIso, jpsWater: jpsWater, jpsRain: jpsRain, tides: tides, wlSeries: wlSeries, rfSeries: rfSeries, rfReadings: rfReadings };
}));
