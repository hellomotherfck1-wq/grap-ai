var GrafikAI = { resim: null };
var onizlemeURL = null;

function kartYap(baslik, satirlar, renk) {
  var d = document.createElement('div');
  d.className = 'kart';
  d.style.borderLeft = '3px solid ' + (renk || '#2f81f7');
  var h = document.createElement('h3');
  h.textContent = baslik;
  d.appendChild(h);
  (satirlar || []).forEach(function(s) {
    var p = document.createElement('p');
    p.textContent = s;
    d.appendChild(p);
  });
  return d;
}

function karar(y) {
  var d = document.createElement('div');
  d.className = 'karar ' + y.renk;
  var h = document.createElement('h2');
  h.textContent = y.baslik;
  var p = document.createElement('p');
  p.textContent = y.ozet;
  var guven = document.createElement('strong');
  guven.textContent = 'Güven: %' + y.guven;
  d.appendChild(h);
  d.appendChild(p);
  d.appendChild(guven);
  return d;
}

function sonucDurum(baslik, satirlar, renk) {
  var hedef = document.getElementById('sonuc');
  if (!hedef) return;
  hedef.innerHTML = '';
  var h = document.createElement('h2');
  h.textContent = 'Analiz Sonuçları';
  hedef.appendChild(h);
  hedef.appendChild(kartYap(baslik, satirlar, renk));
}

function raporYaz(hedef, s, kal, y, ekKartlar, baslik) {
  hedef.innerHTML = '';
  if (baslik) {
    var h = document.createElement('h2');
    h.textContent = baslik;
    hedef.appendChild(h);
  }

  hedef.appendChild(karar(y));

  var tuval = Cizim.grafik(s, kal);
  tuval.style.cssText = 'width:100%;max-width:900px;height:auto;border-radius:12px;background:#0d1117;margin:12px 0';
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
  var alan = document.getElementById('tuval-alan');
  var sonuc = document.getElementById('sonuc');

  if (!alan || !sonuc) {
    throw new Error('Analiz ekranı bileşenleri bulunamadı.');
  }

  var rapor = document.getElementById('analiz-rapor');
  if (rapor) rapor.hidden = true;

  raporYaz(alan, s, kal, y, ekKartlar || []);
  raporYaz(sonuc, s, kal, y, ekKartlar || [], 'Analiz Sonuçları');
}

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(function(e) {
    e.classList.remove('aktif');
  });
  document.querySelectorAll('nav button').forEach(function(b) {
    b.classList.remove('aktif');
  });
  var hedef = document.getElementById(id);
  var dugme = document.querySelector('nav button[data-git="' + id + '"]');
  if (hedef) hedef.classList.add('aktif');
  if (dugme) dugme.classList.add('aktif');
  window.scrollTo(0, 0);
}

document.querySelectorAll('nav button[data-git]').forEach(function(b) {
  b.addEventListener('click', function() {
    ekranGoster(b.dataset.git);
  });
});

document.getElementById('ara-btn').addEventListener('click', async function() {
  var ad = document.getElementById('varlik-ara').value.trim();
  var zaman = document.getElementById('zaman').value;
  var dur = document.getElementById('ara-durum');
  var btn = document.getElementById('ara-btn');

  if (!ad) {
    dur.textContent = 'Lütfen bir hisse veya coin sembolü gir.';
    return;
  }

  btn.disabled = true;
  dur.textContent = 'Veri alınıyor ve analiz hazırlanıyor...';
  sonucDurum('Analiz hazırlanıyor', ['Piyasa verileri alınıyor.'], '#2f81f7');

  try {
    var v = await Veri.ara(ad, zaman);
    if (!v) throw new Error('Bu sembol için veri bulunamadı.');

    var dn = Veri.donustur(v, 80);
    if (!dn || !Array.isArray(dn.m) || dn.m.length < 5) {
      throw new Error('Grafik verisi eksik veya geçersiz.');
    }

    var t = Goruntu.trend(dn.m);
    goster(dn.m, t, dn.kal, [], [
      kartYap('Grafik bilgisi', Veri.bilgi(v, dn.d), '#2f81f7')
    ]);

    document.getElementById('analiz-durum').textContent =
      'Analiz tamamlandı: ' + (v.ad || ad);
    dur.textContent = 'Analiz tamamlandı: ' + (v.ad || ad);
    ekranGoster('analiz');
  } catch (e) {
    var hata = e && e.message ? e.message : String(e);
    dur.textContent = 'Hata: ' + hata;
    document.getElementById('analiz-durum').textContent = 'Analiz yapılamadı: ' + hata;
    sonucDurum('Analiz yapılamadı', [hata], '#ef5350');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('resim-dosya').addEventListener('change', function(e) {
  var dosya = e.target.files && e.target.files[0];
  var onizleme = document.getElementById('resim-onizleme');
  var btn = document.getElementById('analiz-btn');
  var durum = document.getElementById('analiz-durum');

  if (!dosya) return;

  if (!dosya.type || !dosya.type.startsWith('image/')) {
    GrafikAI.resim = null;
    btn.disabled = true;
    durum.textContent = 'Lütfen geçerli bir görsel dosyası seç.';
    return;
  }

  if (onizlemeURL) URL.revokeObjectURL(onizlemeURL);
  onizlemeURL = URL.createObjectURL(dosya);
  GrafikAI.resim = dosya;
  onizleme.src = onizlemeURL;
  onizleme.style.display = 'block';
  btn.disabled = false;
  durum.textContent = 'Görsel yüklendi. Analiz Et butonuna bas.';
});

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
  sonucDurum('Analiz hazırlanıyor', ['Grafik görüntüsü inceleniyor.'], '#2f81f7');

  try {
    var m = await Goruntu.yukle(GrafikAI.resim);
    if (!Array.isArray(m) || m.length < 5) {
      alan.innerHTML = '';
      var mesaj = kartYap('Yetersiz mum verisi', [
        'Görselden yeterli mum verisi çıkarılamadı.',
        'Daha net, mumların tamamının göründüğü bir grafik yükle.'
      ], '#ef5350');
      alan.appendChild(mesaj);
      sonucDurum('Yetersiz mum verisi', [
        'Görselden yeterli mum verisi çıkarılamadı.',
        'Daha net bir grafik yüklemeyi dene.'
      ], '#ef5350');
      durum.textContent = 'Yetersiz mum verisi. Daha net bir grafik yükle.';
      return;
    }

    var t = Goruntu.trend(m);
    var kal = {
      ust: parseFloat(document.getElementById('fiyat-ust').value) || 0,
      alt: parseFloat(document.getElementById('fiyat-alt').value) || 0
    };

    goster(m, t, kal, [], [
      kartYap(null, ['Grafik, görüntüden okunan mumlardan yeniden çizilmiştir.'])
    ]);

    durum.textContent = 'Görsel analiz tamamlandı. Analiz ve Sonuç sekmelerini kontrol et.';
    ekranGoster('analiz');
  } catch (e) {
    var hata = e && e.message ? e.message : String(e);
    durum.textContent = 'Hata: ' + hata;
    sonucDurum('Görsel analiz yapılamadı', [hata], '#ef5350');
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
