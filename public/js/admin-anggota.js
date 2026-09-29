(async () => {
  const data = await jagaHalaman(['admin'], 'anggota');
  if (!data) return;
  muatDaftarAnggota();
})();

async function tambahAnggota() {
  const nama = document.getElementById('nama-baru').value.trim();
  const username = document.getElementById('username-baru').value.trim();
  const pin = document.getElementById('pin-baru').value;
  const pesanEl = document.getElementById('pesan-tambah');

  const data = await apiFetch('/api/admin/anggota', {
    method: 'POST',
    body: JSON.stringify({ nama, username, pin })
  });

  if (data.ok) {
    pesanEl.innerHTML = '<div class="pesan sukses">Akun anggota berhasil ditambahkan.</div>';
    document.getElementById('nama-baru').value = '';
    document.getElementById('username-baru').value = '';
    document.getElementById('pin-baru').value = '';
    muatDaftarAnggota();
  } else {
    pesanEl.innerHTML = `<div class="pesan gagal">${data.pesan}</div>`;
  }
}

async function muatDaftarAnggota() {
  const data = await apiFetch('/api/admin/anggota');
  const bodyEl = document.getElementById('body-anggota-list');
  if (data.length === 0) {
    bodyEl.innerHTML = '<tr><td colspan="4">Belum ada anggota terdaftar.</td></tr>';
    return;
  }
  bodyEl.innerHTML = data.map(u => `
    <tr>
      <td class="nama">${u.nama}</td>
      <td>${u.username}</td>
      <td>${formatTanggal(u.created_at)}</td>
      <td><button class="bahaya kecil" onclick="hapusAnggota(${u.id})">Hapus</button></td>
    </tr>
  `).join('');
}

async function hapusAnggota(id) {
  if (!confirm('Yakin hapus akun anggota ini? Data pembayaran lama tetap tersimpan.')) return;
  const data = await apiFetch(`/api/admin/anggota/${id}`, { method: 'DELETE' });
  if (data.ok) muatDaftarAnggota();
}
