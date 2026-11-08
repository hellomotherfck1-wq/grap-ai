(function () {
  const L = 'AEFES|Anadolu Efes;AGHOL|AG Anadolu Grubu;AHGAZ|Ahlatcı Doğalgaz;AKBNK|Akbank;AKCNS|Akçansa;AKFYE|Akfen Yenilenebilir;AKSA|Aksa Akrilik;AKSEN|Aksa Enerji;ALARK|Alarko Holding;ALBRK|Albaraka Türk;ALTNY|Altınay Savunma;ANHYT|Anadolu Hayat;ANSGR|Anadolu Sigorta;ARCLK|Arçelik;ASELS|Aselsan;ASTOR|Astor Enerji;AYGAZ|Aygaz;BERA|Bera Holding;BIMAS|BİM;BINHO|1000 Yatırımlar Holding;BRSAN|Borusan Boru;BRYAT|Borusan Yatırım;BTCIM|Batıçim;CANTE|Çan2 Termik;CCOLA|Coca-Cola İçecek;CIMSA|Çimsa;CVKMD|CVK Maden;CWENE|CW Enerji;DOAS|Doğuş Otomotiv;DOHOL|Doğan Holding;ECILC|Eczacıbaşı İlaç;ECZYT|Eczacıbaşı Yatırım;EGEEN|Ege Endüstri;EGGUB|Ege Gübre;EKGYO|Emlak Konut;ENERY|Enerya;ENJSA|Enerjisa;ENKAI|Enka İnşaat;ENTRA|IC Enterra;EREGL|Ereğli Demir Çelik;EUREN|Europen Endüstri;FENER|Fenerbahçe;FROTO|Ford Otosan;GARAN|Garanti BBVA;GLRMK|Gülermak;GLYHO|Global Yatırım Holding;GRSEL|Gürsel Turizm;GUBRF|Gübre Fabrikaları;GWIND|Galata Wind;HALKB|Halkbank;HEKTS|Hektaş;ISCTR|İş Bankası;ISDMR|İskenderun Demir Çelik;ISMEN|İş Yatırım;KARSN|Karsan;KATMR|Katmerciler;KCAER|Kocaer Çelik;KCHOL|Koç Holding;KORDS|Kordsa;KRDMD|Kardemir;LMKDC|Limak Doğu Anadolu Çimento;MAVI|Mavi;MGROS|Migros;MPARK|MLP Sağlık;OBAMS|Oba Makarnacılık;ODAS|Odaş Elektrik;OTKAR|Otokar;OYAKC|Oyak Çimento;PAHOL|Pasifik Holding;PETKM|Petkim;PGSUS|Pegasus;RGYAS|Rönesans GYO;RYSAS|Reysaş;SAHOL|Sabancı Holding;SASA|Sasa Polyester;SISE|Şişecam;SNGYO|Sinpaş GYO;SOKM|Şok Marketler;TABGD|TAB Gıda;TAVHL|TAV Havalimanları;TCELL|Turkcell;TCKRC|Kıraç Galvaniz;THYAO|Türk Hava Yolları;TKFEN|Tekfen Holding;TOASO|Tofaş;TRALT|Koza Altın;TRENJ|İpek Doğal Enerji;TRGYO|Torunlar GYO;TRMET|Koza Anadolu Metal;TSKB|TSKB;TTKOM|Türk Telekom;TTRAK|Türk Traktör;TUKAS|Tukaş;TUPRS|Tüpraş;TURSG|Türkiye Sigorta;ULKER|Ülker;VAKBN|Vakıfbank;VESTL|Vestel;YKBNK|Yapı Kredi;ZOREN|Zorlu Enerji';

  const liste = L.split(';').map(s => {
    const p = s.split('|');
    return { k: p[0], a: p[1] };
  });

  liste.forEach(x => {
    const h = { kaynak: 'y', sembol: x.k + '.IS', ad: x.a, tur: 'BIST 100 hissesi' };
    Veri.harita[Veri.norm(x.a)] = h;
    Veri.harita[x.k.toLowerCase()] = h;
  });

  function ekle() {
    const dl = document.getElementById('oneri');
    if (!dl) return;
    const var_ = new Set(Array.from(dl.options).map(o => o.value));
    liste.forEach(x => {
      if (var_.has(x.k)) return;
      const o = document.createElement('option');
      o.value = x.k;
      o.label = x.a;
      dl.appendChild(o);
    });
  }

  if (Veri.oneriDoldur) {
    const eski = Veri.oneriDoldur;
    Veri.oneriDoldur = function () { eski.call(this); ekle(); };
    Veri.oneriDoldur();
  }
})();
