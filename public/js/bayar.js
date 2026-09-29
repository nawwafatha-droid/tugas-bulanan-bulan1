let dataForm = {};

const DAFTAR_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

(async () => {
  await jagaHalaman(['anggota'], 'bayar');
  buatGridBulan();
  hitungTotal();
})();

function buatGridBulan() {
  const grid = document.getElementById('grid-bulan');
  const bulanIni = DAFTAR_BULAN[new Date().getMonth()];
  grid.innerHTML = DAFTAR_BULAN.map(b => `
    <label class="opsi-bulan">
      <input type="checkbox" class="cek-bulan" value="${b}" ${b === bulanIni ? 'checked' : ''} onchange="hitungTotal()">
      <span>${b}</span>
    </label>
  `).join('');
}

function bulanTerpilih() {
  return [...document.querySelectorAll('.cek-bulan:checked')].map(c => c.value);
}

function hitungTotal() {
  const nominal = Number(document.getElementById('nominal').value) || 0;
  const jumlah = bulanTerpilih().length;
  document.getElementById('jumlah-bulan-tampil').textContent =
    jumlah === 0 ? '0 bulan dipilih' : `${jumlah} bulan dipilih (${bulanTerpilih().join(', ')})`;
  document.getElementById('total-tampil').textContent =
    jumlah === 0 || nominal <= 0 ? '-' : formatRupiah(nominal * jumlah);
}

async function buatQR() {
  const daftarBulan = bulanTerpilih();
  const tahun = document.getElementById('tahun').value;
  const nominal = document.getElementById('nominal').value;

  if (daftarBulan.length === 0) {
    alert('Pilih minimal 1 bulan dulu.');
    return;
  }
  if (!nominal || Number(nominal) <= 0) {
    alert('Isi nominal dengan benar dulu.');
    return;
  }
  dataForm = { bulanList: daftarBulan, tahun, nominal };
  const total = Number(nominal) * daftarBulan.length;

  const settings = await apiFetch('/api/settings/public');

  document.getElementById('nomor-dana').textContent = settings.nomor_dana;
  document.getElementById('nama-penerima').textContent = settings.nama_penerima;
  document.getElementById('nominal-tampil').textContent =
    `${formatRupiah(total)} (${daftarBulan.length} bulan @ ${formatRupiah(nominal)})`;

  const qrEl = document.getElementById('qr-code');
  qrEl.innerHTML = '';

  if (settings.qr_image_path) {
    const img = document.createElement('img');
    img.src = settings.qr_image_path;
    img.alt = 'QR DANA';
    img.style.maxWidth = '220px';
    img.style.borderRadius = '10px';
    qrEl.appendChild(img);
  } else {
    const teksQR = `DANA a.n. ${settings.nama_penerima} - No: ${settings.nomor_dana} - Jumlah: ${formatRupiah(total)} - Kas ${daftarBulan.join(', ')} ${tahun} dari ${getNama()}`;
    // eslint-disable-next-line no-undef
    new QRCode(qrEl, { text: teksQR, width: 200, height: 200 });
  }

  document.getElementById('langkah-1').classList.add('tersembunyi');
  document.getElementById('langkah-2').classList.remove('tersembunyi');
}

function salinNomor() {
  const nomor = document.getElementById('nomor-dana').textContent;
  navigator.clipboard.writeText(nomor).then(() => alert('Nomor DANA disalin: ' + nomor));
}

function tampilkanLangkah3() {
  document.getElementById('langkah-2').classList.add('tersembunyi');
  document.getElementById('langkah-3').classList.remove('tersembunyi');
}

async function konfirmasiBayar() {
  const pesanEl = document.getElementById('pesan-konfirmasi');
  const data = await apiFetch('/api/bayar', { method: 'POST', body: JSON.stringify(dataForm) });

  if (data.ok) {
    pesanEl.innerHTML = `<div class="pesan sukses">${data.pesan || 'Pembayaran berhasil dikonfirmasi dan tercatat otomatis.'} Terima kasih!</div>`;
    setTimeout(() => { window.location.href = '/anggota/tabel.html'; }, 1500);
  } else {
    pesanEl.innerHTML = `<div class="pesan gagal">${data.pesan}</div>`;
  }
}
