// js/login.js — dipakai oleh public/login.html
// ID di login.html: member-id, unified-pin-input, login-form,
// btn-submit, btn-submit-text, guest-quick-link, pesan-login

(function () {
  function simpanSesi(data) {
    localStorage.setItem('kb_token', data.token);
    localStorage.setItem('kb_role', data.role);
    localStorage.setItem('kb_nama', data.nama);
    localStorage.setItem('kb_username', data.username);
  }

  function arahkanSesuaiPeran(role) {
    if (role === 'admin') window.location.href = '/admin/dashboard.html';
    else if (role === 'anggota') window.location.href = '/anggota/tabel.html';
    else window.location.href = '/guest/tabel.html';
  }

  function tampilPesan(msg) {
    var el = document.getElementById('pesan-login');
    if (el) {
      el.textContent = msg || '';
    } else if (msg) {
      alert(msg);
    }
  }

  // Auto-redirect kalau token masih valid
  (async function cekSesiAktif() {
    var token = localStorage.getItem('kb_token');
    if (!token) return;
    try {
      var res = await fetch('/api/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      var data = await res.json();
      if (data.ok) arahkanSesuaiPeran(data.role);
      else localStorage.clear();
    } catch (e) { /* tetap di halaman login */ }
  })();

  async function loginMasuk() {
    var inputUser = document.getElementById('member-id');
    var inputPin = document.getElementById('unified-pin-input');
    var btnSubmit = document.getElementById('btn-submit');
    var btnText = document.getElementById('btn-submit-text');

    var username = inputUser ? inputUser.value.trim() : '';
    var pin = inputPin ? inputPin.value : '';

    if (!username) { tampilPesan('Username wajib diisi.'); if (inputUser) inputUser.focus(); return; }
    if (!pin) { tampilPesan('PIN wajib diisi.'); if (inputPin) inputPin.focus(); return; }

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = 'Memverifikasi...';
    tampilPesan('');

    try {
      var res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, pin: pin })
      });
      var data = await res.json();
      if (data.ok) {
        simpanSesi(data);
        arahkanSesuaiPeran(data.role);
      } else {
        tampilPesan(data.pesan || 'Login gagal.');
      }
    } catch (e) {
      tampilPesan('Tidak bisa menghubungi server. Pastikan server jalan di port 3000.');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnText) btnText.textContent = 'Login';
    }
  }

  async function masukTamu() {
    tampilPesan('');
    try {
      var res = await fetch('/api/guest', { method: 'POST' });
      var data = await res.json();
      if (data.ok) {
        simpanSesi(data);
        arahkanSesuaiPeran('tamu');
      } else {
        tampilPesan('Gagal masuk sebagai tamu.');
      }
    } catch (e) {
      tampilPesan('Tidak bisa menghubungi server.');
    }
  }

  function togglePin() {
    var pinInput = document.getElementById('unified-pin-input');
    var eyeIcon = document.getElementById('pin-eye-symbol');
    if (!pinInput) return;
    var isPw = pinInput.type === 'password';
    pinInput.type = isPw ? 'text' : 'password';
    if (eyeIcon) eyeIcon.textContent = isPw ? 'visibility_off' : 'visibility';
  }

  // Pasang event setelah DOM siap (script di-load di akhir body)
  var form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    loginMasuk();
  });

  var guestBtn = document.getElementById('guest-quick-link');
  if (guestBtn) guestBtn.addEventListener('click', function (e) {
    e.preventDefault();
    masukTamu();
  });

  var toggleBtn = document.getElementById('toggle-unified-pin');
  if (toggleBtn) toggleBtn.addEventListener('click', togglePin);

  // Expose untuk onclick inline (kalau masih dipakai)
  window.loginMasuk = loginMasuk;
  window.masukTamu = masukTamu;
  window.togglePin = togglePin;
  window.handleLoginSubmit = loginMasuk;
  window.arahkanSesuaiPeran = arahkanSesuaiPeran;
})();
