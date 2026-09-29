(async () => {
  const data = await jagaHalaman(['admin'], 'pengaturan');
  if (!data) return;
  muatSettingsSaatIni();
})();

async function muatSettingsSaatIni() {
  const s = await apiFetch('/api/settings/public');
  document.getElementById('nomor-dana-baru').value = s.nomor_dana;
  document.getElementById('nama-penerima-baru').value = s.nama_penerima;
  const pratinjau = document.getElementById('pratinjau-qr');
  if (s.qr_image_path) {
    pratinjau.innerHTML = `<img src="${s.qr_image_path}" alt="QR saat ini" style="max-width:180px;border-radius:10px;">`;
  } else {
    pratinjau.innerHTML = '<p style="color:var(--abu); font-size:0.85rem;">Belum ada gambar QR diunggah, pakai QR otomatis dari teks.</p>';
  }
}

async function simpanPengaturan() {
  const nomorDana = document.getElementById('nomor-dana-baru').value.trim();
  const namaPenerima = document.getElementById('nama-penerima-baru').value.trim();
  const pesanEl = document.getElementById('pesan-pengaturan');

  const data = await apiFetch('/api/admin/pengaturan', {
    method: 'POST',
    body: JSON.stringify({ nomorDana, namaPenerima })
  });

  pesanEl.innerHTML = data.ok
    ? '<div class="pesan sukses">Pengaturan tersimpan.</div>'
    : `<div class="pesan gagal">${data.pesan}</div>`;
}

async function unggahQR() {
  const fileEl = document.getElementById('file-qr');
  const pesanEl = document.getElementById('pesan-qr');
  if (!fileEl.files[0]) {
    pesanEl.innerHTML = '<div class="pesan gagal">Pilih file gambar dulu.</div>';
    return;
  }
  const formData = new FormData();
  formData.append('qr', fileEl.files[0]);

  const data = await apiFetch('/api/admin/pengaturan/qr', { method: 'POST', body: formData });

  if (data.ok) {
    pesanEl.innerHTML = '<div class="pesan sukses">QR berhasil diunggah.</div>';
    muatSettingsSaatIni();
  } else {
    pesanEl.innerHTML = `<div class="pesan gagal">${data.pesan}</div>`;
  }
}

async function hapusQR() {
  const pesanEl = document.getElementById('pesan-qr');
  if (!confirm('Hapus gambar QR yang diunggah? Nanti dipakai QR otomatis dari teks.')) return;
  const data = await apiFetch('/api/admin/pengaturan/qr', { method: 'DELETE' });
  if (data.ok) {
    document.getElementById('file-qr').value = '';
    pesanEl.innerHTML = '<div class="pesan sukses">QR berhasil dihapus.</div>';
    muatSettingsSaatIni();
  } else {
    pesanEl.innerHTML = `<div class="pesan gagal">${data.pesan}</div>`;
  }
}
