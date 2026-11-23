/* Monsoon EYE - Settings › Tambah daerah (add a district): a 6-step form that asks for everything a district needs, with a real example
   (Kemaman) and a guide for each link, and checks every answer against the data itself:
     - a gauge link that is really in another district or state (the JPS table says where each gauge is; the number of a JPS gauge
       also holds its map square: 4131001 = about 4.1°N 103.1°E), a rain link in the water level step, a gauge with no recent reading
     - a MET code of another district, coordinates outside the state, a GloFAS cell with no river
   The district becomes a new profile (land) with its own river layout; its pages (Sungai / Hujan / Aliran) read JPS through the relay,
   or from the GitHub copy when the district is added to mirror/districts.json (the form gives the text). */
(function () {
  'use strict';
  var MC = window.MC, C = window.MCCore, ED = window.EDITION || {}, I18N = window.MCI18n;
  if (!MC || ED.kind === 'offshore' || !document.getElementById('distBody')) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = MC.esc, f = MC.f, state = MC.state;
  var T = function (bm, en) { return I18N.lang() === 'en' ? en : bm; };
  var HOUR = 3600000, DAY = 86400000;
  var STATES = { PLS: ['Perlis', 6.45, 100.2, 60], KDH: ['Kedah', 5.9, 100.6, 120], PNG: ['Pulau Pinang', 5.35, 100.4, 50], PRK: ['Perak', 4.6, 101.1, 170], SEL: ['Selangor', 3.3, 101.5, 110],
    WLH: ['WP Kuala Lumpur', 3.14, 101.69, 30], PTJ: ['WP Putrajaya', 2.93, 101.69, 25], NSN: ['Negeri Sembilan', 2.75, 102.15, 100], MLK: ['Melaka', 2.25, 102.3, 50], JHR: ['Johor', 2.0, 103.3, 180],
    PHG: ['Pahang', 3.75, 102.6, 200], TRG: ['Terengganu', 4.95, 103.0, 150], KEL: ['Kelantan', 5.3, 102.0, 150], SRK: ['Sarawak', 2.5, 113.0, 450], SAB: ['Sabah', 5.3, 117.0, 330], WLP: ['WP Labuan', 5.3, 115.22, 30] };
  /* the real example shown next to every field */
  var EX = { name: 'Kemaman', state: 'TRG', town: 'Chukai', lat: 4.2324, lon: 103.4229, met: 'Ds065', wl: 'https://publicinfobanjir.water.gov.my/index.php/wl-graph/?stationid=4131001_',
    wl2: '27192 (Sg. Kemaman di Jamb. Air Putih F2)', rf: 'https://publicinfobanjir.water.gov.my/index.php/rf-graph/?stationid=4232002_', river: '4.225, 103.375' };
  var STEPS = [T('Lokasi', 'Location'), T('MET & amaran', 'MET & warnings'), T('Stesen paras air', 'Water level gauges'), T('Stesen hujan', 'Rain gauges'), T('Susunan sungai', 'River layout'), T('Semak & simpan', 'Check & save')];
  var D = null, step = 0, tables = {}, busy = false;

  function blank() { return { id: '', name: '', state: 'TRG', town: '', lat: '', lon: '', met: '', metName: '', keywords: '', coastal: true, wlText: '', rfText: '', water: [], rain: [], order: [], river: null, riverName: '', mirror: false, msgs: {} }; }
  function num(v) { var x = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; }
  function km(a, b) { var dx = (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180), dy = a[0] - b[0]; return Math.sqrt(dx * dx + dy * dy) * 111; }
  /* JPS gauge number -> map square (Peninsula: 4131001 = 4.1x N, 103.1x E) */
  function gridOf(gid) {
    var m = /^(\d)(\d)(\d)(\d)\d{3}/.exec(String(gid || ''));
    if (!m) return null;
    var lat = +(m[1] + '.' + m[2]) + 0.05, lon = 100 + +(m[3] + '.' + m[4]) + 0.05;
    return lat >= 1.2 && lat <= 6.8 && lon >= 99.6 && lon <= 104.6 ? [lat, lon] : null;
  }
  /* "…/wl-graph/?stationid=4131001_", "4131001_" or "27192" -> { gid, kind } */
  function parseLinks(text) {
    return String(text || '').split(/[\n,;]+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = /stationid=([A-Za-z0-9_-]+)/i.exec(l), kind = /rf-graph|rainfall|hujan/i.test(l) ? 'rf' : /wl-graph|aras-air|water/i.test(l) ? 'wl' : null;
      var gid = m ? m[1] : /^[A-Za-z0-9_-]{3,20}$/.test(l.split(/\s/)[0]) ? l.split(/\s/)[0] : null;
      return { raw: l, gid: gid, kind: kind };
    });
  }

  /* ------------------------------------------------------------ JPS tables: GitHub copy (states in districts.json) or the relay */
  function relayOk() { return C.relayReady(state.settings); }
  function stateTable(st) {
    if (tables[st]) return Promise.resolve(tables[st]);
    var mirror = MC.fetchT(MC.MIRROR + 'jps-' + st + '.json?m=' + Math.floor(Date.now() / 600000), 20000).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (!j.water || !j.water.length) throw new Error('empty'); return { water: j.water, rain: (j.rain && j.rain.stations) || [], src: 'mirror', at: j.waterAt }; });
    var live = function () {
      if (!relayOk()) throw new Error(T('negeri ini belum ada salinan GitHub dan relay belum dipasang', 'this state has no GitHub copy and the relay is not set up'));
      var s2 = Object.assign({}, state.settings, { jpsState: st, scrapeInfobanjir: true, waterDistrict: 'x' }), u = C.jpsUrls(s2);
      var get = function (url) { return MC.fetchT(C.relayUrlFor(url, state.settings), 45000).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }); };
      return Promise.all([get(u.jpsWater), get(u.jpsRain).catch(function () { return ''; })]).then(function (x) {
        var w = window.MCParse.jpsWater(x[0]), r = x[1] ? window.MCParse.jpsRain(x[1]) : { stations: [] };
        if (!w.length) throw new Error(T('jadual JPS kosong', 'JPS table empty'));
        return { water: w, rain: r.stations || [], src: 'relay', at: new Date().toISOString() };
      });
    };
    return mirror.catch(live).then(function (t) { tables[st] = t; return t; });
  }
  function findEverywhere(gid, kind) {
    /* look in the other states too (only those already read, plus a live read of all through the relay when it is set up) */
    var hit = null;
    Object.keys(tables).forEach(function (st) { var t = tables[st]; ((kind === 'rf' ? t.rain : t.water) || []).forEach(function (x) { if (!hit && x.gid === gid) hit = { st: st, x: x }; }); });
    if (hit || !relayOk()) return Promise.resolve(hit);
    var todo = Object.keys(STATES).filter(function (st) { return !tables[st]; });
    return todo.reduce(function (p, st) { return p.then(function (h) { if (h) return h; return stateTable(st).then(function (t) { var x = ((kind === 'rf' ? t.rain : t.water) || []).filter(function (y) { return y.gid === gid; })[0]; return x ? { st: st, x: x } : null; }, function () { return null; }); }); }, Promise.resolve(null));
  }
  function districtsOf(st) { var t = tables[st]; if (!t) return []; var o = {}; (t.water || []).concat(t.rain || []).forEach(function (x) { if (x.district) o[x.district] = 1; }); return Object.keys(o).sort(); }

  /* ------------------------------------------------------------ checks */
  function M(kind, text) { return { k: kind, t: text }; }
  function checkLocation() {
    var out = [], lat = num(D.lat), lon = num(D.lon), S = STATES[D.state];
    if (!D.name) out.push(M('bad', T('Isi nama daerah (sama seperti dalam jadual JPS).', 'Fill in the district name (as in the JPS table).')));
    if (lat === null || lon === null) out.push(M('bad', T('Isi koordinat bandar (latitud, longitud).', 'Fill in the town coordinates (latitude, longitude).')));
    else if (lat < 0.8 || lat > 7.5 || lon < 99.5 || lon > 119.5) out.push(M('bad', T('Koordinat di luar Malaysia — semak susunan latitud / longitud.', 'Coordinates are outside Malaysia — check latitude / longitude order.')));
    else if (S && km([lat, lon], [S[1], S[2]]) > S[3] * 1.4) out.push(M('warn', T('Koordinat ini jauh dari negeri {s} ({k} km dari tengah negeri). Betul negeri?', 'These coordinates are far from {s} ({k} km from its centre). Right state?').replace('{s}', S[0]).replace('{k}', Math.round(km([lat, lon], [S[1], S[2]])))));
    else out.push(M('ok', T('Koordinat dalam {s} ✓', 'Coordinates inside {s} ✓').replace('{s}', S ? S[0] : D.state)));
    var dl = districtsOf(D.state);
    if (dl.length && D.name && dl.map(function (x) { return x.toLowerCase(); }).indexOf(D.name.toLowerCase()) < 0) out.push(M('warn', T('"{d}" tiada dalam jadual JPS {s}. Nama daerah JPS: {l}', '"{d}" is not in the JPS table of {s}. JPS district names: {l}').replace('{d}', D.name).replace('{s}', D.state).replace('{l}', dl.join(', '))));
    else if (dl.length && D.name) out.push(M('ok', T('Daerah "{d}" ada dalam jadual JPS ✓', 'District "{d}" is in the JPS table ✓').replace('{d}', D.name)));
    if (state.profiles.profiles.some(function (p) { return p.name.toLowerCase() === String(D.name).toLowerCase() && p.id !== D.id; })) out.push(M('warn', T('Profil dengan nama ini sudah ada.', 'A profile with this name already exists.')));
    return out;
  }
  function checkGauges(kind) {
    var list = kind === 'wl' ? D.water : D.rain, out = [], lat = num(D.lat), lon = num(D.lon);
    if (!list.length) out.push(M(kind === 'wl' ? 'bad' : 'warn', kind === 'wl' ? T('Tiada stesen paras air lagi.', 'No water level gauge yet.') : T('Tiada stesen hujan (boleh langkau, tapi halaman Hujan akan kosong).', 'No rain gauge (you may skip, but the Rain page will be empty).')));
    var okN = 0;
    list.forEach(function (g) { var bad = (g.msgs || []).filter(function (m) { return m.k !== 'ok'; }); if (!bad.length) okN++; bad.forEach(function (m) { out.push(M(m.k, '<b>' + esc(g.name || g.gid) + '</b>: ' + m.t)); }); });
    if (okN) out.unshift(M('ok', T('{n} stesen {k} disahkan dalam jadual JPS {d} ✓', '{n} {k} gauges confirmed in the JPS table of {d} ✓').replace('{n}', okN).replace('{k}', kind === 'wl' ? T('paras air', 'water level') : T('hujan', 'rain')).replace('{d}', esc(D.name))));
    if (lat !== null) list.forEach(function (g) { if (num(g.lat) !== null && km([lat, lon], [+g.lat, +g.lon]) > 90) out.push(M('warn', '<b>' + esc(g.name) + '</b>: ' + T('{k} km dari bandar — betul stesen ini?', '{k} km from the town — is this the right gauge?').replace('{k}', Math.round(km([lat, lon], [+g.lat, +g.lon]))))); });
    return out;
  }
  /* one gauge: find it in the JPS table of the chosen state, else elsewhere; compare district, kind, freshness, map square */
  function checkOne(p, kind) {
    var g = { gid: p.gid, kind: kind, name: '', msgs: [] };
    if (!p.gid) { g.msgs.push(M('bad', T('Bukan pautan stesen JPS ("…?stationid=…").', 'Not a JPS gauge link ("…?stationid=…").'))); g.name = p.raw.slice(0, 40); return Promise.resolve(g); }
    if (p.kind && p.kind !== kind) g.msgs.push(M('warn', kind === 'wl' ? T('Ini pautan HUJAN (rf-graph). Langkah ini untuk paras air (wl-graph).', 'This is a RAIN link (rf-graph). This step is for water level (wl-graph).') : T('Ini pautan PARAS AIR (wl-graph). Langkah ini untuk hujan (rf-graph).', 'This is a WATER LEVEL link (wl-graph). This step is for rain (rf-graph).')));
    return stateTable(D.state).catch(function () { return null; }).then(function (t) {
      var x = t ? ((kind === 'wl' ? t.water : t.rain) || []).filter(function (y) { return y.gid === p.gid; })[0] : null;
      if (x) return { st: D.state, x: x };
      return findEverywhere(p.gid, kind);
    }).then(function (hit) {
      if (!hit) {
        g.name = p.gid;
        g.msgs.push(M('warn', T('Tidak dijumpai dalam jadual JPS {s}. Semak pautan, atau stesen ini di negeri lain.', 'Not found in the JPS table of {s}. Check the link, or this gauge is in another state.').replace('{s}', D.state)));
      } else {
        var x = hit.x; g.name = x.name; g.district = x.district; g.basin = x.basin || '';
        if (kind === 'wl') { g.normal = x.normal; g.alert = x.alert; g.warning = x.warning; g.danger = x.danger; g.level = x.level; }
        g.updated = x.updated;
        if (hit.st !== D.state) g.msgs.push(M('bad', T('Stesen ini di {d}, {s} — bukan {n}, {m}. Pautan salah?', 'This gauge is in {d}, {s} — not {n}, {m}. Wrong link?').replace('{d}', x.district || '?').replace('{s}', STATES[hit.st] ? STATES[hit.st][0] : hit.st).replace('{n}', D.name).replace('{m}', STATES[D.state] ? STATES[D.state][0] : D.state)));
        else if (x.district && D.name && String(x.district).toLowerCase() !== String(D.name).toLowerCase()) g.msgs.push(M('warn', T('Stesen ini dalam daerah {d}, bukan {n} (negeri sama). Sengaja? (cth stesen hulu di daerah jiran)', 'This gauge is in {d} district, not {n} (same state). On purpose? (e.g. an upstream gauge in the next district)').replace('{d}', x.district).replace('{n}', D.name)));
        else g.msgs.push(M('ok', T('Dijumpai dalam jadual JPS {d} ✓', 'Found in the JPS table, {d} ✓').replace('{d}', x.district || D.state)));
        var t2 = Date.parse(x.updated || '');
        if (isFinite(t2) && Date.now() - t2 > DAY) g.msgs.push(M('warn', T('Bacaan terakhir {a} — stesen mungkin tidak aktif.', 'Last reading {a} — the gauge may be out of service.').replace('{a}', C.timeAgo(t2))));
        if (kind === 'wl' && (x.danger === null || x.danger === undefined)) g.msgs.push(M('warn', T('JPS tiada ambang Bahaya untuk stesen ini — isi sendiri di bawah.', 'JPS has no Danger level for this gauge — fill it in below.')));
      }
      /* the number's map square: a hint only (not every JPS number follows it), used when the table could not place the gauge */
      var gr = gridOf(p.gid), lat = num(D.lat), lon = num(D.lon), far = gr && lat !== null ? km([lat, lon], gr) : null, sure = hit && hit.st === D.state;
      if (gr && (!sure || far <= 70)) { g.lat = gr[0]; g.lon = gr[1]; g.src = 'grid'; }
      else if (lat !== null) { g.lat = lat; g.lon = lon; g.src = 'town'; }
      if (!hit && far !== null && far > 90) g.msgs.push(M('bad', T('Nombor stesen menunjukkan kedudukan ~{a}°U {b}°T, {k} km dari {n}. Pautan salah?', 'The gauge number points to ~{a}°N {b}°E, {k} km from {n}. Wrong link?').replace('{a}', gr[0].toFixed(1)).replace('{b}', gr[1].toFixed(1)).replace('{k}', Math.round(far)).replace('{n}', D.name)));
      return g;
    });
  }
  function readGauges(kind) {
    var list = parseLinks(kind === 'wl' ? D.wlText : D.rfText), seen = {};
    list = list.filter(function (p) { if (!p.gid) return true; if (seen[p.gid]) return false; seen[p.gid] = 1; return true; });
    busy = true; render();
    var prev = {}; (kind === 'wl' ? D.water : D.rain).forEach(function (g) { prev[g.gid] = g; });
    return Promise.all(list.map(function (p) { return checkOne(p, kind); })).then(function (gs) {
      gs.forEach(function (g) { var o = prev[g.gid]; if (o && o.edited) ['normal', 'alert', 'warning', 'danger', 'lat', 'lon', 'villages', 'tidal'].forEach(function (k) { if (o[k] !== undefined) g[k] = o[k]; }); });
      if (kind === 'wl') { D.water = gs; D.order = gs.map(function (g) { return g.gid; }); } else D.rain = gs;
    }).catch(function (e) { MC.toast(T('Tidak dapat semak', 'Could not check'), e.message, 'warning'); }).then(function () { busy = false; render(); });
  }
  function autoFind(kind) {
    busy = true; render();
    stateTable(D.state).then(function (t) {
      var list = ((kind === 'wl' ? t.water : t.rain) || []).filter(function (x) { return x.gid && String(x.district).toLowerCase() === String(D.name).toLowerCase(); });
      if (!list.length) throw new Error(T('Tiada stesen daerah "{d}" dalam jadual JPS {s}. Semak nama daerah (langkah 1).', 'No gauge of "{d}" in the JPS table of {s}. Check the district name (step 1).').replace('{d}', D.name).replace('{s}', D.state));
      var txt = list.map(function (x) { return 'https://publicinfobanjir.water.gov.my/index.php/' + (kind === 'wl' ? 'wl' : 'rf') + '-graph/?stationid=' + x.gid + '   ' + x.name; }).join('\n');
      if (kind === 'wl') D.wlText = txt; else D.rfText = txt;
      busy = false;
      return readGauges(kind);
    }).catch(function (e) { busy = false; MC.toast(T('Cari sendiri gagal', 'Auto-find failed'), e.message, 'warning'); render(); });
  }
  function checkMet() {
    var code = String(D.met || '').trim();
    if (!code) { D.msgs.met = [M('warn', T('Tiada kod MET — ramalan MET harian tidak dipapar (amaran tetap dibaca ikut kata kunci).', 'No MET code — no daily MET forecast (warnings still read by keywords).'))]; render(); return; }
    if (!/^Ds\d{3}$/i.test(code)) { D.msgs.met = [M('bad', T('Kod MET daerah berbentuk Ds + 3 nombor (cth Ds065).', 'A MET district code is Ds + 3 digits (e.g. Ds065).'))]; render(); return; }
    MC.fetchT('https://api.data.gov.my/weather/forecast?contains=' + encodeURIComponent(code) + '@location__location_id&limit=1', 20000).then(function (r) { return r.json(); }).then(function (j) {
      var x = Array.isArray(j) ? j[0] : null, nm = x && x.location ? x.location.location_name : '';
      if (!nm) D.msgs.met = [M('bad', T('Kod {c} tidak dijumpai di data.gov.my.', 'Code {c} not found on data.gov.my.').replace('{c}', code))];
      else if (D.name && nm.toLowerCase().indexOf(D.name.toLowerCase()) < 0 && D.name.toLowerCase().indexOf(nm.toLowerCase()) < 0) D.msgs.met = [M('bad', T('Kod {c} ialah "{n}", bukan {d}. Kod salah?', 'Code {c} is "{n}", not {d}. Wrong code?').replace('{c}', code).replace('{n}', nm).replace('{d}', D.name))];
      else D.msgs.met = [M('ok', T('Kod {c} = {n} ✓', 'Code {c} = {n} ✓').replace('{c}', code).replace('{n}', nm))];
      D.metName = nm;
    }).catch(function (e) { D.msgs.met = [M('warn', T('Tidak dapat semak kod sekarang: ', 'Could not check the code now: ') + esc(e.message))]; }).then(render);
  }
  function findMet() {
    if (!D.name) return;
    MC.fetchT('https://api.data.gov.my/weather/forecast?contains=' + encodeURIComponent(D.name) + '@location__location_name&limit=20', 20000).then(function (r) { return r.json(); }).then(function (j) {
      var ds = (Array.isArray(j) ? j : []).map(function (x) { return x.location; }).filter(function (l) { return l && /^Ds/.test(l.location_id); });
      if (!ds.length) { D.msgs.met = [M('warn', T('Tiada kod daerah MET untuk "{d}". Cari di met.gov.my (lihat panduan).', 'No MET district code for "{d}". Look it up on met.gov.my (see the guide).').replace('{d}', D.name))]; render(); return; }
      D.met = ds[0].location_id; checkMet();
    }).catch(function (e) { D.msgs.met = [M('warn', esc(e.message))]; render(); });
  }
  /* GloFAS: the 9 cells around a point (0.05° grid); the one with the most water is the main river */
  function findRiver() {
    var last = D.order.length ? D.water.filter(function (g) { return g.gid === D.order[D.order.length - 1]; })[0] : null;
    var c = last && num(last.lat) !== null ? [+last.lat, +last.lon] : [num(D.lat), num(D.lon)];
    if (c[0] === null) return;
    var la = [], lo = [];
    [-1, 0, 1].forEach(function (i) { [-1, 0, 1].forEach(function (j) { la.push((Math.round(c[0] / 0.05) * 0.05 + i * 0.05).toFixed(3)); lo.push((Math.round(c[1] / 0.05) * 0.05 + j * 0.05).toFixed(3)); }); });
    D.msgs.river = [M('info', T('Mencari sel sungai GloFAS…', 'Looking for the GloFAS river cell…'))]; render();
    MC.OM.json('https://flood-api.open-meteo.com/v1/flood?latitude=' + la.join(',') + '&longitude=' + lo.join(',') + '&daily=river_discharge&past_days=60&forecast_days=1', 45000).then(function (j) {
      var arr = Array.isArray(j) ? j : [j], best = null;
      arr.forEach(function (x, i) { var v = ((x.daily && x.daily.river_discharge) || []).filter(function (y) { return y !== null; }); if (!v.length) return; var m = v.reduce(function (a, b) { return a + b; }, 0) / v.length; if (!best || m > best.m) best = { m: m, lat: +la[i], lon: +lo[i] }; });
      if (!best || best.m < 1) { D.msgs.river = [M('warn', T('Tiada sungai besar dalam sel GloFAS sekitar. Isi titik sungai sendiri atau biarkan (halaman Aliran akan guna titik ini).', 'No big river in the GloFAS cells around. Fill in a river point yourself or leave it (the Flow page will use this point).'))]; D.river = { lat: c[0], lon: c[1] }; }
      else { D.river = { lat: best.lat, lon: best.lon }; D.msgs.river = [M('ok', T('Sel sungai {a}, {b} — purata 60 hari {m} m³/s ✓', 'River cell {a}, {b} — 60-day mean {m} m³/s ✓').replace('{a}', best.lat.toFixed(3)).replace('{b}', best.lon.toFixed(3)).replace('{m}', f(best.m, 0)))]; }
    }).catch(function (e) { D.msgs.river = [M('warn', T('GloFAS tidak menjawab: ', 'GloFAS did not answer: ') + esc(e.message))]; }).then(render);
  }

  /* ------------------------------------------------------------ the river layout text ("Station < upstream, ... | villages"), like Kemaman */
  function shortName(n) { n = String(n || ''); var m = /^(?:Muara )?Sg\. [^ ]+(?: [^ ]+)? di (.+)$/.exec(n); var s = (m ? m[1] : n).replace(/^(Kg\.|Jamb\.|Jambatan|Rumah Pam|Kuarters?|Kuala) /i, '').replace(/\s*\((F\d|F2)\)\s*$/i, ''); return s.trim() || n; }
  function layoutText() {
    var byGid = {}; D.water.forEach(function (g) { byGid[g.gid] = g; });
    var into = {}; D.water.forEach(function (g) { if (g.into) into[g.gid] = g.into; });
    var ups = function (gid) { var out = [], q = [gid]; while (q.length) { var x = q.shift(); Object.keys(into).forEach(function (k) { if (into[k] === x && out.indexOf(k) < 0) { out.push(k); q.push(k); } }); } return out; };
    return D.order.map(function (gid) {
      var g = byGid[gid]; if (!g) return '';
      var u = ups(gid).map(function (k) { return byGid[k] ? shortName(byGid[k].name) : ''; }).filter(Boolean);
      return (g.tidal ? '~' : '') + shortName(g.name) + (u.length ? ' < ' + u.join(', ') : '') + (g.villages ? ' | ' + String(g.villages).replace(/\s*\n\s*/g, ', ') : '');
    }).filter(Boolean).join('\n');
  }
  function mirrorText() { return JSON.stringify({ id: idOf(), state: D.state, district: D.name, gids: D.water.concat(D.rain).map(function (g) { return g.gid; }).filter(Boolean) }); }
  function idOf() { return D.id || String(D.name || 'daerah').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'daerah'; }

  /* ------------------------------------------------------------ drawing */
  function msgs(list) { return list && list.length ? '<div class="dz-msg">' + list.map(function (m) { return '<div class="dz-m ' + m.k + '">' + (m.k === 'ok' ? '✅ ' : m.k === 'bad' ? '⛔ ' : m.k === 'warn' ? '⚠️ ' : 'ℹ️ ') + m.t + '</div>'; }).join('') + '</div>' : ''; }
  function fld(label, html, ex) { return '<div class="dz-f"><label>' + label + '</label>' + html + (ex ? '<div class="dz-ex">' + ex + '</div>' : '') + '</div>'; }
  function inp(k, ph, mode) { return '<input class="inp" data-dz="' + k + '" value="' + esc(D[k] === null || D[k] === undefined ? '' : D[k]) + '" placeholder="' + esc(ph || '') + '"' + (mode ? ' inputmode="' + mode + '"' : '') + '>'; }
  function code(x) { return '<code>' + esc(x) + '</code>'; }
  function render() {
    var host = $('distBody');
    if (!host) return;
    if (!D) {
      var added = state.profiles.profiles.filter(function (p) { return p.district; });
      host.innerHTML = '<p class="muted">' + T('Tambah daerah lain (cth Dungun, Kuantan, Kota Bharu) dengan stesen JPS sendiri. App minta semua data yang perlu satu langkah demi satu, beri contoh sebenar (Kemaman), dan semak jika pautan salah (cth stesen Selangor untuk Dungun).', 'Add another district (e.g. Dungun, Kuantan, Kota Bharu) with its own JPS gauges. The app asks for everything step by step, shows a real example (Kemaman), and checks for wrong links (e.g. a Selangor gauge for Dungun).') + '</p>' +
        (added.length ? '<div class="mj-list">' + added.map(function (p) { var d = {}; try { d = JSON.parse(p.district); } catch (e) { /* */ } return '<div class="mj-row"><span>🏘️</span><b>' + esc(p.name) + '<br><small>' + esc((d.water || []).length + T(' stesen paras air · ', ' water gauges · ') + (d.rain || []).length + T(' stesen hujan', ' rain gauges') + (d.mirror ? T(' · salinan GitHub', ' · GitHub copy') : T(' · terus melalui relay', ' · live through the relay'))) + '</small></b><button type="button" class="btn sm" data-dz-edit="' + esc(p.id) + '">' + T('Ubah', 'Edit') + '</button></div>'; }).join('') + '</div>' : '') +
        '<button type="button" class="btn pri" id="dzStart">➕ ' + T('Tambah daerah', 'Add a district') + '</button>';
      $('dzStart').onclick = function () { D = blank(); step = 0; render(); };
      return;
    }
    var h = '<div class="dz-steps">' + STEPS.map(function (s, i) { return '<button type="button" class="dz-step' + (i < step ? ' done' : '') + '" data-dz-step="' + i + '" aria-current="' + (i === step) + '"><b>' + (i + 1) + (i < step ? ' ✓' : '') + '</b>' + esc(s) + '</button>'; }).join('') + '</div>';
    if (step === 0) {
      h += '<div class="dz-guide">' + T('Nama daerah mesti sama seperti dalam jadual JPS (Public Infobanjir). Pilih negeri dahulu, kemudian tekan <b>Muat nama daerah JPS</b> untuk senarai yang betul.', 'The district name must be as in the JPS table (Public Infobanjir). Pick the state first, then tap <b>Load JPS district names</b> for the right list.') + '</div><div class="dz-grid">' +
        fld(T('Negeri', 'State'), '<select class="sel" data-dz="state">' + Object.keys(STATES).map(function (k) { return '<option value="' + k + '"' + (D.state === k ? ' selected' : '') + '>' + STATES[k][0] + ' (' + k + ')</option>'; }).join('') + '</select>', T('Contoh: ', 'Example: ') + 'Terengganu (TRG)') +
        fld(T('Nama daerah (JPS)', 'District name (JPS)'), (districtsOf(D.state).length ? '<select class="sel" data-dz="name"><option value="">—</option>' + districtsOf(D.state).map(function (x) { return '<option' + (x === D.name ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' : inp('name', 'Dungun')) +
          '<button type="button" class="btn sm" id="dzLoadD" style="margin-top:6px">' + T('Muat nama daerah JPS', 'Load JPS district names') + '</button>', T('Contoh: ', 'Example: ') + code(EX.name)) +
        fld(T('Bandar utama', 'Main town'), inp('town', 'Kuala Dungun'), T('Contoh: ', 'Example: ') + code(EX.town) + T(' — untuk tajuk & peta', ' — for titles & the map')) +
        fld(T('Latitud bandar', 'Town latitude'), inp('lat', '4.776', 'decimal'), T('Contoh: ', 'Example: ') + code(EX.lat) + T('. Dari Google Maps: tekan lama pada bandar → salin nombor pertama.', '. From Google Maps: long-press the town → copy the first number.')) +
        fld(T('Longitud bandar', 'Town longitude'), inp('lon', '103.415', 'decimal'), T('Contoh: ', 'Example: ') + code(EX.lon) + T(' (nombor kedua)', ' (the second number)')) +
        fld(T('Tepi laut?', 'By the sea?'), '<select class="sel" data-dz="coastal"><option value="1"' + (D.coastal ? ' selected' : '') + '>' + T('Ya — kira risiko pantai (air pasang, ombak)', 'Yes — count coastal risk (tide, waves)') + '</option><option value="0"' + (!D.coastal ? ' selected' : '') + '>' + T('Tidak', 'No') + '</option></select>') +
        '</div>' + msgs(D.msgs.loc);
    } else if (step === 1) {
      h += '<div class="dz-guide">' + T('Kod MET untuk ramalan harian daerah. Tekan <b>Cari kod</b> (app cari ikut nama daerah), atau buka <b>met.gov.my › Ramalan › Daerah</b>, pilih daerah — kod ada di hujung alamat (cth ', 'MET code for the district\'s daily forecast. Tap <b>Find code</b> (the app searches by district name), or open <b>met.gov.my › Forecast › District</b>, pick the district — the code is at the end of the address (e.g. ') + code('…/district/Ds065/') + ').</div><div class="dz-grid">' +
        fld(T('Kod lokasi MET', 'MET location code'), inp('met', 'Ds0xx') + '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn sm" id="dzFindMet">🔎 ' + T('Cari kod', 'Find code') + '</button><button type="button" class="btn sm" id="dzCheckMet">' + T('Semak kod', 'Check code') + '</button></div>', T('Contoh: ', 'Example: ') + code(EX.met) + ' = Kemaman') +
        fld(T('Kata kunci amaran MET', 'MET warning keywords'), inp('keywords', STATES[D.state][0] + ', ' + (D.name || '')), T('Contoh: ', 'Example: ') + code('Terengganu, Kemaman') + T(' — amaran yang menyebut mana-mana perkataan ini dipapar', ' — warnings naming any of these are shown')) +
        '</div>' + msgs(D.msgs.met);
    } else if (step === 2 || step === 3) {
      var kind = step === 2 ? 'wl' : 'rf', list = kind === 'wl' ? D.water : D.rain;
      h += '<div class="dz-guide">' + (kind === 'wl' ? T('Cara dapat pautan stesen paras air:', 'How to get a water level gauge link:') : T('Cara dapat pautan stesen hujan:', 'How to get a rain gauge link:')) + '<ol>' +
        '<li>' + T('Buka <b>publicinfobanjir.water.gov.my</b> › ', 'Open <b>publicinfobanjir.water.gov.my</b> › ') + (kind === 'wl' ? T('Aras Air', 'Water Level') : T('Hujan', 'Rainfall')) + ' › ' + T('pilih negeri', 'pick the state') + '.</li>' +
        '<li>' + T('Tekan nombor / graf stesen dalam jadual → laman graf dibuka.', 'Tap the gauge\'s value / graph in the table → its graph page opens.') + '</li>' +
        '<li>' + T('Salin alamat laman itu dan tampal di bawah, satu baris satu stesen. Nombor stesen sahaja pun boleh.', 'Copy that page\'s address and paste it below, one gauge per line. The gauge number alone works too.') + '</li></ol>' +
        T('Contoh: ', 'Example: ') + code(kind === 'wl' ? EX.wl : EX.rf) + (kind === 'wl' ? ' · ' + code(EX.wl2) : '') + '<br>' + T('Atau tekan <b>Cari sendiri</b>: app baca jadual JPS negeri ini dan ambil semua stesen daerah {d}.', 'Or tap <b>Auto-find</b>: the app reads the JPS table of this state and takes every gauge of {d}.').replace('{d}', '<b>' + esc(D.name || '?') + '</b>') + '</div>' +
        '<div class="dz-f"><label>' + T('Pautan / nombor stesen', 'Gauge links / numbers') + '</label><textarea class="inp" data-dz="' + (kind === 'wl' ? 'wlText' : 'rfText') + '" rows="5" spellcheck="false" placeholder="' + esc(kind === 'wl' ? EX.wl : EX.rf) + '">' + esc(kind === 'wl' ? D.wlText : D.rfText) + '</textarea></div>' +
        '<div class="dz-nav" style="justify-content:flex-start"><button type="button" class="btn pri" data-dz-auto="' + kind + '"' + (busy ? ' disabled' : '') + '>🔎 ' + T('Cari sendiri dari jadual JPS', 'Auto-find from the JPS table') + '</button><button type="button" class="btn" data-dz-read="' + kind + '"' + (busy ? ' disabled' : '') + '>' + T('Semak pautan', 'Check links') + '</button>' + (busy ? '<span class="muted">' + T('Membaca JPS…', 'Reading JPS…') + '</span>' : '') + '</div>' +
        (list.length ? '<div class="oc-scroll"><table class="tbl dz-tbl"><thead><tr><th>' + T('Stesen', 'Gauge') + '</th><th>ID</th>' + (kind === 'wl' ? '<th>Normal</th><th>' + T('Waspada', 'Alert') + '</th><th>' + T('Amaran', 'Warning') + '</th><th>' + T('Bahaya', 'Danger') + '</th>' : '') + '<th>' + T('Lat', 'Lat') + '</th><th>' + T('Lon', 'Lon') + '</th><th></th></tr></thead><tbody>' +
          list.map(function (g, i) {
            var bad = (g.msgs || []).some(function (m) { return m.k === 'bad'; }), warn = (g.msgs || []).some(function (m) { return m.k === 'warn'; });
            var n = function (k) { return '<td><input class="inp" inputmode="decimal" data-dzg="' + kind + ':' + i + ':' + k + '" value="' + esc(g[k] === null || g[k] === undefined ? '' : g[k]) + '"></td>'; };
            return '<tr><td class="nm">' + esc(g.name) + (g.district ? '<br><small class="muted">' + esc(g.district) + '</small>' : '') + '</td><td class="mono">' + esc(g.gid || '-') + '</td>' + (kind === 'wl' ? n('normal') + n('alert') + n('warning') + n('danger') : '') + n('lat') + n('lon') +
              '<td class="st">' + (bad ? '⛔' : warn ? '⚠️' : '✅') + ' <button type="button" class="btn sm warn" data-dzdel="' + kind + ':' + i + '">✕</button></td></tr>';
          }).join('') + '</tbody></table></div><p class="note">' + T('Ambang dari JPS (boleh ubah). Lat / Lon: dari nombor stesen (anggaran ±5 km) atau bandar — betulkan jika tahu kedudukan sebenar.', 'Levels from JPS (you may change them). Lat / Lon: from the gauge number (±5 km) or the town — correct them if you know the real place.') + '</p>' : '') +
        msgs(checkGauges(kind));
    } else if (step === 4) {
      var byGid = {}; D.water.forEach(function (g) { byGid[g.gid] = g; });
      if (!D.order.length) D.order = D.water.map(function (g) { return g.gid; });
      h += '<div class="dz-guide">' + T('Susun stesen dari <b>hulu (atas)</b> ke <b>hilir / laut (bawah)</b> dengan ▲▼. Untuk setiap stesen pilih sungai itu <b>mengalir ke</b> stesen mana, tanda <b>~</b> jika dekat laut (pasang surut), dan tulis kampung yang terjejas. App guna ini untuk amaran awal (hulu naik → hilir).', 'Order the gauges from <b>upstream (top)</b> to <b>downstream / the sea (bottom)</b> with ▲▼. For each gauge pick which gauge the river <b>flows into</b>, tick <b>~</b> if it is near the sea (tidal), and type the villages at risk. The app uses this for early warnings (upstream rising → downstream).') +
        '<br>' + T('Contoh Kemaman: ', 'Kemaman example: ') + code('Ban Ho < Sg. Mas') + ' · ' + code('~Geliga < Paya Paman, Yak Yah | Bandar Chukai, Kg. Geliga') + '</div><div class="dz-river">' +
        D.order.map(function (gid, i) {
          var g = byGid[gid]; if (!g) return '';
          var opts = '<option value="">' + T('— laut / tiada —', '— the sea / none —') + '</option>' + D.order.filter(function (x) { return x !== gid; }).map(function (x) { return '<option value="' + esc(x) + '"' + (g.into === x ? ' selected' : '') + '>' + esc(shortName(byGid[x] ? byGid[x].name : x)) + '</option>'; }).join('');
          return '<div class="dz-rrow"><span class="h"><button type="button" class="btn sm" data-dzmv="' + i + ':-1"' + (i ? '' : ' disabled') + '>▲</button><button type="button" class="btn sm" data-dzmv="' + i + ':1"' + (i < D.order.length - 1 ? '' : ' disabled') + '>▼</button></span>' +
            '<div><b>' + esc(shortName(g.name)) + '</b><br><small>' + esc(g.name) + '</small></div>' +
            '<div><small>' + T('Mengalir ke', 'Flows into') + '</small><select class="sel" data-dzr="' + esc(gid) + ':into">' + opts + '</select></div>' +
            '<div><small>' + T('Kampung terjejas', 'Villages at risk') + '</small><input class="inp" data-dzr="' + esc(gid) + ':villages" value="' + esc(g.villages || '') + '" placeholder="Kg. A, Kg. B"></div>' +
            '<label title="' + esc(T('Dekat laut (pasang surut)', 'Near the sea (tidal)')) + '"><input type="checkbox" data-dzr="' + esc(gid) + ':tidal"' + (g.tidal ? ' checked' : '') + '> ~</label></div>';
        }).join('') + '</div><div class="dz-f" style="margin-top:12px"><label>' + T('Susunan sungai (dijana — sama format dengan Tetapan › Susunan sungai)', 'River layout (made by the app — same format as Settings › River layout)') + '</label><textarea class="inp" rows="5" readonly>' + esc(layoutText()) + '</textarea></div>';
    } else {
      var all = checkLocation().concat(D.msgs.met || [], checkGauges('wl'), checkGauges('rf'), D.msgs.river || []);
      var bad = all.filter(function (m) { return m.k === 'bad'; }).length;
      h += '<div class="dz-grid">' + fld(T('Titik sungai GloFAS (halaman Aliran)', 'GloFAS river point (Flow page)'), '<div style="display:flex;gap:6px"><input class="inp" data-dzriver="lat" value="' + esc(D.river ? D.river.lat : '') + '" placeholder="lat"><input class="inp" data-dzriver="lon" value="' + esc(D.river ? D.river.lon : '') + '" placeholder="lon"></div><button type="button" class="btn sm" id="dzRiver" style="margin-top:6px">🔎 ' + T('Cari sel sungai utama', 'Find the main river cell') + '</button>', T('Contoh Kemaman: ', 'Kemaman example: ') + code(EX.river) + T(' (Sg. Kemaman hilir pertemuan Sg. Cherul)', ' (Sg. Kemaman below the Sg. Cherul junction)')) +
        fld(T('Nama sungai utama', 'Main river name'), inp('riverName', 'Sg. Dungun'), T('Contoh: ', 'Example: ') + code('Sg. Kemaman')) +
        fld(T('Salinan GitHub (30 hari, tanpa relay)', 'GitHub copy (30 days, no relay)'), '<select class="sel" data-dz="mirror"><option value="0"' + (!D.mirror ? ' selected' : '') + '>' + T('Belum — baca JPS terus melalui relay', 'Not yet — read JPS live through the relay') + '</option><option value="1"' + (D.mirror ? ' selected' : '') + '>' + T('Sudah dimasukkan ke mirror/districts.json', 'Added to mirror/districts.json') + '</option></select>',
          T('Untuk salinan GitHub: salin teks di bawah ke fail ', 'For the GitHub copy: put the text below into the file ') + code('mirror/districts.json') + T(' dalam repo monsoon-eye (atau minta Claude), kemudian pilih "Sudah".', ' in the monsoon-eye repo (or ask Claude), then pick "Added".')) +
        '</div><div class="dz-f"><label>' + T('Config mirror', 'Mirror config') + '</label><textarea class="inp" rows="2" readonly id="dzMirror">' + esc(mirrorText()) + '</textarea><button type="button" class="btn sm" id="dzCopyMirror" style="margin-top:6px">📋 ' + T('Salin config mirror', 'Copy mirror config') + '</button></div>' +
        '<h4 style="margin:14px 0 4px">' + T('Semakan', 'Checks') + '</h4>' + msgs(all) +
        (!relayOk() && !D.mirror ? msgs([M('warn', T('Relay Monsoon EYE belum dipasang: daerah ini perlu relay (Tetapan › Relay laman) atau salinan GitHub untuk bacaan 5 minit.', 'The Monsoon EYE relay is not set up: this district needs the relay (Settings › Site relay) or the GitHub copy for 5-minute readings.'))]) : '') +
        (bad ? '<p class="note">' + T('Ada {n} masalah ⛔ — betulkan dulu, atau simpan juga jika anda pasti.', '{n} problems ⛔ — fix them first, or save anyway if you are sure.').replace('{n}', bad) + '</p>' : '');
    }
    h += '<div class="dz-nav"><button type="button" class="btn" id="dzCancel">' + T('Batal', 'Cancel') + '</button>' + (step ? '<button type="button" class="btn" id="dzBack">‹ ' + T('Kembali', 'Back') + '</button>' : '') +
      (step < 5 ? '<button type="button" class="btn pri" id="dzNext">' + T('Seterusnya', 'Next') + ': ' + esc(STEPS[step + 1]) + ' ›</button>' : '<button type="button" class="btn pri" id="dzSave">💾 ' + T('Simpan daerah', 'Save the district') + '</button>') + '</div>';
    host.innerHTML = h;
    wire();
  }
  function wire() {
    var b;
    if ((b = $('dzLoadD'))) b.onclick = function () { this.disabled = true; stateTable(D.state).then(function () { D.msgs.loc = checkLocation(); }, function (e) { D.msgs.loc = [M('warn', esc(e.message))]; }).then(render); };
    if ((b = $('dzFindMet'))) b.onclick = findMet;
    if ((b = $('dzCheckMet'))) b.onclick = checkMet;
    if ((b = $('dzRiver'))) b.onclick = findRiver;
    if ((b = $('dzCopyMirror'))) b.onclick = function () { var t = $('dzMirror'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } MC.toast(T('Disalin ✓', 'Copied ✓'), 'mirror/districts.json'); };
    if ((b = $('dzCancel'))) b.onclick = function () { if (confirm(T('Batal tambah daerah? Isian akan hilang.', 'Cancel adding the district? What you filled in will be lost.'))) { D = null; render(); } };
    if ((b = $('dzBack'))) b.onclick = function () { step--; render(); };
    if ((b = $('dzNext'))) b.onclick = function () {
      if (step === 0) { D.msgs.loc = checkLocation(); if (D.msgs.loc.some(function (m) { return m.k === 'bad'; })) { render(); return; } if (!D.keywords) D.keywords = STATES[D.state][0] + ', ' + D.name; if (!D.town) D.town = D.name; }
      if (step === 1 && !D.msgs.met) { checkMet(); }
      if (step === 2 && !D.water.length && D.wlText) { readGauges('wl'); return; }
      if (step === 4 && !D.river) { step++; render(); findRiver(); return; }
      step++; render();
    };
    if ((b = $('dzSave'))) b.onclick = save;
  }
  function save() {
    if (!D.water.length) { MC.toast(T('Perlu sekurang-kurangnya satu stesen paras air', 'At least one water level gauge is needed'), '', 'warning'); step = 2; render(); return; }
    var id = idOf(), lat = num(D.lat), lon = num(D.lon);
    var pick = function (g, wl) { var o = { gid: g.gid, name: g.name, lat: num(g.lat), lon: num(g.lon), src: g.src || '' }; if (wl) ['normal', 'alert', 'warning', 'danger'].forEach(function (k) { o[k] = num(g[k]); }); if (g.basin) o.basin = g.basin; return o; };
    var order = D.order.length ? D.order : D.water.map(function (g) { return g.gid; }), byGid = {}; D.water.forEach(function (g) { byGid[g.gid] = g; });
    var cfg = { v: 1, id: id, name: D.name, state: D.state, town: D.town || D.name, lat: lat, lon: lon, river: D.river, riverName: D.riverName || '', mirror: !!D.mirror,
      water: order.map(function (gid) { return byGid[gid]; }).filter(Boolean).map(function (g) { return pick(g, true); }), rain: D.rain.filter(function (g) { return g.gid; }).map(function (g) { return pick(g, false); }),
      upstream: layoutText(), form: { into: D.water.map(function (g) { return [g.gid, g.into || '', g.villages || '', !!g.tidal]; }), wlText: D.wlText, rfText: D.rfText, met: D.met, keywords: D.keywords, coastal: D.coastal } };
    var prof = { id: D.id || id, name: D.name, kind: 'land', lat: lat, lon: lon, marineLat: +(lat + 0.03).toFixed(4), marineLon: +(lon + 0.1).toFixed(4),
      riverLat: D.river ? D.river.lat : lat, riverLon: D.river ? D.river.lon : lon, metLocationId: /^Ds\d{3}$/i.test(D.met || '') ? D.met : '', warningKeywords: D.keywords || (STATES[D.state][0] + ', ' + D.name),
      waterDistrict: D.name, jpsState: D.state, scrapeInfobanjir: true, useDataGovFlood: false, coastal: !!D.coastal, tidePlace: 'model', ewUpstream: cfg.upstream, district: JSON.stringify(cfg) };
    var P2 = { active: state.profiles.active, profiles: state.profiles.profiles.slice() }, i = P2.profiles.map(function (p) { return p.id; }).indexOf(prof.id);
    var clean = C.cleanProfile(prof, i >= 0 ? P2.profiles[i] : null);
    if (i >= 0) P2.profiles[i] = clean; else P2.profiles.push(clean);
    MC.setProfiles(P2);
    var name = D.name; D = null; render();
    if (confirm(T('Daerah {n} disimpan ✓. Tukar ke daerah ini sekarang?', 'District {n} saved ✓. Switch to it now?').replace('{n}', name))) MC.switchProfile(clean.id);
  }
  function editExisting(pid) {
    var p = state.profiles.profiles.filter(function (x) { return x.id === pid; })[0], d = {};
    try { d = JSON.parse(p.district); } catch (e) { return; }
    D = blank();
    Object.assign(D, { id: p.id, name: d.name, state: d.state, town: d.town, lat: d.lat, lon: d.lon, met: (d.form && d.form.met) || p.metLocationId, keywords: (d.form && d.form.keywords) || p.warningKeywords, coastal: d.form ? d.form.coastal : true,
      wlText: (d.form && d.form.wlText) || '', rfText: (d.form && d.form.rfText) || '', river: d.river, riverName: d.riverName, mirror: d.mirror });
    var into = {}; ((d.form && d.form.into) || []).forEach(function (x) { into[x[0]] = x; });
    D.water = (d.water || []).map(function (g) { var x = into[g.gid] || []; return Object.assign({}, g, { into: x[1] || '', villages: x[2] || '', tidal: !!x[3], edited: true, msgs: [] }); });
    D.rain = (d.rain || []).map(function (g) { return Object.assign({ msgs: [] }, g); });
    D.order = D.water.map(function (g) { return g.gid; });
    step = 0; render();
  }
  /* inputs */
  $('distBody').addEventListener('input', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-dz') && el.tagName !== 'SELECT') { D[el.getAttribute('data-dz')] = el.value; return; }
    if (el.hasAttribute('data-dzg')) { var a = el.getAttribute('data-dzg').split(':'), list = a[0] === 'wl' ? D.water : D.rain, g = list[+a[1]]; if (g) { g[a[2]] = el.value; g.edited = true; } return; }
    if (el.hasAttribute('data-dzr') && el.type !== 'checkbox' && el.tagName !== 'SELECT') { var r = el.getAttribute('data-dzr').split(':'), w = D.water.filter(function (x) { return x.gid === r[0]; })[0]; if (w) { w[r[1]] = el.value; w.edited = true; } return; }
    if (el.hasAttribute('data-dzriver')) { D.river = D.river || {}; D.river[el.getAttribute('data-dzriver')] = num(el.value); }
  });
  $('distBody').addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-dz') && el.tagName === 'SELECT') {
      var k = el.getAttribute('data-dz'), v = el.value;
      D[k] = k === 'coastal' || k === 'mirror' ? v === '1' : v;
      if (k === 'state') { D.name = ''; D.msgs.loc = null; }
      if (k === 'name') D.msgs.loc = checkLocation();
      render(); return;
    }
    if (el.hasAttribute('data-dzr')) {
      var r = el.getAttribute('data-dzr').split(':'), w = D.water.filter(function (x) { return x.gid === r[0]; })[0];
      if (w) { w[r[1]] = el.type === 'checkbox' ? el.checked : el.value; w.edited = true; }
      if (r[1] !== 'villages') render();
    }
  });
  $('distBody').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-dz-step')) { step = +b.getAttribute('data-dz-step'); render(); return; }
    if (b.hasAttribute('data-dz-auto')) { autoFind(b.getAttribute('data-dz-auto')); return; }
    if (b.hasAttribute('data-dz-read')) { readGauges(b.getAttribute('data-dz-read')); return; }
    if (b.hasAttribute('data-dz-edit')) { editExisting(b.getAttribute('data-dz-edit')); return; }
    if (b.hasAttribute('data-dzdel')) { var a = b.getAttribute('data-dzdel').split(':'), list = a[0] === 'wl' ? D.water : D.rain; var g = list.splice(+a[1], 1)[0]; if (g && a[0] === 'wl') D.order = D.order.filter(function (x) { return x !== g.gid; }); render(); return; }
    if (b.hasAttribute('data-dzmv')) { var m = b.getAttribute('data-dzmv').split(':'), i = +m[0], j = i + +m[1], o = D.order; var t = o[i]; o[i] = o[j]; o[j] = t; render(); }
  });
  MC.EXT.views = MC.EXT.views || {};
  var prev = MC.EXT.views.settings;
  MC.EXT.views.settings = function () { if (prev) prev(); if (!D) render(); };
  MC.EXT.District = { gridOf: gridOf, parseLinks: parseLinks, shortName: shortName, layout: function (d) { var keep = D; D = d; var t = layoutText(); D = keep; return t; } };
  render();
})();
