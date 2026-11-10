'use strict';

const GrafikAI = {
  resim: null,
  onizlemeUrl: null,
  sonAnaliz: null,
  gecmis: [],
  anahtar: 'graphai-analiz-gecmis-v1'
};

const el = id => document.getElementById(id);

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(e => e.classList.toggle('aktif', e.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.git === id));
  if (id === 'sonuc') sonucGuncelle();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('nav button').forEach(b => {
  b.addEventListener('click', () => ekranGoster(b.dataset.git));
});

function kartYap(baslik, satirlar, renk) {
  const d = document.createElement('div');
  d.className = 'kart';
  if (renk) d.style.borderLeft = '4px solid ' + renk;
  if (baslik) {
    const h = document.createElement('h3');
    h.textContent = baslik;
    d.appendChild(h);
  }
  (Array.isArray(satirlar) ? satirlar : []).forEach(t => {
    const p = document.createElement('p');
    p.textContent = String(t);
    p.style.cssText = 'font-size:14px;line-height:1.55;margin:0 0 8px;overflow-wrap:anywhere';
    d.appendChild(p);
  });
  return d;
}

function karar(y) {
  const d = document.createElement('div');
  d.className = 'kart';
  d.style.borderLeft = '6px solid ' + (y.renk || '#f0b429');
  const k = document.createElement('div');
  k.textContent = y.karar || 'BEKLE';
  k.style.cssText = 'font-size:38px;font-weight:850;line-height:1.15;color:' + (y.renk || '#f0b429');
  const u = document.createElement('div');
  u.textContent = 'Teknik uyum puanı: %' + (Number.isFinite(y.uyum) ? y.uyum : 0) + ' (kazanma olasılığı değildir)';
  u.style.cssText = 'font-size:12px;color:#91a0af;margin:7px 0 12px';
  d.appendChild(k);
  d.appendChild(u);
  (Array.isArray(y.ozet) ? y.ozet : []).forEach(t => {
    const p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = 'font-size:14px;line-height:1.55;margin-bottom:8px';
    d.appendChild(p);
  });
  return d;
}

function goster(m, t, kal, uyarilar, ekKartlar, meta) {
  if (!Array.isArray(m) || m.length < 5) throw new Error('Grafik oluşturmak için en az 5 mum gerekli.');
  if (typeof Analiz === 'undefined' || typeof Yorum === 'undefined' || typeof Cizim === 'undefined') throw new Error('Analiz veya grafik modülü yüklenemedi.');

  const alan = el('tuval-alan');
  if (!alan) throw new Error('Grafik alanı bulunamadı.');
  alan.replaceChildren();

  const s = Analiz.yap(m, t, meta && meta.sonMumAcik ? { excludeLast: true } : null);
  s.meta = meta || null;
  const y = Yorum.olustur(s, kal, uyarilar || []);
  alan.appendChild(karar(y));

  const tuval = Cizim.grafik(s, kal);
  if (!tuval) throw new Error('Grafik çizilemedi. Tarayıcının canvas desteğini kontrol et.');
  tuval.className = 'analiz-grafik';
  tuval.setAttribute('role', 'img');
  tuval.setAttribute('aria-label', 'Teknik analiz mum grafiği; destek, direnç ve formasyon seviyeleri');
  alan.appendChild(tuval);

  (Array.isArray(ekKartlar) ? ekKartlar : []).forEach(k => alan.appendChild(k));
  (Array.isArray(y.kartlar) ? y.kartlar : []).forEach(k => alan.appendChild(kartYap(k.baslik, k.satirlar)));

  const rapor = el('analiz-rapor');
  if (rapor && typeof Analiz.rapor === 'function') rapor.textContent = Analiz.rapor(s, m.length, kal).join('\n');
  const raporKutusu = el('rapor-kutusu');
  if (raporKutusu) raporKutusu.hidden = false;

  return { s, y };
}

function gecmisOku() {
  try {
    const kayitlar = JSON.parse(localStorage.getItem(GrafikAI.anahtar) || '[]');
    return Array.isArray(kayitlar) ? kayitlar.slice(0, 30) : [];
  } catch (e) {
    return [];
  }
}

