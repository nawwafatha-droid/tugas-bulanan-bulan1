let peranSaatIni = null;
let modeHapusBukuKas = false;

(async () => {
  const data = await jagaHalaman(['admin', 'anggota', 'tamu'], 'tabel');
  if (!data) return;
  peranSaatIni = data.role;
  if (peranSaatIni === 'admin') document.getElementById('bagian-koreksi').classList.remove('tersembunyi');
  muatTabelAnggota();
  muatBukuKas();
  if (peranSaatIni === 'admin') muatDaftarPembayaran();
})();

async function muatTabelAnggota() {
  const { kolomBulan, data } = await apiFetch('/api/rekap-anggota');

  const headerEl = document.getElementById('header-anggota');
  headerEl.innerHTML = `
    <th>No</th><th>Nama</th>
    ${kolomBulan.map(k => `<th>${k.bulan} ${k.tahun}</th>`).join('')}
  `;

  const bodyEl = document.getElementById('body-anggota');
  if (data.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="${2 + kolomBulan.length}">Belum ada data pembayaran.</td></tr>`;
    return;
  }
  bodyEl.innerHTML = data.map(row => `
    <tr>
      <td>${row.no}</td>
      <td class="nama">${row.nama}</td>
      ${row.perBulan.map(v => `<td>${v ? formatRupiah(v) : '-'}</td>`).join('')}
    </tr>
  `).join('');
}

async function muatBukuKas() {
  const data = await apiFetch('/api/buku-kas');
  const hanyaAdmin = peranSaatIni === 'admin';
  const sedangMenghapus = hanyaAdmin && modeHapusBukuKas;
  const kolomPilih = document.getElementById('kolom-pilih-buku-kas');
  const aksiBukuKas = document.getElementById('aksi-buku-kas');
  const pemicuHapus = document.getElementById('pemicu-hapus-buku-kas');
  if (kolomPilih) kolomPilih.classList.toggle('tersembunyi', !sedangMenghapus);
  if (aksiBukuKas) aksiBukuKas.classList.toggle('tersembunyi', !sedangMenghapus);
  if (pemicuHapus) pemicuHapus.classList.toggle('tersembunyi', !hanyaAdmin || sedangMenghapus);
  const bodyEl = document.getElementById('body-buku-kas');
  if (data.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="${sedangMenghapus ? 7 : 6}">Belum ada transaksi.</td></tr>`;
    return;
  }
  bodyEl.innerHTML = data.map(row => `
    <tr>
      ${sedangMenghapus ? `<td><input type="checkbox" class="pilih-buku-kas" value="${row.id}"></td>` : ''}
      <td>${row.no}</td>
      <td>${formatTanggal(row.tanggal)}</td>
      <td style="text-align:left">${row.keterangan}</td>
      <td>${row.masuk ? formatRupiah(row.masuk) : '-'}</td>
      <td>${row.keluar ? formatRupiah(row.keluar) : '-'}</td>
      <td><b>${formatRupiah(row.saldo)}</b></td>
    </tr>
  `).join('');
}

function togglePilihSemuaBukuKas() {
  const induk = document.getElementById('pilih-semua-buku-kas');
  document.querySelectorAll('.pilih-buku-kas').forEach(c => { c.checked = induk.checked; });
}

// Mode hapus: pilihan & tombol aksi baru muncul setelah tombol Hapus diklik
function masukModeHapusBukuKas() {
  if (peranSaatIni !== 'admin') return;
  modeHapusBukuKas = true;
  muatBukuKas();
}

function batalModeHapusBukuKas() {
  modeHapusBukuKas = false;
  const induk = document.getElementById('pilih-semua-buku-kas');
  if (induk) induk.checked = false;
  muatBukuKas();
}

async function muatUlangSemuaTabel() {
  muatTabelAnggota();
  muatBukuKas();
  if (peranSaatIni === 'admin') muatDaftarPembayaran();
}

async function hapusBukuKasPilihan() {
  const ids = [...document.querySelectorAll('.pilih-buku-kas:checked')].map(c => parseInt(c.value, 10));
  if (ids.length === 0) { alert('Pilih dulu baris yang mau dihapus.'); return; }
  if (!confirm(`Hapus ${ids.length} baris riwayat yang dipilih? Data pembayaran terkait juga ikut terhapus.`)) return;
  const data = await apiFetch('/api/admin/buku-kas/hapus-pilihan', { method: 'POST', body: JSON.stringify({ ids }) });
  if (data.ok) {
    modeHapusBukuKas = false;
    muatUlangSemuaTabel();
  } else {
    alert(data.pesan || 'Gagal menghapus riwayat.');
  }
}

async function hapusSemuaRiwayat() {
  if (!confirm('Hapus SEMUA riwayat buku kas dan pembayaran? Tindakan ini tidak bisa dibatalkan!')) return;
  if (!confirm('Yakin? Seluruh data transaksi akan dihapus permanen.')) return;
  const data = await apiFetch('/api/admin/buku-kas', { method: 'DELETE' });
  if (data.ok) {
    modeHapusBukuKas = false;
    muatUlangSemuaTabel();
  } else {
    alert(data.pesan || 'Gagal menghapus semua riwayat.');
  }
}

async function muatDaftarPembayaran() {
  const data = await apiFetch('/api/admin/pembayaran');
  const bodyEl = document.getElementById('body-koreksi');
  if (data.length === 0) {
    bodyEl.innerHTML = '<tr><td colspan="5">Belum ada data.</td></tr>';
    return;
  }
  bodyEl.innerHTML = data.map(row => `
    <tr>
      <td class="nama">${row.nama}</td>
      <td>${row.bulan} ${row.tahun}</td>
      <td>${formatRupiah(row.nominal)}</td>
      <td>${formatTanggal(row.tanggal)}</td>
      <td><button class="bahaya kecil" onclick="hapusPembayaran(${row.id})">Hapus</button></td>
    </tr>
  `).join('');
}

async function hapusPembayaran(id) {
  if (!confirm('Yakin hapus data pembayaran ini? Baris buku kas terkait juga akan terhapus.')) return;
  const data = await apiFetch(`/api/admin/pembayaran/${id}`, { method: 'DELETE' });
  if (data.ok) {
    muatDaftarPembayaran();
    muatTabelAnggota();
    muatBukuKas();
  } else {
    alert(data.pesan);
  }
}
