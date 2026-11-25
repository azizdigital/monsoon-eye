/* Monsoon EYE - which app this repo is (tools/build-edition.js writes www/assets/js/edition.js from it) */
'use strict';
module.exports = {
  "monsoon-eye": {
    "id": "monsoon-eye",
    "short": "me",
    "kind": "land",
    "version": "1.1.6",
    "pc": {
      "port": 30050,
      "appId": "local.monsooneye.aziz",
      "exe": "Monsoon EYE"
    },
    "name": "Monsoon EYE",
    "nameHtml": "Monsoon<em>EYE</em>",
    "tagline": "Flood & Weather Monitoring",
    "repo": "azizdigital/monsoon-eye",
    "url": "https://azizdigital.github.io/monsoon-eye/",
    "prefix": "me_",
    "cache": "monsoon-eye-",
    "themeColor": "#08101f",
    "defaults": {
      "lang": "ms",
      "relayUrl": "",
      "kind": "land"
    },
    "profiles": [
      "kemaman"
    ],
    "activeProfile": "kemaman",
    "sites": [
      "waterlevel",
      "rainfall",
      "floodhub",
      "ramalan",
      "infobanjir",
      "jpsaras",
      "jpspeta",
      "zoomearth",
      "windy",
      "ventusky",
      "rainviewer",
      "metmalaysia",
      "metradar",
      "meteoblue",
      "himawari",
      "blitzortung",
      "tideforecast",
      "tideschart",
      "tides4fishing",
      "camera",
      "webcam",
      "jalanow",
      "nadma",
      "storms"
    ],
    "wall": [
      "dashboard",
      "waterlevel",
      "rainfall",
      "floodhub",
      "windy",
      "camera"
    ]
  }
};
