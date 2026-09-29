const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');
const { db, URUTAN_BULAN, hashPin } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/', (req, res) => res.redirect('/login.html'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Upload QR ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public', 'uploads'),
    filename: (req, file, cb) => cb(null, 'qr' + path.extname(file.originalname || '.png'))
  }),
  limits: { fileSize: 3 * 1024 * 1024 }
});

// ================= SESSION HELPERS =================
function buatToken() {
  return crypto.randomBytes(24).toString('hex');
}

function simpanSession(token, user) {
  db.prepare(`
    INSERT INTO sessions (token, user_id, username, nama, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, user.id || null, user.username, user.nama, user.role, new Date().toISOString());

  db.prepare(`
    INSERT INTO aktivitas_login (username, nama, role, waktu)
    VALUES (?, ?, ?, ?)
  `).run(user.username, user.nama, user.role, new Date().toISOString());
}

function ambilSession(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
}

function authRequired(rolesDiizinkan) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sesi = ambilSession(token);
    if (!sesi) return res.status(401).json({ ok: false, pesan: 'Sesi tidak valid, silakan login ulang.' });
    if (rolesDiizinkan && !rolesDiizinkan.includes(sesi.role)) {
      return res.status(403).json({ ok: false, pesan: 'Tidak punya akses untuk aksi ini.' });
    }
    req.user = sesi;
    next();
  };
}

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

// ================= AUTH =================
app.post('/api/login', (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) return res.status(400).json({ ok: false, pesan: 'Username dan PIN wajib diisi.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || user.pin_hash !== hashPin(pin)) {
    return res.status(401).json({ ok: false, pesan: 'Username atau PIN salah.' });
  }

  const token = buatToken();
  simpanSession(token, user);
  res.json({ ok: true, token, role: user.role, username: user.username, nama: user.nama });
});

app.post('/api/guest', (req, res) => {
  const token = buatToken();
  simpanSession(token, { id: null, username: 'tamu', nama: 'Tamu', role: 'tamu' });
  res.json({ ok: true, token, role: 'tamu', username: 'tamu', nama: 'Tamu' });
});

app.post('/api/logout', authRequired(), (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization.slice(7));
  res.json({ ok: true });
});

app.get('/api/me', authRequired(), (req, res) => {
  res.json({ ok: true, username: req.user.username, nama: req.user.nama, role: req.user.role });
});

app.get('/api/admin/aktivitas-login', authRequired(['admin']), (req, res) => {
  const awalHari = new Date();
  awalHari.setHours(0, 0, 0, 0);
  const rows = db.prepare(`
    SELECT username, nama, MAX(waktu) as waktu
    FROM aktivitas_login
    WHERE role = 'admin' AND waktu >= ?
    GROUP BY username
    ORDER BY waktu DESC
  `).all(awalHari.toISOString());
  res.json(rows);
});

// ================= INFO PUBLIK (untuk halaman bayar) =================
app.get('/api/settings/public', authRequired(['admin', 'anggota']), (req, res) => {
  const s = getSettings();
  res.json({ nomor_dana: s.nomor_dana, nama_penerima: s.nama_penerima, qr_image_path: s.qr_image_path });
});

// ================= RINGKASAN =================
app.get('/api/summary', authRequired(['admin', 'anggota', 'tamu']), (req, res) => {
  const rows = db.prepare('SELECT tipe, nominal FROM buku_kas ORDER BY id ASC').all();
  let saldo = 0;
  for (const r of rows) saldo += r.tipe === 'masuk' ? r.nominal : -r.nominal;

  const now = new Date();
  const bulanIni = URUTAN_BULAN[now.getMonth()];
  const tahunIni = now.getFullYear();

  const totalBulanIni = db.prepare(
    'SELECT COALESCE(SUM(nominal),0) as total FROM pembayaran WHERE bulan = ? AND tahun = ?'
  ).get(bulanIni, tahunIni).total;

  const jumlahAnggotaBulanIni = db.prepare(
    'SELECT COUNT(DISTINCT nama) as jumlah FROM pembayaran WHERE bulan = ? AND tahun = ?'
  ).get(bulanIni, tahunIni).jumlah;

  res.json({ saldo, bulanIni, tahunIni, totalBulanIni, jumlahAnggotaBulanIni });
});

// ================= BAYAR (anggota, identitas dari sesi) =================
app.post('/api/bayar', authRequired(['anggota']), (req, res) => {
  const { bulan, bulanList, tahun, nominal } = req.body;
  // Dukung bayar 1 bulan (format lama) atau banyak bulan sekaligus (format baru)
  const daftarBulan = Array.isArray(bulanList) && bulanList.length > 0 ? bulanList : (bulan ? [bulan] : []);
  if (daftarBulan.length === 0 || !tahun || !nominal) {
    return res.status(400).json({ ok: false, pesan: 'Data belum lengkap.' });
  }
  if (daftarBulan.length > 12) return res.status(400).json({ ok: false, pesan: 'Maksimal 12 bulan sekaligus.' });
  for (const b of daftarBulan) {
    if (!URUTAN_BULAN.includes(String(b).trim())) {
      return res.status(400).json({ ok: false, pesan: `Nama bulan tidak valid: ${b}` });
    }
  }

  const nominalAngka = parseInt(nominal, 10);
  if (isNaN(nominalAngka) || nominalAngka <= 0) {
    return res.status(400).json({ ok: false, pesan: 'Nominal tidak valid.' });
  }
  const tahunAngka = parseInt(tahun, 10);
  if (isNaN(tahunAngka) || tahunAngka < 2000 || tahunAngka > 2100) {
    return res.status(400).json({ ok: false, pesan: 'Tahun tidak valid.' });
  }

  const tanggal = new Date().toISOString();
  const insertPembayaran = db.prepare(`
    INSERT INTO pembayaran (user_id, nama, nominal, bulan, tahun, tanggal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertBukuKas = db.prepare(`
    INSERT INTO buku_kas (tanggal, keterangan, tipe, nominal, pembayaran_id)
    VALUES (?, ?, 'masuk', ?, ?)
  `);

  // Satu baris pembayaran + satu baris buku kas per bulan
  const transaksi = () => {
    for (const b of daftarBulan) {
      const namaBulan = String(b).trim();
      const info = insertPembayaran.run(req.user.user_id, req.user.nama, nominalAngka, namaBulan, tahunAngka, tanggal);
      const pembayaranId = Number(info.lastInsertRowid);
      const keterangan = `Pembayaran kas - ${req.user.nama} (${namaBulan} ${tahunAngka})`;
      insertBukuKas.run(tanggal, keterangan, nominalAngka, pembayaranId);
    }
  };

  try {
    transaksi();
  } catch (e) {
    console.error('Gagal simpan pembayaran:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menyimpan pembayaran.' });
  }
  const total = nominalAngka * daftarBulan.length;
  res.json({ ok: true, jumlahBulan: daftarBulan.length, total, pesan: `Pembayaran ${daftarBulan.length} bulan berhasil dikonfirmasi dan tercatat.` });
});

