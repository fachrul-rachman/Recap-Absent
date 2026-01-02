# GreatDayHR Attendance Recap CLI & HTTP Service

Project ini adalah tool Node.js (ESM, zero‑dependency) untuk:

- Mengambil data attendance / leave / overtime dari GreatDayHR.
- Menghitung rekap harian, mingguan, dan bulanan (telat, ABS, cuti, lembur, top 5, dll.).
- Mengirim laporan terformat ke Discord melalui Webhook.
- Menyediakan CLI dan HTTP endpoint yang bisa diintegrasikan dengan scheduler (cron, n8n, dsb.).

---

## Prasyarat

- Node.js `v24.11.1` (atau lebih baru di major yang sama).
- npm `v11.7.0`.
- Akses ke API GreatDayHR dev: `https://dev.greatdayhr.com/api`.
- Discord Webhook URL.

---

## Struktur Proyek (Ringkas)

- `package.json` — konfigurasi Node.js (ESM) + scripts.
- `.env.example` — contoh konfigurasi environment.
- `tutorial.md` — panduan penggunaan lebih detail (env, cron, troubleshooting).
- `state.json` — file state idempotency (dibaca/dimikro oleh script).
- `src/`
  - `cli.mjs` — entry CLI (`daily`, `weekly`, `monthly`).
  - `server.mjs` — HTTP server ringan untuk di‑hit dari n8n / scheduler lain.
  - `env.mjs` — loader `.env` manual (tanpa `dotenv`).
  - `config.mjs` — pembacaan konfigurasi dari `process.env`.
  - `http.mjs` — wrapper `fetch` + posting ke Discord.
  - `auth.mjs` — login & refresh token ke GreatDayHR.
  - `greatday/` — akses API GreatDayHR (attendance, leave, overtime, employees, paging).
  - `domain/` — windows tanggal, perhitungan telat/ABS/lembur, agregasi, ranking, exclusions.
  - `report/` — format teks laporan ke Discord + pembatasan jumlah baris.
  - `state/` — penyimpanan dan idempotency (baca/tulis `state.json`).
  - `runners.mjs` — orkestrator `runDaily`, `runWeekly`, `runMonthly`.

---

## Konfigurasi Environment

Salin `.env.example` menjadi `.env` dan isi nilai yang sesuai:

```env
BASE_URL=https://dev.greatdayhr.com/api
SECRET_KEY=...
ACCESS_SECRET=...
DISCORD_WEBHOOK_URL=...
STATE_FILE=state.json
PORT=3002
```

Keterangan:

- `BASE_URL` — base URL API GreatDayHR (default: `https://dev.greatdayhr.com/api`).
- `SECRET_KEY` / `ACCESS_SECRET` — credential untuk `/auth/login` (jangan dibuka ke publik).
- `DISCORD_WEBHOOK_URL` — URL webhook Discord target.
- `STATE_FILE` — path file state idempotency (default `state.json` relatif ke cwd).
- `PORT` — port HTTP server (`src/server.mjs`), default `3000`.

`src/env.mjs` akan otomatis memuat `.env` pada saat CLI maupun server dijalankan.

---

## Mode CLI

Jalankan dari root proyek (setelah `.env` terisi).

### Harian (Daily)

```bash
npm run daily
# atau
node src/cli.mjs daily
```

Perilaku:

- Rekap final **kemarin** (approved absence, ABS, telat, pulang awal, lembur).
- Monitoring **hari ini** (belum hadir, pending leave, telat hari ini).
- Mengirim satu pesan ke Discord dengan layout yang sudah diformat (emoji + bold).

Tambahkan `--force` untuk bypass idempotency (repost hari yang sama):

```bash
node src/cli.mjs daily --force
```

### Mingguan (Weekly)

```bash
npm run weekly
# atau
node src/cli.mjs weekly
```

Window:

- Senin–Jumat minggu berjalan (berdasarkan tanggal saat eksekusi).
- Rekap telat, lembur, dan cuti approved per karyawan (total count + menit).

### Bulanan (Monthly)

```bash
npm run monthly
# atau
node src/cli.mjs monthly
```

Window:

- Tanggal 1 sampai akhir **bulan sebelumnya**.
- Menampilkan:
  - Ringkasan telat, ABS, cuti, lembur.
  - `Top 5` telat dan `Top 5` lembur dengan ranking:
    1. Total menit (DESC)
    2. Jumlah kejadian (DESC)
    3. empId (ASC) — tapi di laporan hanya nama yang ditampilkan.

---

## Idempotency (`state.json`)

Status posting disimpan ke file `state.json` atau path lain sesuai `STATE_FILE`. Bentuk minimal:

```json
{
  "lastPosts": {
    "daily:2025-12-29": { "postedAtIso": "...", "discordMessageHash": "..." },
    "weekly:2025-12-22_to_2025-12-26": { "postedAtIso": "...", "discordMessageHash": "..." },
    "monthly:2025-11": { "postedAtIso": "...", "discordMessageHash": "..." }
  }
}
```

Key:

