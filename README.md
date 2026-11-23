# Monsoon EYE — Flood & Weather Monitoring

App web (iPad / telefon / pelayar) untuk pantau **banjir & cuaca di darat**: paras sungai JPS setiap 5 minit, hujan stesen & 5 model, skor risiko banjir, amaran awal banjir, aliran sungai GloFAS 30 hari, amaran MET (darat), pasang surut, dan **Tanya AI** (panduan app sendiri + prompt untuk ChatGPT / Claude / Gemini / Copilot). Daerah pertama: **Kemaman**; daerah lain boleh ditambah dalam Tetapan.

Dipecahkan daripada *Dashboard Cuaca Aziz* 4.6.0 (bahagian darat). App offshore: **Sentinel OceanWATCH** (repo `oceanwatch`). App asal `dashboard-cuaca` tidak diubah.

- Pautan: **https://azizdigital.github.io/monsoon-eye/**
- iPad: buka pautan dalam Safari → Kongsi → **Tambah ke Skrin Utama**.
- Versi: lihat `www/assets/js/edition.js` / Tetapan › Lain-lain. Perubahan: `PERUBAHAN_1.0.0.txt`. Panduan pengguna: `PANDUAN.md`.

## Sumber data (percuma, tanpa kunci API)
Open-Meteo (cuaca, 5 model hujan, laut, GloFAS) · MET Malaysia melalui api.data.gov.my · JPS Public Infobanjir (melalui mirror GitHub & relay sendiri) · Tide Forecast (Cukai) · OpenStreetMap.

## Pasang sekali (pemilik)
1. **GitHub Pages:** repo › Settings › Pages › Source: **GitHub Actions**. Setiap push ke `main` menerbitkan `www/`.
2. **Mirror JPS** (`.github/workflows/mirror.yml`): jalan sendiri ~15 minit sekali, tulis ke cawangan `data`. Jalankan sekali dengan tangan: Actions › *Mirror data* › Run workflow.
   - Negeri lain: repo › Settings › Secrets and variables › Actions › **Variables** › `JPS_STATES` = `TRG,PHG` (contoh).
   - Daerah dengan salinan 30 hari: tambah baris dari app (Tetapan › Tambah daerah › *Salin config mirror*) ke `mirror/districts.json`, contoh:
     `[{"id":"dungun","state":"TRG","district":"Dungun","gids":["4832011_","27207"]}]`
3. **Relay Cloudflare** (baru, khas Monsoon EYE): dash.cloudflare.com › Workers & Pages › Create › Hello World › nama `monsoon-eye-relay` › Deploy. Dalam app: Tetapan › Relay laman › **Salin skrip relay** → Cloudflare *Edit code* → tampal → Deploy. Isi alamat worker + kunci dalam app → **Uji relay**.
4. **Sandaran GitHub melalui relay** (jadual GitHub percuma selalu lewat): token GitHub *fine-grained* (repo `monsoon-eye` sahaja, **Actions: Read and write**) → Cloudflare › worker › Settings › Variables and Secrets › Secret `GH_TOKEN`. Pilihan: `GH_REPO` (lalai `azizdigital/monsoon-eye`).

## Struktur
```
www/                     app web (GitHub Pages)
  index.html             dashboard, Laman, Dinding, Tanya AI, Sejarah, Alert, Tetapan
  kemaman.html           halaman Sungai / Hujan / Aliran (?tab=water|rain|flow) — Kemaman atau daerah yang ditambah
  assets/js/edition.js   app ini (dibuat oleh tools/build-edition.js — jangan ubah sendiri)
  assets/js/core.js      sumber data, profil, tetapan, peraturan alert
  assets/js/app.js       halaman utama (kongsi dengan app asal)
  assets/js/edition-ui.js  kotak jawapan (hero), jubin, bar sungai, import tetapan
  assets/js/ask.js       Tanya AI: 8 tujuan, panduan app + prompt
  assets/js/district.js  borang Tambah daerah (6 langkah, semak pautan salah)
  assets/js/risk.js, advisor.js, kemaman*.js, mirror-parse.js, charts*.js, i18n.js
  relay-worker.js        skrip relay Cloudflare
mirror/                  mirror JPS & pasang surut (GitHub Actions) + districts.json
tests/                   unit.js, edition.js, mirror.js (Node), web.spec.js (Playwright, tanpa internet)
tools/                   serve.js (pelayan tempatan), build-precache.js, build-edition.js
```

## Pembangunan
```
node tools/serve.js 42050          # http://127.0.0.1:42050/?web
node tests/unit.js && node tests/edition.js && node tests/mirror.js
npx playwright install chromium && npx playwright test
```
`tools/build-precache.js` dijalankan oleh GitHub setiap terbit (versi baru untuk luar talian).

© 2026 Aziz Mohamad
