var GrafikAI = { resim: null };
var onizlemeURL = null;

function kartYap(baslik, satirlar, renk) {
  var d = document.createElement('div');
  d.className = 'kart';
  if (renk) d.style.borderLeft = '4px solid ' + renk;
  if (baslik) {
    var h = document.createElement('h3');
    h.textContent = baslik;
    h.style.cssText = 'font-size:16px;margin-bottom:8px';
    d.appendChild(h);
  }
  (satirlar || []).forEach(function(t) {
    var p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:8px';
    d.appendChild(p);
  });
  return d;
}

function karar(y) {
  var d = document.createElement('div');
  d.className = 'kart';
  d.style.borderLeft = '6px solid ' + y.renk;

  var k = document.createElement('div');
  k.textContent = y.karar;
  k.style.cssText = 'font-size:40px;font-weight:800;color:' + y.renk;

  var u = document.createElement('div');
  u.textContent = 'Teknik uyum puanı: %' + y.uyum + ' (kazanma olasılığı değildir)';
  u.style.cssText = 'font-size:13px;color:#8b98a5;margin:4px 0 12px';

  d.appendChild(k);
  d.appendChild(u);

  (y.ozet || []).forEach(function(t) {
    var p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:8px';
    d.appendChild(p);
  });
  return d;
}

function raporYaz(hedef, s, kal, y, ekKartlar, baslik) {
  if (!hedef) return;
  hedef.innerHTML = '';

  if (baslik) {
    var h = document.createElement('h2');
    h.textContent = baslik;
    hedef.appendChild(h);
  }

  hedef.appendChild(karar(y));

  var tuval = Cizim.grafik(s, kal);
  tuval.style.cssText = 'display:block;width:100%;height:auto;border-radius:12px;margin:4px 0 12px';
  hedef.appendChild(tuval);

  (ekKartlar || []).forEach(function(k) {
    if (k && k.nodeType === 1) hedef.appendChild(k.cloneNode(true));
  });

  (y.kartlar || []).forEach(function(k) {
    hedef.appendChild(kartYap(k.baslik, k.satirlar, k.renk));
  });
}