// ================= TABEL 1: rekap per anggota =================
app.get('/api/rekap-anggota', authRequired(['admin', 'anggota', 'tamu']), (req, res) => {
  const rows = db.prepare('SELECT * FROM pembayaran ORDER BY nama ASC, tahun ASC').all();

  const kolomSet = new Map();
  for (const r of rows) {
    const key = `${r.tahun}-${r.bulan}`;
    if (!kolomSet.has(key)) {
      kolomSet.set(key, { bulan: r.bulan, tahun: r.tahun, urut: r.tahun * 100 + URUTAN_BULAN.indexOf(r.bulan) });
    }
  }

  if (kolomSet.size === 0) {
    const now = new Date();
    const tahunAwal = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    for (let i = 9; i < 12; i++) {
      kolomSet.set(`${tahunAwal}-${URUTAN_BULAN[i]}`, { bulan: URUTAN_BULAN[i], tahun: tahunAwal, urut: tahunAwal * 100 + i });
    }
    for (let i = 0; i < 9; i++) {
      kolomSet.set(`${tahunAwal + 1}-${URUTAN_BULAN[i]}`, { bulan: URUTAN_BULAN[i], tahun: tahunAwal + 1, urut: (tahunAwal + 1) * 100 + i });
    }
  }
  const kolomBulan = [...kolomSet.values()].sort((a, b) => a.urut - b.urut);

  const perNama = new Map();
  for (const r of rows) {
    if (!perNama.has(r.nama)) {
      perNama.set(r.nama, { nama: r.nama, totalJumlah: 0, tanggalTerakhir: r.tanggal, perBulan: {} });
    }
    const entri = perNama.get(r.nama);
    entri.totalJumlah += r.nominal;
    const key = `${r.tahun}-${r.bulan}`;
    entri.perBulan[key] = (entri.perBulan[key] || 0) + r.nominal;
    if (new Date(r.tanggal) > new Date(entri.tanggalTerakhir)) entri.tanggalTerakhir = r.tanggal;
  }

  const data = [...perNama.values()].map((entri, idx) => ({
    no: idx + 1,
    nama: entri.nama,
    tanggalTerakhir: entri.tanggalTerakhir,
    totalJumlah: entri.totalJumlah,
    perBulan: kolomBulan.map(k => entri.perBulan[`${k.tahun}-${k.bulan}`] || null)
  }));

  res.json({ kolomBulan, data });
});

