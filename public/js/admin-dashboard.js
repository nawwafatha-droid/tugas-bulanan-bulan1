(async () => {
  const data = await jagaHalaman(['admin'], 'dashboard');
  if (!data) return;

  const ringkasan = await apiFetch('/api/summary');
  document.getElementById('saldo').textContent = formatRupiah(ringkasan.saldo);
  document.getElementById('bulan-ini').textContent = formatRupiah(ringkasan.totalBulanIni) + ` (${ringkasan.bulanIni})`;
  document.getElementById('jumlah-anggota').textContent = ringkasan.jumlahAnggotaBulanIni + ' orang';

  const soket = io({ auth: { token: getToken() } });
  soket.on('online-list', (daftar) => {
    const el = document.getElementById('daftar-online');
    if (daftar.length === 0) {
      el.innerHTML = '<li>Belum ada yang online.</li>';
      return;
    }
    el.innerHTML = daftar.map(u => `
      <li>
        <span class="titik-hijau"></span>
        <span><b>${u.nama}</b> <span class="teks-username">@${u.username}</span></span>
        <span class="badge-peran ${u.role}">${u.role === 'admin' ? 'Admin' : 'Anggota'}</span>
      </li>
    `).join('');
  });

  const loginHariIni = await apiFetch('/api/admin/aktivitas-login');
  const el = document.getElementById('daftar-login-hari-ini');
  if (!loginHariIni.length) {
    el.innerHTML = '<li>Belum ada admin yang masuk hari ini.</li>';
  } else {
    el.innerHTML = loginHariIni.map(u => `
      <li>
        <span class="titik-hijau"></span>
        <span><b>${u.nama}</b> <span class="teks-username">@${u.username}</span></span>
        <span class="waktu-login">${formatJam(u.waktu)}</span>
      </li>
    `).join('');
  }
})();