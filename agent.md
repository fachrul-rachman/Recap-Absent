Berikut **agent.md** (bukan prompt) yang bisa kamu taruh di repo agar Codex/agent lain membaca spesifikasi dan menghasilkan project script yang rapi, profesional, dan robust sesuai requirement kamu.

---

# agent.md

## Goal

Bangun project **Node.js (ESM)** untuk membuat rekap absensi GreatDayHR dan kirim hasilnya ke **Discord webhook**.

Project harus kompatibel dengan:

* Node: **v24.11.1**
* npm: **11.7.0**
* Tanpa dependency eksternal (default: **zero dependencies**)

Project harus menyediakan CLI:

* `node src/cli.mjs daily`
* `node src/cli.mjs weekly`
* `node src/cli.mjs monthly`

Tambahkan flag:

* `--force` (bypass idempotency)

---

## Security Requirements (Hard Constraints)

1. **Dilarang** menambahkan dependency yang terkait React Server Components / bundler RSC:

   * `react`, `next`, `react-server-dom-webpack`, `react-server-dom-parcel`, `react-server-dom-turbopack`, dsb.
2. Gunakan `fetch` bawaan Node 24 untuk HTTP.
3. Jika benar-benar butuh dependency, harus ada justifikasi kuat (tapi target utama: **tanpa dependency**).
4. Jangan log secret/token ke stdout.

---

## API Base & Auth

### Base URL

* `BASE_URL=https://dev.greatdayhr.com/api`

### Auth contract

* Login: `POST /auth/login`

  * body: `{ "accessKey": SECRET_KEY, "accessSecret": ACCESS_SECRET }`
  * return: `access_token`, `refresh_token`, `created_at`, `expired_at`
* Refresh: `POST /auth/refresh`

  * body: `{ "refreshToken": refresh_token }`

### Token rules

* `access_token` valid 24 jam
* `refresh_token` valid 1 minggu
* **Refresh hanya boleh dipakai jika access token benar-benar expired**.

  * Backend menolak refresh jika access token belum expired.
* Jika dapat 401:

  * cek `expired_at` terlebih dulu
  * kalau expired → refresh → retry 1x
  * kalau belum expired → fail dengan error jelas (jangan refresh)

### Timezone rule

* Semua timestamp berakhiran `Z` harus diperlakukan sebagai **WIB local time** (anggap `Z` hanya label, **bukan UTC**).

---

## Endpoints & Data Rules

### Attendance

