/* Dashboard Cuaca Aziz - GitHub mirror parsers (JPS, Tide Forecast) against real pages: node tests/mirror.js */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const P = require('../mirror/parse');
const fx = f => fs.readFileSync(path.join(__dirname, 'web-fixtures', f), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('mirror: JPS water level page (real sample, missing <tr> tags)', () => {
  const w = P.jpsWater(fx('jps-water-TRG.html'));
  assert.strictEqual(w.length, 46);
  const k = w.filter(s => s.district === 'Kemaman');
  assert.strictEqual(k.length, 8);
  assert.deepStrictEqual(k[0], { no: 30, id: '4131453', name: 'Sg. Cherul di Jambatan Ban Ho', district: 'Kemaman', basin: 'Sungai Kemaman', subBasin: 'Sg. Cherul', updated: '2026-11-20T20:55:00+08:00', level: 10.92, normal: 10, alert: 17, warning: 18, danger: 19, gid: '4131001_' });
});
test('mirror: JPS rainfall page (rows without <tr>, -9999 = no reading, dates from the header)', () => {
  const r = P.jpsRain(fx('jps-rain-TRG.html'));
  assert.strictEqual(r.stations.length, 93);
  assert.deepStrictEqual(r.days, ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
  assert.strictEqual(r.today, '2026-11-20');
  const hj = r.stations.find(s => s.name === 'Hulu Jabor');
  assert.deepStrictEqual([hj.daily, hj.today, hj.hour, hj.updated], [[null, null, 3, 0, null, 1], 0, 0, '2026-11-20T17:00:00+08:00']);
  assert.strictEqual(r.stations.filter(s => s.district === 'Kemaman').length, 17);
});
test('mirror: Tide Forecast Cukai - high / low times and heights in metres, year across December', () => {
  const t = P.tides(fx('tide-cukai.html'), Date.parse('2026-11-20T13:00:00Z'));
  assert.ok(t.length > 100);
  assert.deepStrictEqual(t[0], { type: 'high', time: '2026-11-20T05:00:00+08:00', m: 2.09 });
  assert.deepStrictEqual(t[1], { type: 'low', time: '2026-11-20T12:38:00+08:00', m: 0.81 });
  assert.ok(t.every((e, i) => !i || Date.parse(e.time) > Date.parse(t[i - 1].time)));
  const dec = P.tides('<tr><td>High Tide</td><td><b> 1:00 AM</b><span>(Fri 1 January)</span></td><td>x (1.50 m)</td></tr>', Date.parse('2026-12-30T00:00:00Z'));
  assert.strictEqual(dec[0].time, '2027-01-01T01:00:00+08:00');
});
test('mirror: JPS rain - the rain of each reading from the year counter (clean is a moving 60-minute total), days match the JPS table', () => {
  const a = P.rfReadings(fx('jps-rf-27192-19nov.json')), b = P.rfReadings(fx('jps-rf-TKMN0007-19nov.json'));
  const sum = r => Math.round(r.reduce((x, p) => x + (p.v || 0), 0) * 10) / 10;
  /* JPS rainfall table, 19/11/2026: Jambatan Air Putih (F2) 27.5 mm (5-minute gauge), Yak Yah 13 mm (15-minute gauge) */
  assert.strictEqual(sum(a), 27.5); assert.strictEqual(sum(b), 13);
  assert.strictEqual(a[0].v, null);
  const at = s => a.find(p => p.t === Date.parse(s)).v;
  assert.deepStrictEqual([at('2026-11-19T16:05:00+08:00'), at('2026-11-19T16:10:00+08:00'), at('2026-11-19T16:20:00+08:00')], [4, 3.5, 4.5]);
  const h = P.rfSeries(fx('jps-rf-27192-19nov.json'));
  assert.strictEqual(h.find(x => x.t === Date.parse('2026-11-19T16:00:00+08:00')).v, 15);
  assert.strictEqual(Math.round(h.reduce((x, p) => x + p.v, 0) * 10) / 10, 27.5);
  /* a dip of the counter (a correction) is not counted twice; a new year starts again */
  const dip = P.rfReadings({ values: [['19/11/2026 09:00', 1242], ['19/11/2026 09:15', 1241], ['19/11/2026 09:30', 1242], ['19/11/2026 09:45', 1243]].map(x => ({ dt: x[0], cyearly: x[1] })) });
  assert.deepStrictEqual(dip.map(p => p.v), [null, 0, 0, 1]);
  const ny = P.rfReadings({ values: [['31/12/2026 23:55', 3100], ['01/01/2027 00:05', 0.5]].map(x => ({ dt: x[0], cyearly: x[1] })) });
  assert.deepStrictEqual(ny.map(p => p.v), [null, 0.5]);
});
test('mirror: Kemaman 5-minute data - first run reads 30 days, the next runs only the last hours and add them; the files line up', async () => {
  const K = require('../mirror/kemaman');
  const jps = { water: P.jpsWater(fx('jps-water-TRG.html')), rain: P.jpsRain(fx('jps-rain-TRG.html')) };
  const MIN = 60000, t0 = Date.parse('2026-11-21T04:02:00Z');
  /* made-up JPS: water level 10 + 0.001 per 5 minutes since t0 - 30 days; rain 0.5 mm in every reading */
  const base = t0 - 30 * 86400000, asked = [];
  const parse = u => { const q = new URL(u).searchParams, f = s => { const m = /(\d+)\/(\d+)\/(\d+) (\d+):(\d+)/.exec(s); return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 8, +m[5]); }; return { from: f(q.get('from')), to: f(q.get('to')), rain: /rainfall/.test(u) }; };
  const pad = n => String(n).padStart(2, '0'), dt = t => { const d = new Date(t + 8 * 3600000); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
  const get = async u => { const q = parse(u); asked.push(q); const values = [];
    for (let t = Math.ceil(q.from / 300000) * 300000; t <= q.to; t += 300000) values.push(q.rain ? { dt: dt(t), clean: 6, cyearly: (t - base) / 300000 * 0.5 } : { dt: dt(t), final: String(10 + (t - base) / 300000 * 0.001) });
    return (q.rain ? '' : '<style>x</style>') + JSON.stringify({ info: { name: 'x' }, values }); };
  const store = {}, io = now => ({ now, get, write: (f, d) => { store[f] = JSON.parse(JSON.stringify(d)); }, previous: async f => store[f] ? JSON.parse(JSON.stringify(store[f])) : null });
  const r1 = await K.kemaman(jps, io(t0));
  assert.deepStrictEqual([r1.gauges, r1.failed, r1.full], [25, 0, 25]);
  assert.ok(asked.every(q => q.to - q.from >= 30 * 86400000 - 10 * MIN));
  const now1 = store['kemaman/now.json'];
  assert.strictEqual(now1.water.length, 8); assert.strictEqual(now1.rain.length, 17);
  const ban = now1.water.find(w => /Ban Ho/.test(w.name));
  assert.strictEqual(ban.s.length, 312); assert.strictEqual(ban.level, 10.92);
  const wl = store['kemaman/wl-4131001_.json'];
  assert.strictEqual(wl.s.length, 8640); assert.strictEqual(wl.end, Math.floor(t0 / 300000) * 300000);
  const lastV = 10 + (wl.end - base) / 300000 * 0.001;
  assert.ok(Math.abs(wl.s[8639] - Math.round(lastV * 100) / 100) < 1e-9, wl.s[8639] + ' vs ' + lastV);
  const hj = now1.rain.find(x => x.name === 'Hulu Jabor');
  assert.strictEqual(hj.h.length, 168); assert.strictEqual(hj.h[167], 6); assert.strictEqual(hj.m.length, 36);
  /* 15 minutes later: only the last ~3 hours are read, the old part is kept and moved 3 steps */
  asked.length = 0;
  const t1 = t0 + 15 * MIN, r2 = await K.kemaman(jps, io(t1));
  assert.strictEqual(r2.full, 0); assert.strictEqual(asked.length, 25);
  assert.ok(asked.every(q => q.to - q.from <= 3.5 * 3600000), JSON.stringify(asked[0]));
  const wl2 = store['kemaman/wl-4131001_.json'];
  assert.strictEqual(wl2.end - wl.end, 15 * MIN);
  assert.strictEqual(wl2.s[8639 - 3], wl.s[8639]);
  assert.strictEqual(wl2.s[0], wl.s[3]);
  /* rain read again over the last hours is not counted twice */
  const rf2 = store['kemaman/rf-27191.json'];
  assert.ok(rf2.s.slice(8600).every(v => v === 0.5), JSON.stringify(rf2.s.slice(8630)));
  /* JPS down: the old data stay, the gauge is marked */
  const r3 = await K.kemaman(jps, Object.assign(io(t1 + 15 * MIN), { get: async () => { throw new Error('HTTP 503'); } }));
  assert.strictEqual(r3.failed, 25); assert.strictEqual(store['kemaman/wl-4131001_.json'].s[8639 - 3], wl2.s[8639]); assert.strictEqual(store['kemaman/wl-4131001_.json'].s[8639], null);
  assert.ok(/503/.test(store['kemaman/now.json'].files['wl-4131001_.json'].err));
});
(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log('  ✓ ' + t.name); } catch (e) { fail++; console.log('  ✗ ' + t.name + '\n    ' + (e && e.stack || e)); }
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
