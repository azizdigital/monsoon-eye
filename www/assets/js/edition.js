/* Monsoon EYE 1.1.2 - which app this is. Made by tools/build-edition.js from tools/editions.js; do not edit by hand. */
(function (ALL, FIXED) {
  /* the edition this copy of the app is */
  var id = FIXED;
  if (!id) {
    var q = /[?&]ed=(me|ow|monsoon-eye|oceanwatch)\b/.exec(location.search || ''), keep = null;
    try { keep = sessionStorage.getItem('dev_edition'); } catch (e) { /* */ }
    id = q ? (q[1] === 'ow' || q[1] === 'oceanwatch' ? 'oceanwatch' : 'monsoon-eye') : keep || 'monsoon-eye';
    try { sessionStorage.setItem('dev_edition', id); } catch (e) { /* */ }
  }
  var E = ALL[id];
  /* storage: the three apps (Dashboard Cuaca, Monsoon EYE, OceanWATCH) live on the same address (azizdigital.github.io), so the
     browser gives them ONE localStorage. The code still says 'mc_...'; here every 'mc_' key becomes this app's own prefix.
     E.rawGet reads the real key (used once, to import the settings of the original Dashboard Cuaca). */
  try {
    var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
    var k = function (x) { x = String(x); return x.indexOf('mc_') === 0 ? E.prefix + x.slice(3) : x; };
    E.rawGet = function (x) { try { return g.call(localStorage, String(x)); } catch (e) { return null; } };
    if (!S.__edition) {
      S.getItem = function (x) { return g.call(this, k(x)); };
      S.setItem = function (x, v) { return s.call(this, k(x), v); };
      S.removeItem = function (x) { return r.call(this, k(x)); };
      S.__edition = id;
    }
  } catch (e) { /* no storage */ }
  try { document.documentElement.setAttribute('data-edition', E.short); } catch (e) { /* worker */ }
  self.EDITION = E;
})({"monsoon-eye":{"id":"monsoon-eye","short":"me","kind":"land","version":"1.1.2","pc":{"port":30050,"appId":"local.monsooneye.aziz","exe":"Monsoon EYE"},"name":"Monsoon EYE","nameHtml":"Monsoon<em>EYE</em>","tagline":"Flood & Weather Monitoring","repo":"azizdigital/monsoon-eye","url":"https://azizdigital.github.io/monsoon-eye/","prefix":"me_","cache":"monsoon-eye-","themeColor":"#08101f","defaults":{"lang":"ms","relayUrl":"","kind":"land"},"profiles":["kemaman"],"activeProfile":"kemaman","sites":["waterlevel","rainfall","floodhub","infobanjir","jpsaras","jpspeta","zoomearth","windy","ventusky","rainviewer","metmalaysia","metradar","meteoblue","himawari","blitzortung","tideforecast","tideschart","tides4fishing","camera","webcam","jalanow","nadma","storms"],"wall":["dashboard","waterlevel","rainfall","floodhub","windy","camera"]}}, "monsoon-eye");