* `GET /attendances/byPeriod?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
* Field penting:

  * `shiftstarttime`, `shiftendtime`, `starttime`, `endtime`, `attendCode`, `daytype`, `empId`, `empNo`, (nama/posisi kalau tersedia)
* **Absent/alpha final**: `attendCode == "ABS"` dan `daytype != "OFF"`
* Telat: jika `starttime` ada dan `starttime > shiftstarttime`

  * menit telat = selisih menit (tanpa threshold/grace)
* Pulang awal: jika `endtime` ada dan `endtime < shiftendtime`

  * menit = selisih menit (tanpa threshold)
* Tidak ada overnight shift.

### Leave

* `GET /leave` (tanpa filter tanggal)
* Ada paging (response punya `totalPage`)
* Field penting:

  * `leaveStartdate`, `leaveEnddate`, `status`, `typeRequest`, `empId`, `fullName`
* status: 3=approved, 2=pending, 1=rejected
* Hanya gunakan `typeRequest == "Leave Request"`
* Filter tanggal dilakukan di client:

  * include jika range `leaveStartdate..leaveEnddate` mencakup tanggal target / berada dalam window
* **ABS final**: jika attendance `ABS`, jangan override oleh leave.

### Overtime

* `GET /overtime` (tanpa filter tanggal)
* Ada paging `totalPage`
* Field penting: `ovtDate`, `ovthours`, `status`, `empId`, `fullName`
* approved: status 3
* menit lembur = `round(parseFloat(ovthours) * 60)`
* Filter tanggal/window dilakukan di client.

---

## Schedules (Logic Windows)

Script tidak perlu cron internal; cukup mode CLI. Cron dijelaskan di tutorial.

### Daily (jalan tiap hari 09:00 WIB)

A) Rekap lengkap **kemarin**:

* approved absence (leave status 3 yang mencakup tanggal kemarin)
* absent/alpha (attendance `ABS` kemarin, `daytype != OFF`)
* telat (kemarin)
* pulang awal (kemarin)
* lembur approved (overtime status 3, `ovtDate` = kemarin; count + total menit)

B) Monitor **hari ini**:

* belum hadir jam 09:00: attendance byPeriod untuk hari ini dengan `starttime` kosong/null
* pending leaves: leave status 2 yang mencakup hari ini
* telat hari ini: yang sudah punya `starttime` dan `starttime > shiftstarttime`

### Weekly (jalan setiap Sabtu)

Window: **Senin–Jumat minggu berjalan** (berdasarkan tanggal eksekusi Sabtu itu).

* telat: count + total menit per orang
* lembur: count + total menit per orang
* cuti approved: leave status 3 dalam window (per orang)

### Monthly (jalan tanggal 3)

Window: tanggal 1 s/d akhir bulan **sebelumnya**

* Top 5 telat (ranking):

  1. total menit DESC
  2. jumlah kejadian DESC
  3. empId ASC
* Top 5 lembur (ranking sama, berbasis menit lembur + count)

---

## Discord Output

* Kirim via webhook: `DISCORD_WEBHOOK_URL`
* POST JSON: `{ "content": "..." }`
* Format message:

  * Judul + periode
  * Ringkasan total (counts)
  * Detail list max 30 baris per section; sisanya ringkas: “dan X lainnya”
  * Monthly wajib ada Top 5 telat & Top 5 lembur

---

## Paging Requirements (Robust)

Karena `/leave` dan `/overtime` tanpa filter tanggal:

* Implement `fetchAllPages(path, queryBase)`:

  * start `page = 1`
  * loop sampai `page > totalPage`
  * validasi `totalPage` integer >= 1
  * safety break jika `page > 500`
  * gabungkan semua items
* Struktur list mungkin berbeda; dukung minimal:

  * root array
  * `data`
  * `items`
  * `rows`
* Kalau tidak ketemu list, throw error jelas yang menyebut shape keys yang diterima.

---

## Idempotency

Simpan state ke file `state.json` (tanpa DB).

* daily key: `daily:YYYY-MM-DD`
* weekly key: `weekly:YYYY-MM-DD_to_YYYY-MM-DD`
* monthly key: `monthly:YYYY-MM`

Jika key sudah ada dan tidak ada `--force`, exit tanpa post Discord.

State harus menyimpan minimal:

* `lastPosts: { [key]: { postedAtIso, discordMessageHash } }` (atau minimal `true`)
* (opsional) info debug ringan tanpa secrets

---

## File Structure (No Mixed Script)

Project harus rapi, dipisah per concern:

```
.
├─ package.json
├─ .env.example
├─ tutorial.md
├─ state.json
└─ src/
   ├─ cli.mjs
   ├─ config.mjs
   ├─ http.mjs
   ├─ auth.mjs
   ├─ greatday/
   │  ├─ attendance.mjs
   │  ├─ leave.mjs
   │  ├─ overtime.mjs
   │  └─ paging.mjs
   ├─ domain/
   │  ├─ windows.mjs
   │  ├─ metrics.mjs
   │  ├─ aggregate.mjs
   │  └─ ranking.mjs
   ├─ report/
   │  ├─ formatDiscord.mjs
   │  └─ limits.mjs
   └─ state/
      ├─ stateFile.mjs
      └─ idempotency.mjs
```

Catatan:

* Semua module ESM.
* `cli.mjs` hanya parsing arg + memanggil runner.
* Tidak ada “campur aduk” semua logic di satu file.

---

## Config (.env)

Buat `.env.example` dengan variabel:

* `BASE_URL=https://dev.greatdayhr.com/api`
* `SECRET_KEY=`
* `ACCESS_SECRET=`
* `DISCORD_WEBHOOK_URL=`
* `STATE_FILE=state.json` (optional; default state.json)

Script harus membaca env via `process.env`. Karena tanpa dependency, **jangan pakai dotenv**.
Tutorial harus menjelaskan cara export env atau pakai `.env` via shell.

---

## Deliverables (Wajib Dihasilkan)

1. `package.json` minimal:

   * `"type": "module"`
   * scripts opsional: `"daily"`, `"weekly"`, `"monthly"`
2. Source code sesuai struktur di atas.
3. `.env.example`
4. `tutorial.md` berisi:

   * prasyarat Node 24
   * setup env (contoh export variabel)
   * cara run tiap mode
   * contoh crontab (daily 09:00, weekly Sabtu, monthly tanggal 3)
   * troubleshooting (401 refresh rule, paging, idempotency)
5. `state.json` awal kosong valid JSON.

---