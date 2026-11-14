/* ajan-fk.js — F/K ve temel değerleme ajanı
   ajan.js ve ajan2.js'den sonra yüklenir. Ücretsiz Yahoo Finance verisini kullanır.
   F/K bulunamazsa sayı üretmez; teknik kurul kararını korur. */
(function () {
  'use strict';

  var A = (typeof window !== 'undefined') ? window.Ajan : null;
  if (!A) return;

  var YAHOO = 'https://query1.finance.yahoo.com';
  var KART_BASLIK = '📊 F/K Değerleme ve Ajanlar Arası Tartışma';

  /* Bunlar sektör medyanı değil, yalnızca kaba ön eleme bantlarıdır.
     Sektör karşılaştırması alınamadığında kesin değer gibi kullanılmaz. */
  var BANT = {
    bist: { ucuz: 6, makul: 12, yuksek: 20 },
    diger: { ucuz: 12, makul: 22, yuksek: 35 }
  };

  var FK = {
    sembol: null,
    veri: null,
    hata: null,
    sonFiyat: null,
    jeton: 0,
    kaynak: null,
    tur: null,
    ad: null,
    sonuc: null,
    cache: Object.create(null)
  };
  A.fk = FK;

  function sayiMi(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function deger(x) {
    if (x && typeof x === 'object' && Object.prototype.hasOwnProperty.call(x, 'raw')) x = x.raw;
    if (x === null || x === undefined || x === '') return null;
    var n = Number(x);
    return isFinite(n) ? n : null;
  }

  function fmt(x, basamak) {
    if (!sayiMi(x)) return '—';
    try {
      return new Intl.NumberFormat('tr-TR', {
        maximumFractionDigits: basamak == null ? 2 : basamak
      }).format(x);
    } catch (e) {
      return x.toFixed(basamak == null ? 2 : basamak).replace('.', ',');
    }
  }

  function sembolNorm(x) {
    return String(x || '').toUpperCase().replace(/\s+/g, '');
  }

  function sifirla() {
    FK.jeton++;
    FK.sembol = null;
    FK.veri = null;
    FK.hata = null;
    FK.sonFiyat = null;
    FK.kaynak = null;
    FK.tur = null;
    FK.ad = null;
    FK.sonuc = null;
  }

  function uygulanamaz(sembol, kaynak, tur) {
    var s = sembolNorm(sembol);
    if (!s || kaynak === 'b') return true;
    if (tur && /(kripto|coin|crypto|forex|emtia|endeks)/i.test(String(tur))) return true;
    return /(-USD|-USDT|-EUR|=X|=F)$/i.test(s) || s.charAt(0) === '^';
  }

  async function jsonGet(url) {
    if (!window.GrapAIDataTransport) throw new Error('Ortak veri aktarım katmanı yüklenmedi.');
    return window.GrapAIDataTransport.json(url, {
      cacheTtlMs: 15 * 60 * 1000,
      staleMaxAgeMs: 0,
      timeoutMs: 6500,
      validate: function (value) {
        return !!(value && value.quoteSummary &&
          Array.isArray(value.quoteSummary.result) && value.quoteSummary.result.length > 0);
      }
    }).then(function (value) {
      var info = typeof window.GrapAIDataTransport.info === 'function'
        ? window.GrapAIDataTransport.info(url, 'json') : null;
      if (!info || info.failed || info.stale) {
        throw new Error('F/K verisinin güncelliği doğrulanamadı; eski önbellek verisi kullanılmadı.');
      }
      return value;
    });
  }

  function quoteAyris(sembol, json, grafikFiyati) {
    var q = json && json.quoteSummary;
    var item = q && Array.isArray(q.result) ? q.result[0] : null;
    if (!item) {
      var mesaj = q && q.error && (q.error.description || q.error.code);
      throw new Error(mesaj || 'Yahoo Finance F/K verisi döndürmedi');
    }

    var priceBox = item.price || {};
    var detail = item.summaryDetail || {};
    var stats = item.defaultKeyStatistics || {};
    var financial = item.financialData || {};
    var profile = item.assetProfile || {};

    var currentPrice = deger(financial.currentPrice);
    if (!(currentPrice > 0)) currentPrice = deger(priceBox.regularMarketPrice);
    if (!(currentPrice > 0)) currentPrice = deger(grafikFiyati);

    var trailingPE = deger(detail.trailingPE);
    if (trailingPE === null) trailingPE = deger(stats.trailingPE);
    var forwardPE = deger(detail.forwardPE);
    var trailingEps = deger(stats.trailingEps);
    if (trailingEps === null) trailingEps = deger(financial.trailingEps);

    var pe = trailingPE > 0 ? trailingPE : null;
    var peType = pe !== null ? 'Son 12 ay F/K' : '';
    if (!(pe > 0) && trailingEps > 0 && currentPrice > 0) {
      pe = currentPrice / trailingEps;
      peType = 'Hesaplanan F/K (fiyat / EPS)';
    }
    if (!(pe > 0) && forwardPE > 0) {
      pe = forwardPE;
      peType = 'İleri F/K';
    }

    return {
      symbol: sembolNorm(sembol),
      price: currentPrice,
      currency: priceBox.currency || (sembolNorm(sembol).slice(-3) === '.IS' ? 'TRY' : ''),
      trailingPE: trailingPE,
      forwardPE: forwardPE,
      pe: sayiMi(pe) && pe > 0 ? pe : null,
      peType: peType,
      trailingEps: trailingEps,
      priceToBook: deger(stats.priceToBook),
      earningsGrowth: deger(financial.earningsGrowth),
      revenueGrowth: deger(financial.revenueGrowth),
      roe: deger(financial.returnOnEquity),
      profitMargins: deger(financial.profitMargins),
      debtToEquity: deger(financial.debtToEquity),
      currentRatio: deger(financial.currentRatio),
      marketCap: deger(priceBox.marketCap),
      targetMeanPrice: deger(financial.targetMeanPrice),
      sector: String(profile.sector || ''),
      industry: String(profile.industry || ''),
      fetchedAt: new Date().toISOString(),
      source: 'Yahoo Finance herkese açık QuoteSummary'
    };
  }

  function veriGetir(sembol, grafikFiyati) {
    var key = sembolNorm(sembol);
    var cached = FK.cache[key];
    if (cached && Date.now() - cached.time < 15 * 60 * 1000) {
      return Promise.resolve(cached.data);
    }

    var modules = 'price,summaryDetail,defaultKeyStatistics,financialData,assetProfile';
    var url = YAHOO + '/v10/finance/quoteSummary/' + encodeURIComponent(key) +
      '?modules=' + encodeURIComponent(modules);

    return jsonGet(url).then(function (json) {
      var data = quoteAyris(key, json, grafikFiyati);
      FK.cache[key] = { time: Date.now(), data: data };
      return data;
    });
  }

  function kararOku(s, y) {
    var kartlar = y && Array.isArray(y.kartlar) ? y.kartlar : [];
    for (var i = 0; i < kartlar.length; i++) {
      var baslik = String(kartlar[i] && kartlar[i].baslik || '');
      if (baslik.indexOf('Nihai Karar') >= 0 || baslik.indexOf('Ortak Sonuç') === 0) {
        var eslesme = baslik.match(/:\s*(AL|SAT|BEKLE)\s*$/i);
        if (eslesme) return eslesme[1].toUpperCase();
      }
    }
    var karar = String(s && s.karar || 'BEKLE').toUpperCase();
    return karar === 'AL' || karar === 'SAT' ? karar : 'BEKLE';
  }

  function bantGetir(sembol) {
    return /\.IS$/i.test(sembolNorm(sembol)) ? BANT.bist : BANT.diger;
  }

  function degerlendir(data, s, y, sembol) {
    var base = kararOku(s, y);
    var bant = bantGetir(sembol);
    var pe = data ? deger(data.pe) : null;
    var peType = data && data.peType ? data.peType : 'F/K';
    var eps = data ? deger(data.trailingEps) : null;
    var forwardPE = data ? deger(data.forwardPE) : null;
    var durum = 'veri yok';
    var puan = 0;
    var olumlu = [];
    var riskler = [];

    if (!(pe > 0) && data) {
      var trailing = deger(data.trailingPE);
      if (trailing > 0) {
        pe = trailing;
        peType = 'Son 12 ay F/K';
      } else if (forwardPE > 0) {
        pe = forwardPE;
        peType = 'İleri F/K';
      }
    }

    if (pe > 0) {
      if (pe <= bant.ucuz) {
        durum = 'genel banda göre düşük';
        puan += 1;
        olumlu.push('F/K genel referans bandının alt bölümünde.');
      } else if (pe <= bant.makul) {
        durum = 'genel banda göre makul';
        olumlu.push('F/K genel referans bandında.');
      } else if (pe <= bant.yuksek) {
        durum = 'yüksek';
        puan -= 1;
        riskler.push('F/K genel referans bandının üzerinde.');
      } else {
        durum = 'çok yüksek';
        puan -= 2;
        riskler.push('F/K genel referans bandının belirgin üzerinde.');
      }
    } else if (eps !== null && eps <= 0) {
      durum = 'negatif EPS / F/K hesaplanamaz';
      puan -= 1;
      riskler.push('Şirketin son EPS değeri sıfır veya negatif; klasik F/K anlamlı değil.');
    }

    if (data) {
      var buyume = deger(data.earningsGrowth);
      var roe = deger(data.roe);
      var marj = deger(data.profitMargins);
      var borc = deger(data.debtToEquity);
      var finansSektoru = /(financial|bank|insurance|finans|bankac|sigorta)/i.test(
        String(data.sector || '') + ' ' + String(data.industry || '')
      );

      if (buyume !== null) {
        if (buyume > 0.10) { puan++; olumlu.push('Kâr büyümesi pozitif (' + fmt(buyume * 100, 1) + '%).'); }
        else if (buyume < 0) { puan--; riskler.push('Kâr büyümesi negatif (' + fmt(buyume * 100, 1) + '%).'); }
      }
      if (roe !== null) {
        if (roe > 0.12) { puan++; olumlu.push('Özkaynak kârlılığı destekleyici (' + fmt(roe * 100, 1) + '%).'); }
        else if (roe < 0.05) { puan--; riskler.push('Özkaynak kârlılığı zayıf (' + fmt(roe * 100, 1) + '%).'); }
      }
      if (marj !== null && marj < 0) {
        puan--;
        riskler.push('Net kâr marjı negatif.');
      } else if (marj !== null && marj > 0.10) {
        puan++;
        olumlu.push('Net kâr marjı güçlü (' + fmt(marj * 100, 1) + '%).');
      }
      if (borc !== null && borc > 200 && !finansSektoru) {
        puan--;
        riskler.push('Borç/özkaynak oranı yüksek; finans dışı şirket için risk oluşturabilir.');
      }
      var trailingPE = deger(data.trailingPE);
      if (trailingPE > 0 && forwardPE > 0) {
        if (forwardPE < trailingPE * 0.85) {
          puan++;
          olumlu.push('İleri F/K, mevcut F/K’dan düşük; tahmini kâr artışı fiyatlanıyor olabilir.');
        } else if (forwardPE > trailingPE * 1.15) {
          puan--;
          riskler.push('İleri F/K mevcut F/K’dan yüksek; tahmini kâr görünümü zayıflıyor olabilir.');
        }
      }
    }

    var son = base;
    var dusuruldu = false;
    if (base === 'AL') {
      var zarar = eps !== null && eps <= 0 && !(forwardPE > 0);
      var degerlemeRiski = durum === 'çok yüksek' ||
        (durum === 'yüksek' && puan <= -2) ||
        puan <= -3;
      if (zarar || degerlemeRiski) {
        son = 'BEKLE';
        dusuruldu = true;
      }
    }

    var neden;
    if (dusuruldu) {
      neden = 'Teknik kurul AL yönünde olsa da değerleme veya kârlılık riskleri ağır bastı; acele alım yerine BEKLE daha temkinli.';
    } else if (base === 'BEKLE') {
      neden = 'Teknik kurul net giriş teyidi vermiyor. F/K olumlu olsa bile tek başına zamanlama sinyali olmadığı için BEKLE korunuyor.';
    } else if (base === 'SAT' && durum === 'genel banda göre düşük') {
      neden = 'F/K görece düşük; ancak teknik kurul SAT diyor. Ucuzluk tek başına düşüş trendinin bittiğini göstermez.';
    } else if (base === 'SAT') {
      neden = 'Teknik kurul SAT yönünde. F/K tek başına bu çıkış sinyalini geçersiz kılmaz.';
    } else if (durum === 'genel banda göre düşük' || durum === 'genel banda göre makul') {
      neden = 'Teknik kurul AL yönünde ve değerleme verisi bunu belirgin biçimde engellemiyor. Yine de giriş ve stop seviyeleri korunmalı.';
    } else if (durum === 'yüksek' || durum === 'çok yüksek') {
      neden = 'Teknik kurul AL diyor; ancak F/K yüksek. Güçlü kâr büyümesi teyidi olmadan fiyatı kovalamamak gerekir.';
    } else {
      neden = 'F/K verisi doğrulanamadı; teknik kurulun kararı korundu ancak temel değerleme teyidi yok.';
    }

    return {
      base: base,
      son: son,
      durum: durum,
      neden: neden,
      pe: pe > 0 ? pe : null,
      peType: peType,
      puan: puan,
      bant: bant,
      olumlu: olumlu,
      riskler: riskler,
      data: data || null
    };
  }

  function tartismaOlustur(sonuc, s, data) {
    var satirlar = [];
    var trend = s && s.trend ? s.trend.yon : 'belirlenemedi';
    var rsi = s && sayiMi(s.rsi) ? ' RSI ' + fmt(s.rsi, 1) + '.' : '';
    satirlar.push('Teknik Ajan: İlk kurul kararı ' + sonuc.base + '; trend ' + trend + '.' + rsi);

    if (sonuc.pe !== null) {
      satirlar.push('F/K Ajanı: ' + sonuc.peType + ' ' + fmt(sonuc.pe, 2) +
        'x. Değerleme durumu: ' + sonuc.durum + '. Bu oran tek başına AL/SAT sinyali değildir.');
    } else if (data && data.trailingEps !== null && data.trailingEps <= 0) {
      satirlar.push('F/K Ajanı: EPS negatif olduğu için klasik F/K hesaplanamaz; bu veriyi ucuzluk olarak yorumlamıyorum.');
    } else {
      satirlar.push('F/K Ajanı: Kullanılabilir F/K verisi yok. Eksik değeri tahmin etmiyorum.');
    }

    if (data) {
      var temel = [];
      if (data.earningsGrowth !== null) temel.push('kâr büyümesi ' + fmt(data.earningsGrowth * 100, 1) + '%');
      if (data.roe !== null) temel.push('ROE ' + fmt(data.roe * 100, 1) + '%');
      if (data.profitMargins !== null) temel.push('net marj ' + fmt(data.profitMargins * 100, 1) + '%');
      if (data.debtToEquity !== null) temel.push('borç/özkaynak ' + fmt(data.debtToEquity, 1));
      satirlar.push('Temel Ajan: ' + (temel.length ? temel.join(', ') + '.' : 'Ek temel oranlar sınırlı; güçlü bir hüküm vermiyorum.'));
    } else {
      satirlar.push('Temel Ajan: Ücretsiz finansal kaynak yanıt vermedi; bilanço verisi olmadan olumlu varsayım yapmıyorum.');
    }

    if (sonuc.son !== sonuc.base) {
      satirlar.push('Denetçi Ajan: Teknik AL kararı değerleme/kârlılık riskiyle çelişiyor. Kararı BEKLE seviyesine indiriyorum.');
    } else if (sonuc.base === 'SAT' && sonuc.durum === 'genel banda göre düşük') {
      satirlar.push('Denetçi Ajan: F/K düşük olsa da düşüş trendi teyit edilmeden SAT kararını değiştirmiyorum.');
    } else if (sonuc.base === 'BEKLE') {
      satirlar.push('Denetçi Ajan: Ajanlar arasında yeterli giriş teyidi yok; BEKLE kararını koruyorum.');
    } else if (sonuc.pe !== null) {
      satirlar.push('Denetçi Ajan: Teknik ve temel verileri birlikte tarttım; mevcut AL/SAT kararını koruyorum.');
    } else {
      satirlar.push('Denetçi Ajan: F/K teyidi eksik; yalnızca teknik kurul kararına güvenmek zorunda kalıyorum.');
    }

    satirlar.push('Kurulun nihai kararı: ' + sonuc.son + '. ' + sonuc.neden);
    return satirlar;
  }

  function kartSatirlari(sonuc, data, hata, s) {
    var L = [];
    if (hata) {
      L.push('F/K verisi alınamadı: ' + hata);
      L.push('Ücretsiz kaynak yanıt vermediği için F/K veya adil değer uydurulmadı.');
      L.push('Teknik ajan kurulunun ilk kararı: ' + sonuc.base + ' — bu karar değişmedi.');
      L.push('Kaynak tekrar erişilebilir olduğunda hisseyi yeniden analiz edebilirsin.');
      return L;
    }

    if (sonuc.pe !== null) {
      L.push(sonuc.peType + ': ' + fmt(sonuc.pe, 2) + 'x · ' + sonuc.durum + '.');
    } else if (data && data.trailingEps !== null && data.trailingEps <= 0) {
      L.push('F/K: Hesaplanamıyor; son EPS negatif veya sıfır.');
    } else {
      L.push('F/K: Sağlayıcıdan doğrulanabilir veri gelmedi.');
    }
    if (data && data.trailingPE !== null) L.push('Son 12 ay F/K: ' + fmt(data.trailingPE, 2) + 'x.');
    if (data && data.forwardPE !== null) L.push('İleri F/K: ' + fmt(data.forwardPE, 2) + 'x.');
    if (data && data.priceToBook !== null) L.push('PD/DD: ' + fmt(data.priceToBook, 2) + 'x.');
    if (data && (data.sector || data.industry)) {
      L.push('Sektör: ' + [data.sector, data.industry].filter(Boolean).join(' / ') + '.');
    }
    if (data && data.targetMeanPrice !== null) {
      L.push('Analist ortalama hedefi: ' + fmt(data.targetMeanPrice, 2) +
        (data.currency ? ' ' + data.currency : '') + ' (garanti değildir).');
    }
    L.push('Değerleme puanı: ' + sonuc.puan + ' · teknik karar: ' + sonuc.base + '.');
    L.push('Ajanların tartışması:');
    tartismaOlustur(sonuc, s || {}, data).forEach(function (x) { L.push(x); });
    L.push('Referans bantları sektör medyanı değildir: BIST için ' + sonuc.bant.ucuz + '/' +
      sonuc.bant.makul + '/' + sonuc.bant.yuksek + 'x, diğer hisseler için genel piyasa bandı kullanılır.');
    L.push('Kaynak: Yahoo Finance herkese açık veri ucu. Veri gecikmeli/eksik olabilir; otomatik çıktı yatırım tavsiyesi değildir.');
    return L;
  }

  function renkKarar(karar) {
    return karar === 'AL' ? '#26a69a' : karar === 'SAT' ? '#ef5350' : '#f0b429';
  }

  function kartDOMGuncelle(card, eslesenBaslik) {
    try {
      var root = document.getElementById('tuval-alan');
      if (!root) return;
      var basliklar = root.querySelectorAll('.kart h3');
      var onEk = eslesenBaslik || KART_BASLIK;
      for (var i = 0; i < basliklar.length; i++) {
        if (String(basliklar[i].textContent || '').indexOf(onEk) !== 0) continue;
        var box = basliklar[i].parentNode;
        if (!box) return;
        box.replaceChildren();
        box.style.borderLeft = '4px solid #8b98a5';
        var h = document.createElement('h3');
        h.textContent = card.baslik;
        h.style.cssText = 'font-size:16px;margin-bottom:8px';
        box.appendChild(h);
        (card.satirlar || []).forEach(function (line) {
          var p = document.createElement('p');
          p.textContent = String(line);
          p.style.cssText = 'font-size:14px;line-height:1.5;margin-bottom:6px;color:#c8d1da;overflow-wrap:anywhere';
          box.appendChild(p);
        });
        return;
      }
    } catch (e) {}
  }

  function kararDOMGuncelle(y) {
    try {
      var root = document.getElementById('tuval-alan');
      var box = root && root.firstElementChild;
      if (!box || !box.classList || !box.classList.contains('kart')) return;
      box.style.borderLeft = '6px solid ' + (y.renk || renkKarar(y.karar));
      var buyuk = box.firstElementChild;
      if (buyuk) {
        buyuk.textContent = y.karar || 'BEKLE';
        buyuk.style.color = y.renk || renkKarar(y.karar);
      }
      var paragraflar = box.querySelectorAll('p');
      var ozet = Array.isArray(y.ozet) ? y.ozet : [];
      for (var i = 0; i < ozet.length && i < 3; i++) {
        if (paragraflar[i]) paragraflar[i].textContent = ozet[i];
        else {
          var p = document.createElement('p');
          p.textContent = ozet[i];
          p.style.cssText = 'font-size:14px;line-height:1.55;margin-bottom:8px';
          box.appendChild(p);
        }
      }
    } catch (e) {}
  }

  function gecmisiGuncelle(sembol, sonuc, data) {
    try {
      var g = window.GrafikAI;
      if (!g || !g.sonAnaliz || sembolNorm(g.sonAnaliz.sembol) !== sembolNorm(sembol)) return;
      var ozet = {
        trailingPE: data ? data.trailingPE : null,
        forwardPE: data ? data.forwardPE : null,
        pe: sonuc.pe,
        valuation: sonuc.durum,
        sector: data ? data.sector : '',
        industry: data ? data.industry : '',
        checkedAt: new Date().toISOString()
      };
      g.sonAnaliz.karar = sonuc.son;
      g.sonAnaliz.ozet = sonuc.neden;
      g.sonAnaliz.fk = ozet;
      if (Array.isArray(g.gecmis)) {
        for (var i = 0; i < g.gecmis.length; i++) {
          if (g.gecmis[i] === g.sonAnaliz ||
              (g.gecmis[i].tarih === g.sonAnaliz.tarih &&
               sembolNorm(g.gecmis[i].sembol) === sembolNorm(sembol))) {
            g.gecmis[i].karar = sonuc.son;
            g.gecmis[i].ozet = sonuc.neden;
            g.gecmis[i].fk = ozet;
            break;
          }
        }
      }
      if (window.localStorage && g.anahtar) {
        localStorage.setItem(g.anahtar, JSON.stringify(g.gecmis || []));
      }
      if (typeof sonucGuncelle === 'function') sonucGuncelle();
    } catch (e) {}
  }

  function karariUygula(y, sonuc, sembol, data) {
    if (!y) return;
    y.karar = sonuc.son;
    y.renk = renkKarar(sonuc.son);
    var eski = Array.isArray(y.ozet) ? y.ozet.slice() : [];
    y.ozet = ['Ajan kurulunun F/K sonrası kararı: ' + sonuc.son + ' — ' + sonuc.neden]
      .concat(eski).slice(0, 3);

    var nihaiKart = null;
    if (Array.isArray(y.kartlar)) {
      for (var i = 0; i < y.kartlar.length; i++) {
        if (y.kartlar[i] && String(y.kartlar[i].baslik || '').indexOf('⚖️ Nihai Karar (Denetçi):') === 0) {
          nihaiKart = y.kartlar[i];
          break;
        }
      }
    }
    if (nihaiKart) {
      nihaiKart.baslik = '⚖️ Nihai Karar (Denetçi): ' + sonuc.son;
      var fkSatiri = sonuc.pe !== null
        ? 'F/K denetimi: ' + fmt(sonuc.pe, 2) + 'x (' + sonuc.durum + ').'
        : 'F/K denetimi: doğrulanabilir oran bulunamadı.';
      nihaiKart.satirlar = [
        'Karar: ' + sonuc.son + ' (F/K denetimi sonrası)',
        sonuc.neden,
        'Teknik kurulun ilk kararı: ' + sonuc.base + '. ' + fkSatiri
      ];
      kartDOMGuncelle(nihaiKart, '⚖️ Nihai Karar (Denetçi):');
    }

    var tartisma = null;
    if (Array.isArray(y.kartlar)) {
      for (var j = 0; j < y.kartlar.length; j++) {
        if (y.kartlar[j] && String(y.kartlar[j].baslik || '').indexOf('💬 Ajanların Tartışması') === 0) {
          tartisma = y.kartlar[j];
          break;
        }
      }
    }
    if (tartisma && Array.isArray(tartisma.satirlar)) {
      tartisma.satirlar.push('🟪 F/K Ajanı: ' + (sonuc.pe !== null
        ? fmt(sonuc.pe, 2) + 'x F/K ile değerleme ' + sonuc.durum + '.'
        : 'F/K verisi doğrulanamadı; teknik kararı bu veriyle değiştirmiyorum.'));
      tartisma.satirlar.push('🟪 Denetçi: ' + sonuc.son + ' kararı F/K değerlendirmesi sonrasında verildi.');
    }

    kararDOMGuncelle(y);
    gecmisiGuncelle(sembol, sonuc, data);
    var grafik = window.GrafikAI;
    if (window.AjanPerformans && grafik && grafik.sonAnaliz && grafik.sonAnaliz.performansId) {
      window.AjanPerformans.guncelleKarar(grafik.sonAnaliz.performansId, sonuc.son, {
        fundamentalStatus: 'available',
        fkPE: sonuc.pe,
        fkValuation: sonuc.durum,
        fkVeto: sonuc.base === 'AL' && sonuc.son === 'BEKLE'
      });
    }
  }

  async function analizEt(sembol, s, y, kal, card, jeton) {
    if (uygulanamaz(sembol, FK.kaynak, FK.tur)) return null;
    try {
      var data = await veriGetir(sembol, FK.sonFiyat);
      if (jeton !== FK.jeton || sembolNorm(FK.sembol) !== sembolNorm(sembol)) return null;

      FK.veri = data;
      FK.hata = null;
      var sonuc = degerlendir(data, s, y, sembol);
      FK.sonuc = sonuc;
      card.satirlar = kartSatirlari(sonuc, data, null, s);
      kartDOMGuncelle(card);
      karariUygula(y, sonuc, sembol, data);
      return sonuc;
    } catch (e) {
      if (jeton !== FK.jeton || sembolNorm(FK.sembol) !== sembolNorm(sembol)) return null;
      FK.hata = e && e.message ? e.message : String(e);
      var base = kararOku(s, y);
      var bos = {
        base: base,
        son: base,
        neden: 'F/K verisi alınamadı; teknik kurulun kararı değişmedi.',
        durum: 'veri yok',
        pe: null,
        bant: bantGetir(sembol)
      };
      FK.sonuc = bos;
      card.satirlar = kartSatirlari(bos, null, FK.hata, s);
      kartDOMGuncelle(card);
      var grafik = window.GrafikAI;
      if (window.AjanPerformans && grafik && grafik.sonAnaliz && grafik.sonAnaliz.performansId) {
        window.AjanPerformans.guncelleKarar(grafik.sonAnaliz.performansId, base, {
          fundamentalStatus: 'unavailable',
          fkVeto: false
        });
      }
      return null;
    }
  }

  function veriKopruKur() {
    if (typeof Veri === 'undefined' || !Veri || typeof Veri.ara !== 'function' || Veri.ara.__fkWrapped) return;
    var eskiAra = Veri.ara;
    var yeniAra = async function () {
      /* Veri.ara BIST/finansal taramalarda da kullanılır. Yalnızca grafik arama
         ekranından başlatılan isteği F/K ajanına bağla; taramalar state'i ezmesin. */
      var yukle = document.getElementById('yukle');
      var grafikAramasi = !!(yukle && yukle.classList.contains('aktif'));
      if (!grafikAramasi) return eskiAra.apply(this, arguments);

      sifirla();
      var jeton = FK.jeton;
      var v = await eskiAra.apply(this, arguments);
      if (jeton !== FK.jeton) return v;

      FK.sembol = sembolNorm(v && v.sembol);
      FK.kaynak = v && v.kaynak || '';
      FK.tur = v && v.tur || '';
      FK.ad = v && v.ad || FK.sembol;
      var mumlar = v && Array.isArray(v.mumlar) ? v.mumlar : [];
      FK.sonFiyat = mumlar.length ? deger(mumlar[mumlar.length - 1].c) : null;
      return v;
    };
    yeniAra.__fkWrapped = true;
    Veri.ara = yeniAra;
  }

  function goruntuKopruKur() {
    if (typeof Goruntu === 'undefined' || !Goruntu || typeof Goruntu.mumlar !== 'function' || Goruntu.mumlar.__fkWrapped) return;
    var eskiMumlar = Goruntu.mumlar;
    var yeniMumlar = function () {
      sifirla();
      return eskiMumlar.apply(this, arguments);
    };
    yeniMumlar.__fkWrapped = true;
    Goruntu.mumlar = yeniMumlar;
  }

  function yorumKopruKur() {
    if (typeof Yorum === 'undefined' || !Yorum || typeof Yorum.olustur !== 'function' || Yorum.olustur.__fkWrapped) return;
    var eskiOlustur = Yorum.olustur;
    var yeniOlustur = function (s, kal, uy) {
      var y = eskiOlustur.call(this, s, kal, uy);
      try {
        if (!y) return y;
        var base = kararOku(s, y);
        y.karar = base;
        y.renk = renkKarar(base);
        if (!Array.isArray(y.kartlar)) y.kartlar = [];

        var sembol = FK.sembol;
        if (!uygulanamaz(sembol, FK.kaynak, FK.tur)) {
          var card = {
            baslik: KART_BASLIK,
            satirlar: ['Ücretsiz Yahoo Finance F/K verisi araştırılıyor…', 'Veri gelmeden AL/SAT kararı değiştirilmez.']
          };
          y.kartlar.push(card);
          var jeton = FK.jeton;
          Promise.resolve().then(function () {
            return analizEt(sembol, s, y, kal, card, jeton);
          }).catch(function () {});
        }
      } catch (e) {
        try {
          if (y && Array.isArray(y.kartlar)) {
            y.kartlar.push({ baslik: 'F/K ajanı', satirlar: ['F/K analizi başlatılamadı: ' + (e.message || e)] });
          }
        } catch (e2) {}
      }
      return y;
    };
    yeniOlustur.__fkWrapped = true;
    Yorum.olustur = yeniOlustur;
  }

  FK.sifirla = sifirla;
  FK.veriGetir = veriGetir;
  FK.degerlendir = degerlendir;
  FK.analizEt = analizEt;
  FK.uygulanamaz = uygulanamaz;
  FK.bantlar = BANT;

  veriKopruKur();
  goruntuKopruKur();
  yorumKopruKur();

  try {
    var ayarlar = document.getElementById('ayarlar');
    if (ayarlar) {
      var bilgi = document.createElement('p');
      bilgi.className = 'kart';
      bilgi.textContent = 'F/K ajanı: yüklendi (ücretsiz değerleme + ajan tartışması + AL/SAT/BEKLE denetimi)';
      ayarlar.appendChild(bilgi);
    }
  } catch (e3) {}
})();