- Daily: `daily:YYYY-MM-DD` (tanggal kemarin).
- Weekly: `weekly:YYYY-MM-DD_to_YYYY-MM-DD`.
- Monthly: `monthly:YYYY-MM`.

Jika key sudah ada dan **tidak** memakai `--force`:

- Runner akan **skip** dan tidak memposting ke Discord.
- Output CLI / HTTP akan menyebut status `skipped` dengan alasan.

---

## HTTP Server (untuk n8n / Scheduler Lain)

Selain CLI, proyek ini juga menyediakan HTTP server ringan di `src/server.mjs`.

Jalankan:

```bash
npm run serve
# atau
node src/server.mjs
```

Server membaca `.env` yang sama dan mengikat ke port `PORT` (default `3002`).

### Endpoint

1. **Healthcheck**

   ```http
   GET /health
   ```

   Response (200):

   ```json
   {
     "status": "ok",
     "service": "greatday-attendance-recap"
   }
   ```

2. **Run Report**

   ```http
   POST /run?mode=daily|weekly|monthly&force=true|false
   ```

   Contoh:

   - `POST /run?mode=daily`
   - `POST /run?mode=weekly`
   - `POST /run?mode=monthly&force=true`

   Respon sukses (laporan terkirim):

   ```json
   {
     "status": "ok",
     "mode": "daily",
     "skipped": false,
     "message": "Successfully posted daily report."
   }
   ```

   Respon sukses tapi di‑skip (idempotency):

   ```json
   {
     "status": "skipped",
     "mode": "daily",
     "reason": "Already posted for daily:2025-12-29. Use --force to override."
   }
   ```

   Respon error (param salah):

   ```json
   {
     "status": "error",
     "error": "Invalid mode. Expected one of: daily, weekly, monthly."
   }
   ```

   Respon error (runtime, mis. 401/422 dari API):

   ```json
   {
     "status": "error",
     "error": "Request failed: 422 Unprocessable Entity. Body: ..."
   }
   ```

### Integrasi Singkat dengan n8n

Konsep (non-teknis):

- Buat workflow di n8n dengan `HTTP Request` node yang memanggil `POST /run` ke VPS tempat server ini berjalan.
- Scheduler di n8n (Cron node):
  - Daily: setiap hari 09:00 WIB → `mode=daily`.
  - Weekly: Sabtu 09:05 WIB → `mode=weekly`.
  - Monthly: tanggal 3, 09:10 WIB → `mode=monthly`.
- n8n cukup mengecek `status` (`ok`, `skipped`, `error`) untuk logging atau alert.

Detail wiring node ada di `tutorial.md` (bisa ditambah jika diperlukan).

---

## Aturan Bisnis Penting

- **Auth & Token**
  - Login: `POST /auth/login` dengan `accessKey` / `accessSecret`.
  - Refresh: `POST /auth/refresh` hanya jika `expired_at` sudah lewat (kalau tidak, refresh tidak dipanggil).
  - `401` ditangani dengan aturan: cek dulu expire; kalau belum expired → error jelas tanpa refresh.

- **Attendance / Leave / Overtime**
  - Attendance: `GET /attendances/byPeriod?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
  - Leave: `POST /leave` dengan paging (body filter + `page`, `limit`).
  - Overtime: `POST /overtime` dengan paging.
  - Paging generik (`fetchAllPages`) mendukung bentuk list: root array, `data`, `items`, `rows`.

- **Telat, Pulang Awal, ABS**
  - Telat: `starttime > shiftstarttime`, menit = selisih menit, tanpa threshold.
  - Pulang awal: `endtime < shiftendtime`, menit = selisih menit, tanpa threshold.
  - ABS final: `attendCode == "ABS"` dan `daytype != "OFF"`.
  - Daily rekap kemarin vs monitoring hari ini dipisah dengan jelas (hari ini hanya detect hadir/telat sementara, bukan ABS final).

- **Exclusion / Privacy**
  - Direktur / karyawan tertentu (mis. `empId=DO230167`) dikecualikan dari semua rekap dan ranking.
  - Laporan Discord hanya menampilkan **nama & posisi**, bukan employee id.

---

## Troubleshooting Singkat

- `Missing required environment variable: SECRET_KEY`
  - Pastikan `.env` terisi lengkap dan server/CLI dijalankan dari root project yang sama.

- `Login failed: 404 Not Found`
  - Biasanya karena `BASE_URL` salah (harus menyertakan `/api` sesuai lingkungan yang benar).

- `Request failed: 422 Unprocessable Entity. Body: ...`
  - Ada field filter atau kombinasi parameter yang tidak sesuai kontrak backend.
  - Lihat potongan body di pesan error untuk petunjuk (mis. `limit` melebihi batas, format tanggal, dsb.).

- Laporan tidak muncul di Discord
  - Cek:
    - `DISCORD_WEBHOOK_URL` benar.
    - `state.json` tidak mem‑“blokir” run tersebut (coba jalankan dengan `--force` / `force=true`).
    - Health server (`GET /health`) dan log server/CLI.
