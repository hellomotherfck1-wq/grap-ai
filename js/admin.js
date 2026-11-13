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

  let istatistikYukleniyor = false;

  let ajanRaporuYukleniyor = false;

  function raporTarihi(value) {
    if (!value) return '—';
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  }

  function raporMetrik(parent, label, value) {
    const item = document.createElement('div');
    item.className = 'admin-rapor-metrik';
    const name = document.createElement('span');
    name.textContent = label;
    const number = document.createElement('strong');
    number.textContent = String(value);
    item.append(name, number);
    parent.appendChild(item);
  }

  function raporSatir(parent, label, value, status) {
    const item = document.createElement('div');
    item.className = 'admin-rapor-satir' + (status ? ' durum-' + status : '');
    const name = document.createElement('span');
    name.textContent = label;
    const detail = document.createElement('strong');
    detail.textContent = String(value);
    item.append(name, detail);
    parent.appendChild(item);
  }

  function ajanRaporuCiz(reports) {
    const durum = $('admin-ajan-durum');
    const ozet = $('admin-ajan-ozet');
    const metrikler = $('admin-ajan-metrikler');
    const hatalar = $('admin-ajan-hatalar');
    const kontroller = $('admin-ajan-kontroller');
    const sonuclar = $('admin-ajan-sonuclar');
    const zaman = $('admin-ajan-zaman');
    const gecmis = $('admin-ajan-gecmis');
    if (!durum || !ozet || !metrikler || !hatalar || !kontroller || !sonuclar) return;

    [metrikler, hatalar, kontroller, sonuclar, gecmis].forEach(function (node) {
      if (node) node.replaceChildren();
    });

    if (!Array.isArray(reports) || !reports.length) {
      durum.className = 'admin-rapor-durum admin-rapor-bekle';
      durum.textContent = 'RAPOR BEKLENİYOR';
      ozet.textContent = 'Henüz günlük rapor kaydı yok. Supabase günlük ajan SQL kurulumu ve GitHub Actions secret ayarından sonra ilk rapor burada görünecek.';
      raporSatir(kontroller, 'Günlük ajan', 'İlk çalıştırma bekleniyor', 'warning');
      if (zaman) zaman.textContent = 'Rapor henüz oluşturulmadı.';
      return;
    }

    const latest = reports[0];
    const details = latest.details || {};
    const results = details.results || {};
    const errors = details.errors || {};
    const activity = details.activity || {};
    const status = ['ok', 'warning', 'critical'].indexOf(latest.status) >= 0 ? latest.status : 'warning';

    durum.className = 'admin-rapor-durum admin-rapor-' + status;
    durum.textContent = status === 'ok' ? 'SİSTEM NORMAL' : status === 'critical' ? 'KRİTİK SORUN' : 'UYARI VAR';
    ozet.textContent = latest.summary || 'Günlük sistem raporu hazır.';
    raporMetrik(metrikler, 'Son 30 gün sinyal', results.totalSignals || 0);
    raporMetrik(metrikler, 'Tamamlanan ölçüm', results.completedDirection || 0);
    raporMetrik(metrikler, 'Bekleyen sonuç', results.pending || 0);
    raporMetrik(metrikler, 'Hata kaydı', errors.total || 0);
    raporMetrik(metrikler, '7 gün ziyaret', activity.visits || 0);
    raporMetrik(metrikler, '7 gün analiz', activity.analyses || 0);

    const findings = Array.isArray(errors.findings) ? errors.findings : [];
    if (!findings.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-rapor-bos';
      empty.textContent = 'Rapor içinde hata bulgusu bulunmuyor.';
      hatalar.appendChild(empty);
    } else {
      findings.forEach(function (finding) {
        const card = document.createElement('div');
        card.className = 'admin-rapor-bulgu admin-rapor-bulgu-' + (finding.severity || 'info');
        const title = document.createElement('strong');
        title.textContent = finding.title || 'Hata bulgusu';
        const meta = document.createElement('small');
        meta.textContent = (finding.source || 'Kaynak bilinmiyor') +
          ' · Tekrar: ' + (finding.count || 0) +
          (finding.lastSeen ? ' · Son: ' + raporTarihi(finding.lastSeen) : '');
        const explanation = document.createElement('p');
        explanation.textContent = finding.explanation || 'Ajan bu hata için ek açıklama bulamadı.';
        const action = document.createElement('p');
        action.className = 'admin-rapor-oneri';
        action.textContent = 'Öneri: ' + (finding.action || 'Tekrar edip etmediğini izle.');
        card.append(title, meta, explanation, action);
        hatalar.appendChild(card);
      });
    }

    const checks = Array.isArray(details.checks) ? details.checks : [];
    if (!checks.length) {
      raporSatir(kontroller, 'Kontroller', 'Rapor ayrıntısı bulunamadı', 'warning');
    } else {
      checks.forEach(function (check) {
        raporSatir(kontroller, check.name || 'Kontrol', check.detail || check.status || '—',
          check.status === 'ok' ? 'ok' : check.status === 'critical' ? 'critical' : 'warning');
      });
    }

    const decisions = results.decisions || {};
    raporSatir(sonuclar, 'Karar dağılımı',
      'AL ' + (decisions.AL || 0) + ' · SAT ' + (decisions.SAT || 0) + ' · BEKLE ' + (decisions.BEKLE || 0));
    const directional = results.directional || {};
    const rateText = directional.reliable && Number.isFinite(Number(directional.rate))
      ? '%' + Number(directional.rate).toFixed(1).replace('.', ',') + ' (' + (directional.correct || 0) + ' doğru / ' + (directional.wrong || 0) + ' yanlış)'
      : 'Yeterli bağımsız örnek yok (' + (directional.sampleCount || 0) + '/30)';
    raporSatir(sonuclar, 'Yön ölçümü', rateText);
    raporSatir(sonuclar, 'Spot AL simülasyonu',
      'Kârlı ' + ((results.spotAL || {}).wins || 0) + ' · Zararlı ' + ((results.spotAL || {}).losses || 0) +
      ' · Başa baş ' + ((results.spotAL || {}).flat || 0));
    raporSatir(sonuclar, 'Spot SAT karşılaştırması',
      'Satış daha iyi ' + ((results.spotSAT || {}).sellBetter || 0) +
      ' · Tutmak daha iyi ' + ((results.spotSAT || {}).holdBetter || 0) +
      ' · Benzer ' + ((results.spotSAT || {}).similar || 0));
    const caution = document.createElement('p');
    caution.className = 'admin-rapor-bos';
    caution.textContent = results.caution || 'Sinyal ölçümleri gerçek portföy getirisi değildir.';
    sonuclar.appendChild(caution);

    if (Array.isArray(details.commentary)) {
      details.commentary.forEach(function (line) {
        const p = document.createElement('p');
        p.className = 'admin-rapor-yorum';
        p.textContent = line;
        sonuclar.appendChild(p);
      });
    }

    if (zaman) {
      zaman.textContent = 'Rapor tarihi: ' + (latest.report_date || '—') +
        ' · Son kontrol: ' + raporTarihi(latest.checked_at);
    }

    if (gecmis && reports.length > 1) {
      reports.slice(1).forEach(function (item) {
        const detailsNode = document.createElement('details');
        detailsNode.className = 'admin-rapor-gecmis';
        const summary = document.createElement('summary');
        summary.textContent = (item.report_date || 'Eski rapor') + ' · ' +
          (item.status === 'ok' ? 'Normal' : item.status === 'critical' ? 'Kritik' : 'Uyarı');
        const paragraph = document.createElement('p');
        paragraph.textContent = item.summary || 'Özet bulunmuyor.';
        detailsNode.append(summary, paragraph);
        gecmis.appendChild(detailsNode);
      });
    }
  }

  async function ajanRaporuYukle() {
    const durum = $('admin-ajan-durum');
    const ozet = $('admin-ajan-ozet');
    if (!supabase || ajanRaporuYukleniyor || !durum || !ozet) return;
    ajanRaporuYukleniyor = true;
    durum.textContent = 'RAPOR YÜKLENİYOR…';
    try {
      const { data, error } = await supabase
        .from('admin_daily_reports')
        .select('report_date,status,summary,details,checked_at')
        .order('report_date', { ascending: false })
        .limit(7);
      if (error) throw error;
      ajanRaporuCiz(Array.isArray(data) ? data : []);
    } catch (error) {
      durum.className = 'admin-rapor-durum admin-rapor-warning';
      durum.textContent = 'RAPOR OKUNAMADI';
      ozet.textContent = 'Günlük rapor alınamadı: ' + (error && error.message ? error.message : String(error)) +
        ' · Supabase migration ve yönetici okuma iznini kontrol et.';
    } finally {
      ajanRaporuYukleniyor = false;
    }
  }

  async function istatistikYukle() {
    const ist = $('istatistikler');
    const sonlar = $('son-analizler');
    if (!ist || !sonlar || !supabase || istatistikYukleniyor) return;

    istatistikYukleniyor = true;
    const yenileBtn = $('admin-yenile-btn');
    const guncelleme = $('admin-son-guncelleme');
    if (yenileBtn) {
      yenileBtn.disabled = true;
      yenileBtn.textContent = 'YENİLENİYOR…';
    }

    try {
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
      } else {
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

      if (guncelleme) {
        guncelleme.textContent = 'Son güncelleme: ' + new Date().toLocaleString('tr-TR');
      }
    } catch (e) {
      ist.textContent = 'İstatistikler yüklenemedi: ' + (e.message || String(e));
      sonlar.textContent = 'Bağlantıyı ve Supabase izinlerini kontrol et.';
      if (guncelleme) {
        guncelleme.textContent = 'Son kontrol: ' + new Date().toLocaleString('tr-TR');
      }
    } finally {
      istatistikYukleniyor = false;
      if (yenileBtn) {
        yenileBtn.disabled = false;
        yenileBtn.textContent = '↻ ÖZETİ YENİLE';
      }
    }
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
      await ajanRaporuYukle();
    } catch (e) {
      await ortakHavuzYetkisi(false);
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
      const yenileBtn = $('admin-yenile-btn');

      if (yenileBtn) yenileBtn.addEventListener('click', () => { istatistikYukle(); ajanRaporuYukle(); });

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
