/* ajan-fk.js — Teknik Ajan'a F/K hesabı + ajanların F/K tartışması + F/K dahil nihai karar
   Yükleme sırası: ajan.js ve ajan2.js'den SONRA, arayuz.js'den ÖNCE. */
(function () {
  'use strict';
  if (typeof Ajan === 'undefined' || !Ajan) return;

  var VEKIL = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';

  /* F/K bantları: VARSAYIMDIR, ihtiyaca göre değiştir.
     BIST (.IS) için enflasyonlu ortam nedeniyle farklı bant kullanılır. */
  var BANT = {
    bist:  { ucuz: 6,  makul: 12, yuksek: 20 },
    diger: { ucuz: 12, makul: 22, yuksek: 35 }
  };

  var FK = { sembol: null, veri: null, hata: null, sonFiyat: null, jeton: 0 };
  Ajan.fk = FK;

  function sayiMi(x) { return typeof x === 'number' && isFinite(x); }
  function raw(x) { return (x && typeof x === 'object') ? x.raw : x; }
  function sy(x, d) { return sayiMi(x) ? x.toFixed(d).replace('.', ',') : '?'; }
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function sifirla() {
    FK.jeton++;
    FK.sembol = null; FK.veri = null; FK.hata = null; FK.sonFiyat = null;
  }

  function uygulanamaz(sembol) {
    return /(-USD|-USDT|-EUR|=X|=F)$/i.test(sembol) || sembol.charAt(0) === '^';
  }

  /* ---------- Temel veriyi çek (hiçbir zaman reddetmez) ---------- */