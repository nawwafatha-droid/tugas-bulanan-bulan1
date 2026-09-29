(async () => {
  const data = await jagaHalaman(['admin'], 'pengeluaran');
  if (!data) return;
})();

async function tambahPengeluaran() {
  const keterangan = document.getElementById('keterangan-keluar').value.trim();
  const nominal = document.getElementById('nominal-keluar').value;
  const pesanEl = document.getElementById('pesan-keluar');

  const data = await apiFetch('/api/admin/pengeluaran', {
    method: 'POST',
    body: JSON.stringify({ keterangan, nominal })
  });

  if (data.ok) {
    pesanEl.innerHTML = '<div class="pesan sukses">Pengeluaran tersimpan.</div>';
    document.getElementById('keterangan-keluar').value = '';
    document.getElementById('nominal-keluar').value = '';
  } else {
    pesanEl.innerHTML = `<div class="pesan gagal">${data.pesan}</div>`;
  }
}
