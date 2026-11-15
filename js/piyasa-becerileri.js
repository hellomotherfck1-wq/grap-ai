(function (root) {
  'use strict';
  var VERSION = 'market-skills-1.0.0';
  function num(x) { if (x === null || x === undefined || x === '') return null; var n = Number(x); return isFinite(n) ? n : null; }
  function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x,y) { return x-y; }); var m=Math.floor(b.length/2); return b.length%2?b[m]:(b[m-1]+b[m])/2; }
  function ema(a, p) { if (a.length < p) return null; var out=[], k=2/(p+1), v=avg(a.slice(0,p)); for(var i=0;i<p-1;i++) out.push(null); out.push(v); for(i=p;i<a.length;i++){v=a[i]*k+v*(1-k);out.push(v);} return out; }
  function rsi(a,p) { if(a.length<p+1)return null;var g=0,l=0,i;for(i=1;i<=p;i++){var d=a[i]-a[i-1];if(d>0)g+=d;else l-=d;}g/=p;l/=p;for(i=p+1;i<a.length;i++){d=a[i]-a[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;}return l===0?100:g===0?0:100*g/(g+l);}
  function tr(b,i){return Math.max(b[i].h-b[i].l,Math.abs(b[i].h-b[i-1].c),Math.abs(b[i].l-b[i-1].c));}
  function atr(b,p){if(b.length<p+1)return null;var a=[];for(var i=1;i<b.length;i++)a.push(tr(b,i));return avg(a.slice(-p));}
  function adx(b,p){if(b.length<p*2+1)return null;var trSum=0,plusSum=0,minusSum=0,dx=[];for(var i=1;i<=p;i++){var up=b[i].h-b[i-1].h,down=b[i-1].l-b[i].l;trSum+=tr(b,i);plusSum+=up>down&&up>0?up:0;minusSum+=down>up&&down>0?down:0;}function dxValue(){var pdi=trSum?100*plusSum/trSum:0,mdi=trSum?100*minusSum/trSum:0;return pdi+mdi?100*Math.abs(pdi-mdi)/(pdi+mdi):0;}dx.push(dxValue());for(i=p+1;i<b.length;i++){up=b[i].h-b[i-1].h;down=b[i-1].l-b[i].l;trSum=trSum-trSum/p+tr(b,i);plusSum=plusSum-plusSum/p+(up>down&&up>0?up:0);minusSum=minusSum-minusSum/p+(down>up&&down>0?down:0);dx.push(dxValue());}if(dx.length<p)return null;var value=avg(dx.slice(0,p));for(i=p;i<dx.length;i++)value=(value*(p-1)+dx[i])/p;return value;}
  function normalize(input) { return (Array.isArray(input)?input:[]).map(function(x){if(!x)return null;var o=num(x.o),h=num(x.h),l=num(x.l),c=num(x.c);if(o===null||h===null||l===null||c===null||h<l||c<=0)return null;return {o:o,h:h,l:l,c:c,v:num(x.v!=null?x.v:x.volume),t:num(x.t!=null?x.t:x.openTime),quoteVolume:num(x.quoteVolume),takerBuyQuoteVolume:num(x.takerBuyQuoteVolume)};}).filter(Boolean); }
  function oku(input, options) {
    options=options||{};var b=normalize(input),n=b.length;
    var R={version:VERSION,mode:'shadow',market:options.market||'Genel',timeframe:options.timeframe||null,candleCount:n,quality:'yetersiz',warnings:[],indicators:{},structure:{},volume:{},signals:[],score:{direction:'nötr',value:0,confidence:'düşük'},decisionImpact:'none'};
    if(n<20){R.warnings.push('En az 20 geçerli kapanmış mum gerekli.');return R;}
    var cl=b.map(function(x){return x.c;}),last=b[n-1],e9=ema(cl,9),e20=ema(cl,20),e50=ema(cl,50),e200=ema(cl,200);
    var r=rsi(cl,14),a=atr(b,14),adxV=adx(b,14),m12=ema(cl,12),m26=ema(cl,26),macd=null,signal=null;
    if(m12&&m26){var line=[];for(var q=0;q<n;q++)line.push(m12[q]!=null&&m26[q]!=null?m12[q]-m26[q]:null);var valid=line.filter(function(x){return x!==null;});var sig=ema(valid,9);if(sig){macd=valid[valid.length-1];signal=sig[sig.length-1];}}
    var w=cl.slice(-20),mu=avg(w),variance=avg(w.map(function(x){return (x-mu)*(x-mu);})),sd=Math.sqrt(variance||0);
    var upper=mu+2*sd,lower=mu-2*sd,bbp=upper>lower?(last.c-lower)/(upper-lower):null;
    var vols=b.map(function(x){return x.v;}).filter(function(x){return x!==null&&x>0;}),vBase=median(vols.slice(-25,-5)),vRecent=avg(vols.slice(-5)),vRatio=vBase>0&&vRecent!=null?vRecent/vBase:null;
    var upVol=0,downVol=0,obv=0;for(var i=Math.max(1,n-20);i<n;i++){if(b[i].v!==null){if(b[i].c>b[i-1].c){upVol+=b[i].v;obv+=b[i].v;}else if(b[i].c<b[i-1].c){downVol+=b[i].v;obv-=b[i].v;}}}
    var hi=Math.max.apply(null,b.slice(-21,-1).map(function(x){return x.h;})),lo=Math.min.apply(null,b.slice(-21,-1).map(function(x){return x.l;}));
    var breakout=last.c>hi?'yukarı':last.c<lo?'aşağı':'yok';
    var trend=e20&&e50?(last.c>e20[n-1]&&e20[n-1]>e50[n-1]?'yükseliş':last.c<e20[n-1]&&e20[n-1]<e50[n-1]?'düşüş':'karışık'):'belirsiz';
    var ret=cl.length>10?(last.c/cl[n-11]-1)*100:null;
    R.quality='geçerli';
    if(options.closedCandles===false)R.warnings.push('Açık mum bulundu; bu mum analiz dışı bırakılmalı.');
    if(options.fresh===false)R.warnings.push('Kaynak verisi güncel değil; sinyal güveni düşürülmeli.');
    if(n<50)R.warnings.push('50 mumdan az veri: uzun trend teyidi sınırlı.');
    if(n<200)R.warnings.push('200 mumdan az veri: EMA200 hesaplanamadı.');
    if(options.expectedIntervalMs&&n>2){for(i=1;i<b.length;i++)if(b[i].t&&b[i-1].t&&b[i].t-b[i-1].t>options.expectedIntervalMs*1.8){R.warnings.push('Mum zamanlarında veri boşluğu var.');break;}}
    R.indicators={rsi14:r,ema9:e9?e9[n-1]:null,ema20:e20?e20[n-1]:null,ema50:e50?e50[n-1]:null,ema200:e200?e200[n-1]:null,macd:macd,macdSignal:signal,macdHistogram:macd!==null&&signal!==null?macd-signal:null,bollinger:{upper:upper,middle:mu,lower:lower,percentB:bbp},atr14:a,atrPercent:a&&last.c?a/last.c*100:null,adx14:adxV,return10Pct:ret};
    R.structure={trend:trend,breakout:breakout,breakoutLevel:breakout==='yukarı'?hi:breakout==='aşağı'?lo:null,rangeHigh:hi,rangeLow:lo};
    R.volume={available:vols.length>=15,relativeVolume:vRatio,upVolumeShare:upVol+downVol?(upVol/(upVol+downVol)):null,obvNet:obv,binanceAggressiveBuyShare:null};
    if(options.market==='Binance'&&b.slice(-5).every(function(x){return x.quoteVolume!==null&&x.takerBuyQuoteVolume!==null;})){
      var qv=0,buy=0;b.slice(-5).forEach(function(x){qv+=x.quoteVolume;buy+=x.takerBuyQuoteVolume;});R.volume.binanceAggressiveBuyShare=qv?buy/qv:null;
    }
    var trendVote=trend==='yükseliş'?1:trend==='düşüş'?-1:0;
    var momentumVotes=[];
    if(macd!==null&&signal!==null)momentumVotes.push(macd>signal?1:macd<signal?-1:0);
    if(r!==null)momentumVotes.push(r>=55&&r<75?1:r<=45&&r>25?-1:0);
    var momentumAvg=avg(momentumVotes),momentumVote=momentumAvg>=0.5?1:momentumAvg<=-0.5?-1:0;
    var structureVote=breakout!=='yok'&&vRatio!==null&&vRatio>=1.2?(breakout==='yukarı'?1:-1):0;
    var volumeVote=vRatio!==null&&vRatio>=1.3&&upVol+downVol>0?(upVol>downVol?1:-1):0;
    var groups=[trendVote,momentumVote,structureVote,volumeVote];
    var sum=groups.reduce(function(x,y){return x+y;},0),dir=sum>=2?'yükseliş':sum<=-2?'düşüş':'nötr';
    R.score={direction:dir,value:sum,confidence:groups.length>=4&&Math.abs(sum)>=3?'orta':'düşük',independentGroups:groups.filter(function(x){return x!==0;}).length};
    if(adxV!==null)R.signals.push('ADX14 '+adxV.toFixed(1)+' · '+(adxV>=25?'trend güçlü':adxV<18?'trend zayıf':'trend gelişiyor'));
    if(r!==null)R.signals.push('RSI14 '+r.toFixed(1));
    if(R.indicators.atrPercent!==null)R.signals.push('ATR% '+R.indicators.atrPercent.toFixed(2));
    if(vRatio!==null)R.signals.push('Göreli hacim '+vRatio.toFixed(2)+'x');
    R.signals.push('Fiyat yapısı: '+trend+' · 20 mum kırılımı: '+breakout);
    if(R.volume.binanceAggressiveBuyShare!==null)R.signals.push('Binance Spot agresif alım payı: %'+(R.volume.binanceAggressiveBuyShare*100).toFixed(1));
    if(groups.length<3)R.warnings.push('Bağımsız teyit grubu sayısı yetersiz; skor karar için kullanılmıyor.');
    if(options.market==='BIST')R.signals.push('BIST notu: seans dışı son fiyat ve günlük mumun kapanış zamanı ayrıca doğrulanmalı; finansallar KAP dönemiyle eşleştirilmeli.');
    R.decisionImpact='none';
    return R;
  }
  function temelVeriKontrol(f, options) {
    options=options||{};f=f||{};var keys=['revenueGrowth','earningsGrowth','roe','profitMargins','debtToEquity','trailingPE','priceToBook'];
    var available=keys.filter(function(k){return num(f[k])!==null;});
    var period=f.periodEnd||f.asOfDate||null,age=period?Date.now()-Date.parse(period):null;
    var warnings=[];if(!available.length)warnings.push('Temel finansal veri bulunamadı; oran veya değerleme üretilmedi.');
    if(period&&(!isFinite(age)||age>200*86400000))warnings.push('Finansal dönem 200 günden eski; güncellik doğrulanmalı.');
    if(!period)warnings.push('Finansal verinin raporlama dönemi doğrulanamadı.');
    if(f.debtToEquity!=null&&/bank|financial|insurance/i.test(String(f.sector||'')+' '+String(f.industry||'')))warnings.push('Borç/özkaynak oranı finans sektörü için doğrudan sanayi şirketi eşiğiyle yorumlanmamalı.');
    return {version:VERSION,market:'BIST',availableFields:available,missingFields:keys.filter(function(k){return available.indexOf(k)<0;}),periodEnd:period,ageDays:age===null||!isFinite(age)?null:Math.floor(age/86400000),warnings:warnings,mode:'shadow'};
  }
  root.PiyasaBecerileri={version:VERSION,oku:oku,temelVeriKontrol:temelVeriKontrol};
})(typeof window!=='undefined'?window:this);
