(function () {
  const L = 'A1CAP|A1 Capital;A1YEN|A1 Yenilenebilir Enerji;AAGYO|Agaoglu Avrasya GYO;ACSEL|Acıselsan;ADEL|Adel Kalemcilik;ADESE|Adese Gayrimenkul;ADGYO|Adra GYO;AEFES|Anadolu Efes;AFYON|Afyon Çimento;AGESA|Agesa Hayat;AGHOL|AG Anadolu Grubu;AGROT|Agrotech;AGYO|Atakule GYO;AHGAZ|Ahlatcı Doğalgaz;AHSGY|Ahes GYO;AKBNK|Akbank;AKCNS|Akçansa;AKENR|Akenerji;AKFGY|Akfen GYO;AKFIS|Akfen İnşaat;AKFYE|Akfen Yenilenebilir;AKGRT|Aksigorta;AKHAN|Akhan Un;AKMGY|Akmerkez GYO;AKSA|Aksa Akrilik;AKSEN|Aksa Enerji;AKSGY|Akiş GYO;AKSUE|Aksu Enerji;AKYHO|Akdeniz Yatırım Holding;ALARK|Alarko Holding;ALBRK|Albaraka Türk;ALBTN|Albayrak Beton;ALCAR|Alarko Carrier;ALCTL|Alcatel Lucent Teletaş;ALFAS|Alfa Solar;ALGYO|Alarko GYO;ALKA|Alkim Kağıt;ALKIM|Alkim Kimya;ALKLC|Altinkilic Gıda;ALTIN|Darphane Altın Sertifikası;ALTNY|Altinay Savunma;ALVES|Alves Kablo;ANELE|Anel Elektrik;ANGEN|Anatolia Tanı;ANHYT|Anadolu Hayat;ANSGR|Anadolu Sigorta;ARASE|Doğu Aras Enerji;ARCLK|Arçelik;ARDYZ|ARD Grup Bilişim;ARENA|Arena Bilgisayar;ARFYE|ARF Bio Yenilenebilir;ARMGD|Armada Gıda;ARSAN|Arsan Tekstil;ARTMS|Artemis Halı;ARZUM|Arzum;ASELS|Aselsan;ASGYO|Asce GYO;ASTOR|Astor Enerji;ASUZU|Anadolu Isuzu;ATAGY|Ata GYO;ATAKP|Atakey Patates;ATATP|ATP Yazılım;ATATR|Ata Turizm;ATEKS|Akın Tekstil;ATLAS|Atlas Menkul;ATSYH|Atlantis Yatırım;AVGYO|Avrasya GYO;AVHOL|Avrupa Yatırım Holding;AVOD|AVOD Gıda;AVPGY|Avrupakent GYO;AYCES|Altın Yunus Çeşme;AYDEM|Aydem Yenilenebilir;AYEN|Ayen Enerji;AYES|Ayes Çelik Hasır;AYGAZ|Aygaz;AZTEK|Aztek Teknoloji;BAGFS|Bagfaş;BAHKM|Bahadir Kimya;BAKAB|Bak Ambalaj;BALAT|Balatacılar;BALSU|Balsu Gıda;BANVT|Banvit;BARMA|Barem Ambalaj;BASCM|Baştaş Başkent Çimento;BASGZ|Başkent Doğalgaz;BAYRK|Bayrak EBT Taban;BEGYO|Batı Ege GYO;BERA|Bera Holding;BESLR|Besler Gıda;BESTE|Best Brands Enerji;BETAE|Beta Enerji;BEYAZ|Beyaz Filo;BFREN|Bosch Fren;BIENY|Bien Yapı;BIGCH|Büyük Şefler;BIGEN|Birleşim Grup Enerji;BIGTK|Big Medya;BIMAS|BİM Mağazalar;BINBN|Bin Ulaşım;BINHO|1000 Yatırımlar Holding';

  function ekle() {
    const dl = document.getElementById('oneri');
    if (!dl) return;
    L.split(';').forEach(s => {
      const p = s.split('|');
      const o = document.createElement('option');
      o.value = p[0];
      o.label = p[1];
      dl.appendChild(o);
    });
  }

  if (window.Veri && Veri.oneriDoldur) {
    const eski = Veri.oneriDoldur;
    Veri.oneriDoldur = function () { eski.call(this); ekle(); };
    Veri.oneriDoldur();
  }
})();
