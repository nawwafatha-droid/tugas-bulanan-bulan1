# Panduan Deploy Kas Bulanan — Railway / Render

Aplikasi ini (Express + Socket.IO + SQLite) cocok di hosting Node.js
dengan koneksi hidup terus dan penyimpanan permanen.
JANGAN pakai Vercel (serverless): chat realtime putus, database & upload QR hilang.

## 0. Syarat

- Node.js 22+ (sudah dikunci di `package.json` → `engines`)
- Akun GitHub + akun Railway (railway.app) atau Render (render.com)
- Port otomatis dari hosting (kode sudah pakai `process.env.PORT || 3000`)
   
## 1. Upload proyek ke GitHub

```powershell
cd "C:\Users\Empat Lima\tahun baru pondok it\bulan 1\kas-bulanan"
git init
git add server.js database.js package.json public
git commit -m "Kas Bulanan siap deploy"
# buat repo baru di github.com, lalu:
git remote add origin https://github.com/USERNAME/kas-bulanan.git
git push -u origin main
```

> Jangan ikutkan `node_modules/`, `data/*.db-shm`, `data/*.db-wal`,
> dan file `*-out.log` / `*-err.log`.

## 2A. Deploy ke Railway (disarankan)

1. Buka railway.app → **New Project → Deploy from GitHub** → pilih repo.
2. Railway otomatis `npm install` + `npm start`. Tunggu sampai status Active.
3. **Wajib: pasang Volume** (agar database & QR tidak hilang tiap deploy):
   Service → **Volumes → New Volume**, tambahkan 2 volume:
   - Mount path: `/app/data` (database SQLite)
   - Mount path: `/app/public/uploads` (gambar QR)
4. Buka **Settings → Networking → Generate Domain** untuk URL publik.
5. Selesai — buka URL, login admin default: `admin` / `000000`
   (SEGERA ganti PIN setelah online!)

## 2B. Deploy ke Render (alternatif)

1. Buka render.com → **New → Web Service** → hubungkan repo GitHub.
2. Isi: **Build Command** `npm install`, **Start Command** `npm start`.
3. **Wajib: tambah Disk** (agar database tidak hilang):
   Service → **Disks → Add Disk**, Name `kas-data`,
   Mount Path `/opt/render/project/src/data`, Size 1 GB.
   (Upload QR tanpa disk ikut hilang tiap deploy — upload ulang saja bila perlu.)
4. Klik **Create Web Service**, tunggu live. Catatan: paket gratis
   tidur setelah idle ±15 menit (dibuka pertama kali agak lambat).

## 3. Setelah online

- [ ] Login admin, ganti PIN `000000`
- [ ] Isi Nomor DANA + QR di Pengaturan
- [ ] Buat akun anggota
- [ ] Coba bayar 1 bulan + cek Tabel 1 & 2
- [ ] Coba chat 2 akun (stiker + hapus pesan admin)