function tarihYazi(tarih) {
  try {
    return new Date(tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return String(tarih || '');
  }
}

function fiyatYazi(fiyat) {
  if (typeof fiyat !== 'number' || !Number.isFinite(fiyat)) return '—';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(fiyat);
}

function sonucGuncelle() {
  const alan = el('sonuc-alan');
  if (!alan) return;
  alan.replaceChildren();

  const son = GrafikAI.sonAnaliz || GrafikAI.gecmis[0];
  if (!son) {
    alan.appendChild(kartYap('Henüz analiz yok', ['Bir varlık ara veya grafik görüntüsü yükle. Analiz tamamlandığında karar, özet ve geçmiş kayıtlar burada görünecek.']));
    return;
  }

  const renk = son.karar === 'AL' ? '#26a69a' : son.karar === 'SAT' ? '#ef5350' : '#f0b429';
  alan.appendChild(kartYap((son.ad || 'Varlık') + ' · ' + (son.karar || 'BEKLE'), [
    'Sembol: ' + (son.sembol || 'Görüntü analizi'),
    'Zaman: ' + tarihYazi(son.tarih),
    'Zaman dilimi: ' + (son.zd || '—'),
    'Son fiyat: ' + fiyatYazi(son.fiyat),
    'Trend: ' + (son.trend || 'Belirsiz') + ' · RSI: ' + (son.rsi == null ? '—' : son.rsi),
    'Teknik uyum: %' + (Number.isFinite(son.uyum) ? son.uyum : 0)
  ], renk));

  if (son.ozet) alan.appendChild(kartYap('Analiz özeti', [son.ozet]));
  if (GrafikAI.gecmis.length > 1) {
    const satirlar = GrafikAI.gecmis.slice(0, 12).map(k =>
      tarihYazi(k.tarih) + ' · ' + (k.ad || 'Varlık') + ' → ' + (k.karar || 'BEKLE') +
      (k.sembol ? ' (' + k.sembol + ')' : '')
    );
    alan.appendChild(kartYap('Son analiz kayıtları', satirlar));
  }
}

function analizKaydet(meta, sonuc) {
  const s = sonuc.s, y = sonuc.y;
  const kayit = {
    tarih: new Date().toISOString(),
    ad: meta.ad || 'Ekran görüntüsü',
    sembol: meta.sembol || '',
    kaynak: meta.kaynak || 'Görüntü',
    zd: meta.zd || '',
    fiyat: typeof meta.fiyat === 'number' ? meta.fiyat : null,
    karar: y.karar || s.karar || 'BEKLE',
    uyum: Number.isFinite(y.uyum) ? y.uyum : s.uyum,
    trend: s.trend ? s.trend.yon : 'Belirsiz',
    rsi: s.rsi,
    ozet: Array.isArray(y.ozet) ? y.ozet.join(' ') : '',
    sonMumAcik: Boolean(s.meta && s.meta.sonMumAcik),
    mumSayisi: Array.isArray(s.analysisC) ? s.analysisC.length : s.c.length
  };
  GrafikAI.sonAnaliz = kayit;
  GrafikAI.gecmis.unshift(kayit);
  GrafikAI.gecmis = GrafikAI.gecmis.slice(0, 30);
  try {
    localStorage.setItem(GrafikAI.anahtar, JSON.stringify(GrafikAI.gecmis));
  } catch (e) {
    console.warn('Analiz geçmişi bu cihazda kaydedilemedi:', e);
  }
  sonucGuncelle();
  return kayit;
}

function adminKaydi(asset) {
  if (typeof window.adminAnalizKaydet === 'function') {
    Promise.resolve(window.adminAnalizKaydet(asset)).catch(e => console.warn('Admin analiz kaydı yapılamadı:', e));
  }
}

/* ---------- İsimle arama ---------- */
el('ara-btn').addEventListener('click', async () => {
  const ad = el('ara-ad').value.trim();
  const dur = el('ara-durum');
  const btn = el('ara-btn');
  if (!ad) {
    dur.textContent = 'Önce bir varlık adı veya sembolü yaz.';
    return;
  }

  btn.disabled = true;
  dur.textContent = 'Veri kaynağına bağlanılıyor…';
  try {
    if (typeof Veri === 'undefined' || typeof Veri.ara !== 'function') throw new Error('Piyasa veri modülü yüklenemedi.');
    const v = await Veri.ara(ad, el('ara-zd').value, x => { dur.textContent = x; });
    const dn = Veri.donustur(v, 80);
    if (!dn || !Array.isArray(dn.m) || dn.m.length < 15) throw new Error('Analiz için yeterli piyasa verisi alınamadı.');

    const t = Goruntu.trend(dn.m);
    const sonMum = dn.d[dn.d.length - 1];
    const aralikMs = v.zd === '15m' ? 15 * 60 * 1000
      : v.zd === '1h' ? 60 * 60 * 1000
      : (v.kaynak === 'b' ? 24 * 60 * 60 * 1000
        : (/\.IS$/i.test(v.sembol || '') && new Date(sonMum.t).getUTCHours() <= 2
          ? 15 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000));
    const sonMumAcik = !!(sonMum && Number.isFinite(sonMum.t) && Date.now() < sonMum.t + aralikMs);
    const meta = {
      ad: v.ad, sembol: v.sembol, tur: v.tur, zd: v.zd, kaynak: v.kaynak,
      sonMumZamani: sonMum ? sonMum.t : null,
      sonMumAcik: sonMumAcik,
      veriAlimZamani: v.cekim instanceof Date ? v.cekim.getTime() : Date.now(),
      mumSayisi: dn.d.length
    };
    const sonuc = goster(dn.m, t, dn.kal, [], [
      kartYap('Grafik bilgisi', Veri.bilgi(v, dn.d), '#3988f7')
    ], meta);

    if (window.BistArastirma && typeof window.BistArastirma.grafikOzet === 'function' &&
        String(v.sembol || '').toUpperCase().endsWith('.IS')) {
      const arastirmaKutusu = document.createElement('div');
      arastirmaKutusu.className = 'kart';
      arastirmaKutusu.textContent = '🔎 Araştırma ajanı finansal göstergeleri ve güncel haber başlıklarını tarıyor…';
      el('tuval-alan').appendChild(arastirmaKutusu);
      window.BistArastirma.grafikOzet(v, dn, sonuc, arastirmaKutusu).catch(function (e) {
        arastirmaKutusu.textContent = 'Araştırma ajanı şu anda veri alamadı: ' + (e && e.message ? e.message : String(e));
      });
    }

    const tamam = 'Analiz tamamlandı: ' + v.ad + ' (' + v.sembol + ').';
    el('analiz-durum').textContent = tamam;
    dur.textContent = tamam;
    analizKaydet({
      ad: v.ad,
      sembol: v.sembol,
      kaynak: v.kaynak === 'b' ? 'Binance' : 'Yahoo Finance',
      zd: v.zd,
      fiyat: dn.d.length ? dn.d[dn.d.length - 1].c : null
    }, sonuc);
    adminKaydi(v.ad);
    ekranGoster('analiz');
  } catch (e) {
    const hataMetni = e && e.message ? e.message : String(e);
    dur.textContent = '⚠️ ' + hataMetni +
      ' İnternet bağlantını ve sembolü kontrol et. Örnek: PGSUS.IS veya BTCUSDT.';
    el('analiz-durum').textContent = 'Analiz yapılamadı: ' + hataMetni;
  } finally {
    btn.disabled = false;
  }
});

el('ara-ad').addEventListener('keydown', e => {
  if (e.key === 'Enter') el('ara-btn').click();
});

/* ---------- Ekran görüntüsü modu ---------- */
function resimTemizle() {
  GrafikAI.resim = null;
  if (GrafikAI.onizlemeUrl) URL.revokeObjectURL(GrafikAI.onizlemeUrl);
  GrafikAI.onizlemeUrl = null;
  const onizleme = el('onizleme');
  onizleme.removeAttribute('src');
  onizleme.hidden = true;
  el('analiz-btn').disabled = true;
}

el('dosya').addEventListener('change', e => {
  const dosya = e.target.files && e.target.files[0];
  if (!dosya) return;

  if (!dosya.type || !dosya.type.startsWith('image/')) {
    resimTemizle();
    el('dosya-bilgi').textContent = 'Lütfen geçerli bir görüntü dosyası seç.';
    el('analiz-durum').textContent = 'Geçerli bir grafik görüntüsü yükle.';
    e.target.value = '';
    return;
  }
  if (dosya.size > 15 * 1024 * 1024) {
    resimTemizle();
    el('dosya-bilgi').textContent = 'Dosya 15 MB sınırını aşıyor. Daha küçük bir görüntü seç.';
    el('analiz-durum').textContent = 'Dosya boyutu çok büyük.';
    e.target.value = '';
    return;
  }

  GrafikAI.resim = dosya;
  if (GrafikAI.onizlemeUrl) URL.revokeObjectURL(GrafikAI.onizlemeUrl);
  GrafikAI.onizlemeUrl = URL.createObjectURL(dosya);
  const onizleme = el('onizleme');
  onizleme.src = GrafikAI.onizlemeUrl;
  onizleme.hidden = false;
  el('dosya-bilgi').textContent = 'Grafik yüklendi. Fiyatları elle girebilir veya otomatik okumayı deneyebilirsin.';
  el('analiz-durum').textContent = 'Görüntü hazır. Analizi başlatabilirsin.';
  el('analiz-btn').disabled = false;
  ekranGoster('analiz');
});

function sayi(id) {
  const ham = el(id).value.trim().replace(/\s/g, '');
  if (!ham) return null;
  const temiz = ham.includes('.') && ham.includes(',')
    ? ham.replace(/\./g, '').replace(',', '.')
    : ham.replace(',', '.');
  const n = Number(temiz);
  return Number.isFinite(n) ? n : null;
}

function kalibrasyon() {
  const ustHam = el('fiyat-ust').value.trim();
  const altHam = el('fiyat-alt').value.trim();
  if (!!ustHam !== !!altHam) throw new Error('En yüksek ve en düşük fiyatı birlikte gir.');
  if (!ustHam && !altHam) return null;
  const hi = sayi('fiyat-ust'), lo = sayi('fiyat-alt');
  if (hi === null || lo === null || hi <= lo) throw new Error('En yüksek fiyat, en düşük fiyattan büyük ve ikisi de geçerli sayı olmalı.');
  return { hi, lo };
}

el('analiz-btn').addEventListener('click', async () => {
  const durum = el('analiz-durum');
  const alan = el('tuval-alan');
  const btn = el('analiz-btn');
  if (!GrafikAI.resim) {
    durum.textContent = 'Önce bir grafik görüntüsü yükle.';
    return;
  }

  btn.disabled = true;
  durum.textContent = 'Görüntü okunuyor…';
  alan.replaceChildren();
  try {
    const r = await Goruntu.yukle(GrafikAI.resim);
    const uyarilar = Goruntu.kalite(r);
    const m = Goruntu.mumlar(r);
    if (m.length < 5) {
      alan.appendChild(kartYap('Yeterli mum bulunamadı', [
        'Grafikte en az 5 mum net seçilemedi.',
        'Daha yüksek çözünürlüklü, mum renkleri belirgin bir ekran görüntüsü dene.'
      ].concat(uyarilar.map(u => '⚠️ ' + u)), '#f0b429'));
      durum.textContent = 'Görüntüden yeterli veri okunamadı.';
      return;
    }

    let kal = kalibrasyon();
    let bitis = 'Analiz tamamlandı. Seviyeler görüntü aralığına göre hesaplandı.';
    if (kal) {
      bitis = 'Analiz tamamlandı. Fiyatlar girdiğin en yüksek ve en düşük değerlerle kalibre edildi.';
    } else {
      durum.textContent = 'Fiyat ekseni okunuyor… İlk kullanımda OCR dosyaları internetten indirilebilir.';
      try {
        const o = await OCR.oku(r, m);
        if (o && Number.isFinite(o.hi) && Number.isFinite(o.lo) && o.hi > o.lo) {
          kal = { hi: o.hi, lo: o.lo };
          bitis = 'Analiz tamamlandı. Fiyatlar eksendeki ' + o.n + ' etiketten otomatik okundu; lütfen kontrol et.';
        } else {
          uyarilar.push('Fiyat ekseni okunamadı. Seviyeler görüntü aralığının yüzdesi olarak gösteriliyor.');
        }
      } catch (e) {
        uyarilar.push('Fiyat ekseni otomatik okunamadı: ' + e.message);
      }
    }

    durum.textContent = 'Analiz raporu hazırlanıyor…';
    const sonuc = goster(m, Goruntu.trend(m), kal, uyarilar, [
      kartYap('Görüntü analizi', ['Grafik görüntüsünden ' + m.length + ' mum okundu ve yeniden çizildi.'])
    ]);
    durum.textContent = bitis;
    analizKaydet({ ad: 'Ekran görüntüsü', kaynak: 'Görüntü', zd: 'Görüntü' }, sonuc);
    adminKaydi('Ekran görüntüsü');
  } catch (e) {
    durum.textContent = 'Hata: ' + (e && e.message ? e.message : String(e));
  } finally {
    btn.disabled = !GrafikAI.resim;
  }
});

/* ---------- Başlangıç ---------- */
GrafikAI.gecmis = gecmisOku();
GrafikAI.sonAnaliz = GrafikAI.gecmis[0] || null;
sonucGuncelle();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .catch(e => console.warn('Service Worker kaydedilemedi:', e));
}
GrafikAI.araVarlik = function (sembol, zd) {
  const alan = el('ara-ad');
  const zaman = el('ara-zd');
  const arama = el('ara-btn');
  if (!alan || !zaman || !arama) return;
  alan.value = String(sembol || '').replace(/\.IS$/i, '');
  zaman.value = zd || '1d';
  ekranGoster('yukle');
  arama.click();
};
window.GrafikAI = GrafikAI;
