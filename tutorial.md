# GreatDayHR Attendance Recap CLI

## Prasyarat

- Node.js v24.11.1 atau lebih baru
- npm v11.7.0 atau lebih baru

Pastikan `node` dan `npm` tersedia:

```sh
node -v
npm -v
```

## Konfigurasi Environment

Copy `.env.example` menjadi `.env` (opsional) atau langsung export variabel di shell.

Contoh export di Linux/macOS:

```sh
export BASE_URL="https://dev.greatdayhr.com/api"
export SECRET_KEY="isi_access_key_anda"
export ACCESS_SECRET="isi_access_secret_anda"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
export STATE_FILE="state.json"
```

Contoh di PowerShell (Windows):

```powershell
$env:BASE_URL="https://dev.greatdayhr.com/api"
$env:SECRET_KEY="isi_access_key_anda"
$env:ACCESS_SECRET="isi_access_secret_anda"
$env:DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
$env:STATE_FILE="state.json"
```

> Catatan: jangan pernah mencetak atau commit nilai secret/token.

## Menjalankan Mode CLI

Semua perintah dijalankan dari root project.

### Daily

Rekap kemarin + monitor hari ini:

```sh
node src/cli.mjs daily
```

Atau via npm script:

```sh
npm run daily
```

Gunakan `--force` untuk bypass idempotency:

```sh
node src/cli.mjs daily --force
```

### Weekly

Rekap Senin–Jumat minggu berjalan:

```sh
node src/cli.mjs weekly
```

atau:

```sh
npm run weekly
```

Dengan `--force`:

```sh
node src/cli.mjs weekly --force
```

### Monthly

Rekap 1 s/d akhir bulan sebelumnya, termasuk Top 5 telat & lembur:

```sh
node src/cli.mjs monthly
```

atau:

```sh
npm run monthly
```

Dengan `--force`:

```sh
node src/cli.mjs monthly --force
```

## Contoh Crontab

Sesuaikan path Node dan direktori project. Contoh di Linux dengan timezone server sudah WIB.

Edit crontab:

```sh
crontab -e
```

Tambahkan:

```cron
# Daily: setiap hari jam 09:00 WIB
0 9 * * * cd /path/ke/greatDay && BASE_URL="https://dev.greatdayhr.com/api" SECRET_KEY="..." ACCESS_SECRET="..." DISCORD_WEBHOOK_URL="..." node src/cli.mjs daily >> logs/daily.log 2>&1

# Weekly: setiap Sabtu jam 09:05 WIB
5 9 * * 6 cd /path/ke/greatDay && BASE_URL="https://dev.greatdayhr.com/api" SECRET_KEY="..." ACCESS_SECRET="..." DISCORD_WEBHOOK_URL="..." node src/cli.mjs weekly >> logs/weekly.log 2>&1

# Monthly: tanggal 3 jam 09:10 WIB
10 9 3 * * cd /path/ke/greatDay && BASE_URL="https://dev.greatdayhr.com/api" SECRET_KEY="..." ACCESS_SECRET="..." DISCORD_WEBHOOK_URL="..." node src/cli.mjs monthly >> logs/monthly.log 2>&1
```

## Troubleshooting

### 401 Unauthorized & Aturan Refresh

- Script melakukan login ke `/auth/login` untuk mendapatkan `access_token` dan `refresh_token`.
- Saat menerima HTTP 401:
  - Script mengecek apakah `expired_at` token sudah lewat.
  - Jika sudah expired → akan memanggil `/auth/refresh` lalu retry sekali.
  - Jika **belum** expired → script akan gagal dengan error jelas dan **tidak** memanggil refresh (sesuai aturan backend).

Jika terus-menerus 401:

- Pastikan `SECRET_KEY` dan `ACCESS_SECRET` benar.
- Pastikan waktu server relatif akurat agar perbandingan `expired_at` valid.

### Paging `/leave` dan `/overtime`

- Endpoint `/leave` dan `/overtime` tidak menerima filter tanggal.
- Script menggunakan helper `fetchAllPages` dengan aturan:
  - Mulai dari `page = 1` dan loop sampai `page > totalPage`.
  - `totalPage` divalidasi sebagai integer >= 1 (default 1 jika tidak ada).
  - Safety break jika `page > 500`.
  - Mendukung bentuk list:
    - Array di root
    - `data`
    - `items`
    - `rows`
  - Jika tidak menemukan list, script akan throw error yang menyebutkan keys yang diterima.

### Idempotency & `state.json`

- Status posting disimpan ke file `state.json` (bisa diubah via env `STATE_FILE`).
- Key:
  - Daily: `daily:YYYY-MM-DD` (tanggal **kemarin**)
  - Weekly: `weekly:YYYY-MM-DD_to_YYYY-MM-DD`
  - Monthly: `monthly:YYYY-MM`
- Jika key sudah ada dan Anda tidak menggunakan `--force`, script akan:
  - Tidak memanggil Discord.
  - Mengakhiri eksekusi dengan pesan seperti: `Already posted for ... Use --force to override.`
- Jika perlu re-post (misalnya pesan Discord dihapus), jalankan kembali dengan `--force`.

### Lain-lain

- Pastikan environment variable tidak tercetak di log.
- Jika ada perubahan struktur response API (misal field rename), sesuaikan mapping di folder `src/greatday/` atau `src/domain/`.

