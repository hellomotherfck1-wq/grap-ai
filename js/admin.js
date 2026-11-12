(function () {
  'use strict';

  // Supabase anon/publishable anahtarı tarayıcıda kullanılabilir.
  // Yetki kontrolü app_metadata üzerinden yapılır; service_role anahtarı istemciye konmaz.
  const SUPABASE_URL = 'https://qkkhguyngmsddnkunyws.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_21uKtVP_-Es7lWeTDefk7Q_r-pb8i0-';

  const $ = id => document.getElementById(id);
  const giris = $('admin-giris');
  const panel = $('admin-panel');
  const hata = $('admin-hata');

  if (!giris || !panel) return;

  function mesaj(yazi, hataMi) {
    if (!hata) return;
    hata.textContent = yazi || '';
    hata.style.color = hataMi ? '#ff8585' : '#91a0af';
  }

  function satir(alan, etiket, deger) {
    const d = document.createElement('div');
    d.className = 'istatistik-satir';
    const a = document.createElement('span');
    a.textContent = etiket;
    const b = document.createElement('strong');
    b.textContent = String(deger);
    d.append(a, b);
    alan.appendChild(d);
  }

  function tarihBaslangici(gunFarki) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - gunFarki);
    return d.toISOString();
  }

  let supabase = null;
  let hazir = false;

  function yetkiliMi(user) {
    const meta = user && user.app_metadata ? user.app_metadata : {};
    const roller = Array.isArray(meta.roles) ? meta.roles : [];
    return meta.role === 'admin' || rollersIcerir(roller, 'admin');
  }

  function rollersIcerir(roller, hedef) {
    return roller.some(x => String(x).toLowerCase() === hedef);
  }

  async function ortakHavuzYetkisi(izinli) {
    if (window.GrapAISharedResults && typeof window.GrapAISharedResults.setAdminAccess === 'function') {
      window.GrapAISharedResults.setAdminAccess(Boolean(izinli));
    }
    if (window.AjanPerformans && typeof window.AjanPerformans.yenile === 'function') {
      try { await window.AjanPerformans.yenile(); } catch (e) {}
    }
  }

  async function eventKaydet(tip, asset) {
    if (!supabase || !hazir) return;
    try {
      const { error } = await supabase.from('events').insert({
        event_type: tip,
        asset_name: asset ? String(asset).slice(0, 120) : null
      });
      if (error) console.warn('Graph AI olay kaydı yapılamadı:', error.message);
    } catch (e) {
      console.warn('Graph AI olay kaydı yapılamadı:', e);
    }
  }

  window.adminAnalizKaydet = function (assetName) {
    return eventKaydet('analiz', assetName || 'Ekran görüntüsü');
  };

  async function istatistikYukle() {
    const ist = $('istatistikler');
    const sonlar = $('son-analizler');
    if (!ist || !sonlar) return;

    ist.replaceChildren();
    sonlar.replaceChildren();
    ist.textContent = 'İstatistikler yükleniyor…';

    const bugun = tarihBaslangici(0);
    const dun = tarihBaslangici(1);
    const yediGun = tarihBaslangici(7);

    const { data: events, error } = await supabase
      .from('events')
      .select('event_type, asset_name, created_at')
      .gte('created_at', yediGun)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      ist.textContent = 'İstatistikler yüklenemedi: ' + error.message;
      sonlar.textContent = 'events tablosu ve Supabase RLS izinlerini kontrol et.';
      return;
    }

    const liste = Array.isArray(events) ? events : [];
    const ziyaret = liste.filter(x => x.event_type === 'visit');
    const analizler = liste.filter(x => x.event_type === 'analiz');
    const bugunZiyaret = ziyaret.filter(x => x.created_at >= bugun).length;
    const dunZiyaret = ziyaret.filter(x => x.created_at >= dun && x.created_at < bugun).length;
    const yediZiyaret = ziyaret.length;
    const bugunAnaliz = analizler.filter(x => x.created_at >= bugun).length;

    ist.replaceChildren();
    satir(ist, 'Bugün ziyaret', bugunZiyaret);
    satir(ist, 'Dün ziyaret', dunZiyaret);
    satir(ist, 'Son 7 gün ziyaret', yediZiyaret);
    satir(ist, 'Bugün analiz', bugunAnaliz);
    satir(ist, 'Son 7 gün analiz', analizler.length);

    if (!analizler.length) {
      sonlar.textContent = 'Son 7 günde kayıtlı analiz bulunamadı.';
      return;
    }

    analizler.slice(0, 30).forEach(e => {
      const d = document.createElement('div');
      d.className = 'son-analiz-satiri';
      const t = document.createElement('time');
      const tarih = new Date(e.created_at);
      t.dateTime = e.created_at;
      t.textContent = tarih.toLocaleString('tr-TR');
      const ad = document.createElement('strong');
      ad.textContent = ' — ' + (e.asset_name || 'Ekran görüntüsü');
      d.append(t, ad);
      sonlar.appendChild(d);
    });
  }

  async function sessionKontrol(oturum) {
    try {
      let session = oturum || null;
      if (!session) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        session = data.session;
      }

      if (!session) {
        await ortakHavuzYetkisi(false);
        giris.hidden = false;
        panel.hidden = true;
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (!yetkiliMi(data.user)) {
        await supabase.auth.signOut();
        await ortakHavuzYetkisi(false);
        giris.hidden = false;
        panel.hidden = true;
        mesaj('Bu hesapta yönetici yetkisi bulunmuyor. Supabase app_metadata.role alanı admin olmalı.', true);
        return;
      }

      await ortakHavuzYetkisi(true);
      giris.hidden = true;
      panel.hidden = false;
      mesaj('Yönetici oturumu açık.');
      await istatistikYukle();
    } catch (e) {
      giris.hidden = false;
      panel.hidden = true;
      mesaj('Oturum kontrolü yapılamadı: ' + (e.message || String(e)), true);
    }
  }

  async function baslat() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      mesaj('Supabase bağlantı kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.', true);
      return;
    }

    try {
      supabase = window.GrapAISharedResults && window.GrapAISharedResults.client
        ? window.GrapAISharedResults.client
        : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          });
      hazir = true;

      const girisBtn = $('admin-giris-btn');
      const cikisBtn = $('admin-cikis-btn');

      if (girisBtn) girisBtn.addEventListener('click', async () => {
        if (girisBtn.disabled) return;
        const email = $('admin-email').value.trim();
        const sifre = $('admin-sifre').value;
        if (!email || !sifre) {
          mesaj('E-posta ve şifre alanlarını doldur.', true);
          return;
        }

        girisBtn.disabled = true;
        mesaj('Giriş kontrol ediliyor…');
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password: sifre });
          if (error) throw error;
          await sessionKontrol(data.session);
        } catch (e) {
          mesaj('Giriş başarısız: ' + (e.message || String(e)), true);
        } finally {
          girisBtn.disabled = false;
        }
      });

      if (cikisBtn) cikisBtn.addEventListener('click', async () => {
        cikisBtn.disabled = true;
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          await ortakHavuzYetkisi(false);
          giris.hidden = false;
          panel.hidden = true;
          mesaj('Güvenli çıkış yapıldı.');
        } catch (e) {
          mesaj('Çıkış yapılamadı: ' + (e.message || String(e)), true);
        } finally {
          cikisBtn.disabled = false;
        }
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        Promise.resolve().then(() => sessionKontrol(session));
      });

      await sessionKontrol();
      if (!sessionKontrol._visitLogged) {
        sessionKontrol._visitLogged = true;
        await eventKaydet('visit', null);
      }
    } catch (e) {
      hazir = false;
      mesaj('Admin modülü başlatılamadı: ' + (e.message || String(e)), true);
    }
  }

  baslat();
})();
