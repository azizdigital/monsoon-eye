/* Dashboard Cuaca Aziz - drawings for the river flow tab (all SVG drawn here, no pictures from elsewhere):
   crossSection(o)  the river at Chukai cut across: banks, kampung house, coconut trees, water at today's flow (animated waves),
                    a staff gauge with Amaran / Bahaya / Ekstrem marks and the forecast peak as a ghost line; rain clouds when rising
   gauge(o)         a dial: needle at today's flow over green / orange / red / purple bands, the forecast peak as a marker
   map3d(o)         the real rivers (OpenStreetMap) tilted in 3D, width and flow speed by the discharge of each part
   icon(name)       small icons (drop, peak, warn, wave, cloud)
   Values: o.q (m³/s now), o.peak, o.t2 / t5 / t20 thresholds, o.level 0..3, o.labels { … } (already translated). */
(function (root) {
  'use strict';
  var esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = 0;
  var COL = ['#22c55e', '#f97316', '#ef4444', '#a855f7'];
  function n0(v) { return v === null || v === undefined || !isFinite(v) ? '-' : Math.round(v).toLocaleString('en-US'); }

  /* ------------------------------------------------------------ river cut across */
  function crossSection(o) {
    var id = 'cs' + (++uid), W = 820, H = 380, bed = 318, top = 132, qmax = Math.max(o.t20 * 1.12, (o.peak || 0) * 1.05, (o.q || 0) * 1.05);
    /* stage grows slower than flow (rating curve ~ Q^0.5) */
    var yOf = function (q) { return bed - (bed - top) * Math.pow(Math.max(0, Math.min(1, (q || 0) / qmax)), 0.5); };
    var yq = yOf(o.q), yp = o.peak ? yOf(o.peak) : null, lv = o.level || 0, rising = o.peak && o.q && o.peak > o.q * 1.25;
    var sky = [['#0e2a4a', '#3a6ea5'], ['#3b2a1a', '#a0642a'], ['#3a1414', '#9b2c2c'], ['#2a1240', '#6d28a8']][lv];
    /* the channel: left bank, bed, right bank */
    var chan = 'M0 ' + (top - 8) + ' C 120 ' + (top - 10) + ', 160 ' + (top + 4) + ', 210 ' + (bed - 60) + ' S 300 ' + bed + ', 410 ' + bed + ' S 560 ' + (bed - 4) + ', 610 ' + (bed - 70) + ' S 700 ' + (top + 2) + ', ' + W + ' ' + (top - 6);
    var ground = chan + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z';
    var inside = chan + ' L ' + W + ' 0 L 0 0 Z';
    var marks = [[o.t2, o.labels.t2, COL[1]], [o.t5, o.labels.t5, COL[2]], [o.t20, o.labels.t20, COL[3]]];
    var wave = function (y, amp, len, cls) { var d = 'M -' + len + ' ' + y; for (var x = -len; x < W + 2 * len; x += len) d += ' q ' + (len / 4) + ' -' + amp + ' ' + (len / 2) + ' 0 t ' + (len / 2) + ' 0'; return '<path class="' + cls + '" d="' + d + ' V ' + H + ' H -' + len + ' Z"/>'; };
    var palm = function (x, y, s, flip) {
      var f = flip ? -1 : 1, fr = '';
      [[-70, 0.9], [-30, 1], [10, 0.95], [50, 0.85], [100, 0.8], [150, 0.75], [-120, 0.7]].forEach(function (a) {
        var r = a[0] * Math.PI / 180, L2 = 46 * s * a[1], ex = Math.cos(r) * L2 * f, ey = Math.sin(r) * L2 * 0.55 + 12 * s;
        fr += '<path d="M0 0 q ' + (ex * 0.5) + ' ' + (-22 * s) + ' ' + ex + ' ' + ey + '" class="cs-frond"/>';
      });
      return '<g transform="translate(' + x + ' ' + y + ')"><path d="M0 0 q ' + (8 * s * f) + ' ' + (-50 * s) + ' ' + (2 * s * f) + ' ' + (-100 * s) + '" class="cs-trunk" style="stroke-width:' + (6 * s) + '"/>' +
        '<g transform="translate(' + (2 * s * f) + ' ' + (-100 * s) + ')">' + fr + '<circle r="' + (4 * s) + '" cx="' + (3 * s * f) + '" cy="' + (4 * s) + '" class="cs-coco"/><circle r="' + (4 * s) + '" cx="' + (-3 * s * f) + '" cy="' + (6 * s) + '" class="cs-coco"/></g></g>';
    };
    var house = function (x, y, s) {   /* kampung house on stilts, two visible walls and a roof in 3D */
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" filter="url(#' + id + 'sh)">' +
        [6, 30, 54].map(function (px) { return '<rect x="' + px + '" y="-14" width="4" height="16" class="cs-stilt"/>'; }).join('') +
        '<polygon points="0,-14 60,-14 60,-54 0,-54" class="cs-wall"/><polygon points="60,-14 82,-24 82,-62 60,-54" class="cs-wall2"/>' +
        '<polygon points="-6,-52 30,-84 66,-52" class="cs-roof"/><polygon points="66,-52 30,-84 52,-92 88,-60" class="cs-roof2"/>' +
        '<rect x="10" y="-44" width="12" height="12" class="cs-win"/><rect x="36" y="-46" width="14" height="32" class="cs-door"/>' +
        '<polygon points="66,-44 76,-48 76,-36 66,-32" class="cs-win2"/></g>';
    };
    var post = function () {   /* staff gauge in the water by the right bank */
      var x = 560, yb = bed - 30, s = '<g filter="url(#' + id + 'sh)"><rect x="' + (x - 3) + '" y="' + (top - 6) + '" width="20" height="' + (yb - top + 6) + '" rx="2" class="cs-post"/>';
      for (var yy = top - 4; yy < yb; yy += 12) s += '<rect x="' + (x - 1) + '" y="' + yy + '" width="16" height="6" class="cs-tick"/>';
      return s + '</g>';
    };
    var cloud = function (x, y, s, rain) {
      var c = '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" class="cs-cloud"><ellipse cx="0" cy="0" rx="34" ry="18"/><ellipse cx="26" cy="-10" rx="26" ry="20"/><ellipse cx="52" cy="2" rx="28" ry="16"/><ellipse cx="22" cy="8" rx="40" ry="14"/></g>';
      if (rain) for (var k = 0; k < 9; k++) c += '<line class="cs-rain" style="animation-delay:-' + (k * 0.13).toFixed(2) + 's" x1="' + (x - 20 + k * 9 * s) + '" y1="' + (y + 18 * s) + '" x2="' + (x - 26 + k * 9 * s) + '" y2="' + (y + 40 * s) + '"/>';
      return c;
    };
    var s = '<svg class="cs-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.labels.title) + '"><defs>' +
      '<linearGradient id="' + id + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4f2a"/><stop offset=".35" stop-color="#4a3520"/><stop offset="1" stop-color="#2a1d12"/></linearGradient>' +
      '<linearGradient id="' + id + 'grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fae4a"/><stop offset="1" stop-color="#2f6b2a"/></linearGradient>' +
      '<linearGradient id="' + id + 'water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3df" stop-opacity=".92"/><stop offset=".5" stop-color="#1f6aa5" stop-opacity=".95"/><stop offset="1" stop-color="#0c2f55"/></linearGradient>' +
      '<linearGradient id="' + id + 'mud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7834f" stop-opacity=".9"/><stop offset="1" stop-color="#5b4224"/></linearGradient>' +
      '<radialGradient id="' + id + 'sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>' +
      '<clipPath id="' + id + 'in"><path d="' + inside + '"/></clipPath></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'sky)"/>' +
      (rising ? cloud(150, 46, 1.1, true) + cloud(470, 34, 1.3, true) + cloud(690, 60, 0.9, true) : '<circle cx="690" cy="62" r="46" fill="url(#' + id + 'sun)"/>' + cloud(170, 54, 0.8, false)) +
      /* hills far away */
      '<path d="M0 150 C 120 96, 220 110, 330 128 S 520 92, 640 118 S 760 104, 820 122 V 160 H 0 Z" class="cs-hill"/>' +
      /* water (clipped to the channel), waves */
      '<g clip-path="url(#' + id + 'in)">' +
      '<rect x="0" y="' + yq.toFixed(1) + '" width="' + W + '" height="' + (H - yq).toFixed(1) + '" fill="url(#' + id + (lv >= 2 ? 'mud' : 'water') + ')"/>' +
      '<g class="cs-waves" transform="translate(0 ' + (yq - 2).toFixed(1) + ')">' + wave(0, 5, 70, 'cs-wave a') + wave(4, 4, 52, 'cs-wave b') + '</g>' +
      '<line x1="0" x2="' + W + '" y1="' + (yq + 0.5).toFixed(1) + '" y2="' + (yq + 0.5).toFixed(1) + '" class="cs-shine"/>' +
      '</g>' +
      /* ground, grass on the banks */
      '<path d="' + ground + '" fill="url(#' + id + 'soil)"/>' +
      '<path d="M0 ' + (top - 8) + ' C 120 ' + (top - 10) + ', 160 ' + (top + 4) + ', 190 ' + (top + 30) + ' L 182 ' + (top + 36) + ' C 150 ' + (top + 10) + ', 110 ' + (top + 2) + ', 0 ' + (top + 4) + ' Z" fill="url(#' + id + 'grass)"/>' +
      '<path d="M' + W + ' ' + (top - 6) + ' C 700 ' + (top + 2) + ', 660 ' + (top + 14) + ', 632 ' + (top + 34) + ' L 640 ' + (top + 40) + ' C 670 ' + (top + 18) + ', 720 ' + (top + 8) + ', ' + W + ' ' + (top + 6) + ' Z" fill="url(#' + id + 'grass)"/>' +
      /* threshold marks across the channel, the forecast peak */
      marks.map(function (m) { var y = yOf(m[0]); return '<line x1="150" x2="680" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="cs-mark" style="stroke:' + m[2] + '"/><text x="684" y="' + (y + 4).toFixed(1) + '" class="cs-mt" style="fill:' + m[2] + '">' + esc(m[1]) + '</text>'; }).join('') +
      (yp !== null ? '<line x1="220" x2="600" y1="' + yp.toFixed(1) + '" y2="' + yp.toFixed(1) + '" class="cs-peak"/><text x="224" y="' + (yp - 6).toFixed(1) + '" class="cs-pt">▲ ' + esc(o.labels.peak) + '</text>' : '') +
      post() +
      /* the kampung on the left bank, trees */
      house(34, top - 4, 0.95) + palm(140, top - 4, 1.05, false) + palm(18, top - 2, 0.8, true) +
      palm(760, top - 2, 1.1, true) + palm(706, top + 2, 0.85, false) +
      '<g filter="url(#' + id + 'sh)"><ellipse cx="660" cy="' + (top + 2) + '" rx="26" ry="9" class="cs-bush"/><ellipse cx="236" cy="' + (top + 40) + '" rx="18" ry="7" class="cs-bush"/></g>' +
      /* the reading */
      '<g transform="translate(16 ' + (H - 70) + ')"><rect width="250" height="56" rx="12" class="cs-card"/><text x="14" y="24" class="cs-ct">' + esc(o.labels.place) + '</text>' +
      '<text x="14" y="47" class="cs-cv">' + n0(o.q) + ' m³/s</text><rect x="150" y="32" rx="9" width="' + (o.labels.level.length * 7.5 + 18) + '" height="20" style="fill:' + COL[lv] + '"/><text x="159" y="46" class="cs-cl">' + esc(o.labels.level) + '</text></g>' +
      '</svg>';
    return s;
  }

  /* ------------------------------------------------------------ dial */
  function gauge(o) {
    var id = 'gg' + (++uid), cx = 160, cy = 168, R = 128, max = Math.max(o.t20 * 1.25, (o.peak || 0) * 1.1, (o.q || 0) * 1.1);
    var ang = function (v) { return Math.PI * (1 - Math.max(0, Math.min(1, v / max))); };
    var pt = function (v, r) { var a = ang(v); return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; };
    var arc = function (a, b, r, col, w) { var p1 = pt(a, r), p2 = pt(b, r); return '<path d="M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A ' + r + ' ' + r + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + '" stroke="' + col + '" stroke-width="' + w + '" fill="none"/>'; };
    var ticks = '';
    for (var k = 0; k <= 10; k++) { var v = max * k / 10, a1 = pt(v, R - 30), a2 = pt(v, R - (k % 5 ? 38 : 44)); ticks += '<line x1="' + a1[0].toFixed(1) + '" y1="' + a1[1].toFixed(1) + '" x2="' + a2[0].toFixed(1) + '" y2="' + a2[1].toFixed(1) + '" class="gg-tick"/>'; if (k % 2 === 0) { var tl = pt(v, R - 56); ticks += '<text x="' + tl[0].toFixed(1) + '" y="' + (tl[1] + 4).toFixed(1) + '" class="gg-tl">' + n0(v) + '</text>'; } }
    var deg = 180 * Math.max(0, Math.min(1, (o.q || 0) / max)) - 90, pk = o.peak ? pt(o.peak, R + 14) : null;
    return '<svg class="gg-svg" viewBox="0 0 320 220" role="img" aria-label="' + esc(o.labels.title) + '"><defs>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ecf3"/><stop offset=".45" stop-color="#8b98ab"/><stop offset="1" stop-color="#3d4757"/></linearGradient>' +
      '<radialGradient id="' + id + 'f" cx=".5" cy=".75" r=".8"><stop offset="0" stop-color="#1b2b45"/><stop offset="1" stop-color="#070e1c"/></radialGradient>' +
      '<radialGradient id="' + id + 'c" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#b8c2d2"/><stop offset="1" stop-color="#4b5567"/></radialGradient>' +
      '<filter id="' + id + 's"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity=".5"/></filter></defs>' +
      '<path d="M' + (cx - R - 18) + ' ' + cy + ' A ' + (R + 18) + ' ' + (R + 18) + ' 0 0 1 ' + (cx + R + 18) + ' ' + cy + ' L ' + (cx + R + 18) + ' ' + (cy + 14) + ' L ' + (cx - R - 18) + ' ' + (cy + 14) + ' Z" fill="url(#' + id + 'b)" filter="url(#' + id + 's)"/>' +
      '<path d="M' + (cx - R - 8) + ' ' + cy + ' A ' + (R + 8) + ' ' + (R + 8) + ' 0 0 1 ' + (cx + R + 8) + ' ' + cy + ' Z" fill="url(#' + id + 'f)"/>' +
      arc(0, o.t2, R - 14, COL[0], 18) + arc(o.t2, o.t5, R - 14, COL[1], 18) + arc(o.t5, o.t20, R - 14, COL[2], 18) + arc(o.t20, max, R - 14, COL[3], 18) + ticks +
      (pk ? '<g transform="translate(' + pk[0].toFixed(1) + ' ' + pk[1].toFixed(1) + ') rotate(' + (90 - ang(o.peak) * 180 / Math.PI) + ')"><polygon points="-7,-9 7,-9 0,3" class="gg-peak"/></g>' : '') +
      '<g class="gg-needle" style="transform-origin:' + cx + 'px ' + cy + 'px; --deg:' + deg.toFixed(1) + 'deg" filter="url(#' + id + 's)"><polygon points="' + (cx - 5) + ',' + cy + ' ' + (cx + 5) + ',' + cy + ' ' + cx + ',' + (cy - R + 22) + '" class="gg-n"/></g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="url(#' + id + 'c)"/>' +
      '<text x="' + cx + '" y="' + (cy - 36) + '" class="gg-v">' + n0(o.q) + '</text><text x="' + cx + '" y="' + (cy - 18) + '" class="gg-u">m³/s · ' + esc(o.labels.level) + '</text>' +
      (o.peak ? '<text x="' + cx + '" y="' + (cy + 40) + '" class="gg-p">▲ ' + esc(o.labels.peak) + '</text>' : '') + '</svg>';
  }

  /* ------------------------------------------------------------ rivers in 3D */
  function map3d(o) {
    var G = root.MCKemamanGeo; if (!G) return '';
    var bb = [102.89, 4.07, 103.50, 4.46], k = Math.cos(4.26 * Math.PI / 180), W = 1000, H = Math.round(W * (bb[3] - bb[1]) / ((bb[2] - bb[0]) * k));
    var X = function (lon) { return ((lon - bb[0]) / (bb[2] - bb[0]) * W).toFixed(1); }, Y = function (lat) { return ((bb[3] - lat) / (bb[3] - bb[1]) * H).toFixed(1); };
    var path = function (p) { return p.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]) + ' ' + Y(q[1]); }).join(''); };
    var qmax = Math.max(o.main || 1, o.cherul || 1, o.up || 1, 1), wid = function (q) { return (3 + 22 * Math.sqrt(Math.max(0, q || 0) / qmax)).toFixed(1); };
    var spd = function (q) { return (3.2 - 2.4 * Math.min(1, (q || 0) / Math.max(o.t2 || qmax, 1))).toFixed(2) + 's'; };
    var cpts = []; (G.coast || []).forEach(function (c) { cpts = cpts.concat(c); }); cpts.sort(function (a, b) { return b[1] - a[1]; });
    var sea = cpts.length ? 'M' + W + ' 0L' + cpts.map(function (q) { return X(q[0]) + ' ' + Y(q[1]); }).join('L') + 'L' + W + ' ' + H + 'Z' : '';
    /* which flow each river part carries: Sg. Cherul / Sg. Mas = Cherul cell; Sg. Kemaman west of 103.31 = Air Putih cell; the rest = downstream */
    var qOf = function (r) { if (r.n === 'Sg. Cherul' || r.n === 'Sg. Mas') return o.cherul; if (r.n === 'Sg. Kemaman') return null; return null; };
    var rivers = '';
    G.rivers.forEach(function (r) {
      if (r.n === 'Sg. Kemaman') {
        var up = r.p.filter(function (q) { return q[0] <= 103.31; }), dn = r.p.filter(function (q) { return q[0] >= 103.30; });
        [[up, o.up], [dn, o.main]].forEach(function (x) { if (x[0].length > 1) { var d = path(x[0]); rivers += '<path d="' + d + '" class="m3-bed" style="stroke-width:' + (+wid(x[1]) + 6) + '"/><path d="' + d + '" class="m3-r" style="stroke-width:' + wid(x[1]) + '"/><path d="' + d + '" class="m3-flow" style="animation-duration:' + spd(x[1]) + '"/>'; } });
        return;
      }
      var qq = qOf(r), w = qq !== null && qq !== undefined ? wid(qq) : '3', d2 = path(r.p);
      rivers += '<path d="' + d2 + '" class="m3-bed" style="stroke-width:' + (+w + 5) + '"/><path d="' + d2 + '" class="m3-r' + (qq ? '' : ' thin') + '" style="stroke-width:' + w + '"/>' + (qq ? '<path d="' + d2 + '" class="m3-flow" style="animation-duration:' + spd(qq) + '"/>' : '');
    });
    var tag = function (lon, lat, name, q, cls) { var x = +X(lon), y = +Y(lat); return '<g class="m3-tag ' + (cls || '') + '" transform="translate(' + x + ' ' + y + ')"><line y2="-46" class="m3-pin"/><circle r="7" class="m3-dot"/><g transform="translate(0 -54)"><rect x="-74" y="-30" width="148" height="34" rx="9" class="m3-lab"/><text y="-17" class="m3-n">' + esc(name) + '</text><text y="-2" class="m3-q">' + n0(q) + ' m³/s</text></g></g>'; };
    return '<div class="m3-wrap"><svg class="m3-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.labels.title) + '"><defs>' +
      '<linearGradient id="m3land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f5a35"/><stop offset=".6" stop-color="#4f7a3c"/><stop offset="1" stop-color="#6d8a4a"/></linearGradient>' +
      '<linearGradient id="m3sea" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7fc1"/><stop offset="1" stop-color="#0d3a6b"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#m3land)"/>' + (sea ? '<path d="' + sea + '" fill="url(#m3sea)"/>' : '') + rivers +
      tag(103.175, 4.125, o.labels.cherul, o.cherul) + tag(103.225, 4.275, o.labels.up, o.up) + tag(103.375, 4.225, o.labels.main, o.main, 'main') +
      '<text x="' + (W - 60) + '" y="' + (H * 0.55) + '" class="m3-sea">' + esc(o.labels.sea) + '</text>' +
      '<g transform="translate(40 50)" class="m3-north"><path d="M0 -22 L9 8 L0 2 L-9 8Z"/><text y="26">U</text></g></svg></div>';
  }

  /* ------------------------------------------------------------ icons */
  var ICON = {
    drop: '<path d="M12 2.5C9 7 5.5 10.5 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.5 15 7 12 2.5z" class="i-fill"/><path d="M9 15a3 3 0 0 0 3 3" class="i-line"/>',
    peak: '<path d="M2 20l6-9 4 5 3-4 7 8z" class="i-fill"/><path d="M15 4l2 3h-4z" class="i-acc"/>',
    warn: '<path d="M12 3l10 18H2z" class="i-fill"/><path d="M12 10v5M12 18v.5" class="i-line2"/>',
    wave: '<path d="M2 15c3-3 5-3 8 0s5 3 8 0 3-2 4-2" class="i-line"/><path d="M2 10c3-3 5-3 8 0s5 3 8 0 3-2 4-2" class="i-line"/>',
    cloud: '<path d="M7 17h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 17z" class="i-fill"/><path d="M8 20l-1 2M12 20l-1 2M16 20l-1 2" class="i-line"/>'
  };
  function icon(name, cls) { return '<svg class="km-ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>'; }

  root.MCKemamanArt = { crossSection: crossSection, gauge: gauge, map3d: map3d, icon: icon };
})(window);