// ================= TABEL 2: buku kas =================
app.get('/api/buku-kas', authRequired(['admin', 'anggota', 'tamu']), (req, res) => {
  const rows = db.prepare('SELECT * FROM buku_kas ORDER BY id ASC').all();
  let saldo = 0;
  const data = rows.map((r, idx) => {
    saldo += r.tipe === 'masuk' ? r.nominal : -r.nominal;
    return {
      id: r.id,
      no: idx + 1,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      masuk: r.tipe === 'masuk' ? r.nominal : 0,
      keluar: r.tipe === 'keluar' ? r.nominal : 0,
      saldo
    };
  });
  res.json(data);
});

// ================= ADMIN: hapus riwayat buku kas =================
// Hapus baris terpilih (beserta data pembayaran terkait bila ada)
app.post('/api/admin/buku-kas/hapus-pilihan', authRequired(['admin']), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, pesan: 'Tidak ada baris yang dipilih.' });
  }
  const daftarId = ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  if (daftarId.length === 0) return res.status(400).json({ ok: false, pesan: 'ID tidak valid.' });
  try {
    const tanda = daftarId.map(() => '?').join(',');
    const baris = db.prepare(`SELECT id, pembayaran_id FROM buku_kas WHERE id IN (${tanda})`).all(...daftarId);
    const idPembayaran = [...new Set(baris.map(b => b.pembayaran_id).filter(Boolean))];
    db.prepare(`DELETE FROM buku_kas WHERE id IN (${tanda})`).run(...daftarId);
    if (idPembayaran.length > 0) {
      const tanda2 = idPembayaran.map(() => '?').join(',');
      db.prepare(`DELETE FROM pembayaran WHERE id IN (${tanda2})`).run(...idPembayaran);
    }
  } catch (e) {
    console.error('Gagal hapus riwayat pilihan:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menghapus riwayat.' });
  }
  res.json({ ok: true });
});

// Hapus SEMUA riwayat (buku kas + pembayaran) — reset total
app.delete('/api/admin/buku-kas', authRequired(['admin']), (req, res) => {
  try {
    db.prepare('DELETE FROM buku_kas').run();
    db.prepare('DELETE FROM pembayaran').run();
  } catch (e) {
    console.error('Gagal hapus semua riwayat:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menghapus semua riwayat.' });
  }
  res.json({ ok: true });
});

