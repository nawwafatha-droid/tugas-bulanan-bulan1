let soket = null;
let peranSaya = null;
let usernameSaya = null;

// Daftar stiker cepat (emoji besar) — 48 stiker, grid 3 baris x 16 kolom
const DAFTAR_STIKER = [
  '😀', '😁', '😂', '🤣', '😍', '🥰', '😎', '🤩',
  '😢', '😭', '😮', '😡', '🥳', '😴', '😊', '😜',
  '🤔', '😇', '🥺', '🤗', '😱', '👍', '👎', '🙏',
  '👏', '💪', '🫡', '👌', '✌️', '🤝', '🐱', '🐶',
  '🎉', '🎊', '💰', '💵', '✅', '❌', '🔥', '⭐',
  '❤️', '💯', '😋', '😝', '🙃', '😉', '🤯', '🥶'
];

(async () => {
  const data = await jagaHalaman(['admin', 'anggota'], 'chat');
  if (!data) return;
  peranSaya = data.role;
  usernameSaya = data.username;

  buatPanelStiker();

  const riwayat = await apiFetch('/api/chat');
  riwayat.forEach(tambahBubble);
  gulirKeBawah();

  soket = io({ auth: { token: getToken() } });
  soket.on('chat:baru', (pesan) => {
    tambahBubble(pesan);
    gulirKeBawah();
  });
  // Pesan dihapus admin -> hilangkan dari layar semua user
  soket.on('chat:hapus', ({ id }) => {
    const el = document.querySelector(`[data-pesan-id="${id}"]`);
    if (el) el.remove();
  });
  // Pesan ditolak filter kata kotor
  soket.on('chat:ditolak', ({ pesan }) => {
    alert(pesan || 'Pesan mengandung kata tidak pantas dan otomatis dihapus.');
  });
})();

function apakahStiker(teks) {
  const t = String(teks || '').trim();
  return DAFTAR_STIKER.includes(t);
}

function tambahBubble(pesan) {
  const listEl = document.getElementById('daftar-pesan');
  if (!listEl) return;
  // Cegah duplikat (misal riwayat + socket bersamaan)
  if (pesan.id != null && listEl.querySelector(`[data-pesan-id="${pesan.id}"]`)) return;
  const punyaku = pesan.username === usernameSaya;
  const tagAdmin = pesan.role === 'admin' ? ' <span class="tag-admin">(admin)</span>' : '';
  const bubble = document.createElement('div');
  const modeStiker = apakahStiker(pesan.pesan);
  bubble.className = 'pesan bubble' + (punyaku ? ' keluar' : ' masuk') + (modeStiker ? ' pesan-stiker' : '');
  if (pesan.id != null) bubble.setAttribute('data-pesan-id', pesan.id);
  // Tombol hapus hanya dirender untuk admin
  const tombolHapus = (peranSaya === 'admin' && pesan.id != null)
    ? `<button class="hapus-pesan" title="Hapus pesan" onclick="hapusPesan(${pesan.id})"><span class="material-symbols-outlined">delete</span></button>`
    : '';
  bubble.innerHTML = `
    ${tombolHapus}
    <div class="pesan-header"><strong>${escapeHtml(pesan.nama)}${tagAdmin}</strong><span>${formatJam(pesan.waktu)}</span></div>
    ${modeStiker
      ? `<div class="stiker-besar">${escapeHtml(pesan.pesan)}</div>`
      : `<div class="pesan-body">${escapeHtml(pesan.pesan)}</div>`}
  `;
  listEl.appendChild(bubble);
}

function gulirKeBawah() {
  const listEl = document.getElementById('daftar-pesan');
  if (listEl) listEl.scrollTop = listEl.scrollHeight;
}

function escapeHtml(teks) {
  const div = document.createElement('div');
  div.textContent = teks;
  return div.innerHTML;
}

function kirimPesan() {
  const inputEl = document.getElementById('input-pesan');
  const teks = inputEl.value.trim();
  if (!teks || !soket) return;
  soket.emit('chat:kirim', teks);
  inputEl.value = '';
}

// Hapus pesan — hanya admin (server memverifikasi role)
async function hapusPesan(id) {
  if (peranSaya !== 'admin') return;
  if (!confirm('Hapus pesan ini?')) return;
  try {
    const data = await apiFetch(`/api/chat/${id}`, { method: 'DELETE' });
    if (!data.ok) alert(data.pesan || 'Gagal menghapus pesan.');
    // Penghapusan layar ditangani via event socket chat:hapus
  } catch (e) {
    alert('Gagal menghapus pesan.');
  }
}

// ---------- Stiker ----------
function buatPanelStiker() {
  if (document.getElementById('panel-stiker')) return;
  const wrap = document.querySelector('.chat-wrap');
  const row = document.querySelector('.chat-input-row');
  if (!wrap || !row) return;
  const panel = document.createElement('div');
  panel.className = 'panel-stiker';
  panel.id = 'panel-stiker';
  panel.innerHTML = `
    <div class="daftar-stiker">
      ${DAFTAR_STIKER.map(s => `<button class="stiker" onclick="kirimStiker('${s}')">${s}</button>`).join('')}
    </div>
  `;
  wrap.insertBefore(panel, row);
}

function togglePanelStiker() {
  buatPanelStiker();
  document.getElementById('panel-stiker').classList.toggle('aktif');
}

function tutupPanelStiker() {
  const p = document.getElementById('panel-stiker');
  if (p) p.classList.remove('aktif');
}

function kirimStiker(stiker) {
  if (!soket) return;
  soket.emit('chat:kirim', stiker);
  tutupPanelStiker();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'input-pesan') {
    kirimPesan();
  }
});
