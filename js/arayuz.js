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

document.getElementById('analiz-btn').addEventListener('click', async () => {
  const durum = document.getElementById('analiz-durum');
  const rapor = document.getElementById('analiz-rapor');
  const alan = document.getElementById('tuval-alan');
  durum.textContent = 'Analiz ediliyor...';
  rapor.hidden = true; alan.innerHTML = '';
  try {
    const r = await Goruntu.yukle(GrafikAI.resim);
    const uyarilar = Goruntu.kalite(r);
    const m = Goruntu.mumlar(r);
    const t = Goruntu.trend(m);
    const tuval = Goruntu.ciz(r, m);
    tuval.style.cssText = 'width:100%;border-radius:12px;margin-top:10px';
    alan.appendChild(tuval);
    const yesil = m.filter(k => k.renk === 1).length;
    const satirlar = ['Bulunan mum sayısı: ' + m.length + ' (yeşil: ' + yesil + ', kırmızı: ' + (m.length - yesil) + ')'];
    if (t) satirlar.push('Tahmini trend: ' + t.yon + ' (güç: %' + t.guc + ')');
    else satirlar.push('Yeterli mum bulunamadı, trend belirlenemedi.');
    satirlar.push('Fiyat seviyeleri henüz okunmuyor.');
    uyarilar.forEach(u => satirlar.push('⚠️ ' + u));
    if (m.length < 5) satirlar.push('⚠️ Mum çubukları net seçilemedi. Daha net bir grafik dene.');
    rapor.textContent = satirlar.join('\n');
    rapor.hidden = false;
    durum.textContent = 'Analiz tamamlandı.';
  } catch (e) {
    durum.textContent = 'Hata: ' + e.message;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
} 
