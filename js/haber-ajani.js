(function () {
  'use strict';

  var PROXY = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';
  var ALL_ORIGINS = 'https://api.allorigins.win/raw?url=';
  var KAP = 'https://www.kap.org.tr';
  var YAHOO = 'https://query1.finance.yahoo.com';
  var MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  function norm(value) {
    return String(value || '').toLocaleLowerCase('tr-TR')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i').replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function dateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
      var number = Number(value);
      var numericDate = new Date(number < 1000000000000 ? number * 1000 : number);
      return isNaN(numericDate.getTime()) ? null : numericDate;
    }
    var raw = String(value).trim();
    var local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (local) {
      var parsedLocal = new Date(
        Number(local[3]), Number(local[2]) - 1, Number(local[1]),
        Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0)
      );
      return isNaN(parsedLocal.getTime()) ? null : parsedLocal;
    }
    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function textOnly(value) {
    if (!value) return '';
    try {
      var doc = new DOMParser().parseFromString(String(value), 'text/html');
      return String(doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  async function getText(url) {
    var routes = [PROXY + encodeURIComponent(url), ALL_ORIGINS + encodeURIComponent(url)];
    var lastError;
    for (var i = 0; i < routes.length; i++) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 16000);
      try {
        var response = await fetch(routes[i], { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.text();
      } catch (error) {
        lastError = error && error.name === 'AbortError' ? new Error('Kaynak zaman aşımına uğradı') : error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error('Haber kaynağına erişilemedi');
  }

  async function getJson(url) {
    var routes = [PROXY + encodeURIComponent(url), ALL_ORIGINS + encodeURIComponent(url)];
    var lastError;
    for (var i = 0; i < routes.length; i++) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 16000);
      try {
        var response = await fetch(routes[i], { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
      } catch (error) {
        lastError = error && error.name === 'AbortError' ? new Error('Kaynak zaman aşımına uğradı') : error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error('Haber kaynağına erişilemedi');
  }

  function codeOf(asset) {
    return String(asset && (asset.sembol || asset.symbol) || '')
      .toUpperCase().replace(/\.IS$/, '').trim();
  }

  function normalizeItem(item, source) {
    if (!item) return null;
    var title = String(item.title || item.subject || 'Başlıksız bildirim').trim();
    var link = String(item.link || item.url || '');
    if (!/^https?:\/\//i.test(link)) return null;
    return {
      title: title,
      summary: textOnly(item.summary || item.description || ''),
      source: String(item.source || item.publisher || source || 'Kaynak belirtilmedi'),
      link: link,
      date: dateValue(item.date || item.pubDate || item.providerPublishTime || item.publishDate),
      origin: source || 'Haber'
    };
  }

  function isRecent(item) {
    if (!item.date) return true;
    var age = Date.now() - item.date.getTime();
    return age >= -24 * 60 * 60 * 1000 && age <= MAX_AGE;
  }

  async function yahooNews(asset) {
    if (window.BistArastirma && typeof window.BistArastirma.haberGetir === 'function') {
      return await window.BistArastirma.haberGetir(asset.sembol || asset.symbol || '');
    }
    var symbol = asset.sembol || asset.symbol || '';
    var json = await getJson(YAHOO + '/v1/finance/search?q=' + encodeURIComponent(symbol) + '&quotesCount=0&newsCount=8');
    return (Array.isArray(json && json.news) ? json.news : []).map(function (item) {
      return {
        title: item.title,
        publisher: item.publisher || item.provider,
        link: item.link || item.url,
        providerPublishTime: item.providerPublishTime
      };
    });
  }

  async function googleNews(asset) {
    var code = codeOf(asset);
    var name = String(asset && (asset.ad || asset.name) || code).trim();
    var query = '"' + code + '" OR "' + name + '" when:7d';
    var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) +
      '&hl=tr&gl=TR&ceid=TR%3Atr';
    var xml = await getText(url);
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Google News RSS biçimi okunamadı');
    return Array.from(doc.getElementsByTagName('item')).slice(0, 12).map(function (item) {
      function value(tag) {
        var node = item.getElementsByTagName(tag)[0];
        return node ? node.textContent : '';
      }
      return {
        title: value('title'),
        link: value('link'),
        date: value('pubDate'),
        source: value('source') || 'Google News',
        summary: value('description')
      };
    });
  }

  function kapRowsFromResponse(value) {
    var rows = Array.isArray(value) ? value : (value ? [value] : []);
    return rows.map(function (item) {
      var d = item && item.disclosureBasic ? item.disclosureBasic : item;
      if (!d) return null;
      var index = d.disclosureIndex || d.index;
      if (!index) return null;
      return {
        title: d.title || d.subject || d.summary || 'KAP bildirimi',
        summary: d.summary || d.subject || '',
        link: KAP + '/tr/Bildirim/' + encodeURIComponent(index),
        date: d.publishDate || d.date || '',
        source: 'Kamuyu Aydınlatma Platformu (KAP)'
      };
    }).filter(Boolean);
  }

  async function kapNews(asset, providedKap) {
    if (providedKap) {
      return []
        .concat(kapRowsFromResponse(providedKap.disclosures))
        .concat(kapRowsFromResponse(providedKap.financialReports));
    }
    var code = codeOf(asset);
    if (!code) return [];
    var member = await getJson(KAP + '/tr/api/member/filter/' + encodeURIComponent(code));
    if (Array.isArray(member)) member = member[0];
    var oid = member && (member.mkkMemberOid || member.companyId);
    if (!oid) throw new Error('KAP şirket kaydı bulunamadı');
    var responses = await Promise.allSettled([
      getJson(KAP + '/tr/api/company-detail/disclosures/ODA/' + encodeURIComponent(oid)),
      getJson(KAP + '/tr/api/company-detail/disclosures/FR/' + encodeURIComponent(oid))
    ]);
    var rows = [];
    responses.forEach(function (result) {
      if (result.status === 'fulfilled') rows = rows.concat(kapRowsFromResponse(result.value));
    });
    if (!rows.length && responses.every(function (result) { return result.status === 'rejected'; })) {
      throw new Error('KAP bildirim listeleri alınamadı');
    }
    return rows;
  }

  var POSITIVE = [
    'kar artisi', 'karini artirdi', 'kar rekoru', 'rekor kar', 'rekor gelir',
    'gelir artisi', 'ciro artisi', 'satislarini artirdi', 'yeni sozlesme',
    'sozlesme imzaladi', 'yeni anlasma', 'anlasma imzaladi', 'ihale kazandi',
    'ihale aldi', 'siparis aldi', 'yeni siparis', 'temettu', 'kar payi',
    'geri alim', 'ihracat artisi', 'kapasite artisi', 'uretim artisi',
    'lisans aldi', 'tesvik aldi', 'onaylandi', 'buyume kaydetti'
  ];
  var NEGATIVE = [
    'zarar acikladi', 'zarar', 'kar dususu', 'kar geriledi', 'gelir dususu',
    'ciro dususu', 'satislar geriledi', 'ceza', 'sorusturma', 'dava acildi',
    'iflas', 'konkordato', 'temerrut', 'borc krizi', 'uretim durdu',
    'faaliyet durduruldu', 'sozlesme feshi', 'ihale iptal', 'iptal edildi',
    'not indirimi', 'nakit sikintisi', 'yatirim iptal', 'faaliyet izni iptal',
    'sermaye kaybi', 'kayip acikladi'
  ];

  function classify(item) {
    var haystack = norm(item.title + ' ' + item.summary);
    var positive = POSITIVE.filter(function (word) { return haystack.indexOf(word) >= 0; });
    var negative = NEGATIVE.filter(function (word) { return haystack.indexOf(word) >= 0; });
    var impact = positive.length && negative.length ? 'Karışık' :
      positive.length ? 'Olumlu' : negative.length ? 'Olumsuz' : 'Nötr / Belirsiz';
    return { impact: impact, positiveHits: positive, negativeHits: negative };
  }

  function mergeNews(groups) {
    var seen = {};
    var rows = [];
    groups.forEach(function (group) {
      (group.items || []).forEach(function (raw) {
        var item = normalizeItem(raw, group.source);
        if (!item || !item.title || !isRecent(item)) return;
        var key = norm(item.title);
        if (!key || seen[key]) return;
        seen[key] = true;
        var score = classify(item);
        item.impact = score.impact;
        item.positiveHits = score.positiveHits;
        item.negativeHits = score.negativeHits;
        rows.push(item);
      });
    });
    rows.sort(function (a, b) {
      var at = a.date ? a.date.getTime() : 0;
      var bt = b.date ? b.date.getTime() : 0;
      return bt - at;
    });
    return rows.slice(0, 8);
  }

  function summarize(rows) {
    var counts = { positive: 0, negative: 0, mixed: 0, neutral: 0 };
    rows.forEach(function (item) {
      if (item.impact === 'Olumlu') counts.positive++;
      else if (item.impact === 'Olumsuz') counts.negative++;
      else if (item.impact === 'Karışık') counts.mixed++;
      else counts.neutral++;
    });
    var summary;
    if (!rows.length) {
      summary = 'Son 7 günde doğrulanabilir haber başlığı bulunamadı. Haber bulunamaması olumlu sinyal anlamına gelmez.';
    } else if (counts.positive > counts.negative && counts.positive > counts.mixed) {
      summary = 'Bulunan başlıklarda olumlu gelişme ifadeleri daha fazla. Bu, tek başına fiyatın yükseleceği anlamına gelmez.';
    } else if (counts.negative > counts.positive && counts.negative > counts.mixed) {
      summary = 'Bulunan başlıklarda risk ve olumsuz gelişme ifadeleri daha fazla. Şirket açıklamalarının ayrıntısı ayrıca okunmalı.';
    } else if (counts.mixed || (counts.positive && counts.negative)) {
      summary = 'Haber akışı karışık. Olumlu ve olumsuz başlıklar birlikte bulundu; net yön çıkarmıyorum.';
    } else {
      summary = 'Haber başlıklarında belirgin olumlu veya olumsuz bir yön bulunmadı.';
    }
    return { counts: counts, summary: summary };
  }

  async function analizEt(asset, options) {
    options = options || {};
    if (!asset || !/\.IS$/i.test(String(asset.sembol || asset.symbol || ''))) {
      throw new Error('Haber Ajanı yalnızca BIST hisselerinde çalışır.');
    }
    var tasks = await Promise.allSettled([
      Array.isArray(options.yahoo) ? Promise.resolve(options.yahoo) : yahooNews(asset),
      Array.isArray(options.google) ? Promise.resolve(options.google) : googleNews(asset),
      options.kap ? Promise.resolve(kapNews(asset, options.kap)) : kapNews(asset)
    ]);
    var names = ['Yahoo Finance', 'Google News', 'KAP'];
    var groups = [];
    var errors = [];
    tasks.forEach(function (task, index) {
      if (task.status === 'fulfilled') groups.push({ source: names[index], items: task.value });
      else errors.push(names[index] + ': ' + (task.reason && task.reason.message ? task.reason.message : String(task.reason)));
    });
    var rows = mergeNews(groups);
    var result = summarize(rows);
    return {
      name: asset.ad || asset.name || codeOf(asset),
      symbol: String(asset.sembol || asset.symbol),
      generatedAt: new Date(),
      windowDays: 7,
      items: rows,
      counts: result.counts,
      summary: result.summary,
      errors: errors,
      sources: ['KAP kamuya açık bildirimleri', 'Google News RSS', 'Yahoo Finance haber araması']
    };
  }

  function el(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function render(report, container) {
    if (!container || !report) return;
    container.replaceChildren();
    container.classList.add('haber-ajani');
    container.appendChild(el('h3', 'haber-ajani-baslik', '📰 Haber Ajanı · ' + report.name + ' (' + report.symbol + ')'));
    container.appendChild(el('p', 'haber-ajani-meta',
      'Son ' + report.windowDays + ' gün · ' + report.items.length + ' başlık · Olumlu ' +
      report.counts.positive + ' · Olumsuz ' + report.counts.negative + ' · Karışık ' +
      report.counts.mixed + ' · Nötr/belirsiz ' + report.counts.neutral));
    container.appendChild(el('p', 'haber-ajani-ozet', report.summary));

    if (!report.items.length) {
      container.appendChild(el('p', 'alt', 'Kaynaklar yanıt vermediyse aşağıdaki uyarılara bak. Yeni haber bulunmaması, şirket için risk olmadığı anlamına gelmez.'));
    }

    report.items.forEach(function (item) {
      var row = el('div', 'haber-ajani-satir');
      var link = el('a', 'haber-ajani-link', item.title);
      link.href = item.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.appendChild(link);
      var tagClass = item.impact === 'Olumlu' ? 'haber-etiket haber-olumlu' :
        item.impact === 'Olumsuz' ? 'haber-etiket haber-olumsuz' :
        item.impact === 'Karışık' ? 'haber-etiket haber-karisik' : 'haber-etiket haber-notr';
      row.appendChild(el('span', tagClass, item.impact));
      row.appendChild(el('small', 'haber-ajani-kaynak',
        item.source + ' · ' + (item.date ? item.date.toLocaleString('tr-TR') : 'Tarih belirtilmedi')));
      if (item.summary) row.appendChild(el('p', 'haber-ajani-aciklama', item.summary));
      container.appendChild(row);
    });

    if (report.errors.length) {
      container.appendChild(el('p', 'haber-ajani-uyari', 'Yanıt vermeyen kaynaklar: ' + report.errors.join(' · ')));
    }
    container.appendChild(el('p', 'haber-ajani-not',
      'Yorum; haber başlığı ve varsa kısa açıklama üzerindeki anahtar kelimelere dayanır. Haberlerin tam metni ve şirketin resmî açıklaması açılarak doğrulanmalıdır. Haber Ajanı AL/SAT kararını tek başına değiştirmez.'));
    return container;
  }

  window.HaberAjani = {
    analizEt: analizEt,
    render: render,
    normalize: norm,
    siniflandir: classify
  };
})();
