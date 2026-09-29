# Kas Bulanan (v2 — Login, Role, Chat)

Website pencatatan kas bulanan dengan login username/PIN, 3 peran (Admin, Anggota, Tamu), chat real-time, dan pencatatan otomatis.

## Cara Menjalankan

1. Pastikan **Node.js** terinstal (`node -v`).
2. Buka folder ini lewat terminal:
   ```
   npm install
   npm start
   ```
3. Buka browser ke `http://localhost:3000` (otomatis diarahkan ke halaman login).

Database SQLite otomatis dibuat di `data/kas.db` saat pertama kali dijalankan.

## Login Awal

Akun admin default dibuat otomatis:
- **Username**: `admin`
- **PIN**: `000000`

Login lewat tautan biru kecil **"Masuk khusus Admin"** di halaman login. Setelah masuk, **segera ganti nomor DANA** di menu Pengaturan, dan **tambahkan akun anggota** di menu Kelola Anggota (masing-masing anggota dapat username & PIN sendiri untuk login).

Tautan biru **"Masuk sebagai Tamu"** langsung masuk tanpa akun — hanya bisa melihat Tabel Kas & Data, tidak bisa bayar atau chat.

## Peran & Akses

| Peran | Bisa Apa |
|---|---|
| **Tamu** | Lihat Tabel Kas & Data saja |
| **Anggota** | Bayar kas, lihat Tabel Kas & Data, chat |
| **Admin** | Semua akses anggota + kelola akun anggota, tambah pengeluaran, koreksi/hapus data pembayaran, ubah nomor DANA & QR, lihat siapa saja yang sedang online, chat (pesan ditandai label admin) |

## Catatan Penting Soal Pembayaran

Website ini **tidak terhubung langsung ke API DANA**. Integrasi API resmi DANA hanya dibuka untuk akun merchant/bisnis terverifikasi lewat payment gateway (Duitku, Xendit, Midtrans, dll), bukan ke nomor DANA pribadi. Alurnya semi-otomatis:

1. Anggota login, isi bulan & nominal di halaman Bayar Kas.
2. Web menampilkan QR (gambar yang diunggah admin, atau QR teks otomatis) + nomor DANA tujuan.
3. Anggota transfer manual lewat app DANA.
4. Anggota klik **"Saya Sudah Transfer" → Konfirmasi** — identitasnya otomatis diambil dari sesi login, langsung tercatat ke Tabel 1 & Tabel 2.

Karena konfirmasi berbasis kejujuran anggota (bukan verifikasi otomatis ke saldo DANA asli), admin disarankan sesekali mengecek mutasi DANA dan mencocokkan dengan data di Tabel Kas. Data yang salah/curang bisa dihapus admin di halaman Tabel Kas & Data bagian "Koreksi".

## Catatan Keamanan (untuk tugas kuliah, bukan produksi)

- PIN disimpan dalam bentuk hash SHA-256, bukan plain text — tapi ini masih jauh lebih sederhana dari standar produksi (idealnya pakai bcrypt/argon2 + rate limiting).
- Sesi login disimpan di tabel `sessions` dengan token acak; token tidak kedaluwarsa otomatis (tidak ada auto-logout). Untuk tugas kuliah ini cukup, tapi bukan praktik produksi.
- Proteksi halaman di sisi klien (redirect kalau role tidak sesuai) hanya untuk UX; keamanan sesungguhnya ada di setiap endpoint API yang selalu mengecek token & role di server sebelum mengizinkan aksi.

## Struktur Halaman

- `/login.html` — Login anggota (username+PIN) + tautan Admin & Tamu
- `/anggota/bayar.html`, `/anggota/tabel.html`, `/anggota/chat.html`
- `/admin/dashboard.html` (ringkasan + user online), `/admin/anggota.html`, `/admin/pengeluaran.html`, `/admin/tabel.html`, `/admin/chat.html`, `/admin/pengaturan.html`
- `/guest/tabel.html` — Tampilan tamu, view only

## Struktur Database

- **users** — akun login (username, pin hash, nama, role)
- **sessions** — token sesi aktif
- **pembayaran** — catatan mentah setiap konfirmasi pembayaran anggota
- **buku_kas** — catatan kronologis pemasukan & pengeluaran + saldo berjalan
- **messages** — riwayat chat
- **settings** — nomor DANA, nama penerima, path gambar QR
