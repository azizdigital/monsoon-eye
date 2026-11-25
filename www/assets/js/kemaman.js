/* Dashboard Cuaca Aziz - Kemaman water level & rainfall page (kemaman.html?tab=water | rain).
   Data: GitHub mirror folder kemaman/ (branch "data"):
     now.json      { v, at, end, step:5, water:[{name, gid, lat, lon, level, normal, alert, warning, danger, updated, tidal, s:[26 h of 5-minute levels]}],
                     rain:[{name, gid, lat, lon, updated, daily, today, h:[7 days hourly mm], m:[3 h of 5-minute mm]}] }
     wl-<gid>.json / rf-<gid>.json   { v, gid, end, step:5, s:[30 days of 5-minute values] }   (loaded when a station is opened)
   The last value of each series is at "end" (ms); value i is at end - (n - 1 - i) * step minutes.
   5-model rain (Open-Meteo, 4 points over the basin): yesterday vs the gauges, and the next 24 hours. */
(function (root) {
  'use strict';
  var C = root.MCCore, R = root.MCRisk, A = root.MCAdvisor;
  var L = root.MCI18n ? root.MCI18n.L : function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] !== undefined ? o[k] : m; }); };
  var NS = 'http://www.w3.org/2000/svg', MIN = 60000, HOUR = 3600000, DAY = 86400000;
  var Q = new URLSearchParams(location.search);
  var MIRROR = Q.get('mirror') || (C ? C.mirrorBase(location) : '');
  /* inside the PC app (?pc=1): everything through the app's own server (/api/fetch), which reads JPS, Open-Meteo and the GitHub copy */
  var PC = Q.get('pc') === '1';
  /* Monsoon EYE: a district added with the form (Tetapan › Tambah daerah) has its own gauges, river layout, GloFAS cell and title.
     None = Daerah Kemaman (the river lines, places and 3D map below are drawn for Kemaman only). */
  var DIST = (function () {
    try { var s = JSON.parse(localStorage.getItem('mc_settings') || 'null'); var d = s && s.district ? JSON.parse(s.district) : null; return d && d.water && d.water.length ? d : null; }
    catch (e) { return null; }
  })();
  var NAME = DIST ? DIST.name : 'Kemaman';
  var EN = function () { return root.MCI18n && root.MCI18n.lang() === 'en'; };
  var TT = function (kind) {
    return { water: (EN() ? 'Water level ' : 'Paras Air ') + NAME, rain: (EN() ? 'Rainfall ' : 'Hujan ') + NAME, flow: (EN() ? 'River flow ' : 'Aliran Sungai ') + NAME + (DIST ? (DIST.town ? ' (' + DIST.town + ')' : '') : ' (Chukai)'),
      loading: EN() ? 'Loading JPS data for ' + NAME + '…' : 'Memuatkan data JPS ' + NAME + '…', schema: (EN() ? 'River schema ' : 'Skema sungai ') + NAME }[kind];
  };
  function viaPc(u) { return fetch('/api/fetch?url=' + encodeURIComponent(u), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (v) { return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; };
  var f = function (v, d) { v = num(v); return v === null ? '-' : v.toFixed(d === undefined ? 2 : d); };
  var sgn = function (v, d) { v = num(v); return v === null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d === undefined ? 2 : d); };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(t) { var p = C.myt(t); return pad(p.h) + ':' + pad(p.mi); }
  function dm(t) { var p = C.myt(t); return p.d + '/' + p.mo; }
  function dmhm(t) { return dm(t) + ' ' + hm(t); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }

  /* ------------------------------------------------------------------ data helpers */
  var LV = ['normal', 'alert', 'warning', 'danger'];
  var LV_NAME = { normal: 'Normal', alert: 'Waspada', warning: 'Amaran', danger: 'Bahaya', unknown: 'Tiada data' };
  var LV_MEAN = { normal: 'Paras biasa', alert: 'Naik ketara, belum banjir', warning: 'Kemungkinan kecil akan banjir', danger: 'Banjir, bersedia berpindah', unknown: '' };
  function status(st, v) { return C.stationStatus({ level: v === undefined ? st.level : v, alert: st.alert, warning: st.warning, danger: st.danger }); }
  /* points {t, v} of a series object (now.json station or a 30-day file) */
  function pts(o) {
    var s = (o && o.s) || [], end = o.end, step = (o.step || 5) * MIN, n = s.length, out = [];
    for (var i = 0; i < n; i++) if (s[i] !== null && s[i] !== undefined) out.push({ t: end - (n - 1 - i) * step, v: +s[i] });
    return out;
  }
  /* position against the thresholds: Normal 0 · Waspada 1 · Amaran 2 · Bahaya 3 (piecewise, same scale for every gauge) */
  function idx(st, v) {
    var a = num(st.alert), w = num(st.warning), d = num(st.danger), n = num(st.normal);
    if (v === null || a === null || w === null || d === null) return null;
    if (n === null || n >= a) n = a - Math.max(1, d - a);
    if (v < a) return Math.max(-0.5, (v - n) / (a - n) - 0);
    if (v < w) return 1 + (v - a) / (w - a);
    if (v < d) return 2 + (v - w) / (d - w);
    return 3 + (v - d) / Math.max(0.5, d - w);
  }
  /* % of the way from Normal to Bahaya */
  function pct(st, v) {
    var d = num(st.danger), n = num(st.normal), a = num(st.alert);
    if (v === null || d === null) return null;
    if (n === null || (a !== null && n >= a)) n = (a !== null ? a : d) - Math.max(1, d - (a !== null ? a : d - 1));
    return Math.max(0, Math.min(130, (v - n) / (d - n) * 100));
  }
  function valueAt(list, t) {
    if (!list.length) return null;
    var lo = 0, hi = list.length - 1;
    if (t <= list[0].t) return list[0].v;
    if (t >= list[hi].t) return list[hi].v;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (list[mid].t <= t) lo = mid; else hi = mid; }
    return list[lo].v;
  }
  function rateOver(list, hours) {
    if (list.length < 2) return null;
    var last = list[list.length - 1], v0 = valueAt(list, last.t - hours * HOUR);
    if (list[0].t > last.t - hours * HOUR + 10 * MIN) return null;
    return v0 === null ? null : last.v - v0;
  }
  /* usual minutes between readings (5 for most gauges, 15 or 60 for some) and the gap that breaks a line */
  function stepOf(list) { var d = []; for (var i = Math.max(1, list.length - 60); i < list.length; i++) d.push(list[i].t - list[i - 1].t); d.sort(function (a, b) { return a - b; }); return d.length ? d[d.length >> 1] : 5 * MIN; }
  function gapOf(list) { return Math.max(40 * MIN, 2.5 * stepOf(list)); }
  function maxIn(list, from) { var m = null; list.forEach(function (p) { if (p.t >= from && (m === null || p.v > m.v)) m = p; }); return m; }
  function shortName(n) {
    var m = /^(Muara )?Sg\. (.+?) di (.+?)( \(F\d\))?$/.exec(n || '');
    return m ? { place: m[3], river: (m[1] ? 'Muara ' : '') + 'Sg. ' + m[2] } : { place: n, river: '' };
  }
  function rainSum(st, hours) {
    if (hours <= 3 && st.m && st.m.length) { var k = Math.min(st.m.length, Math.round(hours * 12)), a = 0; for (var i = st.m.length - k; i < st.m.length; i++) a += st.m[i] || 0; return a; }
    var h = st.h || [], n = Math.min(h.length, hours), b = 0;
    for (var j = h.length - n; j < h.length; j++) b += h[j] || 0;
    return b;
  }
  /* JPS hourly rainfall classes */
  function intensity(mmh) {
    if (mmh === null || mmh < 0.1) return { k: 0, name: L('Tiada hujan') };
    if (mmh <= 10) return { k: 1, name: L('Ringan') };
    if (mmh <= 30) return { k: 2, name: L('Sederhana') };
    if (mmh <= 60) return { k: 3, name: L('Lebat') };
    return { k: 4, name: L('Sangat lebat') };
  }
  /* sequential blue ramp (one hue, light -> strong); dark mode: brighter = more */
  var RAIN_BINS = [0.1, 1, 5, 10, 20, 30, 60];
  function rainBin(v) { if (v === null || v < 0.1) return -1; for (var i = RAIN_BINS.length - 1; i >= 0; i--) if (v >= RAIN_BINS[i]) return i; return 0; }
  function dist(a, b) { var dx = (a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180), dy = a.lat - b.lat; return Math.sqrt(dx * dx + dy * dy) * 111; }
  function nearest(list, p) { var best = null, bd = 1e9; list.forEach(function (x) { if (num(x.lat) === null) return; var d = dist(x, p); if (d < bd) { bd = d; best = x; } }); return best ? { st: best, km: bd } : null; }
  function ageMin(st, now) { var t = Date.parse(st.updated || ''); return isFinite(t) ? (now - t) / MIN : null; }

  /* ------------------------------------------------------------------ SVG chart engine
     panels share one time axis: [{ h, min, max, unit, d, bands:[{from,to,cls}], hl:[{v,cls,label}], lines:[{pts, cls, dash}], bars:[{t, v, w, cls}], area }]
     crosshair + one tooltip over all panels; drag across = zoom in; double tap / "Semua" = back */
  function el(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  var MON = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  function niceStep(r, n) { var raw = r / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function timeTicks(t0, t1, w) {
    var span = t1 - t0, want = Math.max(3, Math.floor(w / 90));
    /* long spans: the first of the month, or every n years */
    if (span > 60 * DAY) {
      var out2 = [], a = new Date(t0), yr = a.getUTCFullYear(), mo = a.getUTCMonth();
      if (span > 3 * 365 * DAY) {
        var ny = [1, 2, 5, 10].filter(function (n) { return span / (n * 365 * DAY) <= want; })[0] || 10;
        for (var y2 = Math.ceil(yr / ny) * ny; Date.UTC(y2, 0, 1) <= t1; y2 += ny) if (Date.UTC(y2, 0, 1) >= t0) out2.push(Date.UTC(y2, 0, 1));
        return { ticks: out2, years: true };
      }
      var nm = [1, 2, 3, 6].filter(function (n) { return span / (n * 30.4 * DAY) <= want; })[0] || 6;
      for (var k = 1; ; k++) { var mm = mo + k; if (mm % nm) continue; var t = Date.UTC(yr + Math.floor(mm / 12), mm % 12, 1) - 8 * HOUR; if (t > t1) break; out2.push(t); }
      return { ticks: out2, months: true };
    }
    var steps = [HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 7 * DAY];
    var step = steps.filter(function (s) { return span / s <= want; })[0] || 7 * DAY, off = 8 * HOUR, out = [];
    for (var t = Math.ceil((t0 + off) / step) * step - off; t <= t1; t += step) out.push(t);
    return { ticks: out, daily: step >= DAY };
  }
  function chart(host, o) {
    host.classList.add('kc');
    var view = { t0: o.t0, t1: o.t1 };
    function draw() {
      var W = Math.max(280, host.clientWidth), padL = 46, padR = o.padR || 14, gap = 10;
      var H = o.panels.reduce(function (a, p) { return a + p.h + gap; }, 0) + 22;
      host.innerHTML = '';
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'kc-svg', role: 'img', 'aria-label': o.label || '' }, host);
      var t0 = view.t0, t1 = view.t1, x = function (t) { return padL + (t - t0) / (t1 - t0) * (W - padL - padR); };
      var y0 = 4, panes = [];
      o.panels.forEach(function (p, pi) {
        var lo = p.min, hi = p.max;
        if (p.auto) {
          var vs = []; (p.lines || []).forEach(function (l) { l.pts.forEach(function (q) { if (q.t >= t0 && q.t <= t1) vs.push(q.v); }); });
          (p.bars || []).forEach(function (b) { if (b.t >= t0 && b.t <= t1) vs.push(b.v); });
          (p.ranges || []).forEach(function (r) { r.hi.concat(r.lo).forEach(function (q) { if (q.t >= t0 && q.t <= t1) vs.push(q.v); }); });
          (p.keep || []).forEach(function (v) { if (v !== null) vs.push(v); });
          if (vs.length) { lo = Math.min.apply(null, vs); hi = Math.max.apply(null, vs); }
          var padY = Math.max((hi - lo) * 0.08, p.minSpan || 0.2); lo = p.floor !== undefined ? Math.max(p.floor, lo - padY) : lo - padY; hi += padY;
        }
        if (hi <= lo) hi = lo + 1;
        var top = y0, h = p.h, y = function (v) { return top + h - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * h; };
        var clip = 'kc' + Math.random().toString(36).slice(2, 8);
        var cp = el('clipPath', { id: clip }, el('defs', {}, svg)); el('rect', { x: padL, y: top, width: W - padL - padR, height: h }, cp);
        var g = el('g', { 'clip-path': 'url(#' + clip + ')' }, svg);
        (p.bands || []).forEach(function (b) {
          var a = y(Math.min(hi, b.to === null ? hi : b.to)), z = y(Math.max(lo, b.from === null ? lo : b.from));
          if (z > a) el('rect', { x: padL, y: a, width: W - padL - padR, height: z - a, class: 'kc-band ' + b.cls }, g);
        });
        var st = niceStep(hi - lo, Math.max(2, Math.floor(h / 34)));
        for (var v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) {
          el('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'kc-grid' }, svg);
          var tx = el('text', { x: padL - 6, y: y(v) + 4, class: 'kc-ax', 'text-anchor': 'end' }, svg); tx.textContent = p.fmtY ? p.fmtY(v) : (+v.toFixed(2)).toString();
        }
        if (p.unit) { var u = el('text', { x: padL + 6, y: top + 13, class: 'kc-unit' }, svg); u.textContent = p.unit; }
        (p.hl || []).forEach(function (l) {
          if (l.v === null || l.v < lo || l.v > hi) return;
          el('line', { x1: padL, x2: W - padR, y1: y(l.v), y2: y(l.v), class: 'kc-hl ' + l.cls }, svg);
          if (l.label) { var t = el('text', { x: W - padR - 4, y: y(l.v) - 4, class: 'kc-hlt ' + l.cls, 'text-anchor': 'end' }, svg); t.textContent = l.label; }
        });
        (p.ranges || []).forEach(function (r) {
          var hi = r.hi.filter(function (q) { return q.t >= t0 - DAY && q.t <= t1 + DAY && q.v !== null; }), lo = r.lo.filter(function (q) { return q.t >= t0 - DAY && q.t <= t1 + DAY && q.v !== null; });
          if (hi.length < 2 || lo.length < 2) return;
          var d = hi.map(function (q, i) { return (i ? 'L' : 'M') + x(q.t).toFixed(1) + ' ' + y(q.v).toFixed(1); }).join('') + lo.slice().reverse().map(function (q) { return 'L' + x(q.t).toFixed(1) + ' ' + y(q.v).toFixed(1); }).join('') + 'Z';
          el('path', { d: d, class: 'kc-range ' + (r.cls || '') }, g);
        });
        (p.bars || []).forEach(function (b) {
          if (b.t + b.w < t0 || b.t > t1 || !b.v) return;
          var xa = x(b.t), xb = x(b.t + b.w), bw = Math.max(1, xb - xa - (xb - xa > 4 ? 1.5 : 0.3));
          el('rect', { x: xa, y: y(b.v), width: bw, height: Math.max(0.5, y(lo) - y(b.v)), rx: bw > 6 ? 2 : 0, class: 'kc-bar ' + (b.cls || '') }, g);
        });
        (p.fans || []).forEach(function (fn) {
          var up = fn.pts.filter(function (q) { return q.t >= t0 && q.t <= t1; });
          if (up.length < 2) return;
          var dd = up.map(function (q, k) { return (k ? 'L' : 'M') + x(q.t).toFixed(1) + ' ' + y(q.hi).toFixed(1); }).join('') + up.slice().reverse().map(function (q) { return 'L' + x(q.t).toFixed(1) + ' ' + y(q.lo).toFixed(1); }).join('') + 'Z';
          el('path', { d: dd, class: 'kc-fan ' + (fn.cls || '') }, g);
        });
        (p.lines || []).forEach(function (l) {
          var d = '', open = false, prev = null;
          l.pts.forEach(function (q) {
            if (q.t < t0 - (l.gapMs || 30 * MIN) || q.t > t1 + (l.gapMs || 30 * MIN)) { open = false; return; }
            var jump = prev && q.t - prev.t > (l.gapMs || 30 * MIN);
            d += (open && !jump ? 'L' : 'M') + x(q.t).toFixed(1) + ' ' + y(q.v).toFixed(1); open = true; prev = q;
          });
          if (!d) return;
          if (l.area) { var last = l.pts.filter(function (q) { return q.t <= t1; }).pop(), first = l.pts.filter(function (q) { return q.t >= t0; })[0];
            if (first && last) el('path', { d: d + 'L' + x(last.t).toFixed(1) + ' ' + y(lo) + 'L' + x(first.t).toFixed(1) + ' ' + y(lo) + 'Z', class: 'kc-area ' + (l.cls || '') }, g); }
          el('path', { d: d, class: 'kc-line ' + (l.cls || '') + (l.dash ? ' dash' : ''), style: l.color ? 'stroke:' + l.color : '' }, g);
          if (l.endLabel) { var lp = l.pts.filter(function (q) { return q.t <= t1; }).pop(); if (lp) { var et = el('text', { x: Math.min(W - padR + 2, x(lp.t) + 4), y: y(lp.v) + 4, class: 'kc-end', style: l.color ? 'fill:' + l.color : '' }, svg); et.textContent = l.endLabel; } }
        });
        (p.marks || []).forEach(function (m) { if (m.t >= t0 && m.t <= t1) el('circle', { cx: x(m.t), cy: y(m.v), r: m.r || 4, class: 'kc-mark ' + (m.cls || '') }, svg); });
        if (p.nowT && p.nowT > t0 && p.nowT < t1) { el('line', { x1: x(p.nowT), x2: x(p.nowT), y1: top, y2: top + h, class: 'kc-now' }, svg); if (pi === 0) { var nt = el('text', { x: x(p.nowT) + 4, y: top + 12, class: 'kc-ax' }, svg); nt.textContent = L('kini'); } }
        panes.push({ top: top, h: h, y: y, p: p });
        y0 += h + gap;
      });
      var tk = timeTicks(t0, t1, W - padL - padR);
      tk.ticks.forEach(function (t) {
        el('line', { x1: x(t), x2: x(t), y1: 4, y2: y0 - gap, class: 'kc-vgrid' }, svg);
        var tt = el('text', { x: x(t), y: y0 + 8, class: 'kc-ax', 'text-anchor': 'middle' }, svg);
        var p = C.myt(t); tt.textContent = tk.years ? String(new Date(t).getUTCFullYear()) : tk.months ? MON[p.mo - 1] + (p.mo === 1 ? ' ' + String(p.y).slice(2) : '') : tk.daily || (p.h === 0 && p.mi === 0) ? dm(t) : hm(t);
      });
      /* hover / touch */
      var cross = el('line', { y1: 4, y2: y0 - gap, class: 'kc-cross', visibility: 'hidden' }, svg);
      var dots = panes.map(function () { return el('circle', { r: 4.5, class: 'kc-dot', visibility: 'hidden' }, svg); });
      var sel = el('rect', { y: 4, height: y0 - gap - 4, class: 'kc-sel', visibility: 'hidden' }, svg);
      var tip = document.createElement('div'); tip.className = 'kc-tip'; tip.hidden = true; host.appendChild(tip);
      var tOf = function (px) { return t0 + (px - padL) / (W - padL - padR) * (t1 - t0); };
      var down = null;
      function show(px) {
        var t = tOf(px); if (t < t0 || t > t1) { hide(); return; }
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
        var rows = o.tip ? o.tip(t) : [];
        panes.forEach(function (pn, i) {
          var l = (pn.p.lines || [])[0]; var v = l ? valueAt(l.pts.filter(function (q) { return q.t <= t + 5 * MIN; }), t) : null;
          if (v !== null && l && l.pts.length && t >= l.pts[0].t && t <= l.pts[l.pts.length - 1].t + 5 * MIN) { dots[i].setAttribute('cx', px); dots[i].setAttribute('cy', pn.y(v)); dots[i].setAttribute('visibility', 'visible'); } else dots[i].setAttribute('visibility', 'hidden');
        });
        tip.innerHTML = '<b>' + esc(dmhm(t)) + '</b>' + rows.map(function (r) { return '<div>' + r + '</div>'; }).join('');
        tip.hidden = false;
        var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(W - tw, px + 12 > W - tw ? px - tw - 12 : px + 12)) + 'px'; tip.style.top = '6px';
      }
      function hide() { cross.setAttribute('visibility', 'hidden'); dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); }); tip.hidden = true; }
      var rect = function (e) { var r = svg.getBoundingClientRect(); return e.clientX - r.left; };
      svg.addEventListener('pointerdown', function (e) { down = { x: rect(e), id: e.pointerId, moved: false }; });
      svg.addEventListener('pointermove', function (e) {
        var px = rect(e); show(px);
        if (down && Math.abs(px - down.x) > 12 && o.zoom !== false) { down.moved = true; try { svg.setPointerCapture(down.id); } catch (er) { /* */ } sel.setAttribute('x', Math.min(px, down.x)); sel.setAttribute('width', Math.abs(px - down.x)); sel.setAttribute('visibility', 'visible'); }
      });
      svg.addEventListener('pointerup', function (e) {
        var px = rect(e);
        if (down && down.moved) { var a = tOf(Math.min(px, down.x)), b = tOf(Math.max(px, down.x)); if (b - a > 20 * MIN) { view.t0 = Math.max(o.t0, a); view.t1 = Math.min(o.t1, b); draw(); if (o.onZoom) o.onZoom(true); } }
        sel.setAttribute('visibility', 'hidden'); down = null;
      });
      svg.addEventListener('pointerleave', function () { if (!down) hide(); });
      svg.addEventListener('dblclick', function () { reset(); });
    }
    function reset() { view.t0 = o.t0; view.t1 = o.t1; draw(); if (o.onZoom) o.onZoom(false); }
    draw();
    if (root.ResizeObserver) { var lw = host.clientWidth; new ResizeObserver(function () { if (Math.abs(host.clientWidth - lw) > 4) { lw = host.clientWidth; draw(); } }).observe(host); }
    return { reset: reset, redraw: draw };
  }
  /* mini sparkline (cards): 24 h, threshold lines */
  function spark(st, list) {
    if (list.length < 2) return '';
    var W = 220, H = 46, t0 = list[0].t, t1 = list[list.length - 1].t, vs = list.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    ['alert', 'warning', 'danger'].forEach(function (k) { var v = num(st[k]); if (v !== null && v > hi && v - hi < Math.max(0.6, (hi - lo) * 1.5)) hi = v; });
    var pd = Math.max(0.05, (hi - lo) * 0.12); lo -= pd; hi += pd;
    var x = function (t) { return (t - t0) / (t1 - t0) * W; }, y = function (v) { return H - (v - lo) / (hi - lo) * H; };
    var d = list.map(function (p, i) { return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join('');
    var hl = ['alert', 'warning', 'danger'].map(function (k) { var v = num(st[k]); return v !== null && v >= lo && v <= hi ? '<line x1="0" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="sp-hl ' + k + '"/>' : ''; }).join('');
    return '<svg class="km-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + hl +
      '<path d="' + d + 'L' + W + ' ' + H + 'L0 ' + H + 'Z" class="sp-area"/><path d="' + d + '" class="sp-line"/></svg>';
  }

  /* ------------------------------------------------------------------ state */
  var S = {
    tab: Q.get('tab') === 'rain' ? 'rain' : Q.get('tab') === 'flow' ? 'flow' : Q.get('tab') === 'pred' ? 'pred' : 'water', data: null, err: null, at: 0,
    mapMode: load('km_map', 'map'), rainPeriod: load('km_rp', 24), heatSpan: load('km_hs', 24),
    replay: null, frame: null, files: {}, models: null, modelsAt: 0, sel: null, range: 3
  };
  var MODELS = (A && A.LAND_MODELS) || [];
  var MCOL = { ecmwf_ifs025: '#4c8dff', gfs_seamless: '#f2a33a', icon_seamless: '#2fbf8f', jma_seamless: '#e5609b', ukmo_seamless: '#9b7cf0' };
  /* the basin in 4 parts for the model rain: upstream, middle, Chukai, Kemasik/Kijal */
  var ZONES = [{ id: 'hulu', name: 'Hulu (Sg. Mas, Jabor)', lat: 4.13, lon: 103.2 }, { id: 'tengah', name: 'Tengah (Air Putih, Ban Ho)', lat: 4.3, lon: 103.26 },
    { id: 'hilir', name: 'Hilir (Chukai, Geliga)', lat: 4.23, lon: 103.4 }, { id: 'utara', name: 'Kemasik & Kijal', lat: 4.4, lon: 103.45 }];
  if (DIST) ZONES = distZones();
  /* a district from the form: its rain gauges in up to 3 groups from west (upstream) to east (downstream), else one zone at the town */
  function distZones() {
    var g = (DIST.rain || []).concat(DIST.water || []).filter(function (x) { return num(x.lat) !== null; }).sort(function (a, b) { return a.lon - b.lon; });
    if (g.length < 3) return [{ id: 'all', name: NAME, lat: +DIST.lat, lon: +DIST.lon }];
    var n = Math.min(3, Math.floor(g.length / 2) || 1), out = [], names = EN() ? ['Upstream', 'Middle', 'Downstream'] : ['Hulu', 'Tengah', 'Hilir'];
    for (var i = 0; i < n; i++) {
      var part = g.slice(Math.floor(i * g.length / n), Math.floor((i + 1) * g.length / n));
      out.push({ id: 'z' + i, name: (n === 1 ? NAME : names[n === 2 ? i * 2 : i]) + ' (' + part.slice(0, 2).map(function (x) { return String(x.name).replace(/^Sg\. \S+ di /, ''); }).join(', ') + ')',
        lat: part.reduce(function (a, x) { return a + +x.lat; }, 0) / part.length, lon: part.reduce(function (a, x) { return a + +x.lon; }, 0) / part.length });
    }
    return out;
  }
  function zoneOf(p) { return ZONES.map(function (z, i) { return { i: i, d: dist(z, p) }; }).sort(function (a, b) { return a.d - b.d; })[0].i; }

  /* the river layout of the app's settings (Tetapan › Susunan sungai), else the default */
  function upstream() { var s = load('mc_settings', null); return (s && typeof s.ewUpstream === 'string' ? s.ewUpstream : null) || (C.DEFAULTS && C.DEFAULTS.ewUpstream) || ''; }
  function getJson(u) { if (PC) return viaPc(u); return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  /* cache-buster: one per 5 minutes; a forced update: a new one now */
  function bust() { return S.bust ? 't=' + S.bust : 'm=' + Math.floor(Date.now() / (5 * MIN)); }
  /* where the district's files are in the GitHub copy (Kemaman: kemaman/; a district in mirror/districts.json: d/<id>/) */
  var FOLDER = DIST ? (DIST.mirror ? 'd/' + DIST.id + '/' : '') : 'kemaman/';
  /* a district with no GitHub copy: the gauges from the form, every reading of the last 26 hours read now through the relay */
  function distNow() {
    var now = Date.now(), end = Math.floor(now / (5 * MIN)) * 5 * MIN - 26 * HOUR;
    var thr = function (x) { return { name: x.name, gid: x.gid, district: NAME, basin: x.basin || '', normal: num(x.normal), alert: num(x.alert), warning: num(x.warning), danger: num(x.danger), level: null, updated: null, s: [] }; };
    return Promise.resolve({ v: 1, end: end, step: 5, files: {}, water: DIST.water.map(thr), rain: (DIST.rain || []).map(function (x) { return { name: x.name, gid: x.gid, district: NAME, h: [], m: [] }; }), dist: true });
  }
  function loadNow() {
    if (DIST && !FOLDER && !liveOn()) { S.err = EN() ? NAME + ' has no GitHub copy: set up the Monsoon EYE relay (Settings › Site relay) to read JPS live.' : NAME + ' tiada salinan GitHub: pasang relay Monsoon EYE (Tetapan › Relay laman) untuk baca JPS terus.'; return Promise.resolve(); }
    return (FOLDER ? getJson(MIRROR + FOLDER + 'now.json?' + bust()) : distNow()).then(function (j) {
      if (!j || !j.water) throw new Error(L('Data mirror tidak lengkap'));
      var P = (GEO && GEO.stations) || {};
      var place = function (st) { var q = P[st.name]; if (q) { st.lat = q[0]; st.lon = q[1]; st.src = q[2]; } };
      if (DIST) {
        var byGid = {}; DIST.water.concat(DIST.rain || []).forEach(function (x) { byGid[x.gid] = x; });
        place = function (st) { var q = byGid[st.gid]; if (q && num(q.lat) !== null) { st.lat = +q.lat; st.lon = +q.lon; st.src = q.src || 'jps'; } };
      }
      var rivers = R ? R.parseRivers(upstream()) : [];
      j.water.forEach(function (st) { st.list = pts({ s: st.s, end: j.end, step: j.step }); st.short = shortName(st.name); place(st); if (st.tidal === undefined && R) st.tidal = R.isTidal(rivers, st); });
      j.rain.forEach(place);
      j.endRain = j.end; j.mirrorEnd = j.end;
      var done = function () {
        j.rain.forEach(function (st) { st.hourly = (st.h || []).map(function (v, i, a) { return { t: j.endRain - (a.length - 1 - i) * HOUR - HOUR / 2, v: v || 0 }; }); });
        S.data = j; S.err = null; S.at = Date.now();
      };
      /* 1.1.4: the first time, the GitHub copy is shown at once and the live readings (relay) come in afterwards - the page used to
         wait for all of them (up to 24 readings, 30 s each on a slow line) and only spun. Later refreshes keep the page as it is meanwhile. */
      if (liveOn() && FOLDER && !S.data) {
        done(); j.live = { pending: true, ok: 0, n: 0, at: Date.now() };
        live(j).then(function () { done(); S.liveDone = Date.now(); if (root.MCKemaman && root.MCKemaman.onLive) root.MCKemaman.onLive(); }, function () { j.live = null; });
        return;
      }
      return live(j).then(done);
    }).catch(function (e) { S.err = e.message || String(e); });
  }

  /* ---------- live readings through the user's relay (Tetapan › Relay laman), like the dashboard: the last hours of every gauge,
     read again each time (every 3 minutes while shown). The GitHub copy gives the older part and is used alone without a relay. */
  function appSettings() { return load('mc_settings', null) || {}; }
  function relayOn() { return !!(C.relayReady && C.relayReady(appSettings()) && root.MCParse && R && R.seriesUrl); }
  function liveOn() { return PC ? !!(root.MCParse && R && R.seriesUrl) : relayOn(); }
  function viaRelay(u) {
    var ac = root.AbortController ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, 12000) : null;   /* 1.1.4: 12 s each (was 30 s) */
    return fetch(C.relayUrlFor(u, appSettings()), { cache: 'no-store', signal: ac ? ac.signal : undefined }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (x) { clearTimeout(t); return x; }, function (e) { clearTimeout(t); throw e; });
  }
  function pool(items, n, fn) {
    var i = 0, out = [];
    function next() { if (i >= items.length) return Promise.resolve(); var k = i++; return Promise.resolve(fn(items[k])).then(function (v) { out[k] = v; }, function () { out[k] = null; }).then(next); }
    var w = []; for (var x = 0; x < n; x++) w.push(next());
    return Promise.all(w).then(function () { return out; });
  }
  function live(j) {
    if (!(j.live && j.live.pending)) j.live = null;
    if (!liveOn()) return Promise.resolve();
    var now = Date.now(), P = root.MCParse;
    /* rain: whole hours on a grid that continues the copy's hours; from an hour boundary at least 1 hour before the copy ends */
    var endRain = now > j.end ? j.end + Math.ceil((now - j.end) / HOUR) * HOUR : j.end;
    var from = endRain - Math.max(3, Math.ceil((endRain - (j.end - HOUR)) / HOUR)) * HOUR;
    if (now - from > 26 * HOUR) from = endRain - 26 * HOUR;
    var hours = (now - from) / HOUR + 0.5;   /* a reading before "from": the first rain step */
    var jobs = j.water.filter(function (st) { return st.gid; }).map(function (st) { return ['wl', st]; }).concat(j.rain.filter(function (st) { return st.gid; }).map(function (st) { return ['rf', st]; }));
    var prog = 0;
    if (j.live && j.live.pending) j.live.n = jobs.length;
    return pool(jobs, 5, function (x) {
      var u = x[0] === 'wl' ? R.seriesUrl(x[1].gid, now, hours) : R.rainUrl(x[1].gid, now, hours);
      var tick = function () { prog++; var b = $('kmLive'); if (b) b.textContent = '⟳ ' + L('Membaca JPS langsung {n}/{m}…', { n: prog, m: jobs.length }); };
      return (PC ? viaPc(u) : viaRelay(u)).then(function (txt) { tick(); return x[0] === 'wl' ? P.wlSeries(txt) : P.rfReadings(txt); }, function (e) { tick(); throw e; });
    }).then(function (res) {
      var ok = 0, newest = 0;
      res.forEach(function (pts2, k) {
        var kind = jobs[k][0], st = jobs[k][1];
        if (!pts2 || !pts2.length) return;
        ok++;
        if (kind === 'wl') {
          var fresh = pts2.filter(function (p) { return p.t >= from; });
          if (!fresh.length) return;
          st.list = st.list.filter(function (p) { return p.t < fresh[0].t; }).concat(fresh);
          var last = fresh[fresh.length - 1];
          st.level = Math.round(last.v * 100) / 100; st.updated = isoMyt(last.t); st.liveFrom = fresh[0].t; newest = Math.max(newest, last.t);
        } else {
          var rs = pts2.filter(function (p) { return p.t > from && p.v !== null; });
          var old = st.h || [], shift = Math.round((endRain - j.end) / HOUR), h = [];
          for (var b = 0; b < 168; b++) {
            var a0 = endRain - (168 - b) * HOUR;
            if (a0 >= from) { var sum = null; rs.forEach(function (p) { if (p.t > a0 && p.t <= a0 + HOUR) sum = (sum || 0) + p.v; }); h.push(sum === null ? null : Math.round(sum * 10) / 10); }
            else h.push(old[b + shift] === undefined ? null : old[b + shift]);
          }
          var e5 = Math.floor(now / (5 * MIN)) * 5 * MIN, m = []; for (var c = 0; c < 36; c++) m.push(null);
          rs.forEach(function (p) { var i = 35 - Math.round((e5 - p.t) / (5 * MIN)); if (i >= 0 && i < 36) m[i] = (m[i] || 0) + p.v; });
          st.h = h; st.m = m; st.live = rs; st.liveFrom = from;
          if (pts2.length) { st.updated = isoMyt(pts2[pts2.length - 1].t); newest = Math.max(newest, pts2[pts2.length - 1].t); }
        }
      });
      if (ok) { j.endRain = endRain; j.end = Math.max(j.end, Math.floor(now / (5 * MIN)) * 5 * MIN); }
      j.live = { ok: ok, n: jobs.length, newest: newest || null, at: now };
      /* the same readings into the GitHub backup: the relay asks GitHub to run the mirror (at most every 10 minutes) */
      if (ok && !PC && C.pokeMirror) { try { C.pokeMirror(appSettings(), localStorage).then(function (r) { S.poke = r; }); } catch (e) { /* */ } }
    });
  }
  /* the GitHub backup, as the relay answered */
  function pokeText() {
    var p = S.poke; if (!p) return '';
    if (p.ok) return ' · ' + L('sandaran GitHub ✓');
    return ' · ' + (p.reason === 'no-token' ? L('sandaran GitHub: perlu token dalam Cloudflare') : p.reason === 'token' ? L('sandaran GitHub: token salah') : p.reason === 'relay' ? L('sandaran GitHub: skrip relay lama (v4 perlu)') : L('sandaran GitHub gagal'));
  }
  function isoMyt(t) { var p = C.myt(t); return p.y + '-' + pad(p.mo) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi) + ':00+08:00'; }
  function loadFile(kind, gid) {
    var k = kind + '-' + gid, c = S.files[k];
    if (c && Date.now() - c.at < 10 * MIN) return Promise.resolve(c.data);
    if (!FOLDER) return distFile(kind, gid).then(function (j) { S.files[k] = { at: Date.now(), data: j }; return j; });
    return getJson(MIRROR + FOLDER + k + '.json?' + bust()).then(function (j) { S.files[k] = { at: Date.now(), data: j }; return j; });
  }
  /* Open-Meteo: 5 models, 4 points, yesterday + 2 days; counted with the dashboard's daily budget (localStorage mc_om) */
  /* 30 days of one gauge through the relay, in the same shape as the GitHub files ({ end, step: 5, s: [...] }) */
  function distFile(kind, gid) {
    if (!liveOn()) return Promise.reject(new Error(EN() ? 'needs the relay' : 'perlu relay'));
    var now = Date.now(), end = Math.floor(now / (5 * MIN)) * 5 * MIN, N = 30 * 288, s2 = []; for (var i = 0; i < N; i++) s2.push(null);
    var u = kind === 'wl' ? R.seriesUrl(gid, now, 720) : R.rainUrl(gid, now, 720);
    return (PC ? viaPc(u) : viaRelay(u)).then(function (txt) {
      var pts2 = kind === 'wl' ? root.MCParse.wlSeries(txt) : root.MCParse.rfReadings(txt);
      pts2.forEach(function (p) { var k = N - 1 - Math.round((end - p.t) / (5 * MIN)); if (k >= 0 && k < N && p.v !== null) s2[k] = kind === 'wl' ? Math.round(p.v * 100) / 100 : Math.round(((s2[k] || 0) + p.v) * 10) / 10; });
      return { v: 1, gid: gid, end: end, step: 5, s: s2 };
    });
  }
  function omCount(n) { var o = load('mc_om', {}); if (o.day !== C.dateKey(Date.now())) o = { day: C.dateKey(Date.now()), n: 0, block: o.block || 0 }; o.n += n; save('mc_om', o); return o; }
  function loadModels() {
    if (S.models && Date.now() - S.modelsAt < 15 * MIN) return Promise.resolve(S.models);
    var o = load('mc_om', {}); if (o.block && Date.now() < o.block) return Promise.resolve(S.models);
    var q = 'latitude=' + ZONES.map(function (z) { return z.lat; }).join(',') + '&longitude=' + ZONES.map(function (z) { return z.lon; }).join(',') + '&hourly=precipitation&timezone=Asia%2FKuala_Lumpur&past_days=1&forecast_days=16';   /* 1.1.5: 16 days (Ramalan page, up to 14 days) */
    var out = {};
    return Promise.all(MODELS.map(function (m) {
      var om = 'https://api.open-meteo.com/v1/forecast?' + q + '&models=' + m.id;
      if (!PC) omCount(ZONES.length);
      return (PC ? viaPc(om) : fetch(om).then(function (r) {
        if (r.status === 429) { var b = load('mc_om', {}); b.block = Date.now() + HOUR; save('mc_om', b); }
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      })).then(function (j) {
        var list = Array.isArray(j) ? j : [j];
        out[m.id] = list.map(function (x) { var h = x.hourly || {}, off = x.utc_offset_seconds === undefined ? 28800 : x.utc_offset_seconds;
          return (h.time || []).map(function (t, i) { return { t: Date.parse(t + ':00Z') - off * 1000, v: h.precipitation ? h.precipitation[i] : null }; }); });
      }).catch(function () { out[m.id] = null; });
    })).then(function () { S.models = out; S.modelsAt = Date.now(); return out; });
  }
  function modelSum(m, zone, from, to) { if (!m || !m[zone]) return null; var a = 0, n = 0; m[zone].forEach(function (p) { if (p.t >= from && p.t < to && p.v !== null) { a += p.v; n++; } }); return n ? a : null; }

  /* ------------------------------------------------------------------ page */
  function head(title, sub) {
    if (S.tab === 'flow') return headFlow(title, sub);
    var d = S.data, now = Date.now(), lv = d && d.live && d.live.ok && !d.live.pending ? d.live : null;
    var pend = d && d.live && d.live.pending ? '<span class="km-badge wait" id="kmLive">⟳ ' + esc(L('Membaca JPS langsung {n}/{m}…', { n: 0, m: d.live.n || '…' })) + '</span>' : '';
    var newest = lv && lv.newest ? lv.newest : d ? Date.parse(d.at) : null, age = newest ? (now - newest) / MIN : null;
    var src = lv ? (PC ? L('Langsung (JPS)') : L('Langsung (relay)')) : pend ? L('Mirror GitHub') : PC ? L('Mirror GitHub (JPS gagal)') : relayOn() ? L('Mirror GitHub (relay gagal)') : L('Mirror GitHub');
    /* 1.1.4: the colour says how old the newest reading is: green up to 30 min, amber up to 3 hours, red after */
    var fresh = age === null ? '' : age > 180 ? '<span class="km-badge bad" title="' + esc(src) + '">⚠️ ' + esc(L('Data lama:')) + ' ' + esc(C.timeAgo(newest, now)) + ' · ' + esc(src) + '</span>'
      : age > 30 ? '<span class="km-badge warn" title="' + esc(src) + '">● ' + esc(src) + ' · ' + esc(hm(newest)) + ' · ' + esc(C.timeAgo(newest, now)) + '</span>'
      : '<span class="km-badge ok" title="' + esc(src) + '">● ' + esc(src) + ' · ' + esc(hm(newest)) + '</span>';
    fresh += pend;
    return '<header class="km-head"><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div><div class="km-act">' + fresh +
      '<button type="button" class="km-btn force" data-act="refresh" title="' + esc(L('Baca semula semua data sekarang, tanpa cache')) + '">⚡ ' + esc(L('Paksa kemas kini')) + '</button>' +
      '<button type="button" class="km-btn" data-act="pdf">🖨️ ' + esc(L('PDF')) + '</button>' +
      '<button type="button" class="km-btn" data-act="img">🖼️ ' + esc(L('Gambar')) + '</button>' +
      (!ORIG[S.tab] ? '' : PC ? '<button type="button" class="km-btn ln" data-act="orig">🌐 ' + esc(L('Laman asal')) + '</button>' : '<a class="km-btn ln" href="' + ORIG[S.tab] + '" target="_blank" rel="noopener">' + esc(L('Laman asal ↗')) + '</a>') + '</div></header>';
  }
  var ORIG = { water: 'https://infobanjir.terengganu.gov.my/WaterLevel/District/4', rain: 'https://infobanjir.terengganu.gov.my/Rainfall/District/4',
    flow: 'https://sites.research.google/floods/l/4.226693947058215/103.41916850003622/13.39981973087496/p/ChIJYVEG9-SGyDERjwlnnLGhe5E?layers=1' };
  ORIG.pred = ORIG.flow;
  if (DIST) ORIG = { pred: null, water: 'https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=' + (DIST.state || 'TRG') + '&district=ALL&station=ALL&lang=en',
    rain: 'https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=' + (DIST.state || 'TRG') + '&district=ALL&station=ALL&language=1&loginStatus=0',
    flow: 'https://sites.research.google/floods/l/' + (DIST.river ? DIST.river.lat + '/' + DIST.river.lon : DIST.lat + '/' + DIST.lon) + '/11' };
  if (DIST) ORIG.pred = ORIG.flow;
  function render() {
    var box = $('km');
    if (S.tab === 'flow') { destroyMap(); renderFlow(box); return; }
    if (!S.data) { box.innerHTML = '<div class="km-loading">' + (S.err ? '⚠️ ' + esc(L('Tidak dapat membaca data mirror: {e}', { e: S.err })) : esc(DIST ? TT('loading') : L('Memuatkan data JPS Kemaman…'))) + '</div>'; return; }
    destroyMap();
    if (S.tab === 'pred') { destroyMap(); box.innerHTML = predPage(); afterPred(); return; }
    box.innerHTML = S.tab === 'rain' ? rainPage() : waterPage();
    if (S.tab === 'rain') afterRain(); else afterWater();
  }


  /* ---------- river flow (tab "flow" = the app's own "Flood Hub Chukai"): GloFAS v4 (Copernicus / ECMWF) through Open-Meteo, no key.
     Point: the GloFAS cell of the main Sg. Kemaman below Sg. Cherul (4.225, 103.375; the cell at the mouth has no river).
     Thresholds from the GloFAS record of this cell (annual peaks, Gumbel): 2-year = Amaran, 5-year = Bahaya, 20-year = Ekstrem -
     not JPS levels and not Google's model. 50 ensemble members give the chance of passing each threshold. */
  var FLOW = DIST && DIST.river ? { lat: +DIST.river.lat, lon: +DIST.river.lon } : { lat: 4.225, lon: 103.375 };
  var FLOW_UP = DIST ? (DIST.up || []) : [{ name: 'Sg. Cherul (Ban Ho)', lat: 4.125, lon: 103.175 }, { name: 'Sg. Kemaman (Air Putih)', lat: 4.275, lon: 103.225 }];
  var FAPI = 'https://flood-api.open-meteo.com/v1/flood?';
  var FLV = [{ k: 'normal', n: 'Normal' }, { k: 'warning', n: 'Amaran' }, { k: 'danger', n: 'Bahaya' }, { k: 'extreme', n: 'Ekstrem' }];
  function dayT(d) { return Date.parse(d + 'T12:00:00+08:00'); }
  function omGet(u) {
    if (PC) return viaPc(u);
    var o = load('mc_om', {}); if (o.block && Date.now() < o.block) return Promise.reject(new Error(L('Open-Meteo: had percuma harian, cuba semula sejam lagi')));
    omCount(1);
    return fetch(u, { cache: 'no-store' }).then(function (r) { if (r.status === 429) { var b = load('mc_om', {}); b.block = Date.now() + HOUR; save('mc_om', b); } if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function q(a, p) { if (!a.length) return null; var s2 = a.slice().sort(function (x, y) { return x - y; }), i = (s2.length - 1) * p, lo = Math.floor(i); return s2[lo] + (s2[Math.min(s2.length - 1, lo + 1)] - s2[lo]) * (i - lo); }
  /* the record of the cell -> thresholds (Gumbel, method of moments), the usual range for each day of the year, the biggest years */
  function histStats(h) {
    var d = (h && h.daily) || {}, t = d.time || [], v = d.river_discharge || [], ann = {}, cnt = {}, doy = [];
    for (var k = 0; k < 366; k++) doy.push([]);
    t.forEach(function (day, i) {
      var x = v[i]; if (x === null || x === undefined) return;
      var yr = day.slice(0, 4); cnt[yr] = (cnt[yr] || 0) + 1;
      if (!ann[yr] || x > ann[yr].v) ann[yr] = { v: x, d: day };
      var j = Math.floor((Date.parse(day + 'T00:00:00Z') - Date.parse(yr + '-01-01T00:00:00Z')) / DAY);
      for (var w = -7; w <= 7; w++) doy[(j + w + 366) % 366].push(x);
    });
    var years = Object.keys(ann).filter(function (y) { return cnt[y] >= 330; }).sort(), am = years.map(function (y) { return ann[y].v; });
    if (am.length < 8) throw new Error(L('Rekod GloFAS terlalu pendek'));
    var mu = am.reduce(function (a, b) { return a + b; }, 0) / am.length, sd = Math.sqrt(am.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / (am.length - 1));
    var gum = function (T) { return Math.round(mu - Math.sqrt(6) / Math.PI * (0.5772 + Math.log(Math.log(T / (T - 1)))) * sd); };
    return { v: 1, at: Date.now(), from: years[0], to: years[years.length - 1], n: am.length, t2: gum(2), t5: gum(5), t20: gum(20),
      peaks: years.map(function (y) { return { y: +y, v: Math.round(ann[y].v), d: ann[y].d }; }),
      p10: doy.map(function (a) { return Math.round(q(a, 0.1)); }), p50: doy.map(function (a) { return Math.round(q(a, 0.5)); }), p90: doy.map(function (a) { return Math.round(q(a, 0.9)); }) };
  }
  function flowLevel(x, H) { return x === null || !H ? 0 : x >= H.t20 ? 3 : x >= H.t5 ? 2 : x >= H.t2 ? 1 : 0; }
  function loadFlow(force) {
    if (!force && S.flow && Date.now() - S.flowAt < 60 * MIN) return Promise.resolve(S.flow);
    var p = 'latitude=' + FLOW.lat + '&longitude=' + FLOW.lon, hist = load('km_flow_hist', null), y = new Date().getUTCFullYear() - 1;
    var needHist = !hist || hist.v !== 1 || Date.now() - hist.at > 30 * DAY;
    return Promise.all([
      omGet(FAPI + p + '&daily=river_discharge,river_discharge_median,river_discharge_max,river_discharge_min,river_discharge_p25,river_discharge_p75&past_days=92&forecast_days=30'),
      omGet(FAPI + p + '&daily=river_discharge&past_days=1&forecast_days=30&ensemble=true'),
      omGet(FAPI + p + '&daily=river_discharge&past_days=92&forecast_days=210&models=seamless_v4').catch(function () { return null; }),
      omGet(FAPI + 'latitude=' + FLOW_UP.map(function (u) { return u.lat; }).join(',') + '&longitude=' + FLOW_UP.map(function (u) { return u.lon; }).join(',') + '&daily=river_discharge,river_discharge_median,river_discharge_max,river_discharge_min&past_days=30&forecast_days=30').catch(function () { return null; }),
      needHist ? omGet(FAPI + p + '&daily=river_discharge&start_date=1984-01-01&end_date=' + y + '-12-31&models=consolidated_v4').then(function (h) { var x = histStats(h); save('km_flow_hist', x); return x; })
        .catch(function (e) { if (hist) return hist; throw e; }) : Promise.resolve(hist)
    ]).then(function (res) { S.flow = buildFlow(res); S.flowAt = Date.now(); S.flowErr = null; return S.flow; })
      .catch(function (e) { S.flowErr = (e && e.message) || String(e); return S.flow; });
  }
  function series(d, key) { return (d.time || []).map(function (t, i) { var v = d[key] ? d[key][i] : null; return { t: dayT(t), d: t, v: v === null || v === undefined ? null : Math.round(v * 10) / 10 }; }).filter(function (x) { return x.v !== null; }); }
  function buildFlow(res) {
    var st = res[0].daily, ens = res[1].daily, H = res[4], today = new Date().toISOString().slice(0, 10), tT = dayT(today);
    var main = series(st, 'river_discharge'), past = main.filter(function (x) { return x.d <= today; }), fut = main.filter(function (x) { return x.d >= today; });
    var band = function (k) { return series(st, k).filter(function (x) { return x.d >= today; }); };
    var mem = Object.keys(ens).filter(function (k) { return /member/.test(k); }).map(function (k) { return series(ens, k).filter(function (x) { return x.d >= today; }); }).filter(function (m) { return m.length; });
    var days = (mem[0] || []).map(function (x) { return x.d; }), th = [H.t2, H.t5, H.t20];
    var daily = days.map(function (d, i) { var vs = mem.map(function (m) { return m[i] ? m[i].v : null; }).filter(function (v) { return v !== null; }); return { d: d, t: dayT(d), p: th.map(function (T) { return vs.length ? vs.filter(function (v) { return v >= T; }).length / vs.length : 0; }) }; });
    var over = th.map(function (T) { return mem.length ? mem.filter(function (m) { return m.some(function (x) { return x.v >= T; }); }).length / mem.length : 0; });
    var med = band('river_discharge_median'), mx = band('river_discharge_max');
    var peak = med.reduce(function (a, b) { return !a || b.v > a.v ? b : a; }, null), top = mx.reduce(function (a, b) { return !a || b.v > a.v ? b : a; }, null);
    var now = past.length ? past[past.length - 1] : main[0];
    var cli = function (k) { return main.map(function (x) { var j = Math.floor((Date.parse(x.d + 'T00:00:00Z') - Date.parse(x.d.slice(0, 4) + '-01-01T00:00:00Z')) / DAY); return { t: x.t, v: H[k][Math.min(365, j)] }; }); };
    var long = res[2] ? series(res[2].daily, Object.keys(res[2].daily).filter(function (k) { return /river_discharge/.test(k); })[0]) : [];
    var up = res[3] ? (Array.isArray(res[3]) ? res[3] : [res[3]]).map(function (o, i) { return { name: FLOW_UP[i] ? FLOW_UP[i].name : '', main: series(o.daily, 'river_discharge'), med: series(o.daily, 'river_discharge_median'), mx: series(o.daily, 'river_discharge_max'), mn: series(o.daily, 'river_discharge_min') }; }) : [];
    return { H: H, today: today, tT: tT, now: now, past: past, fut: fut, med: med, mx: mx, mn: band('river_discharge_min'), p25: band('river_discharge_p25'), p75: band('river_discharge_p75'),
      mem: mem, daily: daily, over: over, peak: peak, top: top, cli10: cli('p10'), cli50: cli('p50'), cli90: cli('p90'), long: long, up: up, runDate: past.length ? dm(past[past.length - 1].t) : '-' };
  }
  function headFlow(title, sub) {
    var F = S.flow, b = F ? '<span class="km-badge ok">● ' + esc(L('GloFAS · data {d}', { d: F.runDate })) + '</span>' : '';
    return '<header class="km-head"><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div><div class="km-act">' + b +
      '<button type="button" class="km-btn force" data-act="refresh" title="' + esc(L('Baca semula semua data sekarang, tanpa cache')) + '">⚡ ' + esc(L('Paksa kemas kini')) + '</button>' +
      '<button type="button" class="km-btn" data-act="pdf">🖨️ ' + esc(L('PDF')) + '</button>' +
      '<button type="button" class="km-btn" data-act="img">🖼️ ' + esc(L('Gambar')) + '</button>' +
      (PC ? '<button type="button" class="km-btn ln" data-act="orig">🌐 ' + esc(L('Laman asal')) + '</button>' : '<a class="km-btn ln" href="' + ORIG.flow + '" target="_blank" rel="noopener">' + esc(L('Flood Hub ↗')) + '</a>') + '</div></header>';
  }
  function fmt0(v) { return v === null || v === undefined ? '-' : Math.round(v).toLocaleString('en-US'); }
  function renderFlow(box) {
    var F = S.flow;
    if (!F) { box.innerHTML = '<div class="km-loading">' + (S.flowErr ? '⚠️ ' + esc(L('Tidak dapat membaca GloFAS: {e}', { e: S.flowErr })) : esc(L('Memuatkan ramalan aliran sungai (GloFAS)…'))) + '</div>'; return; }
    var H = F.H, lvNow = flowLevel(F.now && F.now.v, H), lvPeak = flowLevel(F.peak && F.peak.v, H), pctTxt = function (p) { return Math.round(p * 100) + '%'; };
    var h = head(DIST ? TT('flow') : L('Aliran Sungai Kemaman (Chukai)'), L('GloFAS v4 (Copernicus / ECMWF) melalui Open-Meteo · 50 ahli ensemble · ramalan 30 hari, dikemas kini setiap hari'));
    /* the pictures on top: the river cut across at Chukai, the dial */
    var ART = root.MCKemamanArt, upNow = function (u) { var p = u ? u.main.filter(function (x) { return x.d <= F.today; }) : []; return p.length ? p[p.length - 1].v : null; };
    var labs = { title: L('Keratan rentas sungai'), place: DIST ? (DIST.riverName || NAME) + (DIST.town ? ' · ' + DIST.town : '') : L('Sg. Kemaman · Chukai'), level: L(FLV[lvNow].n), peak: L('Puncak ramalan {v} m³/s ({d})', { v: fmt0(F.peak && F.peak.v), d: F.peak ? dm(F.peak.t) : '-' }),
      t2: L('Amaran') + ' ' + fmt0(H.t2), t5: L('Bahaya') + ' ' + fmt0(H.t5), t20: L('Ekstrem') + ' ' + fmt0(H.t20) };
    if (ART) h += '<section class="km-hero"><div class="km-card hero-cs">' + ART.crossSection({ q: F.now && F.now.v, peak: F.peak && F.peak.v, t2: H.t2, t5: H.t5, t20: H.t20, level: lvNow, labels: labs }) + '</div>' +
      '<div class="km-card hero-gg"><h2>' + esc(L('Meter aliran')) + '</h2>' + ART.gauge({ q: F.now && F.now.v, peak: F.peak && F.peak.v, t2: H.t2, t5: H.t5, t20: H.t20, labels: { title: L('Meter aliran'), level: L(FLV[lvNow].n), peak: L('puncak {v}', { v: fmt0(F.peak && F.peak.v) }) } }) +
      '<div class="gg-leg">' + FLV.map(function (x, i) { return '<span><i class="dot ' + x.k + '"></i>' + esc(L(x.n)) + (i ? ' ≥ ' + fmt0([0, H.t2, H.t5, H.t20][i]) : '') + '</span>'; }).join('') + '</div></div></section>';
    var ico = function (n, c) { return ART ? ART.icon(n, c) : ''; };
    h += '<section class="km-sum flow">' +
      '<div class="km-hi big ' + FLV[lvNow].k + '">' + ico('drop', 'ok') + '<span>' + esc(L('Aliran hari ini')) + '</span><b>' + fmt0(F.now && F.now.v) + ' <small>m³/s</small></b><em><span class="chip ' + FLV[lvNow].k + '">' + esc(L(FLV[lvNow].n)) + '</span> ' + esc(L('julat biasa {a}–{b}', { a: fmt0(F.cli10[F.past.length - 1] && F.cli10[F.past.length - 1].v), b: fmt0(F.cli90[F.past.length - 1] && F.cli90[F.past.length - 1].v) })) + '</em></div>' +
      '<div class="km-hi ' + FLV[lvPeak].k + '">' + ico('peak', FLV[lvPeak].k) + '<span>' + esc(L('Puncak ramalan (nilai tengah)')) + '</span><b>' + fmt0(F.peak && F.peak.v) + ' <small>m³/s</small></b><em>' + esc(F.peak ? dm(F.peak.t) : '-') + ' · ' + esc(L('paling tinggi {v} ({d})', { v: fmt0(F.top && F.top.v), d: F.top ? dm(F.top.t) : '-' })) + '</em></div>' +
      [[0, 'warning'], [1, 'danger'], [2, 'extreme']].map(function (x) { return '<div class="km-cnt pr ' + x[1] + '">' + ico(x[0] ? 'warn' : 'cloud', x[1]) + '<b>' + pctTxt(F.over[x[0]]) + '</b><span>' + esc(L('peluang lepasi {n} dalam 30 hari', { n: L(FLV[x[0] + 1].n) })) + '</span></div>'; }).join('') + '</section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Aliran & ramalan 30 hari')) + '</h2><div class="km-seg" id="kmFlowSpan">' + [[30, '30 hari lepas'], [92, '3 bulan lepas']].map(function (x) { return '<button type="button" data-fspan="' + x[0] + '" aria-pressed="' + ((S.fspan || 30) === x[0]) + '">' + esc(L(x[1])) + '</button>'; }).join('') +
      '<button type="button" data-fens="1" aria-pressed="' + !!S.fens + '">〰️ ' + esc(L('50 ahli')) + '</button></div></div><div id="kmFlow" class="km-chart"></div>' +
      '<div class="km-legend"><span><i class="sw" style="background:var(--brand-text)"></i>' + esc(L('Aliran (model)')) + '</span><span><i class="sw dash"></i>' + esc(L('Ramalan nilai tengah')) + '</span><span><i class="sw blk iq"></i>' + esc(L('50% ahli')) + '</span><span><i class="sw blk mm"></i>' + esc(L('julat semua ahli')) + '</span><span><i class="sw blk cli"></i>' + esc(L('julat biasa (10–90% sejak {y})', { y: H.from })) + '</span>' +
      FLV.slice(1).map(function (x, i) { return '<span><i class="dot ' + x.k + '"></i>' + esc(L(x.n)) + ' ' + fmt0([H.t2, H.t5, H.t20][i]) + ' (' + [2, 5, 20][i] + ' ' + esc(L('tahun')) + ')</span>'; }).join('') + '</div></section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Peluang lepasi ambang setiap hari')) + '</h2><span class="muted">' + esc(L('% daripada 50 ahli ensemble')) + '</span></div>' + probStrip(F) + '</section>';
    if (ART && !DIST) h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Peta 3D aliran sungai hari ini')) + '</h2><span class="muted">' + esc(L('tebal sungai & laju arus ikut aliran')) + '</span></div>' +
      ART.map3d({ main: F.now && F.now.v, cherul: upNow(F.up[0]), up: upNow(F.up[1]), t2: H.t2, labels: { title: L('Peta 3D aliran sungai'), cherul: 'Sg. Cherul', up: 'Sg. Kemaman (Air Putih)', main: L('Hilir → Chukai'), sea: L('Laut China Selatan') } }) + '</section>';
    h += '<section class="km-grid2"><div class="km-card"><div class="km-ct"><h2>' + esc(L('Hulu: gelombang dari atas')) + '</h2></div><div class="km-ups">' + F.up.map(function (u, i) { return '<div><h3>' + esc(u.name) + '</h3><div id="kmUp' + i + '" class="km-chart sm"></div></div>'; }).join('') + '</div>' +
      '<p class="muted km-tipline">' + esc(L('Air dari Sg. Cherul dan Sg. Kemaman atas sampai ke Chukai lebih kurang 1–2 hari kemudian.')) + '</p></div>' +
      '<div class="km-card"><div class="km-ct"><h2>' + esc(L('Puncak setiap tahun ({a}–{b})', { a: H.from, b: H.to })) + '</h2></div><div id="kmPeaks" class="km-chart"></div><div class="km-top">' +
      H.peaks.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 5).map(function (p, i) { var l = flowLevel(p.v, H); return '<span class="chip ' + FLV[l].k + '">' + (i + 1) + '. ' + p.y + ' · ' + fmt0(p.v) + ' m³/s · ' + esc(dm(dayT(p.d))) + '</span>'; }).join('') + '</div></div></section>';
    if (F.long.length) h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Tinjauan bermusim (7 bulan)')) + '</h2><span class="muted">' + esc(L('satu larian model · arah umum sahaja')) + '</span></div><div id="kmLong" class="km-chart"></div></section>';
    h += '<p class="km-note">' + esc(L('Sumber: GloFAS v4 (Copernicus Emergency Management Service / ECMWF) melalui Open-Meteo, sel sungai 4.225, 103.375 (Sg. Kemaman hilir pertemuan Sg. Cherul). Ambang dikira daripada puncak tahunan rekod GloFAS di sel ini (taburan Gumbel): Amaran = 2 tahun, Bahaya = 5 tahun, Ekstrem = 20 tahun - bukan paras rasmi JPS dan bukan model AI Google Flood Hub. Guna bersama paras JPS (tab Water Level Kemaman).')) + '</p>';
    box.innerHTML = h;
    drawFlow(F); drawUps(F); drawPeaks(F); drawLong(F);
  }
  function probStrip(F) {
    var rows = FLV.slice(1).map(function (lv, k) {
      return '<div class="pb-row"><span class="pb-n"><i class="dot ' + lv.k + '"></i>' + esc(L(lv.n)) + ' ≥ ' + fmt0([F.H.t2, F.H.t5, F.H.t20][k]) + '</span>' + F.daily.map(function (d) {
        var p = d.p[k], a = Math.round(p * 100);
        return '<i class="pb ' + lv.k + '" style="--p:' + (p === 0 ? 0 : 0.18 + 0.82 * p).toFixed(2) + '" title="' + esc(dm(d.t) + ': ' + a + '%') + '">' + (a >= 5 ? a : '') + '</i>';
      }).join('') + '</div>';
    }).join('');
    var head2 = '<div class="pb-row pb-head"><span></span>' + F.daily.map(function (d, i) { var p = C.myt(d.t); return '<span>' + (i % 3 === 0 ? p.d + '/' + p.mo : '') + '</span>'; }).join('') + '</div>';
    return '<div class="km-pb" style="--cols:' + F.daily.length + '">' + head2 + rows + '</div>';
  }
  function drawFlow(F) {
    var host = $('kmFlow'); if (!host) return;
    var H = F.H, span = S.fspan || 30, t0 = F.tT - span * DAY, t1 = F.tT + 30 * DAY, lines = [];
    if (S.fens) F.mem.forEach(function (m) { lines.push({ pts: m, cls: 'ens', gapMs: 2 * DAY }); });
    lines.unshift({ pts: F.past, cls: 'wl', gapMs: 2 * DAY });
    lines.push({ pts: F.med, cls: 'med dash', gapMs: 2 * DAY });
    var keep = [H.t2]; var mx = Math.max.apply(null, F.mx.map(function (x) { return x.v; }).concat([0])); if (mx > H.t2 * 0.8) keep.push(H.t5); if (mx > H.t5 * 0.85) keep.push(H.t20);
    chart(host, { t0: t0, t1: t1, label: L('Aliran sungai'), panels: [{ h: 300, auto: true, floor: 0, minSpan: 50, unit: 'm³/s', keep: keep, nowT: F.tT, fmtY: function (v) { return fmt0(v); },
      bands: [{ from: H.t2, to: H.t5, cls: 'warning' }, { from: H.t5, to: H.t20, cls: 'danger' }, { from: H.t20, to: null, cls: 'extreme' }],
      hl: [{ v: H.t2, cls: 'warning', label: L('Amaran') + ' ' + fmt0(H.t2) }, { v: H.t5, cls: 'danger', label: L('Bahaya') + ' ' + fmt0(H.t5) }, { v: H.t20, cls: 'extreme', label: L('Ekstrem') + ' ' + fmt0(H.t20) }],
      ranges: [{ hi: F.cli90, lo: F.cli10, cls: 'cli' }, { hi: F.mx, lo: F.mn, cls: 'mm' }, { hi: F.p75, lo: F.p25, cls: 'iq' }],
      lines: lines, marks: F.now ? [{ t: F.now.t, v: F.now.v, cls: FLV[flowLevel(F.now.v, H)].k, r: 5 }] : [] }],
      tip: function (t) {
        var near = function (list) { var b = null; list.forEach(function (x) { if (Math.abs(x.t - t) < DAY / 2) b = x; }); return b; };
        var pa = near(F.past), md = near(F.med), lo = near(F.mn), hi = near(F.mx), c1 = near(F.cli10), c9 = near(F.cli90), dd = near(F.daily);
        return [pa ? esc(L('Aliran')) + ': <b>' + fmt0(pa.v) + ' m³/s</b>' : '', md ? esc(L('Nilai tengah')) + ': <b>' + fmt0(md.v) + ' m³/s</b>' : '', lo && hi ? esc(L('Julat ahli')) + ': ' + fmt0(lo.v) + '–' + fmt0(hi.v) : '',
          dd ? esc(L('Peluang')) + ': ' + FLV.slice(1).map(function (x, k) { return esc(L(x.n)) + ' ' + Math.round(dd.p[k] * 100) + '%'; }).join(' · ') : '', c1 && c9 ? '<span class="muted">' + esc(L('Biasa')) + ': ' + fmt0(c1.v) + '–' + fmt0(c9.v) + '</span>' : ''].filter(Boolean);
      } });
  }
  function drawUps(F) {
    F.up.forEach(function (u, i) {
      var host = $('kmUp' + i); if (!host) return;
      var past = u.main.filter(function (x) { return x.d <= F.today; }), fut = (u.med.length ? u.med : u.main).filter(function (x) { return x.d >= F.today; });
      chart(host, { t0: F.tT - 21 * DAY, t1: F.tT + 30 * DAY, zoom: false, label: u.name, panels: [{ h: 130, auto: true, floor: 0, minSpan: 20, unit: 'm³/s', nowT: F.tT, fmtY: function (v) { return fmt0(v); },
        ranges: [{ hi: u.mx.filter(function (x) { return x.d >= F.today; }), lo: u.mn.filter(function (x) { return x.d >= F.today; }), cls: 'mm' }],
        lines: [{ pts: past, cls: 'wl', gapMs: 2 * DAY }, { pts: fut, cls: 'med dash', gapMs: 2 * DAY }] }],
        tip: function (t) { var b = null; u.main.forEach(function (x) { if (Math.abs(x.t - t) < DAY / 2) b = x; }); return b ? [esc(u.name) + ': <b>' + fmt0(b.v) + ' m³/s</b>'] : []; } });
    });
  }
  function drawPeaks(F) {
    var host = $('kmPeaks'); if (!host) return;
    var H = F.H, bars = H.peaks.map(function (p) { return { t: Date.UTC(p.y, 0, 15), v: p.v, w: 330 * DAY, cls: 'peak ' + FLV[flowLevel(p.v, H)].k }; });
    chart(host, { t0: Date.UTC(+H.from, 0, 1), t1: Date.UTC(+H.to + 1, 0, 1), zoom: false, label: L('Puncak setiap tahun'), panels: [{ h: 190, min: 0, max: Math.max(H.t20 * 1.05, Math.max.apply(null, H.peaks.map(function (p) { return p.v; })) * 1.08), unit: 'm³/s', fmtY: function (v) { return fmt0(v); },
      hl: [{ v: H.t2, cls: 'warning', label: '2 ' + L('tahun') }, { v: H.t5, cls: 'danger', label: '5 ' + L('tahun') }, { v: H.t20, cls: 'extreme', label: '20 ' + L('tahun') }], bars: bars, lines: [] }],
      tip: function (t) { var yr = new Date(t).getUTCFullYear(), p = H.peaks.filter(function (x) { return x.y === yr; })[0]; return p ? [yr + ': <b>' + fmt0(p.v) + ' m³/s</b> · ' + esc(dm(dayT(p.d)))] : []; } });
  }
  function drawLong(F) {
    var host = $('kmLong'); if (!host || !F.long.length) return;
    var H = F.H, l = F.long, t0 = F.tT - 30 * DAY, t1 = l[l.length - 1].t;
    var cl = function (k) { return l.map(function (x) { var j = Math.floor((Date.parse(x.d + 'T00:00:00Z') - Date.parse(x.d.slice(0, 4) + '-01-01T00:00:00Z')) / DAY); return { t: x.t, v: H[k][Math.min(365, j)] }; }); };
    chart(host, { t0: t0, t1: t1, zoom: false, label: L('Tinjauan bermusim'), panels: [{ h: 170, auto: true, floor: 0, minSpan: 50, unit: 'm³/s', nowT: F.tT, keep: [H.t2], fmtY: function (v) { return fmt0(v); },
      hl: [{ v: H.t2, cls: 'warning', label: L('Amaran') + ' ' + fmt0(H.t2) }], ranges: [{ hi: cl('p90'), lo: cl('p10'), cls: 'cli' }],
      lines: [{ pts: cl('p50'), cls: 'cli50 dash', gapMs: 2 * DAY }, { pts: l, cls: 'wl', gapMs: 2 * DAY }] }],
      tip: function (t) { var b = null; l.forEach(function (x) { if (Math.abs(x.t - t) < DAY / 2) b = x; }); return b ? [esc(L('Model')) + ': <b>' + fmt0(b.v) + ' m³/s</b>'] : []; } });
  }

  /* ---------- water level */
  function waterInfo(st, now) {
    var l = st.list, v = num(st.level), s = status(st, v), r1 = rateOver(l, 1), r4 = rateOver(l, 4), r24 = rateOver(l, 24), mx = maxIn(l, now - DAY);
    var nextK = s === 'normal' ? 'alert' : s === 'alert' ? 'warning' : s === 'warning' ? 'danger' : null;
    return { v: v, s: s, r1: r1, r4: r4, r24: r24, max24: mx, toDanger: num(st.danger) !== null && v !== null ? st.danger - v : null, pct: pct(st, v), next: nextK, toNext: nextK && v !== null ? st[nextK] - v : null, age: ageMin(st, now) };
  }
  function arrow(r) { return r === null ? '' : r > 0.02 ? '<span class="km-up">▲</span>' : r < -0.02 ? '<span class="km-dn">▼</span>' : '<span class="km-flat">▬</span>'; }
  function waterPage() {
    var d = S.data, now = Date.now(), W = d.water.slice();
    var info = {}; W.forEach(function (st) { info[st.name] = waterInfo(st, now); });
    var cnt = { normal: 0, alert: 0, warning: 0, danger: 0 }; W.forEach(function (st) { var s = info[st.name].s; if (cnt[s] !== undefined) cnt[s]++; });
    var near = W.filter(function (st) { return info[st.name].pct !== null; }).sort(function (a, b) { return info[b.name].pct - info[a.name].pct; });
    var fast = W.filter(function (st) { return !st.tidal && info[st.name].r1 !== null; }).sort(function (a, b) { return info[b.name].r1 - info[a.name].r1; })[0];
    var top = near[0], ti = top && info[top.name];
    var h = head(DIST ? TT('water') : L('Paras Air Kemaman'), L('{n} stesen JPS · bacaan setiap 5 minit', { n: W.length }));
    h += '<section class="km-sum">' + LV.map(function (k) { return '<div class="km-cnt ' + k + '"><b>' + cnt[k] + '</b><span>' + esc(L(LV_NAME[k])) + '</span></div>'; }).join('') +
      (top ? '<button type="button" class="km-hi" data-wl="' + esc(top.name) + '"><span>' + esc(L('Paling hampir Bahaya')) + '</span><b>' + esc(top.short.place) + '</b><em>' + esc(L('{m} m lagi · {p}% ke Bahaya', { m: f(ti.toDanger), p: Math.round(ti.pct) })) + '</em></button>' : '') +
      (fast ? '<button type="button" class="km-hi" data-wl="' + esc(fast.name) + '"><span>' + esc(L('Paling laju naik')) + '</span><b>' + esc(fast.short.place) + '</b><em>' + esc(sgn(info[fast.name].r1) + ' m/j · ' + L('{r} m dalam 4 jam', { r: sgn(info[fast.name].r4) })) + '</em></button>' : '') + '</section>';
    h += '<section class="km-grid2"><div class="km-card km-mapcard"><div class="km-ct"><h2>' + esc(L('Peta stesen')) + '</h2><div class="km-seg" role="tablist">' +
      '<button type="button" data-map="map" aria-pressed="' + (S.mapMode === 'map') + '">🗺️ ' + esc(L('Peta')) + '</button><button type="button" data-map="schema" aria-pressed="' + (S.mapMode === 'schema') + '">〰️ ' + esc(L('Skema sungai')) + '</button></div></div>' +
      '<div id="kmMap" class="km-map"></div>' +
      '<div class="km-replay"><button type="button" class="km-play" data-act="play" aria-label="' + esc(L('Main semula 24 jam')) + '">▶</button><input type="range" id="kmFrame" min="0" max="287" value="287" aria-label="' + esc(L('Masa')) + '"><span id="kmFrameT" class="km-ft">' + esc(L('Kini')) + '</span></div>' +
      '<div class="km-legend">' + LV.map(function (k) { return '<span><i class="dot ' + k + '"></i>' + esc(L(LV_NAME[k])) + '</span>'; }).join('') + '<span class="muted">' + esc(L('Tekan stesen untuk butiran')) + '</span></div></div>';
    h += '<div class="km-card"><div class="km-ct"><h2>' + esc(L('Semua stesen berbanding ambang · 24 jam')) + '</h2></div><div id="kmIdx" class="km-chart"></div>' +
      '<div class="km-rank">' + near.map(function (st) {
        var i = info[st.name];
        return '<button type="button" class="km-rk ' + i.s + '" data-wl="' + esc(st.name) + '"><span class="n">' + esc(st.short.place) + '</span><span class="bar"><i style="width:' + Math.min(100, i.pct).toFixed(0) + '%"></i>' +
          ['alert', 'warning'].map(function (k) { var p = pct(st, num(st[k])); return p === null ? '' : '<u style="left:' + Math.min(100, p).toFixed(1) + '%"></u>'; }).join('') + '</span><b>' + Math.round(i.pct) + '%</b><em>' + esc(i.toDanger !== null && i.toDanger > 0 ? L('{m} m', { m: f(i.toDanger) }) : L('Bahaya')) + '</em></button>';
      }).join('') + '</div></div></section>';
    h += '<section class="km-cards">' + W.map(function (st) {
      var i = info[st.name], old = i.age !== null && i.age > 60;
      return '<button type="button" class="km-st ' + i.s + (old ? ' old' : '') + '" data-wl="' + esc(st.name) + '"><div class="t"><b>' + esc(st.short.place) + '</b><span>' + esc(st.short.river) + (st.tidal ? ' · ' + esc(L('pasang surut')) : '') + '</span></div>' +
        '<div class="v"><b>' + f(i.v) + '</b><small>m</small>' + arrow(i.r1) + '</div>' +
        '<div class="c"><span class="chip ' + i.s + '">' + esc(L(LV_NAME[i.s])) + '</span><span class="r">' + esc(i.r1 === null ? '' : sgn(i.r1) + ' m/j') + '</span></div>' + spark(st, st.list.filter(function (p) { return p.t >= now - DAY; })) +
        '<div class="f">' + (i.next ? esc(L('{m} m ke {l}', { m: f(i.toNext), l: L(LV_NAME[i.next]) })) + ' · ' : '') + esc(L('Bahaya {d} m', { d: f(st.danger) })) + '</div>' +
        (old ? '<div class="km-old">⚠️ ' + esc(L('Bacaan {m} minit lalu', { m: Math.round(i.age) })) + '</div>' : '') + '</button>';
    }).join('') + '</section>';
    h += '<p class="km-note">' + esc(L('Sumber: JPS Public Infobanjir (paras air 5 minit): langsung melalui relay awak setiap 3 minit, dengan salinan GitHub (mirror) untuk data lama dan bila relay gagal. Ambang: Waspada = naik ketara, belum banjir · Amaran = kemungkinan kecil akan banjir · Bahaya = banjir. Kedudukan stesen: koordinat JPS, atau kampung / jambatan stesen di sungai dalam OpenStreetMap (anggaran, garis putus-putus). Sungai: © OpenStreetMap.')) + '</p>';
    return h;
  }
  /* ------------------------------------------------------------------ Ramalan (1.1.5): water level 1-24 h, river flow 2-14 days, rain 1 h-14 days */
  function loadTide() {
    if (DIST || !MIRROR) return Promise.resolve(null);
    if (S.tide && Date.now() - S.tideAt < 60 * MIN) return Promise.resolve(S.tide);
    return getJson(MIRROR + 'tide-cukai.json?' + bust()).then(function (j) { S.tide = C.parseTideMirror(j); S.tideAt = Date.now(); return S.tide; }).catch(function () { return S.tide || null; });
  }
  var PRED_H = [1, 3, 6, 12, 24], RAIN_H = [1, 3, 6, 12, 24, 48, 72, 168, 336], LVC = ['n', 'a', 'w', 'd'];
  function hLabel(h) { return h < 48 ? L('{h} j', { h: h }) : L('{d} hari', { d: h / 24 }); }
  function confWord(c) { return c === null ? '' : c >= 70 ? L('tinggi') : c >= 40 ? L('sederhana') : L('rendah'); }
  function predPage() {
    var sub = DIST ? NAME : L('Paras 1–24 jam · aliran sungai & hujan hingga 14 hari');
    var h = head(DIST ? NAME + ' · ' + L('Ramalan') : L('Ramalan Kemaman'), sub);
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Ramalan paras sungai')) + '</h2><span class="muted" id="kmPredLvAt">' + esc(L('anggaran paras (m) dan tahap · tekan stesen untuk graf')) + '</span></div>' +
      '<div id="kmPredLv" class="km-scroll"><div class="km-loading">' + esc(L('Mengira ramalan…')) + '</div></div>' +
      '<div class="pd-legend"><span style="--c:var(--st-normal)">' + esc(L('Normal')) + '</span><span style="--c:var(--st-alert)">' + esc(L('Waspada')) + '</span><span style="--c:var(--st-warning)">' + esc(L('Amaran')) + '</span><span style="--c:var(--st-danger)">' + esc(L('Bahaya')) + '</span></div>' +
      '<h3 class="pd-ttl">' + esc(L('2 – 14 hari: arah aliran sungai (GloFAS, bukan paras)')) + '</h3><div id="kmPredFlow" class="pd-trend"><div class="km-loading">' + esc(L('Membaca GloFAS…')) + '</div></div>' +
      '<p class="km-note">' + esc(L('1–24 jam: kadar naik/turun 1–4 jam terakhir; selepas 4 jam kadar beransur ke trend 24 jam, dan kenaikan didarab faktor hujan 5 model (≥ 30 mm × 1, ≥ 5 mm × 0.75, kurang × 0.5). Ramalan kering (model < 5 mm/24 j dan hujan hari ini < 10 mm): paras tidak naik, dan tidak turun bawah paras terendah 7 hari. Stesen muara ikut jadual pasang surut Cukai × nisbah stesen. Keyakinan = formula amaran awal. Lebih 24 jam paras tidak dianggar (terlalu tak pasti) — yang ditunjuk ialah arah aliran sungai GloFAS (nilai tengah ahli berbanding hari ini).')) + '</p></section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Ramalan hujan')) + '</h2><span class="muted">' + esc(L('jumlah dijangka (mm) · nilai tengah 5 model · julat paling sikit – paling banyak')) + '</span></div>' +
      '<div id="kmPredRain" class="km-scroll"><div class="km-loading">' + esc(L('Membaca 5 model…')) + '</div></div>' +
      '<div class="pd-legend"><span style="--c:var(--ink-3)">' + esc(L('< 1 mm')) + '</span><span style="--c:#7cc4ff">' + esc(L('ringan')) + '</span><span style="--c:#5aa9ff">' + esc(L('sederhana')) + '</span><span style="--c:#a78bfa">' + esc(L('lebat')) + '</span><span style="--c:#e879f9">' + esc(L('sangat lebat')) + '</span></div>' +
      '<p class="km-note">' + esc(L('Kelas hujan JPS (1–10 ringan, 11–30 sederhana, 31–60 lebat, > 60 sangat lebat): pada jumlah hingga 24 jam, pada purata sehari untuk 2–14 hari. Sumber: Open-Meteo — ECMWF IFS (15 hari), NOAA GFS (16), JMA (11), DWD ICON (7.5), UK Met Office (7); lebih 7 hari hanya model yang sampai. 7–14 hari = petunjuk musim, bukan janji.')) + '</p></section>';
    return '<div class="km-root">' + h + '</div>';
  }
  function predLevels(m, tide, files, flow) {
    var d = S.data, now = Date.now(), from = Math.floor(now / HOUR) * HOUR;
    var ev = tide && tide.events ? tide.events : null;
    var g = null;
    if (flow && flow.H && flow.H.t2 && flow.med && flow.med.length) g = Math.max.apply(null, flow.med.slice(0, 2).map(function (x) { return x.v; })) / flow.H.t2;
    return d.water.map(function (st, i) {
      var fl = files && files[i] && files[i].all, all = st.list;
      if (fl && fl.length) { var lf = st.liveFrom; all = lf ? fl.filter(function (p) { return p.t < lf; }).concat(st.list.filter(function (p) { return p.t >= lf; })) : fl; st.full = all; }
      return fcFor(st, all, m, ev, g, now, from);
    });
  }
  /* one gauge: its trend and the 1-24 h forecast (also for the gauge's own sheet: dashed line on the hydrograph) */
  function fcFor(st, all, m, ev, g, now, from) {
    now = now || Date.now(); from = from || Math.floor(now / HOUR) * HOUR;
    var tr = R && R.trend ? R.trend(all, st, now, { stepMin: Math.round(stepOf(all) / MIN) || 5, tidal: !!st.tidal }) : null;
    var week = all.filter(function (p) { return p.t >= now - 7 * DAY && p.v !== null; }).map(function (p) { return p.v; });
    var z = zoneOf(st), rn = nearest(S.data.rain, st);
    var rainH = function (h) { return MODELS.map(function (md) { return modelSum(m && m[md.id], z, from, from + h * HOUR); }).filter(function (v) { return v !== null; }); };
    var fc = tr && R.forecastLevel ? R.forecastLevel(tr, st, { now: now, rainH: rainH, obsToday: rn ? rainSum(rn.st, 24) : null, floor: week.length ? Math.min.apply(null, week) : null,
      tide: st.tidal ? ev : null, ratio: st.tidal && ev ? R.tideRatio(all, ev, now) : null, project: { glofas: g } }) : null;
    if (fc) fc.at = now;
    st.fc = fc;
    return { st: st, tr: tr, fc: fc };
  }
  function drawPredLevels(rows) {
    var host = $('kmPredLv'); if (!host) return;
    var rateTxt = function (tr) { var r = tr && num(tr.rate); return r === null ? '' : r > 0.005 ? L('naik {r}/j', { r: f(r) }) : r < -0.005 ? L('turun {r}/j', { r: f(-r) }) : L('stabil'); };
    var ARW = { up: '↑', down: '↓', flat: '→' };
    host.innerHTML = '<table class="pd-t"><thead><tr><th>' + esc(L('Stesen')) + '</th><th>' + esc(L('Sekarang')) + '</th>' + PRED_H.map(function (h) { return '<th>' + esc(hLabel(h)) + '</th>'; }).join('') + '<th>' + esc(L('Keyakinan 24 j')) + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var st = r.st, fc = r.fc, cur = num(st.level);
        var subTxt = (st.tidal ? L('muara · pasang surut') : (st.short.river || '')) + (num(st.alert) !== null ? ' · ' + L('Waspada') + ' ' + f(st.alert) : '');
        var cells = fc ? fc.steps.map(function (x) {
          return '<td class="' + LVC[Math.max(0, x.lv)] + '" title="' + esc(L('julat {a} – {b} m', { a: f(x.lo), b: f(x.hi) })) + '"><b>' + f(x.v) + '</b><i>' + (x.lv > 0 ? esc(L(['Normal', 'Waspada', 'Amaran', 'Bahaya'][x.lv])) : ARW[x.dir]) + '</i></td>';
        }).join('') : PRED_H.map(function () { return '<td class="now"><b>-</b></td>'; }).join('');
        return '<tr><td class="nm"><button type="button" data-wl="' + esc(st.name) + '">' + esc(st.short.place) + '</button><small>' + esc(subTxt) + '</small></td>' +
          '<td class="now"><b>' + f(cur) + '</b><i>' + esc(fc && fc.dry ? L('ramalan kering') : rateTxt(r.tr)) + '</i></td>' + cells +
          '<td class="now"><b>' + (fc && fc.conf !== null ? fc.conf + '%' : '-') + '</b><i>' + esc(fc ? confWord(fc.conf) : '') + '</i></td></tr>';
      }).join('') + '</tbody></table>';
    var at = $('kmPredLvAt'); if (at) at.textContent = L('dikira {t} · tekan stesen untuk graf', { t: hm(Date.now()) });
  }
  function drawPredFlow(flow) {
    var host = $('kmPredFlow'); if (!host) return;
    if (!flow || !flow.med || !flow.now) { host.innerHTML = '<p class="muted">' + esc(L('GloFAS tidak dapat dibaca')) + '</p>'; return; }
    var probs = (flow.daily || []).map(function (x) { return x.p ? x.p[0] : null; });
    var tr = R.flowTrend(flow.med, flow.now.v, flow.H && flow.H.t2, null, probs);
    host.innerHTML = tr.map(function (x) {
      return '<div class="pd-tc"><span>' + esc(L('{d} hari', { d: x.d })) + '</span><b class="' + x.dir + '">' + ({ up: '↑', down: '↓', flat: '→' })[x.dir] + ' ' + (x.pct > 0 ? '+' : '') + x.pct + '%</b><small>' + esc(x.v + ' m³/s' + (x.of2 !== null ? ' · ' + L('{p}% paras 2 tahun', { p: x.of2 }) : '') + (x.p2 ? ' · ' + L('peluang lepas {p}%', { p: Math.round(x.p2 * 100) }) : '')) + '</small></div>';
    }).join('') || '<p class="muted">' + esc(L('GloFAS tidak dapat dibaca')) + '</p>';
  }
  function drawPredRain(m) {
    var host = $('kmPredRain'); if (!host) return;
    if (!m) { host.innerHTML = '<p class="muted">' + esc(L('Ramalan model tidak dapat dibaca')) + '</p>'; return; }
    var now = Date.now(), per = ZONES.map(function (z, zi) { return R.rainWindows(MODELS.map(function (md) { return m[md.id] ? m[md.id][zi] : null; }), now, RAIN_H); });
    var RC = ['r0', 'r1', 'r2', 'r3', 'r4'];
    var cell = function (w, i) { return '<td class="' + (w.cls < 0 ? 'now' : RC[w.cls]) + (i === 5 ? ' sep' : '') + '"><b>' + (w.med === null ? '-' : f(w.med, w.med < 10 ? 1 : 0)) + '</b><i>' + (w.lo === null ? '' : esc(f(w.lo, w.lo < 10 ? 1 : 0) + '–' + f(w.hi, w.hi < 10 ? 1 : 0))) + '</i></td>'; };
    var nRow = per[0].map(function (w, i) {
      var miss = MODELS.filter(function (md) { return m[md.id] && R.rainWindows([m[md.id][0]], now, [w.h])[0].n; }).map(function (md) { return md.name.replace(/^(NOAA |DWD |UK )/, ''); });
      return '<td class="now' + (i === 5 ? ' sep' : '') + '"><b>' + w.n + '</b>' + (w.n && w.n < MODELS.length ? '<i>' + esc(miss.join(', ')) + '</i>' : '') + '</td>';
    }).join('');
    host.innerHTML = '<table class="pd-t"><thead><tr><th>' + esc(L('Zon')) + '</th>' + RAIN_H.map(function (h, i) { return '<th' + (i === 5 ? ' class="sep"' : '') + '>' + esc(hLabel(h)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      per.map(function (ws, zi) { return '<tr><td class="nm">' + esc(L(ZONES[zi].name)) + '</td>' + ws.map(cell).join('') + '</tr>'; }).join('') +
      '<tr><td class="nm">' + esc(L('Model')) + '<small>' + esc(L('berapa model sampai')) + '</small></td>' + nRow + '</tr></tbody></table>';
  }
  function afterPred() {
    var d = S.data;
    Promise.all([loadModels(), loadFlow().catch(function () { return null; }), loadTide(),
      Promise.all(d.water.map(function (st) { return st.gid ? loadFile('wl', st.gid).then(function (j) { return { all: pts(j) }; }, function () { return null; }) : null; }))])
      .then(function (res) {
        if (S.tab !== 'pred') return;
        drawPredLevels(predLevels(res[0], res[2], res[3], res[1]));
        drawPredFlow(res[1]); drawPredRain(res[0]);
      });
  }
  function afterWater() {
    var d = S.data, now = Date.now(), t0 = now - DAY;
    /* all gauges on one scale: Normal 0 · Waspada 1 · Amaran 2 · Bahaya 3 */
    var lines = d.water.map(function (st, i) {
      return { gapMs: gapOf(st.list), pts: st.list.filter(function (p) { return p.t >= t0 - HOUR; }).map(function (p) { return { t: p.t, v: idx(st, p.v) }; }).filter(function (p) { return p.v !== null; }),
        cls: 'idx s-' + status(st), color: null, endLabel: status(st) === 'normal' ? '' : st.short.place.length > 14 ? st.short.place.slice(0, 13) + '…' : st.short.place };
    }).sort(function (a, b) { return (a.cls > b.cls) ? 1 : -1; });
    chart($('kmIdx'), { t0: t0, t1: d.end, padR: 100, label: L('Semua stesen berbanding ambang'), zoom: false, panels: [{ h: 190, min: -0.5, max: 3.4,
      bands: [{ from: 1, to: 2, cls: 'alert' }, { from: 2, to: 3, cls: 'warning' }, { from: 3, to: null, cls: 'danger' }],
      fmtY: function (v) { return ['Normal', 'Waspada', 'Amaran', 'Bahaya'][Math.round(v)] && Math.abs(v - Math.round(v)) < 0.01 ? L(['Normal', 'Waspada', 'Amaran', 'Bahaya'][Math.round(v)]) : ''; },
      lines: lines }],
      tip: function (t) { return d.water.map(function (st) { var v = valueAt(st.list, t); return v === null ? '' : '<i class="dot ' + status(st, v) + '"></i>' + esc(st.short.place) + ': <b>' + f(v) + ' m</b>'; }).filter(Boolean).slice(0, 8); } });
    drawMap(null);
  }

  /* ---------- the map: Leaflet + OpenStreetMap tiles, or the river schema */
  var MAP = null;
  /* label side on the map, so close gauges near Chukai do not cover each other */
  var TT_DIR = { 'Paya Paman': 'bottom', 'Geliga': 'right', 'Yak Yah': 'right', 'Rantau Panjang': 'bottom', 'Ban Ho': 'bottom', 'Air Putih': 'left', 'Sg. Mas di': 'top', 'Kemasik': 'left' };
  function destroyMap() { if (MAP) { try { MAP.map.remove(); } catch (e) { /* */ } MAP = null; } stopReplay(); }
  /* OpenStreetMap's own tiles: free, no key (CARTO now wants one); dark theme = the same tiles darkened in CSS */
  function tileUrl() { return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'; }
  function drawMap(frameT) {
    var host = $('kmMap'); if (!host) return;
    if (S.tab === 'water' && S.mapMode === 'schema') { host.innerHTML = schema(frameT); return; }
    if (!root.L || !root.L.map) { host.innerHTML = '<div class="km-loading">' + esc(L('Peta tidak dapat dimuat')) + '</div>'; return; }
    var LL = root.L;
    if (!MAP) {
      var map = LL.map(host, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true }).setView([4.26, 103.3], 10);
      LL.tileLayer(tileUrl(), { maxZoom: 17, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      MAP = { map: map, layer: LL.layerGroup().addTo(map) };
      setTimeout(function () { try { map.invalidateSize(); } catch (e) { /* */ } }, 60);
    }
    MAP.layer.clearLayers();
    var pts2 = [];
    if (S.tab === 'water') {
      S.data.water.forEach(function (st) {
        if (num(st.lat) === null) return;
        var v = frameT ? valueAt(st.list, frameT) : num(st.level), s = status(st, v), p = pct(st, v) || 0;
        var m = LL.circleMarker([st.lat, st.lon], { radius: 9 + Math.min(10, p / 10), className: 'km-mk ' + s + (st.src === 'osm' ? ' est' : ''), weight: 2.5, fillOpacity: 0.85 }).addTo(MAP.layer);
        var dir = TT_DIR[Object.keys(TT_DIR).filter(function (k) { return st.name.indexOf(k) >= 0; })[0]] || 'right';
        m.bindTooltip('<b>' + esc(st.short.place) + '</b> ' + f(v) + ' m', { permanent: true, direction: dir, offset: dir === 'left' ? [-10, 0] : dir === 'top' ? [0, -10] : dir === 'bottom' ? [0, 10] : [10, 0], className: 'km-tt ' + s });
        m.on('click', function () { openWater(st.name); });
        pts2.push([st.lat, st.lon]);
      });
    } else {
      var per = S.rainPeriod, sums = S.data.rain.map(function (st) { return rainSum(st, per); }), mxs = Math.max.apply(null, sums.concat([1]));
      var topN = sums.slice().sort(function (a, b) { return b - a; })[Math.min(4, sums.length - 1)];
      S.data.rain.forEach(function (st) {
        if (num(st.lat) === null) return;
        var mm = rainSum(st, per), b = rainBin(per <= 1 ? mm : mm / Math.max(1, per / 6));
        var m = LL.circleMarker([st.lat, st.lon], { radius: 4 + 12 * Math.sqrt(mm / mxs), className: 'km-rb b' + b + (st.src === 'osm' ? ' est' : ''), weight: 1.5, fillOpacity: 0.8 }).addTo(MAP.layer);
        m.bindTooltip('<b>' + f(mm, 1) + '</b> mm' + (mm >= topN && mm > 0 ? '<br><small>' + esc(st.name.replace(/ \(F\d\)$/, '')) + '</small>' : ''), { permanent: mm >= topN && mm > 0, direction: 'right', offset: [8, 0], className: 'km-tt rain' });
        m.on('click', function () { openRain(st.name); });
        pts2.push([st.lat, st.lon]);
      });
    }
    if (pts2.length && !MAP.fitted) { try { MAP.map.fitBounds(pts2, { padding: [40, 50], maxZoom: 11 }); MAP.fitted = true; } catch (e) { /* */ } }
  }
  /* river schema drawn from the real rivers (OpenStreetMap, simplified) with the gauges at their places; flow animated downstream.
     Ring around each gauge = % of the way from Normal to Bahaya. */
  var GEO = root.MCKemamanGeo || null;
  if (DIST) GEO = distGeo();
  /* a district from the form: no real river lines; straight lines from each gauge to the gauge downstream of it (river layout) */
  function distGeo() {
    var W2 = (DIST.water || []).filter(function (x) { return num(x.lat) !== null; }), rivers = [], rv = R && R.parseRivers ? R.parseRivers(DIST.upstream || '') : [];
    var find = function (n) { n = String(n).toLowerCase(); return W2.filter(function (x) { return String(x.name).toLowerCase().indexOf(n) >= 0; })[0]; };
    rv.forEach(function (r) { var me = find(r.name); if (!me) return; (r.up || []).forEach(function (u) { var o = find(u); if (o) rivers.push({ n: '', p: [[+o.lon, +o.lat], [+me.lon, +me.lat]] }); }); });
    var lons = W2.map(function (x) { return +x.lon; }), lats = W2.map(function (x) { return +x.lat; });
    if (!W2.length) { lons = [+DIST.lon]; lats = [+DIST.lat]; }
    var pad2 = 0.06, bb = [Math.min.apply(null, lons) - pad2, Math.min.apply(null, lats) - pad2, Math.max.apply(null, lons) + pad2, Math.max.apply(null, lats) + pad2];
    return { bbox: bb, rivers: rivers, coast: [], places: [[DIST.town || NAME, +DIST.lat, +DIST.lon]], stations: {} };
  }
  var SC_LAB = { 'Air Putih': [-20, -62, 'end'], 'Rantau Panjang': [0, 62, 'middle'], 'Ban Ho': [0, 62, 'middle'], 'Sg. Mas di': [0, -66, 'middle'], 'Paya Paman': [-10, 62, 'middle'],
    'Geliga': [16, -62, 'middle'], 'Yak Yah': [0, -66, 'middle'], 'Kemasik': [-44, 8, 'end'] };
  var SC_MAIN = { 'Sg. Kemaman': 1, 'Sg. Cherul': 1 };
  /* the part of the basin with the water level gauges (lon0, lat0, lon1, lat1) */
  var SC_BOX = DIST && GEO ? GEO.bbox : [102.89, 4.07, 103.50, 4.46];
  function schema(frameT) {
    if (!GEO) return '<div class="km-loading">' + esc(L('Peta sungai tidak dapat dimuat')) + '</div>';
    var bb = SC_BOX, k = Math.cos((bb[1] + bb[3]) / 2 * Math.PI / 180), W = 1000, H = Math.round(W * (bb[3] - bb[1]) / ((bb[2] - bb[0]) * k));
    var X = function (lon) { return ((lon - bb[0]) / (bb[2] - bb[0]) * W).toFixed(1); }, Y = function (lat) { return ((bb[3] - lat) / (bb[3] - bb[1]) * H).toFixed(1); };
    var path = function (p) { return p.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]) + ' ' + Y(q[1]); }).join(''); };
    /* sea: east of the coast line, closed along the right edge */
    var cpts = []; (GEO.coast || []).forEach(function (c) { cpts = cpts.concat(c); });
    cpts.sort(function (a, b) { return b[1] - a[1]; });
    var sea = cpts.length ? 'M' + W + ' 0L' + cpts.map(function (q) { return X(q[0]) + ' ' + Y(q[1]); }).join('L') + 'L' + W + ' ' + H + 'Z' : '';
    var rivers = GEO.rivers.map(function (r) { var d = path(r.p), m = SC_MAIN[r.n] ? ' main' : ''; return '<path d="' + d + '" class="sc-r' + m + '"/><path d="' + d + '" class="sc-flow' + m + '"/>'; }).join('');
    var rlab = {}, rl = GEO.rivers.filter(function (r) { if (rlab[r.n] || r.p.length < 10) return false; rlab[r.n] = 1; return true; }).map(function (r) {
      var q = r.p[Math.floor(r.p.length * (r.n === 'Sg. Kemaman' ? 0.25 : 0.45))]; return '<text x="' + X(q[0]) + '" y="' + (Y(q[1]) - 12) + '" class="sc-rn">' + esc(r.n) + '</text>'; }).join('');
    var places = (GEO.places || []).map(function (p) { return '<circle cx="' + X(p[2]) + '" cy="' + Y(p[1]) + '" r="3" class="sc-pl"/><text x="' + (+X(p[2]) + 6) + '" y="' + (+Y(p[1]) + 4) + '" class="sc-plt">' + esc(p[0]) + '</text>'; }).join('');
    var nodes = S.data.water.map(function (st) {
      if (num(st.lat) === null) return '';
      var v = frameT ? valueAt(st.list, frameT) : num(st.level), s = status(st, v), p = Math.min(100, pct(st, v) || 0), r = 26, c = 2 * Math.PI * (r + 8);
      var lk = Object.keys(SC_LAB).filter(function (key) { return st.name.indexOf(key) >= 0; })[0], lo = SC_LAB[lk] || [0, 44, 'middle'];
      return '<g class="sc-n ' + s + (st.src === 'osm' ? ' est' : '') + '" data-wl="' + esc(st.name) + '" transform="translate(' + X(st.lon) + ' ' + Y(st.lat) + ')" tabindex="0" role="button">' +
        '<circle r="' + (r + 8) + '" class="sc-ring"/><circle r="' + (r + 8) + '" class="sc-pct" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90)"/>' +
        '<circle r="' + r + '" class="sc-core"/><text class="sc-v" y="7">' + f(v, 1) + '</text>' +
        '<text class="sc-l" x="' + lo[0] + '" y="' + lo[1] + '" text-anchor="' + lo[2] + '">' + esc(st.short.place.replace(/^Jamb(atan|\.) /, '').replace(/^Kg\. /, '')) + '</text>' +
        '<text class="sc-p" x="' + lo[0] + '" y="' + (lo[1] + 22) + '" text-anchor="' + lo[2] + '">' + Math.round(p) + '% · ' + esc(L(LV_NAME[s])) + '</text></g>';
    }).join('');
    return '<svg class="km-schema" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(DIST ? TT('schema') : L('Skema sungai Kemaman')) + '">' +
      (sea ? '<path d="' + sea + '" class="sc-sea"/>' : '') + (DIST ? '' : '<text x="' + (W - 16) + '" y="' + (H * 0.78) + '" class="sc-seat" transform="rotate(90 ' + (W - 16) + ' ' + (H * 0.78) + ')">' + esc(L('Laut China Selatan')) + '</text>') +
      rivers + rl + places + nodes +
      '<g class="sc-north" transform="translate(44 60)"><path d="M0 -22 L8 6 L0 0 L-8 6Z"/><text y="22">U</text></g>' +
      '<text x="20" y="' + (H - 14) + '" class="sc-hint">' + esc(DIST ? (EN() ? 'Straight lines = river layout from Settings (not the real river course)' : 'Garis lurus = susunan sungai dari Tetapan (bukan laluan sungai sebenar)') : L('Sungai: © OpenStreetMap · ○ putus-putus = kedudukan anggaran')) + '</text></svg>';
  }
  function stopReplay() { if (S.replay) { clearInterval(S.replay); S.replay = null; } }
  function setFrame(i) {
    var d = S.data, t = d.end - (287 - i) * 5 * MIN, last = i >= 287;
    var lab = $('kmFrameT'); if (lab) lab.textContent = last ? L('Kini') : dmhm(t);
    drawMap(last ? null : t);
  }
  function togglePlay(btn) {
    if (S.replay) { stopReplay(); btn.textContent = '▶'; return; }
    var inp = $('kmFrame'), i = +inp.value >= 287 ? 0 : +inp.value; btn.textContent = '⏸';
    S.replay = setInterval(function () { i = Math.min(287, i + 2); inp.value = i; setFrame(i); if (i >= 287) { stopReplay(); btn.textContent = '▶'; } }, 70);
  }

  /* ---------- rainfall */
  function rainPage() {
    var d = S.data, R0 = d.rain.slice(), now = Date.now();
    var raining = R0.filter(function (st) { return rainSum(st, 0.5) >= 0.5; });
    var by = function (h) { return R0.slice().sort(function (a, b) { return rainSum(b, h) - rainSum(a, h); })[0]; };
    var m1 = by(1), m24 = by(24), m7 = by(168);
    var avg24 = R0.reduce(function (a, st) { return a + rainSum(st, 24); }, 0) / Math.max(1, R0.length);
    var h = head(DIST ? TT('rain') : L('Hujan Kemaman'), L('{n} stesen hujan JPS · bacaan setiap 5 minit', { n: R0.length }));
    var tile = function (k, st, hh, unit) { return '<button type="button" class="km-hi" data-rf="' + esc(st ? st.name : '') + '"><span>' + esc(k) + '</span><b>' + f(st ? rainSum(st, hh) : null, 1) + ' <small>' + unit + '</small></b><em>' + esc(st ? st.name : '-') + '</em></button>'; };
    h += '<section class="km-sum rain"><div class="km-cnt rain"><b>' + raining.length + '</b><span>' + esc(L('stesen sedang hujan')) + '</span></div>' +
      tile(L('Tertinggi 1 jam'), m1, 1, 'mm') + tile(L('Tertinggi 24 jam'), m24, 24, 'mm') + tile(L('Tertinggi 7 hari'), m7, 168, 'mm') +
      '<div class="km-cnt"><b>' + f(avg24, 1) + '</b><span>' + esc(L('mm purata 24 jam')) + '</span></div></section>';
    var per = S.rainPeriod;
    h += '<section class="km-grid2"><div class="km-card km-mapcard"><div class="km-ct"><h2>' + esc(L('Peta hujan')) + '</h2><div class="km-seg">' +
      [[1, '1 j'], [3, '3 j'], [24, '24 j'], [168, '7 hari']].map(function (x) { return '<button type="button" data-rp="' + x[0] + '" aria-pressed="' + (per === x[0]) + '">' + esc(L(x[1])) + '</button>'; }).join('') + '</div></div>' +
      '<div id="kmMap" class="km-map"></div><div class="km-legend">' + rampLegend() + '<span class="muted">' + esc(L('Saiz bulatan = jumlah hujan')) + '</span></div></div>';
    h += '<div class="km-card"><div class="km-ct"><h2>' + esc(L('Kedudukan & jumlah')) + '</h2></div><div class="km-scroll"><table class="tbl km-tbl"><thead><tr><th>' + esc(L('Stesen')) + '</th><th class="num">1 j</th><th class="num">3 j</th><th class="num">6 j</th><th class="num">24 j</th><th class="num">' + esc(L('7 hari')) + '</th></tr></thead><tbody>' +
      R0.slice().sort(function (a, b) { return rainSum(b, 24) - rainSum(a, 24); }).map(function (st) {
        var it = intensity(rainSum(st, 1)), old = ageMin(st, now) > 60;
        return '<tr data-rf="' + esc(st.name) + '"' + (old ? ' class="old"' : '') + '><td title="' + esc(st.name) + '">' + (it.k ? '<i class="km-idot i' + it.k + '" title="' + esc(it.name) + '"></i>' : '') + esc(st.name.replace(/ \(F\d\)$/, '')) + (/\(F\d\)$/.test(st.name) ? ' <small class="muted">' + esc(/\((F\d)\)$/.exec(st.name)[1]) + '</small>' : '') + (old ? ' ⚠️' : '') + '</td>' + [1, 3, 6, 24, 168].map(function (hh) { var v = rainSum(st, hh); return '<td class="num"><span class="km-cell b' + rainBin(hh === 1 ? v : v / Math.max(1, hh / 6)) + '">' + f(v, 1) + '</span></td>'; }).join('') +
          '</tr>';
      }).join('') + '</tbody></table></div></div></section>';
    var hs = S.heatSpan;
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Hujan setiap jam · stesen × jam')) + '</h2><div class="km-seg">' + [[24, '24 jam'], [168, '7 hari']].map(function (x) { return '<button type="button" data-hs="' + x[0] + '" aria-pressed="' + (hs === x[0]) + '">' + esc(L(x[1])) + '</button>'; }).join('') + '</div></div>' +
      heatmap(hs) + '<div class="km-legend">' + rampLegend() + '<span class="muted">' + esc(L('mm sejam · tekan petak / nama stesen')) + '</span></div></section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Hujan sebenar vs ramalan 5 model')) + '</h2><span class="muted" id="kmModelAt"></span></div><div class="km-mgrid"><div id="kmModel" class="km-chart"></div><div id="kmModelTbl"></div></div></section>';
    h += '<p class="km-note">' + esc(L('Sumber: JPS Public Infobanjir (hujan 5 minit): langsung melalui relay awak setiap 3 minit, dengan salinan GitHub (mirror) untuk data lama. Ramalan: Open-Meteo (ECMWF, GFS, ICON, JMA, UKMO). Kelas hujan sejam JPS: ringan 1–10, sederhana 11–30, lebat 31–60, sangat lebat > 60 mm. Kedudukan stesen: koordinat JPS, atau kampung / jambatan stesen dalam OpenStreetMap (anggaran, garis putus-putus).')) + '</p>';
    return h;
  }
  function rampLegend() { return '<span class="km-ramp">' + RAIN_BINS.map(function (v, i) { return '<i class="b' + i + '" title="≥ ' + v + ' mm"></i>'; }).join('') + '</span><span class="muted">0.1 → 60+ mm</span>'; }
  function heatmap(hours) {
    var d = S.data, end = d.endRain || d.end, step = hours <= 24 ? 1 : 3, cols = Math.ceil(hours / step);
    var list = d.rain.slice().sort(function (a, b) { return rainSum(b, hours) - rainSum(a, hours); });
    var head2 = '', h = '<div class="km-heat" style="--cols:' + cols + '"><div class="hm-row hm-head"><span></span>';
    for (var c = 0; c < cols; c++) { var t = end - (cols - c) * step * HOUR + step * HOUR; var p = C.myt(t); head2 += '<span>' + (hours <= 24 ? (c % 3 === 0 ? pad(p.h) : '') : (p.h < step ? dm(t) : '')) + '</span>'; }
    h += head2 + '<span class="hm-tot">Σ</span></div>';
    list.forEach(function (st) {
      var hrs = st.h || [], row = '<div class="hm-row" data-rf="' + esc(st.name) + '"><span class="hm-n">' + esc(st.name) + '</span>';
      for (var c2 = 0; c2 < cols; c2++) {
        var a = 0, i0 = hrs.length - (cols - c2) * step; for (var k = 0; k < step; k++) a += hrs[i0 + k] || 0;
        var t2 = end - (cols - c2) * step * HOUR;
        row += '<i class="b' + rainBin(a / step) + '" title="' + esc(st.name + ' · ' + dmhm(t2) + ' · ' + f(a, 1) + ' mm') + '"></i>';
      }
      h += row + '<span class="hm-tot">' + f(rainSum(st, hours), 0) + '</span></div>';
    });
    return h + '</div>';
  }
  function afterRain() {
    drawMap(null);
    loadModels().then(function (m) { if (S.tab === 'rain' && $('kmModel')) drawModels(m); });
  }
  /* gauges (average of the basin's stations, hourly) vs each model (average of the 4 points): yesterday, then the next 24 h */
  function drawModels(m) {
    var d = S.data, end = d.endRain || d.end, t0 = end - DAY, t1 = end + DAY, host = $('kmModel');
    if (!m) { host.innerHTML = '<div class="km-loading">' + esc(L('Ramalan model tidak dapat dibaca')) + '</div>'; return; }
    var obsH = []; for (var i = 24; i >= 1; i--) { var a = 0, n = 0; d.rain.forEach(function (st) { var hh = st.h || []; var v = hh[hh.length - i]; if (v !== undefined && v !== null) { a += v; n++; } }); obsH.push({ t: end - i * HOUR, v: n ? a / n : 0 }); }
    var cum = function (list) { var s = 0; return list.map(function (p) { s += p.v || 0; return { t: p.t + HOUR, v: s }; }); };
    var obsC = [{ t: t0, v: 0 }].concat(cum(obsH));
    var rows = [], lines = [{ pts: obsC, cls: 'obs', gapMs: 3 * HOUR, endLabel: L('Sebenar') }];
    MODELS.forEach(function (md) {
      var z = m[md.id]; if (!z) { rows.push({ md: md, ok: false }); return; }
      var avg = z[0].map(function (p, k) { var s2 = 0, nn = 0; z.forEach(function (zz) { var q = zz[k]; if (q && q.v !== null) { s2 += q.v; nn++; } }); return { t: p.t, v: nn ? s2 / nn : null }; }).filter(function (p) { return p.v !== null && p.t >= t0 && p.t < t1; });
      var past = avg.filter(function (p) { return p.t < end; }), fut = avg.filter(function (p) { return p.t >= end; });
      var pc = cum(past), pastSum = pc.length ? pc[pc.length - 1].v : 0;
      var fc = cum(fut).map(function (p) { return { t: p.t, v: p.v + pastSum }; });
      lines.push({ pts: [{ t: t0, v: 0 }].concat(pc, fc), color: MCOL[md.id], cls: 'mdl', gapMs: 3 * HOUR, endLabel: md.name.replace(/^(NOAA |DWD |UK )/, '') });
      rows.push({ md: md, ok: true, past: pastSum, next: fc.length ? fc[fc.length - 1].v - pastSum : 0, next6: cum(fut.slice(0, 6)).pop() });
    });
    var obsSum = obsC[obsC.length - 1].v;
    rows.forEach(function (r) { if (r.ok) r.err = Math.abs(r.past - obsSum); });
    var best = rows.filter(function (r) { return r.ok; }).sort(function (a, b) { return a.err - b.err; })[0];
    chart(host, { t0: t0, t1: t1, padR: 70, label: L('Hujan terkumpul'), panels: [{ h: 200, auto: true, floor: 0, minSpan: 2, unit: 'mm', nowT: end, lines: lines }],
      tip: function (t) { return lines.map(function (l) { var v = valueAt(l.pts, t); return v === null ? '' : '<i class="sw" style="background:' + (l.color || 'var(--ink)') + '"></i>' + esc(l.endLabel) + ': <b>' + f(v, 1) + ' mm</b>'; }).filter(Boolean); } });
    var at = $('kmModelAt'); if (at) at.textContent = L('purata kawasan · terkumpul dari semalam') + (best ? ' · ★ ' + L('paling tepat: {m}', { m: best.md.name }) : '');
    $('kmModelTbl').innerHTML = '<table class="tbl km-tbl"><thead><tr><th>' + esc(L('Model')) + '</th><th class="num">' + esc(L('24 j lepas')) + '</th><th class="num">' + esc(L('beza')) + '</th><th class="num">' + esc(L('6 j depan')) + '</th><th class="num">' + esc(L('24 j depan')) + '</th></tr></thead><tbody>' +
      '<tr class="obs"><td><i class="sw" style="background:var(--ink)"></i>' + esc(L('Tolok JPS (sebenar)')) + '</td><td class="num"><b>' + f(obsSum, 1) + '</b></td><td></td><td></td><td></td></tr>' +
      rows.map(function (r) {
        return '<tr' + (best && r === best ? ' class="best" title="' + esc(L('paling tepat 24 jam lepas')) + '"' : '') + '><td><i class="sw" style="background:' + MCOL[r.md.id] + '"></i>' + (best && r === best ? '★ ' : '') + esc(r.md.name) + '</td>' +
          (r.ok ? '<td class="num">' + f(r.past, 1) + '</td><td class="num">' + sgn(r.past - obsSum, 1) + '</td><td class="num">' + f(r.next6 ? r.next6.v : 0, 1) + '</td><td class="num"><b>' + f(r.next, 1) + '</b></td>' : '<td colspan="4" class="muted">' + esc(L('tiada data')) + '</td>') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ------------------------------------------------------------------ station sheets */
  function sheet(html) { var s = $('kmSheet'); s.innerHTML = '<div class="km-sh-in">' + html + '</div>'; s.hidden = false; document.body.classList.add('sheet-on'); s.scrollTop = 0; }
  function closeSheet() { var s = $('kmSheet'); s.hidden = true; s.innerHTML = ''; S.sel = null; document.body.classList.remove('sheet-on'); }
  function ranges(cur) { return '<div class="km-seg" id="kmRange">' + [[1, '1 hari'], [3, '3 hari'], [7, '7 hari'], [14, '14 hari'], [30, '30 hari']].map(function (x) { return '<button type="button" data-range="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + esc(L(x[1])) + '</button>'; }).join('') + '</div>'; }
  function big(k, v, sub, cls) { return '<div class="km-big ' + (cls || '') + '"><span>' + esc(k) + '</span><b>' + v + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>'; }
  function openWater(name) {
    var st = S.data.water.filter(function (x) { return x.name === name; })[0]; if (!st) return;
    S.sel = { kind: 'wl', name: name };
    var now = Date.now(), i = waterInfo(st, now), mx7 = null;
    var rn = nearest(S.data.rain, st);
    var lv = function (k) { var v = num(st[k]); return v === null ? '-' : f(v); };
    var to = function (k) { var v = num(st[k]); if (v === null || i.v === null) return ''; var dd = v - i.v; return dd > 0 ? esc(L('{m} m lagi', { m: f(dd) })) : '<b class="hot">' + esc(L('dilepasi {m} m', { m: f(-dd) })) + '</b>'; };
    var h = '<header class="km-sh-h ' + i.s + '"><div><span class="chip ' + i.s + '">' + esc(L(LV_NAME[i.s])) + '</span><h2>' + esc(st.short.place) + '</h2><p>' + esc(st.name) + (st.tidal ? ' · ' + esc(L('dipengaruhi pasang surut')) : '') + '</p></div>' +
      '<div class="km-act"><button type="button" class="km-btn" data-act="pdf">🖨️ PDF</button><button type="button" class="km-btn" data-act="img">🖼️ ' + esc(L('Gambar')) + '</button><button type="button" class="km-btn x" data-act="close" aria-label="' + esc(L('Tutup')) + '">✕</button></div></header>';
    h += '<section class="km-bigs">' +
      big(L('Paras sekarang'), f(i.v) + '<small> m</small>', esc(L(LV_MEAN[i.s])) + ' · ' + esc(hm(Date.parse(st.updated) || now)), 'main ' + i.s) +
      big(L('Ke Waspada') + ' ' + lv('alert'), '', to('alert'), 'thr alert') + big(L('Ke Amaran') + ' ' + lv('warning'), '', to('warning'), 'thr warning') + big(L('Ke Bahaya') + ' ' + lv('danger'), '', to('danger'), 'thr danger') +
      big(L('Kadar sejam'), sgn(i.r1) + '<small> m/j</small>', arrow(i.r1) + ' ' + esc(i.r1 === null ? '' : i.r1 > 0.02 ? L('naik') : i.r1 < -0.02 ? L('turun') : L('mendatar'))) +
      big(L('Berubah 4 / 24 jam'), sgn(i.r4) + ' <small>/</small> ' + sgn(i.r24), esc(L('meter'))) +
      big(L('Tertinggi 24 jam'), i.max24 ? f(i.max24.v) + '<small> m</small>' : '-', i.max24 ? esc(dmhm(i.max24.t)) : '') +
      '<div class="km-big" id="kmMax7"><span>' + esc(L('Tertinggi 7 hari')) + '</span><b>…</b></div>' +
      big(L('% ke Bahaya'), (i.pct === null ? '-' : Math.round(i.pct)) + '<small>%</small>', '<span class="km-mini"><i style="width:' + Math.min(100, i.pct || 0) + '%"></i></span>') + '</section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Hidrograf & hujan berdekatan')) + '</h2>' + ranges(S.range) + '</div><div id="kmHyd" class="km-chart"><div class="km-loading">' + esc(L('Memuatkan 30 hari data 5 minit…')) + '</div></div>' +
      '<p class="muted km-tipline">' + esc(L('Seret melintang untuk zoom · ketik dua kali untuk semula')) + (rn ? ' · ' + esc(L('Hujan: {n} ({k} km)', { n: rn.st.name, k: f(rn.km, 1) })) : '') + '</p></section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Ramalan & anggaran')) + '</h2></div><div id="kmProj" class="km-proj"><div class="km-loading">' + esc(L('Membaca 5 model…')) + '</div></div></section>';
    sheet(h);
    loadFile('wl', st.gid).then(function (j) {
      var all = pts(j), lf = st.liveFrom; if (lf) all = all.filter(function (p) { return p.t < lf; }).concat(st.list.filter(function (p) { return p.t >= lf; })); st.full = all;
      var m7 = maxIn(all, now - 7 * DAY), b = $('kmMax7'); if (b && m7) b.innerHTML = '<span>' + esc(L('Tertinggi 7 hari')) + '</span><b>' + f(m7.v) + '<small> m</small></b><em>' + esc(dmhm(m7.t)) + '</em>';
      drawHydro(st, rn ? rn.st : null);
    }).catch(function () { st.full = st.list; var b = $('kmMax7'); if (b) b.innerHTML = '<span>' + esc(L('Tertinggi 7 hari')) + '</span><b>-</b><em>' + esc(L('data 30 hari belum ada')) + '</em>'; drawHydro(st, rn ? rn.st : null); });
    Promise.all([loadModels(), rn ? loadFile('rf', rn.st.gid).catch(function () { return null; }) : null, st.tidal ? loadTide() : null]).then(function (res) { if (S.sel && S.sel.name === name) drawProj(st, res[0], rn ? rn.st : null); });
  }
  function hydroBands(st) {
    return [{ from: null, to: num(st.alert), cls: 'normal' }, { from: num(st.alert), to: num(st.warning), cls: 'alert' }, { from: num(st.warning), to: num(st.danger), cls: 'warning' }, { from: num(st.danger), to: null, cls: 'danger' }];
  }
  function drawHydro(st, rst) {
    var host = $('kmHyd'); if (!host) return;
    var all = st.full || st.list, end = all.length ? all[all.length - 1].t : S.data.end, t0 = end - S.range * DAY;
    var view = all.filter(function (p) { return p.t >= t0 - HOUR; });
    var rf = rst && S.files['rf-' + rst.gid] ? pts(S.files['rf-' + rst.gid].data) : null;
    var bars = [], step = S.range <= 3 ? HOUR : S.range <= 7 ? 3 * HOUR : 6 * HOUR;
    if (rf) { var acc = {}; rf.forEach(function (p) { if (p.t < t0) return; var k = Math.floor((p.t + 8 * HOUR) / step) * step - 8 * HOUR; acc[k] = (acc[k] || 0) + p.v; }); Object.keys(acc).forEach(function (k) { bars.push({ t: +k, v: acc[k], w: step, cls: 'rain' }); }); }
    else if (rst) (rst.hourly || []).forEach(function (p) { if (p.t >= t0) bars.push({ t: p.t - HOUR / 2, v: p.v, w: HOUR, cls: 'rain' }); });
    var keep = [num(st.alert)]; if (view.length) { var mx = Math.max.apply(null, view.map(function (p) { return p.v; })); if (num(st.warning) !== null && st.warning - mx < 1) keep.push(st.warning); if (num(st.danger) !== null && st.danger - mx < 1) keep.push(st.danger); }
    /* 1.1.5: the 1-24 h forecast as a dashed line with its range (1 and 3 days views) */
    var fc = st.fc && S.range <= 3 && view.length ? st.fc : null, t1 = end, fcPts = [], fans = [];
    if (fc) {
      var last = view[view.length - 1], base = Math.max(last.t, fc.at ? Math.min(fc.at, last.t + HOUR) : last.t);
      fcPts = [{ t: last.t, v: last.v }].concat(fc.steps.map(function (x) { return { t: base + x.h * HOUR, v: x.v }; }));
      fans = [{ pts: [{ t: last.t, lo: last.v, hi: last.v }].concat(fc.steps.map(function (x) { return { t: base + x.h * HOUR, lo: x.lo, hi: x.hi }; })), cls: 'fc' }];
      t1 = base + DAY; fc.steps.forEach(function (x) { if (x.hi > (keep[1] || -1e9)) keep.push(x.hi); });
    }
    chart(host, { t0: t0, t1: t1, label: L('Hidrograf'), panels: [
      { h: 230, auto: true, unit: 'm', keep: keep, minSpan: 0.3, bands: hydroBands(st),
        hl: [{ v: num(st.alert), cls: 'alert', label: L('Waspada') + ' ' + f(st.alert) }, { v: num(st.warning), cls: 'warning', label: L('Amaran') + ' ' + f(st.warning) }, { v: num(st.danger), cls: 'danger', label: L('Bahaya') + ' ' + f(st.danger) }],
        fans: fans, nowT: fc ? view[view.length - 1].t : null,
        lines: [{ pts: view, cls: 'wl', area: true, gapMs: gapOf(view) }].concat(fc ? [{ pts: fcPts, cls: 'wl fc', dash: true, gapMs: 13 * HOUR }] : []),
        marks: (view.length ? [{ t: view[view.length - 1].t, v: view[view.length - 1].v, cls: status(st), r: 5 }] : []).concat(fcPts.slice(1).map(function (q) { return { t: q.t, v: q.v, cls: 'fc', r: 3 }; })) },
      { h: 90, auto: true, floor: 0, minSpan: 2, unit: 'mm', bars: bars, lines: [] }],
      tip: function (t) {
        var v = valueAt(view, t), b = bars.filter(function (x) { return t >= x.t && t < x.t + x.w; })[0];
        var fv = fc && v === null && t > fcPts[0].t ? valueAt(fcPts, t) : null;
        return [v === null ? '' : '<i class="dot ' + status(st, v) + '"></i>' + esc(L('Paras')) + ': <b>' + f(v) + ' m</b> · ' + esc(L(LV_NAME[status(st, v)])),
          fv === null ? '' : '<i class="dot ' + status(st, fv) + '"></i>' + esc(L('Anggaran')) + ': <b>' + f(fv) + ' m</b> · ' + esc(L(LV_NAME[status(st, fv)])),
          b ? '🌧️ ' + esc(L('Hujan')) + ': <b>' + f(b.v, 1) + ' mm</b> / ' + (b.w / HOUR) + ' j' : ''].filter(Boolean);
      } });
  }
  /* 5-model rain at the gauge's zone + the early-warning projection (same formula as the dashboard) */
  function drawProj(st, m, rst) {
    var host = $('kmProj'); if (!host) return;
    var now = Date.now(), z = zoneOf(st), end = S.data.end;
    var per = MODELS.map(function (md) { return { md: md, h4: modelSum(m && m[md.id], z, end, end + 4 * HOUR), h24: modelSum(m && m[md.id], z, end, end + DAY) }; });
    var ok = per.filter(function (x) { return x.h24 !== null; });
    var med = function (a) { a = a.filter(function (v) { return v !== null; }).sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : null; };
    var rain4 = ok.map(function (x) { return x.h4; }), rain24 = ok.map(function (x) { return x.h24; });
    var tl = st.full || st.list, tr = R ? R.trend(tl, st, now, { stepMin: Math.round(stepOf(tl) / MIN) || 5, tidal: !!st.tidal }) : null;
    var obsT = rst ? rainSum(rst, 24) : null;
    var pr = tr && R.project ? R.project(tr, st, { rain4: rain4, rain24: rain24, obsToday: obsT }) : null;
    /* 1.1.5: the 1-24 h forecast on the hydrograph (dashed) */
    var gq = S.flow && S.flow.H && S.flow.H.t2 && S.flow.med && S.flow.med.length ? Math.max.apply(null, S.flow.med.slice(0, 2).map(function (x) { return x.v; })) / S.flow.H.t2 : null;
    fcFor(st, tl, m, S.tide && S.tide.events, gq, now); if (S.sel && S.sel.name === st.name) drawHydro(st, rst);
    var maxH = Math.max.apply(null, ok.map(function (x) { return x.h24; }).concat([1]));
    var h = '<div class="km-pgrid"><div><h3>' + esc(L('Hujan 24 jam depan · {z}', { z: L(ZONES[z].name) })) + '</h3>' + (ok.length ? per.map(function (x) {
      return '<div class="km-mrow"><span><i class="sw" style="background:' + MCOL[x.md.id] + '"></i>' + esc(x.md.name) + '</span><span class="bar"><i style="width:' + (x.h24 === null ? 0 : x.h24 / maxH * 100).toFixed(0) + '%;background:' + MCOL[x.md.id] + '"></i></span><b>' + (x.h24 === null ? '-' : f(x.h24, 1)) + '</b><em>' + (x.h4 === null ? '' : esc(L('4 j: {v}', { v: f(x.h4, 1) }))) + '</em></div>';
    }).join('') + '<p class="muted">' + esc(L('Nilai tengah {m} mm (julat {a}–{b} mm)', { m: f(med(rain24), 1), a: f(Math.min.apply(null, rain24), 1), b: f(Math.max.apply(null, rain24), 1) })) + '</p>' : '<p class="muted">' + esc(L('Ramalan model tidak dapat dibaca')) + '</p>') + '</div>';
    h += '<div><h3>' + esc(L('Anggaran paras')) + '</h3>';
    if (!pr || !tr) h += '<p class="muted">' + esc(L('Data trend belum cukup.')) + '</p>';
    else {
      var tg = pr.targetName ? L(pr.targetName) + ' ' + f(pr.targetM) + ' m' : '-';
      h += '<div class="km-bigs two">' + big(L('Dalam 4 jam'), f(pr.p4) + '<small> m</small>', esc(L(LV_NAME[status(st, pr.p4)])), 'thr ' + status(st, pr.p4)) + big(L('Dalam 24 jam'), f(pr.p24) + '<small> m</small>', esc(L(LV_NAME[status(st, pr.p24)])), 'thr ' + status(st, pr.p24)) + '</div>' +
        '<p>' + (pr.dry ? '☀️ ' + esc(L('Ramalan kering: paras tidak dijangka naik.')) : pr.tier ? '⚠️ ' + esc(L('Dijangka capai {t} dalam {h} jam.', { t: tg, h: pr.tier })) : '✅ ' + esc(L('Tidak dijangka capai {t} dalam 24 jam.', { t: tg }))) + '</p>' +
        (pr.conf !== undefined ? '<div class="km-conf"><span>' + esc(L('Keyakinan {c}%', { c: pr.conf })) + '</span><span class="km-mini"><i style="width:' + pr.conf + '%"></i></span>' + (pr.parts ? '<small>' + esc(L('trend {t}/40 · hujan {r}/25 · hulu & GloFAS {u}/20 · data {d}/15', { t: pr.parts.trend, r: pr.parts.rain, u: pr.parts.up, d: pr.parts.data })) + '</small>' : '') + '</div>' : '') +
        (tr.tidal ? '<p class="muted">' + esc(L('Stesen pasang surut: kadar dikira atas 24 jam.')) + '</p>' : '');
    }
    host.innerHTML = h + '</div></div>';
  }
  function openRain(name) {
    var st = S.data.rain.filter(function (x) { return x.name === name; })[0]; if (!st) return;
    S.sel = { kind: 'rf', name: name };
    var now = Date.now(), it = intensity(rainSum(st, 1)), wn = nearest(S.data.water, st);
    var h = '<header class="km-sh-h rain"><div><span class="km-int i' + it.k + '">' + esc(it.name) + '</span><h2>' + esc(st.name) + '</h2><p>' + esc(L('Stesen hujan JPS · {d}', { d: st.district || 'Kemaman' })) + '</p></div>' +
      '<div class="km-act"><button type="button" class="km-btn" data-act="pdf">🖨️ PDF</button><button type="button" class="km-btn" data-act="img">🖼️ ' + esc(L('Gambar')) + '</button><button type="button" class="km-btn x" data-act="close" aria-label="' + esc(L('Tutup')) + '">✕</button></div></header>';
    h += '<section class="km-bigs">' + [[1, '1 jam'], [3, '3 jam'], [6, '6 jam'], [24, '24 jam'], [168, '7 hari']].map(function (x) { var v = rainSum(st, x[0]); return big(L(x[1]), f(v, 1) + '<small> mm</small>', x[0] === 1 ? esc(intensity(v).name) : esc(L('purata {v} mm/j', { v: f(v / x[0], 1) })), x[0] === 24 ? 'main rain' : 'rain'); }).join('') +
      big(L('Bacaan terakhir'), esc(hm(Date.parse(st.updated) || now)), esc(dm(Date.parse(st.updated) || now))) + '</section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Hujan & jumlah terkumpul')) + '</h2>' + ranges(S.range) + '</div><div id="kmRf" class="km-chart"><div class="km-loading">' + esc(L('Memuatkan 30 hari data 5 minit…')) + '</div></div>' +
      (wn ? '<p class="muted km-tipline">' + esc(L('Paras air berdekatan: {n} ({k} km)', { n: wn.st.short.place, k: f(wn.km, 1) })) + ' · <a href="#" data-wl="' + esc(wn.st.name) + '">' + esc(L('buka')) + ' →</a></p>' : '') + '</section>';
    h += '<section class="km-card"><div class="km-ct"><h2>' + esc(L('Ramalan 5 model di sini')) + '</h2></div><div id="kmRfProj" class="km-proj"><div class="km-loading">' + esc(L('Membaca 5 model…')) + '</div></div></section>';
    sheet(h);
    Promise.all([loadFile('rf', st.gid).then(function (j) { var a = pts(j); if (st.live) a = a.filter(function (p) { return p.t <= st.liveFrom; }).concat(st.live); st.full = a; }).catch(function () { st.full = st.live || null; }),
      wn ? loadFile('wl', wn.st.gid).then(function (j) { var a = pts(j), lf = wn.st.liveFrom; if (lf) a = a.filter(function (p) { return p.t < lf; }).concat(wn.st.list.filter(function (p) { return p.t >= lf; })); wn.st.full = a; }).catch(function () { }) : null]).then(function () { if (S.sel && S.sel.name === name) drawRain(st, wn ? wn.st : null); });
    loadModels().then(function (m) { if (S.sel && S.sel.name === name) drawRainProj(st, m); });
  }
  function drawRain(st, wst) {
    var host = $('kmRf'); if (!host) return;
    var end = S.data.end, t0 = end - S.range * DAY, step = S.range <= 3 ? HOUR : S.range <= 7 ? 3 * HOUR : 6 * HOUR, bars = [], cum = [], acc = {};
    var src = st.full ? st.full : (st.hourly || []).map(function (p) { return { t: p.t - HOUR / 2, v: p.v }; });
    src.forEach(function (p) { if (p.t < t0) return; var k = Math.floor((p.t + 8 * HOUR) / step) * step - 8 * HOUR; acc[k] = (acc[k] || 0) + p.v; });
    var s = 0; Object.keys(acc).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { bars.push({ t: k, v: acc[k], w: step, cls: 'rain b' + rainBin(acc[k] / (step / HOUR)) }); s += acc[k]; cum.push({ t: k + step, v: s }); });
    var wl = wst ? (wst.full || wst.list).filter(function (p) { return p.t >= t0; }) : [];
    var panels = [{ h: 170, auto: true, floor: 0, minSpan: 2, unit: 'mm/' + (step / HOUR) + 'j', bars: bars, lines: [] }, { h: 90, auto: true, floor: 0, minSpan: 5, unit: 'Σ mm', lines: [{ pts: cum, cls: 'cum', area: true, gapMs: 2 * DAY }] }];
    if (wl.length) panels.push({ h: 80, auto: true, unit: 'm', keep: [num(wst.alert)], minSpan: 0.3, bands: hydroBands(wst), lines: [{ pts: wl, cls: 'wl', gapMs: gapOf(wl) }] });
    chart(host, { t0: t0, t1: end, label: L('Hujan'), panels: panels, tip: function (t) {
      var b = bars.filter(function (x) { return t >= x.t && t < x.t + x.w; })[0], c = valueAt(cum, t), v = wl.length ? valueAt(wl, t) : null;
      return [b ? '🌧️ <b>' + f(b.v, 1) + ' mm</b> / ' + (b.w / HOUR) + ' j · ' + esc(intensity(b.v / (b.w / HOUR)).name) : '', c === null ? '' : 'Σ <b>' + f(c, 1) + ' mm</b>', v === null ? '' : '<i class="dot ' + status(wst, v) + '"></i>' + esc(wst.short.place) + ': <b>' + f(v) + ' m</b>'].filter(Boolean);
    } });
  }
  function drawRainProj(st, m) {
    var host = $('kmRfProj'); if (!host) return;
    var z = zoneOf(st), end = S.data.end;
    if (!m) { host.innerHTML = '<p class="muted">' + esc(L('Ramalan model tidak dapat dibaca')) + '</p>'; return; }
    var lines = [], t1 = end + DAY;
    MODELS.forEach(function (md) { var zz = m[md.id] && m[md.id][z]; if (!zz) return; lines.push({ md: md, pts: zz.filter(function (p) { return p.t >= end && p.t < t1 && p.v !== null; }) }); });
    var div = document.createElement('div'); div.className = 'km-chart'; host.innerHTML = ''; host.appendChild(div);
    chart(div, { t0: end, t1: t1, padR: 14, zoom: false, label: L('Ramalan'), panels: [{ h: 150, auto: true, floor: 0, minSpan: 2, unit: 'mm/j', lines: lines.map(function (l) { return { pts: l.pts.map(function (p) { return { t: p.t + HOUR / 2, v: p.v }; }), color: MCOL[l.md.id], cls: 'mdl', gapMs: 2 * HOUR }; }) }],
      tip: function (t) { return lines.map(function (l) { var v = valueAt(l.pts, t - HOUR / 2); return v === null ? '' : '<i class="sw" style="background:' + MCOL[l.md.id] + '"></i>' + esc(l.md.name) + ': <b>' + f(v, 1) + ' mm</b>'; }).filter(Boolean); } });
    var p = document.createElement('p'); p.className = 'muted';
    p.className = 'km-legend';
    p.innerHTML = '<b>' + esc(L('Jumlah 24 jam')) + '</b>' + lines.map(function (l) { return '<span><i class="sw" style="background:' + MCOL[l.md.id] + '"></i>' + esc(l.md.name.replace(/^(NOAA |DWD |UK )/, '')) + ' <b>' + f(l.pts.reduce(function (a, q) { return a + q.v; }, 0), 1) + '</b> mm</span>'; }).join('') + '<span class="muted">' + esc(L(ZONES[z].name)) + '</span>';
    host.appendChild(p);
  }

  /* ------------------------------------------------------------------ events */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-wl],[data-rf],[data-act],[data-map],[data-rp],[data-hs],[data-range],[data-fspan],[data-fens]');
    if (!t) return;
    if (t.tagName === 'A') e.preventDefault();
    if (t.dataset.wl) { openWater(t.dataset.wl); return; }
    if (t.dataset.rf) { openRain(t.dataset.rf); return; }
    if (t.dataset.map) { S.mapMode = t.dataset.map; save('km_map', S.mapMode); render(); return; }
    if (t.dataset.rp) { S.rainPeriod = +t.dataset.rp; save('km_rp', S.rainPeriod); render(); return; }
    if (t.dataset.hs) { S.heatSpan = +t.dataset.hs; save('km_hs', S.heatSpan); render(); return; }
    if (t.dataset.fspan) { S.fspan = +t.dataset.fspan; render(); return; }
    if (t.dataset.fens) { S.fens = !S.fens; render(); return; }
    if (t.dataset.range) {
      S.range = +t.dataset.range;
      Array.prototype.forEach.call(document.querySelectorAll('#kmRange button'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.range === S.range)); });
      if (S.sel && S.sel.kind === 'wl') { var st = S.data.water.filter(function (x) { return x.name === S.sel.name; })[0], rn = nearest(S.data.rain, st); drawHydro(st, rn ? rn.st : null); }
      if (S.sel && S.sel.kind === 'rf') { var rs = S.data.rain.filter(function (x) { return x.name === S.sel.name; })[0], wn = nearest(S.data.water, rs); drawRain(rs, wn ? wn.st : null); }
      return;
    }
    var a = t.dataset.act;
    if (a === 'close') closeSheet();
    else if (a === 'refresh') force();
    else if (a === 'play') togglePlay(t);
    else if (a === 'pdf') printPage();
    else if (a === 'img') saveImage();
    else if (a === 'orig') { try { root.parent.postMessage({ kmOrig: true }, location.origin); } catch (e) { root.open(ORIG[S.tab], '_blank'); } }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'kmFrame') { stopReplay(); var b = document.querySelector('[data-act="play"]'); if (b) b.textContent = '▶'; setFrame(+e.target.value); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g[data-wl]')) openWater(e.target.getAttribute('data-wl')); });
  document.addEventListener('click', function (e) { var g = e.target.closest && e.target.closest('g[data-wl]'); if (g) openWater(g.getAttribute('data-wl')); }, true);
  $('kmSheet').addEventListener('click', function (e) { if (e.target.id === 'kmSheet') closeSheet(); });

  /* PDF: the browser's print (A4) of what is on screen; the iPad app shell gives its own PDF if it can */
  function printPage() {
    var title = S.sel ? S.sel.name : DIST ? TT(S.tab) : S.tab === 'rain' ? L('Hujan Kemaman') : S.tab === 'flow' ? L('Aliran Sungai Kemaman (Chukai)') : S.tab === 'pred' ? L('Ramalan Kemaman') : L('Paras Air Kemaman');
    var name = NAME + ' ' + (S.sel ? S.sel.name : S.tab === 'rain' ? 'hujan' : S.tab === 'flow' ? 'aliran sungai' : S.tab === 'pred' ? 'ramalan' : 'paras air') + ' ' + C.dateKey(Date.now());
    try {
      if (root.parent && root.parent !== root && root.parent.MC && root.parent.MC.printHtml) {
        /* inside the app (tab): the app prints it (the iPad app makes its PDF from the app's own page) */
        var src = S.sel ? document.querySelector('#kmSheet .km-sh-in') : $('km'), c = src.cloneNode(true);
        Array.prototype.forEach.call(c.querySelectorAll('.km-act, .km-seg, .km-replay, .kc-tip, .leaflet-control-container'), function (x) { x.remove(); });
        var m = c.querySelector('#kmMap'); if (m && !m.querySelector('svg.km-schema')) m.innerHTML = schemaOrNote();
        Array.prototype.forEach.call(c.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
        root.parent.MC.printHtml('<header class="km-phead"><b>' + esc(title) + '</b><span>' + (S.tab === 'flow' ? 'GloFAS / Open-Meteo · ' : 'JPS Public Infobanjir · ') + esc(dmhm(S.data ? S.data.end : Date.now())) + ' · Dashboard Cuaca Aziz</span></header>' + c.innerHTML, name, 'assets/css/kemaman.css');
        return;
      }
    } catch (e) { /* not the app */ }
    root.print();
  }
  /* the river schema in the printout instead of the map tiles */
  function schemaOrNote() { return S.tab === 'water' && GEO ? schema(null) : ''; }
  /* image: the open chart(s) as one PNG (SVG -> canvas), shared or downloaded */
  function saveImage() {
    var svgs = Array.prototype.slice.call(document.querySelectorAll((S.sel ? '#kmSheet' : '#km') + ' svg.kc-svg, ' + (S.sel ? '#kmSheet' : '#km') + ' svg.km-schema'));
    if (!svgs.length) return;
    var cs = getComputedStyle(document.documentElement), W = Math.max.apply(null, svgs.map(function (s) { return s.getBoundingClientRect().width; })), pad2 = 24, title = (S.sel ? S.sel.name : S.tab === 'rain' ? L('Hujan Kemaman') : S.tab === 'flow' ? L('Aliran Sungai Kemaman (Chukai)') : S.tab === 'pred' ? L('Ramalan Kemaman') : L('Paras Air Kemaman'));
    var H = svgs.reduce(function (a, s) { return a + s.getBoundingClientRect().height + 12; }, 60);
    var cv = document.createElement('canvas'), k = 2; cv.width = (W + pad2 * 2) * k; cv.height = (H + pad2) * k;
    var g = cv.getContext('2d'); g.scale(k, k); g.fillStyle = cs.getPropertyValue('--surface') || '#0d182c'; g.fillRect(0, 0, W + pad2 * 2, H + pad2);
    g.fillStyle = cs.getPropertyValue('--ink') || '#fff'; g.font = '700 18px Inter, sans-serif'; g.fillText(title, pad2, 34);
    g.font = '12px Inter, sans-serif'; g.fillStyle = cs.getPropertyValue('--ink-3') || '#889'; g.fillText((S.tab === 'flow' ? 'GloFAS / Open-Meteo · ' : 'JPS Public Infobanjir · ') + dmhm(S.data.end) + ' · Dashboard Cuaca Aziz', pad2, 52);
    var y = 66;
    (function next(i) {
      if (i >= svgs.length) {
        cv.toBlob(function (b) {
          var file = new File([b], 'kemaman-' + C.dateKey(Date.now()) + '.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: title }).catch(function () { }); return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }, 'image/png');
        return;
      }
      var s = svgs[i], r = s.getBoundingClientRect(), clone = s.cloneNode(true);
      inlineStyles(s, clone);
      clone.setAttribute('xmlns', NS); clone.setAttribute('width', r.width); clone.setAttribute('height', r.height);
      var img = new Image();
      img.onload = function () { g.drawImage(img, pad2, y, r.width, r.height); y += r.height + 12; next(i + 1); };
      img.onerror = function () { next(i + 1); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    })(0);
  }
  function inlineStyles(src, dst) {
    var a = src.querySelectorAll('*'), b = dst.querySelectorAll('*');
    for (var i = 0; i < a.length; i++) {
      var cs = getComputedStyle(a[i]), st = '';
      ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'visibility'].forEach(function (p) { st += p + ':' + cs.getPropertyValue(p) + ';'; });
      b[i].setAttribute('style', st);
    }
  }

  /* ------------------------------------------------------------------ start, auto refresh (mirror ~15 min; checked every 5 min while shown) */
  function refresh(force) {
    if (!force && document.hidden) return;
    if (S.tab === 'flow') { loadFlow(force).then(function () { var y = root.scrollY; render(); root.scrollTo(0, y); }); return; }
    var keep = S.sel;
    loadNow().then(function () { var y = root.scrollY; render(); if (force && keep) (keep.kind === 'wl' ? openWater : openRain)(keep.name); else root.scrollTo(0, y); });
  }
  /* "Paksa kemas kini": everything again now (mirror files, 30-day files, 5 models), then the version and the data times */
  function force() {
    if (S.tab === 'flow') {
      note('⚡ ' + L('Paksa kemas kini…'));
      S.flowAt = 0;
      loadFlow(true).then(function () { render(); note(S.flowErr ? '⚠️ ' + S.flowErr : '✅ ' + L('Data dikemas kini {t}', { t: hm(Date.now()) }) + ' · ' + L('GloFAS {d}', { d: S.flow ? S.flow.runDate : '-' }) + ' · ' + L('Versi {v}', { v: C.VERSION }), 7000); });
      return;
    }
    S.bust = Date.now(); S.files = {}; S.models = null; S.modelsAt = 0;
    note('⚡ ' + L('Paksa kemas kini…'));
    var keep = S.sel;
    loadNow().then(function () {
      render(); if (keep) (keep.kind === 'wl' ? openWater : openRain)(keep.name);
      if (S.tab === 'water') loadModels();
      note(S.err ? '⚠️ ' + L('Tidak dapat membaca data mirror: {e}', { e: S.err }) :
        '✅ ' + L('Data dikemas kini {t}', { t: hm(Date.now()) }) + ' · ' + (S.data.live && S.data.live.ok ? L('JPS langsung {n}/{m} stesen, bacaan {t}', { n: S.data.live.ok, m: S.data.live.n, t: hm(S.data.live.newest || Date.now()) }) : L('mirror JPS {m}', { m: hm(Date.parse(S.data.at)) }) + (PC ? ' · ' + L('JPS gagal') : relayOn() ? ' · ' + L('relay gagal') : ' · ' + L('tiada relay'))) + pokeText() + ' · ' + L('Versi {v}', { v: C.VERSION }), 7000);
      S.bust = 0;
    });
  }
  function note(text, ms) {
    var n = $('kmNote'); if (!n) { n = document.createElement('div'); n.id = 'kmNote'; n.className = 'km-note-pop'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    n.textContent = text; n.hidden = false; clearTimeout(note.t); if (ms) note.t = setTimeout(function () { n.hidden = true; }, ms);
  }
  root.MCKemaman = { S: S, onLive: function () { if (S.tab === 'flow') return; var y = root.scrollY; render(); if (S.sel) (S.sel.kind === 'wl' ? openWater : openRain)(S.sel.name); root.scrollTo(0, y); }, refresh: refresh, force: force, idx: idx, pct: pct, intensity: intensity, rainBin: rainBin, shortName: shortName, pts: pts, setTab: function (t) { S.tab = t === 'rain' || t === 'flow' || t === 'pred' ? t : 'water'; closeSheet(); render(); } };
  window.addEventListener('message', function (e) { if (e.origin !== location.origin || !e.data) return; if (e.data.kmTab) root.MCKemaman.setTab(e.data.kmTab); if (e.data.kmForce) force(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - S.at > 3 * MIN) refresh(); });
  setInterval(function () { refresh(false); }, 3 * MIN);
  setInterval(function () { if (S.data && !S.sel) { var b = document.querySelector('.km-badge'); if (b) { var lv = S.data.live, nw = lv && lv.ok && lv.newest ? lv.newest : Date.parse(S.data.at), age = (Date.now() - nw) / MIN; if (age > 60 && !b.classList.contains('bad')) render(); } } }, MIN);
  refresh(true);
})(window);