// ================= ADMIN: kelola akun anggota =================
app.get('/api/admin/anggota', authRequired(['admin']), (req, res) => {
  const rows = db.prepare("SELECT id, username, nama, created_at FROM users WHERE role = 'anggota' ORDER BY nama ASC").all();
  res.json(rows);
});

app.post('/api/admin/anggota', authRequired(['admin']), (req, res) => {
  const { username, pin, nama } = req.body;
  if (!username || !pin || !nama) return res.status(400).json({ ok: false, pesan: 'Data belum lengkap.' });

  const sudahAda = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (sudahAda) return res.status(400).json({ ok: false, pesan: 'Username sudah dipakai.' });

  db.prepare(`
    INSERT INTO users (username, pin_hash, nama, role, created_at)
    VALUES (?, ?, ?, 'anggota', ?)
  `).run(username.trim(), hashPin(pin), nama.trim(), new Date().toISOString());

  res.json({ ok: true });
});

app.delete('/api/admin/anggota/:id', authRequired(['admin']), (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'anggota'").run(req.params.id);
  res.json({ ok: true });
});

// ================= ADMIN: pengeluaran =================
app.post('/api/admin/pengeluaran', authRequired(['admin']), (req, res) => {
  const { keterangan, nominal } = req.body;
  const nominalAngka = parseInt(nominal, 10);
  if (!keterangan || isNaN(nominalAngka) || nominalAngka <= 0) {
    return res.status(400).json({ ok: false, pesan: 'Data pengeluaran tidak valid.' });
  }
  db.prepare(`
    INSERT INTO buku_kas (tanggal, keterangan, tipe, nominal)
    VALUES (?, ?, 'keluar', ?)
  `).run(new Date().toISOString(), keterangan.trim(), nominalAngka);
  res.json({ ok: true });
});

// ================= ADMIN: koreksi/hapus pembayaran =================
app.get('/api/admin/pembayaran', authRequired(['admin']), (req, res) => {
  res.json(db.prepare('SELECT * FROM pembayaran ORDER BY id DESC').all());
});

app.delete('/api/admin/pembayaran/:id', authRequired(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM buku_kas WHERE pembayaran_id = ?').run(id);
    db.prepare('DELETE FROM pembayaran WHERE id = ?').run(id);
  } catch (e) {
    console.error('Gagal hapus pembayaran:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menghapus data.' });
  }
  res.json({ ok: true });
});

// ================= ADMIN: pengaturan nomor DANA & QR =================
app.post('/api/admin/pengaturan', authRequired(['admin']), (req, res) => {
  const { nomorDana, namaPenerima } = req.body;
  const s = getSettings();
  db.prepare('UPDATE settings SET nomor_dana = ?, nama_penerima = ? WHERE id = 1').run(
    nomorDana || s.nomor_dana,
    namaPenerima || s.nama_penerima
  );
  res.json({ ok: true });
});

app.post('/api/admin/pengaturan/qr', authRequired(['admin']), upload.single('qr'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, pesan: 'File QR tidak ditemukan.' });
  db.prepare('UPDATE settings SET qr_image_path = ? WHERE id = 1').run('/uploads/' + req.file.filename);
  res.json({ ok: true, qr_image_path: '/uploads/' + req.file.filename });
});

// Hapus file QR yang diunggah — kembali pakai QR otomatis dari teks
app.delete('/api/admin/pengaturan/qr', authRequired(['admin']), (req, res) => {
  try {
    const s = db.prepare('SELECT qr_image_path FROM settings WHERE id = 1').get();
    if (s && s.qr_image_path) {
      const lokasi = path.join(__dirname, 'public', s.qr_image_path.replace(/^\/+/, ''));
      fs.unlink(lokasi, () => {});
    }
    db.prepare('UPDATE settings SET qr_image_path = NULL WHERE id = 1').run();
  } catch (e) {
    console.error('Gagal hapus QR:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menghapus QR.' });
  }
  res.json({ ok: true });
});

