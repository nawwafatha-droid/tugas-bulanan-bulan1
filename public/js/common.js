function formatRupiah(angka) {
  return 'Rp' + Number(angka || 0).toLocaleString('id-ID');
}
function formatTanggal(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatJam(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getToken() { return localStorage.getItem('kb_token'); }
function getRole() { return localStorage.getItem('kb_role'); }
function getNama() { return localStorage.getItem('kb_nama'); }

async function apiFetch(url, opsi = {}) {
  const headers = opsi.headers || {};
  headers['Authorization'] = 'Bearer ' + getToken();
  if (opsi.body && !(opsi.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opsi, headers });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    throw new Error('Sesi habis');
  }
  return res.json();
}

function halamanUntukPeran(role) {
  if (role === 'admin') return '/admin/dashboard.html';
  if (role === 'anggota') return '/anggota/tabel.html';
  return '/guest/tabel.html';
}

const MENU = {
  anggota: [
    { id: 'bayar', label: 'Bayar Kas', href: '/anggota/bayar.html', ikon: 'payments', kelas: 'ikon-slate' },
    { id: 'tabel', label: 'Tabel Kas & Data', href: '/anggota/tabel.html', ikon: 'table_chart', kelas: 'ikon-slate' },
    { id: 'chat', label: 'Chat', href: '/anggota/chat.html', ikon: 'forum', kelas: 'ikon-slate' }
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', ikon: 'dashboard', kelas: 'ikon-dashboard' },
    { id: 'anggota', label: 'Kelola Anggota', href: '/admin/anggota.html', ikon: 'group', kelas: 'ikon-slate' },
    { id: 'pengeluaran', label: 'Tambah Keuangan', href: '/admin/pengeluaran.html', ikon: 'add_circle', kelas: 'ikon-slate' },
    { id: 'tabel', label: 'Tabel & Data', href: '/admin/tabel.html', ikon: 'table_chart', kelas: 'ikon-slate' },
    { id: 'chat', label: 'Chat', href: '/admin/chat.html', ikon: 'forum', kelas: 'ikon-slate' },
    { id: 'pengaturan', label: 'Pengaturan', href: '/admin/pengaturan.html', ikon: 'settings', kelas: 'ikon-slate' }
  ],
  tamu: [
    { id: 'tabel', label: 'Tabel Kas & Data', href: '/guest/tabel.html', ikon: 'table_chart', kelas: 'ikon-slate' }
  ]
};

function renderSidebar(role, nama, activePage) {
  const container = document.getElementById('sidebar-container');
  if (!container) return;
  const menu = MENU[role] || [];
  const ikonPeran = role === 'admin' ? 'admin_panel_settings' : role === 'anggota' ? 'person' : 'visibility';
  const labelPeran = role === 'admin' ? 'Admin' : role === 'anggota' ? 'Anggota' : 'Tamu';
  // Navbar HP (hanya tampil di layar kecil lewat CSS) + latar drawer
  if (!document.getElementById('navbar-hp')) {
    const navHp = document.createElement('div');
    navHp.className = 'navbar-hp';
    navHp.id = 'navbar-hp';
    navHp.innerHTML = `
      <button class="tombol-sidebar" onclick="toggleSidebar()" aria-label="Buka tutup menu"><span class="material-symbols-outlined">menu</span></button>
      <div class="navbar-judul-wrap">
        <span class="navbar-judul">Kas Bulanan</span>
        <span class="navbar-peran">${labelPeran}</span>
      </div>
      <button class="tombol-keluar-hp" onclick="keluar()" aria-label="Logout" title="Logout"><span class="material-symbols-outlined">logout</span></button>
    `;
    document.body.prepend(navHp);
    const latar = document.createElement('button');
    latar.className = 'latar-sidebar';
    latar.id = 'latar-sidebar';
    latar.setAttribute('aria-label', 'Tutup menu');
    latar.onclick = toggleSidebar;
    document.body.appendChild(latar);
  } else {
    const badge = document.querySelector('#navbar-hp .navbar-peran');
    if (badge) badge.textContent = labelPeran;
  }
  container.innerHTML = `
    <div class="profil">
      <span class="profil-ikon ikon-peran-${role}"><span class="material-symbols-outlined">${ikonPeran}</span></span>
      <div class="profil-teks">
        <div class="nama">${nama}</div>
        <span class="peran ${role}">${role === 'admin' ? 'Admin' : role === 'anggota' ? 'Anggota' : 'Tamu'}</span>
      </div>
    </div>
    <nav>
      ${menu.map(m => `<a href="${m.href}" class="${m.id === activePage ? 'aktif' : ''}"><span class="material-symbols-outlined ${m.kelas || 'ikon-slate'}">${m.ikon}</span><span>${m.label}</span></a>`).join('')}
    </nav>
    <div class="sidebar-bawah">
      <a class="keluar" onclick="keluar()"><span class="material-symbols-outlined ikon-slate">logout</span><span>Logout</span></a>
    </div>
  `;
}

async function keluar() {
  try { await apiFetch('/api/logout', { method: 'POST' }); } catch (e) { /* abaikan */ }
  localStorage.clear();
  window.location.href = '/login.html';
}

// Drawer sidebar HP: buka/tutup lewat ikon hamburger kiri atas
function toggleSidebar() {
  document.body.classList.toggle('sidebar-terbuka');
}

function tutupSidebar() {
  document.body.classList.remove('sidebar-terbuka');
}

/**
 * Jaga akses halaman: pastikan sudah login & role diizinkan.
 * Memanggil renderSidebar otomatis kalau elemen #sidebar-container ada.
 */
async function jagaHalaman(rolesDiizinkan, activePage) {
  const token = getToken();
  if (!token) { window.location.href = '/login.html'; return null; }

  const data = await apiFetch('/api/me');
  if (!data.ok) { window.location.href = '/login.html'; return null; }

  if (rolesDiizinkan && !rolesDiizinkan.includes(data.role)) {
    window.location.href = halamanUntukPeran(data.role);
    return null;
  }

  localStorage.setItem('kb_role', data.role);
  localStorage.setItem('kb_nama', data.nama);
  renderSidebar(data.role, data.nama, activePage);
  return data;
}

// ================= Notifikasi otomatis hilang 5 detik =================
// Berlaku untuk semua .pesan sukses/gagal di semua halaman.
// Bubble chat dikecualikan (mereka juga pakai class .pesan).
(function () {
  const TUNGGU_MS = 5000;
  function jadwalkanHilang(el) {
    if (!el || el.dataset.hilangTerjadwal) return;
    if (el.closest && el.closest('.chat-pesan-list')) return;
    el.dataset.hilangTerjadwal = '1';
    setTimeout(() => {
      el.classList.add('pesan-hilang');
      setTimeout(() => el.remove(), 400);
    }, TUNGGU_MS);
  }
  document.querySelectorAll('.pesan').forEach(jadwalkanHilang);
  new MutationObserver((daftarMutasi) => {
    for (const m of daftarMutasi) {
      for (const node of m.addedNodes) {
        if (!node || node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains('pesan')) jadwalkanHilang(node);
        if (node.querySelectorAll) node.querySelectorAll('.pesan').forEach(jadwalkanHilang);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
