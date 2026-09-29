const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new DatabaseSync(path.join(dataDir, 'kas.db'));
db.exec('PRAGMA journal_mode = WAL');

// ---------- Skema tabel ----------
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nomor_dana TEXT NOT NULL,
  nama_penerima TEXT NOT NULL,
  qr_image_path TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','anggota')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER,
  username TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','anggota','tamu')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pembayaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  nama TEXT NOT NULL,
  nominal INTEGER NOT NULL,
  bulan TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  tanggal TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buku_kas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal TEXT NOT NULL,
  keterangan TEXT NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('masuk','keluar')),
  nominal INTEGER NOT NULL,
  pembayaran_id INTEGER,
  FOREIGN KEY (pembayaran_id) REFERENCES pembayaran(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL,
  pesan TEXT NOT NULL,
  waktu TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aktivitas_login (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','anggota','tamu')),
  waktu TEXT NOT NULL
);
`);

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

// ---------- Data awal ----------
const existingSettings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
if (!existingSettings) {
  db.prepare(`
    INSERT INTO settings (id, nomor_dana, nama_penerima, qr_image_path)
    VALUES (1, '081234567890', 'Nama Admin', NULL)
  `).run();
}

const adminAda = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminAda) {
  db.prepare(`
    INSERT INTO users (username, pin_hash, nama, role, created_at)
    VALUES ('admin', ?, 'Admin', 'admin', ?)
  `).run(hashPin('000000'), new Date().toISOString());
}

const URUTAN_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatRupiah(angka) {
  return 'Rp' + Number(angka || 0).toLocaleString('id-ID');
}

module.exports = { db, URUTAN_BULAN, formatRupiah, hashPin };