function goster(m, t, kal, uyarilar, ekKartlar) {
  if (!Array.isArray(m) || m.length < 5) {
    throw new Error('Analiz için yeterli mum verisi bulunamadı.');
  }

  var s = Analiz.yap(m, t);
  var y = Yorum.olustur(s, kal, Array.isArray(uyarilar) ? uyarilar : []);

  raporYaz(
    document.getElementById('tuval-alan'),
    s, kal, y, ekKartlar || []
  );

  raporYaz(
    document.getElementById('sonuc-alan'),
    s, kal, y, ekKartlar || [], 'Analiz Sonuçları'
  );

  var rapor = document.getElementById('analiz-rapor');
  if (rapor) rapor.hidden = true;
}

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(function(e) {
    e.classList.toggle('aktif', e.id === id);
  });
  document.querySelectorAll('nav button').forEach(function(b) {
    b.classList.toggle('aktif', b.dataset.git === id);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll('nav button[data-git]').forEach(function(b) {
  b.addEventListener('click', function() {
    ekranGoster(b.dataset.git);
  });
});

/* ---------- İsimle arama ---------- */
document.getElementById('ara-btn').addEventListener('click', async function() {
  var ad = document.getElementById('ara-ad').value.trim();
  var dur = document.getElementById('ara-durum');
  var btn = document.getElementById('ara-btn');

  if (!ad) {
    dur.textContent = 'Önce bir varlık adı yaz.';
    return;
  }

  btn.disabled = true;
  dur.textContent = 'Veri alınıyor ve analiz hazırlanıyor...';

  try {
    var v = await Veri.ara(ad, document.getElementById('ara-zd').value, function(x) {
      dur.textContent = x;
    });

    var dn = Veri.donustur(v, 80);
    if (!dn || !Array.isArray(dn.m) || dn.m.length < 5) {
      throw new Error('Grafik verisi eksik veya geçersiz.');
    }

    var t = Goruntu.trend(dn.m);
    var bilgi = kartYap('Grafik bilgisi', Veri.bilgi(v, dn.d), '#2f81f7');

    goster(dn.m, t, dn.kal, [], [bilgi]);

    var tamam = 'Analiz tamamlandı: ' + (v.ad || ad);
    dur.textContent = tamam;
    document.getElementById('analiz-durum').textContent = tamam;
    ekranGoster('analiz');
  } catch(e) {
    var hata = e && e.message ? e.message : String(e);
    dur.textContent = 'Hata: ' + hata + ' İnternetini ve sembolü kontrol et.';
    document.getElementById('analiz-durum').textContent = 'Analiz yapılamadı: ' + hata;
    var sonuc = document.getElementById('sonuc-alan');
    if (sonuc) sonuc.replaceChildren(kartYap('Analiz yapılamadı', [hata], '#ef5350'));
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('ara-ad').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('ara-btn').click();
});

/* ---------- Ekran görüntüsü modu ---------- */
document.getElementById('dosya').addEventListener('change', function(e) {
  var dosya = e.target.files && e.target.files[0];
  if (!dosya) return;

  var bilgi = document.getElementById('dosya-bilgi');
  var onizleme = document.getElementById('onizleme');
  var btn = document.getElementById('analiz-btn');

  if (!dosya.type || !dosya.type.startsWith('image/')) {
    GrafikAI.resim = null;
    btn.disabled = true;
    bilgi.textContent = 'Lütfen geçerli bir resim dosyası seç.';
    return;
  }

  if (onizlemeURL) URL.revokeObjectURL(onizlemeURL);
  onizlemeURL = URL.createObjectURL(dosya);
  GrafikAI.resim = dosya;

  onizleme.src = onizlemeURL;
  onizleme.hidden = false;
  btn.disabled = false;

  bilgi.textContent = 'Grafik yüklendi. Analiz sekmesinden "Yüklenen Görüntüyü Analiz Et" butonuna bas.';
  document.getElementById('analiz-durum').textContent = 'Grafik hazır.';
});

function sayi(id) {
  var alan = document.getElementById(id);
  var metin = alan.value.trim().replace(',', '.');
  if (!metin) return null;
  var deger = Number(metin);
  return Number.isFinite(deger) ? deger : null;
}

function kalibrasyon() {
  var hi = sayi('fiyat-ust');
  var lo = sayi('fiyat-alt');
  return hi !== null && lo !== null && hi > lo ? { hi: hi, lo: lo } : null;
}

document.getElementById('analiz-btn').addEventListener('click', async function() {
  var durum = document.getElementById('analiz-durum');
  var alan = document.getElementById('tuval-alan');
  var btn = document.getElementById('analiz-btn');

  if (!GrafikAI.resim) {
    durum.textContent = 'Önce bir grafik görseli yükle.';
    return;
  }

  btn.disabled = true;
  durum.textContent = 'Grafik görüntüsü analiz ediliyor...';
  alan.innerHTML = '';

  try {
    var r = await Goruntu.yukle(GrafikAI.resim);
    var uyarilar = Goruntu.kalite(r) || [];
    var m = Goruntu.mumlar(r);
    var t = Goruntu.trend(m);

    if (!Array.isArray(m) || m.length < 5) {
      var mesaj = 'Görselden yeterli mum verisi çıkarılamadı. Daha net, mumların tamamının göründüğü bir grafik yükle.';
      alan.appendChild(kartYap('Yetersiz mum verisi', [mesaj], '#f0b429'));
      durum.textContent = mesaj;
      return;
    }

    var kal = kalibrasyon();
    var bitis = 'Görsel analiz tamamlandı.';

    if (kal) {
      bitis += ' Fiyatlar girdiğin üst ve alt değerlerle hesaplandı.';
    } else {
      var hiText = document.getElementById('fiyat-ust').value.trim();
      var loText = document.getElementById('fiyat-alt').value.trim();

      if (hiText || loText) {
        uyarilar.push('Üst ve alt fiyat değerleri geçerli değil; fiyat ekseni otomatik okunacak.');
      }

      durum.textContent = 'Fiyat ekseni okunuyor... İlk kullanımda OCR dosyaları için internet gerekebilir.';
      try {
        var o = await OCR.oku(r, m);
        if (o && o.hi > o.lo) {
          kal = { hi: o.hi, lo: o.lo };
          bitis += ' Fiyat ekseni otomatik okundu; sonuçları eksenle karşılaştır.';
        } else {
          uyarilar.push('Fiyat ekseni okunamadı. Seviyeler yüzde olarak gösteriliyor.');
        }
      } catch(e) {
        uyarilar.push('Fiyat ekseni okunamadı: ' + (e && e.message ? e.message : String(e)));
      }
    }

    goster(m, t, kal, uyarilar, [
      kartYap(null, ['Grafik, görüntüden okunan mumlardan yeniden çizilmiştir.'])
    ]);

    durum.textContent = bitis;
    ekranGoster('analiz');
  } catch(e) {
    var hata = e && e.message ? e.message : String(e);
    durum.textContent = 'Hata: ' + hata;
    var sonuc = document.getElementById('sonuc-alan');
    if (sonuc) sonuc.replaceChildren(kartYap('Görsel analiz yapılamadı', [hata], '#ef5350'));
  } finally {
    btn.disabled = !GrafikAI.resim;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').catch(function(e) {
      console.warn('Service Worker kaydedilemedi:', e);
    });
  });
}
