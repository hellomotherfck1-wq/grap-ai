(function () {
  const bilgi = [
    'formasyon2: ' + (typeof Formasyon2 !== 'undefined' ? 'yüklendi' : 'YOK'),
    'yorum: ' + (typeof Yorum !== 'undefined' ? 'yüklendi' : 'YOK'),
    'analiz: ' + (typeof Analiz !== 'undefined' ? 'yüklendi' : 'YOK'),
    'yeni tarama bağlı: ' + (typeof Formasyon !== 'undefined' && Formasyon.hepsi.toString().includes('Formasyon2') ? 'evet' : 'HAYIR')
  ].join(' | ');

  const ay = document.getElementById('ayarlar');
  if (ay) {
    const p = document.createElement('p');
    p.className = 'kart';
    p.textContent = 'Tanı: ' + bilgi;
    ay.appendChild(p);
  }

  if (typeof Yorum !== 'undefined') {
    const eski = Yorum.olustur;
    Yorum.olustur = function (s, kal, uy) {
      const y = eski.call(this, s, kal, uy);
      try {
        const k = y.kartlar.find(x => x.baslik === 'Formasyonlar');
        if (k) {
          const yeni = s.form.filter(f => f.seviyeler).length;
          k.satirlar.push('Tarama kontrolü: ' + s.c.length + ' mum tarandı, yeni formasyon sayısı: ' + yeni + '. (' + bilgi + ')');
        }
      } catch (e) {}
      return y;
    };
  }
})();
