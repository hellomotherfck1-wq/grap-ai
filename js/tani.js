(function () {
  if (typeof Yorum === 'undefined') return;
  const eski = Yorum.olustur;
  Yorum.olustur = function (s, kal, uy) {
    const y = eski.call(this, s, kal, uy);
    try {
      const k = y.kartlar.find(x => x.baslik === 'Formasyonlar');
      if (k) {
        k.satirlar.push('Tarama kontrolü: ' + s.c.length + ' mum tarandı, bulunan formasyon sayısı: ' + s.form.length + '.');
      }
    } catch (e) {}
    return y;
  };
})();
