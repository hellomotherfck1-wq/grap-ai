const GrafikAI = { resim: null };

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(e => e.classList.toggle('aktif', e.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('aktif', b.dataset.git === id));
  window.scrollTo(0, 0);
}

document.querySelectorAll('nav button').forEach(b => {
  b.addEventListener('click', () => ekranGoster(b.dataset.git));
});

document.getElementById('dosya').addEventListener('change', e => {
  const dosya = e.target.files[0];
  if (!dosya) return;
  if (!dosya.type.startsWith('image/')) {
    document.getElementById('dosya-bilgi').textContent = 'Lütfen bir resim dosyası seç.';
    return;
  }
  GrafikAI.resim = dosya;
  const onizleme = document.getElementById('onizleme');
  onizleme.src = URL.createObjectURL(dosya);
  onizleme.hidden = false;
  document.getElementById('dosya-bilgi').textContent = 'Grafik yüklendi: ' + dosya.name;
  document.getElementById('analiz-durum').textContent = 'Grafik hazır.';
  document.getElementById('analiz-btn').disabled = false;
});

function sayi(id) {
  const x = parseFloat(document.getElementById(id).value.trim().replace(',', '.'));
  return isFinite(x) ? x : null;
}

function kalibrasyon() {
  const hi = sayi('fiyat-ust'), lo = sayi('fiyat-alt');
  return (hi !== null && lo !== null && hi > lo) ? { hi, lo } : null;
}

function kartYap(baslik, satirlar, renk) {
  const d = document.createElement('div');
  d.className = 'kart';
  if (renk) d.style.borderLeft = '4px solid ' + renk;
  if (baslik) {
    const h = document.createElement('h3');
    h.textContent = baslik;
    h.style.cssText = 'font-size:16px;margin-bottom:8px';
    d.appendChild(h);
  }
  satirlar.forEach(t => {
    const p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:8px';
    d.appendChild(p);
  });
  return d;
}

function karar(y) {
  const d = document.createElement('div');
  d.className = 'kart';
  d.style.borderLeft = '6px solid ' + y.renk;
  const k = document.createElement('div');
  k.textContent = y.karar;
  k.style.cssText = 'font-size:40px;font-weight:800;color:' + y.renk;
  const u = document.createElement('div');
  u.textContent = 'Teknik uyum puanı: %' + y.uyum + ' (kazanma olasılığı değildir)';
  u.style.cssText = 'font-size:13px;color:#8b98a5;margin:4px 0 12px';
  d.appendChild(k); d.appendChild(u);
  y.ozet.forEach(t => {
    const p = document.createElement('p');
    p.textContent = t;
    p.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:8px';
    d.appendChild(p);
  });
  return d;
}

document.getElementById('analiz-btn').addEventListener('click', async () => {
  const durum = document.getElementById('analiz-durum');
  const alan = document.getElementById('tuval-alan');
  durum.textContent = 'Analiz ediliyor...';
  document.getElementById('analiz-rapor').hidden = true;
  alan.innerHTML = '';
  try {
    const r = await Goruntu.yukle(GrafikAI.resim);
    const uyarilar = Goruntu.kalite(r);
    const m = Goruntu.mumlar(r);
    const t = Goruntu.trend(m);
    if (m.length < 5) {
      alan.appendChild(kartYap('Sonuç', ['Yeterli mum bulunamadı.', '⚠️ Mum çubukları net seçilemedi. Daha net bir grafik dene.'].concat(uyarilar.map(u => '⚠️ ' + u)), '#f0b429'));
      durum.textContent = 'Analiz tamamlandı.';
      return;
    }

    let kal = kalibrasyon();
    let bitis = 'Analiz tamamlandı.';
    if (kal) {
      bitis = 'Analiz tamamlandı. Fiyatlar senin yazdığın değerlerle hesaplandı.';
    } else {
      durum.textContent = 'Fiyat ekseni okunuyor... İlk seferde dosyalar indirilir, 1-2 dakika sürebilir.';
      try {
        const o = await OCR.oku(r, m);
        if (o) {
          kal = { hi: o.hi, lo: o.lo };
          bitis = 'Analiz tamamlandı. Fiyatlar eksendeki ' + o.n + ' etiketten otomatik okundu. Grafikteki eksenle karşılaştırıp kontrol et.';
        } else {
          uyarilar.push('Fiyat ekseni okunamadı. Seviyeler yüzde olarak gösteriliyor.');
        }
      } catch (e) {
        uyarilar.push('Fiyat ekseni okunamadı: ' + e.message);
      }
    }

    durum.textContent = 'Rapor hazırlanıyor...';
    const s = Analiz.yap(m, t);
    const y = Yorum.olustur(s, kal, uyarilar);
    alan.appendChild(karar(y));
    const tuval = Cizim.grafik(s, kal);
    tuval.style.cssText = 'width:100%;border-radius:12px;margin:4px 0 12px';
    alan.appendChild(tuval);
    const not = document.createElement('p');
    not.className = 'alt';
    not.textContent = 'Grafik, görüntüden okunan mumlardan yeniden çizilmiştir.';
    alan.appendChild(not);
    y.kartlar.forEach(k => alan.appendChild(kartYap(k.baslik, k.satirlar)));
    durum.textContent = bitis;
  } catch (e) {
    durum.textContent = 'Hata: ' + e.message;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
} 
