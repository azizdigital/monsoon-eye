# Panduan Monsoon EYE

## Pasang di iPad
1. Buka **https://azizdigital.github.io/monsoon-eye/** dalam Safari.
2. Tekan butang **Kongsi ⬆️ → Tambah ke Skrin Utama**. Ikon awan + matahari keluar di skrin utama.
3. Buka dari ikon itu. Kali pertama: **Tetapan › Import dari Dashboard Cuaca** (jika app asal pernah dibuka di iPad yang sama) untuk salin profil, Tempat saya, susunan sungai & kunci relay.

## Pasang di PC (Windows)
1. Pasang **Node.js 22 LTS** (nodejs.org) jika belum ada.
2. Ekstrak zip, buka folder yang ada `package.json`, klik bar alamat, taip `cmd`, Enter.
3. `npm install` → `npm run dist`. Dalam folder `dist` ada **Monsoon EYE Setup 1.1.0.exe** (pasang) dan **Monsoon EYE 1.1.0.exe** (portable).
4. Buka app → **Tetapan › Import dari Dashboard Cuaca** — profil & tetapan dibaca terus dari app PC Dashboard Cuaca.
5. Boleh buka serentak dengan Dashboard Cuaca dan app satu lagi (port 30050, folder data `%APPDATA%\Monsoon EYE`). Pilih **Kekal di tray** dalam Tetapan supaya alert terus berbunyi bila tetingkap ditutup.

## Menu (kiri; di telefon di bawah)
| Menu | Isi |
|---|---|
| **Utama** | Kotak jawapan "Banjir ke tak?", 4 nombor utama, paras sungai (hulu → hilir), hujan, aliran sungai, ramalan, amaran MET darat, skor risiko penuh |
| **Sungai** | Halaman Paras Air (JPS 5 minit, peta / skema sungai, graf 1–30 hari, anggaran 4/24 j) |
| **Hujan** | Halaman Hujan (stesen JPS, heatmap, sebenar vs 5 model) |
| **Aliran** | Aliran sungai GloFAS & ramalan 30 hari, peluang lepasi ambang, puncak tahunan |
| **Laman** | 23 laman web (radar, satelit, JPS, CCTV, NADMA…) |
| **Dinding** | Beberapa laman serentak |
| **Tanya AI** | 8 tujuan, setiap satu ada **Panduan app** (tanpa AI) + **Prompt** untuk AI |
| **Sejarah / Alert / Tetapan** | Graf, log alert, semua tetapan |

## Kotak jawapan di atas
- Cincin = **skor risiko banjir 24 jam** (0–100): <25 Sangat rendah 🟢 · 25–49 Rendah 🟡 · 50–70 Sederhana 🟠 · 71–84 Tinggi 🔴 · ≥85 Sangat tinggi 🟣.
- Tajuk ditulis app ikut paras stesen paling teruk (bukan AI): Normal → "Tiada risiko banjir buat masa ini"; Waspada → "Sungai naik, masih jauh dari paras banjir"; Amaran → "Sungai naik, tapi belum paras banjir"; ≤ 0.25 m ke Bahaya → "Hampir paras banjir — bersedia"; Bahaya → "BANJIR".
- 3 fakta di kanan: amaran awal, hujan 24 j (5 model), air pasang seterusnya. Tekan untuk pergi ke kad.

## Tanya AI
Pilih tujuan → isi borang kecil → baca **Panduan app** → jika mahu, **Salin prompt** dan tampal ke ChatGPT / Claude / Gemini / Copilot (hidupkan carian web AI itu). Prompt *Ringkas* atau *Penuh*, jawapan BM atau EN.
- **Perlu bersedia atau pindah?** — tahap tindakan: Tiada tindakan / Bersedia / Alih barang & kenderaan / Pindah, dengan sebab & "paling lewat".
- **Sungai naik atau turun?** · **Lepas banjir: bila selamat balik?** · **Senarai semak beg kecemasan**
- **Perjalanan selamat?** · **Aktiviti luar / hujan** · **Ringkasan WhatsApp** (mesej siap hantar) · **Tinjauan 7 hari / tengkujuh**

## Tambah daerah (Tetapan)
6 langkah, setiap medan ada contoh Kemaman:
1. **Lokasi** — negeri, nama daerah (tekan *Muat nama daerah JPS*), bandar, koordinat.
2. **MET & amaran** — kod Ds… (tekan *Cari kod*), kata kunci amaran.
3. **Stesen paras air** — tampal pautan `…/wl-graph/?stationid=…` atau tekan *Cari sendiri dari jadual JPS*.
4. **Stesen hujan** — sama, pautan `rf-graph`.
5. **Susunan sungai** — hulu → hilir, "mengalir ke", kampung terjejas, ~ pasang surut.
6. **Semak & simpan** — sel sungai GloFAS, salinan GitHub, semua semakan.

App memberi amaran bila: stesen dalam **daerah / negeri lain** (contoh stesen Selangor untuk Dungun), pautan hujan dalam langkah paras air, stesen tiada bacaan > 24 j, kod MET daerah lain, koordinat di luar negeri. Daerah baru dibaca terus dari JPS melalui **relay** (perlu dipasang), atau dari salinan GitHub bila ditambah ke `mirror/districts.json`.

## Relay (Tetapan › Relay laman)
Relay Cloudflare percuma khas Monsoon EYE: baca JPS terus setiap 3 minit, buka laman yang menolak paparan dalam app, buang iklan. Langkah ada dalam Tetapan dan README.

## Penting
Ini alat bantu, bukan amaran rasmi. Ikut arahan APM, NADMA, JPS dan MET Malaysia.