// ================= CHAT (riwayat via REST, live via Socket.IO) =================
// Daftar kata kotor (Indonesia + Inggris umum) — otomatis ditolak & tidak disimpan
const KATA_KOTOR = [
  'anjing', 'anjir', 'anjay', 'babi', 'bangsat', 'bajingan', 'brengsek',
  'tolol', 'goblok', 'idiot', 'bodoh', 'dungu', 'bejat', 'bejad',
  'kontol', 'memek', 'ngentot', 'ngentod', 'jancuk', 'jancok', 'asu',
  'kampret', 'tai', 'taik', 'perek', 'lonte', 'pelacur', 'sundal',
  'bitch', 'fuck', 'shit', 'dick', 'pussy', 'bastard', 'asshole'
];

function mengandungKataKotor(teks) {
  const rendah = String(teks || '').toLowerCase();
  return KATA_KOTOR.some(k => {
    const pola = new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, 'i');
    return pola.test(rendah);
  });
}

app.get('/api/chat', authRequired(['admin', 'anggota']), (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id ASC LIMIT 200').all());
});

// Hapus pesan chat — hanya admin
app.delete('/api/chat/:id', authRequired(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, pesan: 'ID tidak valid.' });
  try {
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  } catch (e) {
    console.error('Gagal hapus chat:', e);
    return res.status(500).json({ ok: false, pesan: 'Gagal menghapus pesan.' });
  }
  io.emit('chat:hapus', { id });
  res.json({ ok: true });
});

// ================= SOCKET.IO: chat & status online =================
const onlineUsers = new Map(); // socket.id -> { username, nama, role }

function kirimDaftarOnlineKeAdmin() {
  // 1 pengguna = 1 baris: gabungkan koneksi ganda (banyak tab) per username.
  // Tamu (username sama-sama 'tamu') tetap dihitung per koneksi.
  const unik = new Map();
  for (const [idSoket, u] of onlineUsers) {
    const kunci = u.role === 'tamu' ? `tamu:${idSoket}` : `${u.role}:${u.username}`;
    if (!unik.has(kunci)) unik.set(kunci, u);
  }
  io.to('admin-room').emit('online-list', [...unik.values()]);
}

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const sesi = ambilSession(token);
  if (!sesi) return next(new Error('Sesi tidak valid'));
  socket.data.user = sesi;
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  onlineUsers.set(socket.id, { username: user.username, nama: user.nama, role: user.role });

  if (user.role === 'admin') socket.join('admin-room');
  kirimDaftarOnlineKeAdmin();

  socket.on('chat:kirim', (pesan) => {
    if (user.role !== 'admin' && user.role !== 'anggota') return;
    const teks = String(pesan || '').trim().slice(0, 500);
    if (!teks) return;
    // Otomatis tolak kalimat kotor — tidak disimpan & tidak disiarkan
    if (mengandungKataKotor(teks)) {
      socket.emit('chat:ditolak', { pesan: 'Pesan mengandung kata tidak pantas dan otomatis dihapus.' });
      return;
    }
    const waktu = new Date().toISOString();
    let idBaru = null;
    try {
      const info = db.prepare(`
        INSERT INTO messages (username, nama, role, pesan, waktu)
        VALUES (?, ?, ?, ?, ?)
      `).run(user.username, user.nama, user.role, teks, waktu);
      idBaru = Number(info.lastInsertRowid);
    } catch (e) {
      console.error('Gagal simpan chat:', e);
      return;
    }

    io.emit('chat:baru', { id: idBaru, username: user.username, nama: user.nama, role: user.role, pesan: teks, waktu });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    kirimDaftarOnlineKeAdmin();
  });
});

server.listen(PORT, () => {
  console.log(`Kas Bulanan jalan di http://localhost:${PORT}`);
});
