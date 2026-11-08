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

document.getElementById('analiz-btn').addEventListener('click', () => {
  document.getElementById('analiz-durum').textContent = 'Analiz motoru henüz eklenmedi (Aşama 3-4).';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
} 
