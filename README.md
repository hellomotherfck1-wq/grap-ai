# Graph AI

Graph AI, GitHub Pages üzerinde çalışan statik bir piyasa analiz uygulamasıdır. Projede derleme adımı yoktur; `index.html` doğrudan yüklenir.

## Uygulama modülleri

- `js/veri.js` ve `js/liste.js`: varlık eşleştirme ve piyasa verisi
- `js/goruntu.js`: grafik görüntüsünden mum okuma
- `js/analiz.js`, `js/formasyon.js`, `js/formasyon2.js`: teknik analiz ve formasyonlar
- `js/cizim.js`: analiz grafiğini canvas üzerinde çizme
- `js/ajan.js`, `js/ajan2.js`: hacim, teknik ve denetçi değerlendirmeleri
- `js/tahmin.js`, `js/coin-tahmin.js`: BIST ve kripto tarama ekranları
- `js/bist-arastirma.js`, `js/finansal-panel.js`: BIST şirket araştırması
- `js/haber-ajani.js`: ücretsiz BIST haber taraması ve başlık temelli özet
- `js/ajan-performans.js`: gerçek analiz ve tarama sinyallerinin performans takibi
- `js/admin.js`: Supabase oturumu, yönetici yetkisi ve olay istatistikleri

## Yayınlama

1. Değişiklikleri GitHub deposunun `main` dalına gönder.
2. GitHub Pages ayarında kaynak olarak `main` dalı ve kök klasör (`/`) seçili olmalı.
3. Yayın tamamlandıktan sonra sayfayı önbelleksiz yenile (Windows: `Ctrl + Shift + R`).
4. Uygulama önbelleği `sw.js` üzerinden yönetilir. Yeni sürümlerde `SURUM` değerini artır.

## BIST 100 Araştırma Ajanı

`js/bist-arastirma.js` teknik araştırmayı, `js/finansal-panel.js` ise ücretsiz temel araştırma panelini sağlar.

- BIST taraması: uygulamadaki 100 sembollük liste üzerinden yalnızca günlük (1D) teknik tarama.
- Tarama tablosu: son fiyat, son mum değişimi, son hacim, 20 mum ortalama hacmi, hacim oranı, RSI, ortak karar ve skor.
- Ücretsiz fiyat/hacim: Yahoo Finance herkese açık chart uçları; uygulamanın mevcut proxy'si üzerinden alınır. Gecikme, erişim kesintisi ve kullanım kısıtları olabilir.
- Teknik göstergeler: RSI(14), EMA(20/50/100/200), 20/60 günlük getiri, son hacim/20 günlük ortalama hacim ve trend yönü tarayıcıda hesaplanır.
- Temel oranlar ve haberler: Yeni ücretsiz finansal panel Yahoo Finance'ın herkese açık haber aramasını kullanır; fiyat/hacim verisinden teknik göstergeleri kendisi hesaplar. QuoteSummary gibi erişimi kısıtlı uçlar yeni panelin çalışması için gerekli değildir.
- KAP: şirket kimliği, finansal rapor bildirimleri ve özel durum açıklamaları KAP'ın herkese açık sayfalarından alınır. Son finansal raporun HTML tablosu tarayıcıda ayrıştırılarak hasılat, dönem kârı, varlıklar, özkaynaklar, likidite ve nakit akışı kalemleri çıkarılır. KAP'ın ücretli kurumsal veri dağıtım hizmeti kullanılmaz.
- Ajan paylaşımı: son araştırma `window.TahminAI.temelAnaliz`, `window.TahminAI.arastirmaBaglami`, `window.Ajan.temelAnaliz` ve `window.GrafikAI.temelAnaliz` alanlarına verilir.
- Değerleme: ücretsiz kaynaktan F/K, PD/DD veya EPS gelmiyorsa sayı uydurulmaz; adil değer hesaplanmış gibi gösterilmez.

**Veri ve güven sınırları:** BIST 100 üyeliği zamanla değişir; sembol listesi güncel tutulmalıdır. Ücretsiz fiyat ve haber uçları gecikmeli, eksik veya geçici olarak erişilemez olabilir. KAP bildirim listesi şirketin finansal tablosunun tamamını tarayıcıya indirmez; rapor bağlantıları kullanıcıyı KAP'a götürür. Veri gelmediğinde ilgili alan boş/uyarı olarak gösterilir. Otomatik çıktılar yatırım tavsiyesi değildir. Ücretli API anahtarı veya kullanıcı aboneliği gerekmez.

## Haber Ajanı

`js/haber-ajani.js`, BIST hissesi analiz edildiğinde son 7 gündeki haber başlıklarını ücretsiz kaynaklardan birleştirir:

- KAP'ın kamuya açık şirket bildirimleri (özel durum açıklamaları ve finansal rapor başlıkları)
- Google News RSS araması
- Yahoo Finance'ın herkese açık haber araması

Ajan haberleri tarih ve kaynak bağlantısıyla gösterir; tekrar eden başlıkları birleştirir ve başlık/kısa açıklama içindeki anahtar kelimelere göre olumlu, olumsuz, karışık veya nötr/belirsiz olarak sınıflandırır. Ücretli haber API'si veya ücretli yapay zekâ servisi kullanmaz. Haberlerin tam metnini okuduğunu iddia etmez; özet başlık ve varsa kısa açıklama temellidir. Haber Ajanı teknik AL/SAT kararını tek başına değiştirmez.

## Ajan performans karnesi

**Sonuçlar** ekranındaki test paneli şu aşamada yalnızca Kripto · 15 dakika kayıtlarını gösterir. Eski kayıtlar ve diğer zaman dilimleri silinmez; CSV dışa aktarımında korunur. Sinyaller IndexedDB'de 365 gün saklanır.

- Ham fiyat mumları depolanmaz; sonuç kontrol edilirken ücretsiz Yahoo Finance / Binance herkese açık geçmiş verisi yeniden çekilir. Geçmiş fiyatlar yalnızca gerçek analiz ve tarama sinyallerinin performansını ölçmek için kullanılır; ayrı bir manuel geçmiş sinyal simülasyonu bulunmaz.
- Aynı sembol, zaman dilimi ve kapanmış mum için tekrar eden sinyaller tek kayıtta birleştirilir.
- Coin taraması 216 coin için 15 dakikalık Binance Spot mumlarını tek seferde kullanır; genel/teknik/hacim/Order Flow kararları ve 5 mumluk Denetçi tahmini aynı mum verisinden üretilir. İlk 20 aday ayrıca 1 saat, 4 saat ve günlük bağlamla doğrulanır. Ham mumlar saklanmaz.
- 15 dakikalık Spot AL işlemi sonraki mum açılışından başlar ve 5 mumluk test ufkuyla ölçülür; varsayılan toplam maliyet %0,20, hedef/stop aynı mumda görülürse stop önceliklidir. Eski kayıtlar kendi saklanan ufuklarıyla değerlendirilir.
- Spot SAT için short açılmaz. Elde coin olduğu varsayımıyla sonraki mum açılışındaki satış fiyatı, 15 dakikalık testte 5 kapanmış mum tutmaya kıyaslanır. Bu fiyat farkı komisyonu, önceki alış maliyetini ve gerçek pozisyon miktarını içermez; gerçek portföy PnL'si değildir.
- Genel analiz, teknik, hacim ve nihai kurulun yön isabeti 15 dakikalık testte sonraki 5 kapanmış mumun fiyat yönüyle ölçülür. BEKLE kararları kazanma oranına eklenmez; düşüşten kaçınma / yükseliş kaçırma olarak raporlanır.
- Denetçi ajanının Düşük/Orta/Yüksek risk seviyesi ve bulgu sayısı saklanır; 15 dakikalık testte her risk seviyesinin ardından 5 mumluk sonuçlar ayrı incelenir. F/K ajanının AL → BEKLE veto kararları da sonraki fiyat hareketiyle karşılaştırılır.
- Tarama kayıtlarında F/K ajanı çalıştırılmadıysa bu eksik açıkça belirtilir. Grafik analizinde F/K sonucu sonradan kararı değiştirirse aynı sinyal kaydı güncellenir.
- Ajan yön isabeti bu aşamada 15 dakikalık kripto kayıtları için gösterilir. AL/SAT oyları, 5 kapanmış mum sonrası fiyat yönüyle ölçülür; BEKLE oyları ayrı sayılır.
- Aynı sembol/periyotta ileriye dönük 5 mum pencereleri çakışan sinyaller bağımsız örnek sayılmaz. İleri dönem bitiş zamanı eksik eski kayıtlar bağımsız örnek hesabına katılmaz; 30'dan az bağımsız örnek güvenilir başarı oranı sayılmaz.
- Spot AL işlem kazanma oranında 30 işlemden önce örneklem yetersiz olarak işaretlenir; Wilson güven aralığı gösterilir.
- Her cihaz kendi sinyallerini IndexedDB'de tutar ve ortak sonuç havuzuyla Supabase'e eşitler; ortak kayıtları yalnızca admin yetkili hesap okuyabilir. Tarayıcı verisi temizlenirse henüz eşitlenmemiş yerel kayıtlar kaybolabilir; CSV dışa aktarımı vardır. 365 günden eski kayıtlar otomatik silinir.
- Ücretsiz Yahoo geçmiş sınırları yaklaşık 15 dakika için 30 gün, 1 saat için 3 ay, günlük için 2 yıldır; Binance geçmişi en fazla 1.000 mumdur. Kayıtlar 365 gün saklansa da sonuçları geciktirmeden güncellemek gerekir; kaynak geçmişi dışına çıkan sonuçlar "veri aralığı dışında" olarak işaretlenir.

## Supabase yönetici paneli

Yönetici istatistikleri için Supabase SQL Editor'de `supabase-setup.sql` dosyasını bir kez çalıştır.

Yönetici olarak giriş yapacak kullanıcının e-posta adresini aşağıdaki sorguda değiştirerek SQL Editor'de çalıştır:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'YONETICI_EPOSTASI';
```

Ardından uygulamadaki Admin ekranından bu hesapla giriş yap. Yetki, kullanıcı tarafından değiştirilebilen `user_metadata` yerine sunucu tarafındaki `app_metadata.role` alanından kontrol edilir.

**Güvenlik:** Tarayıcıya yalnızca Supabase anon/publishable anahtarı konur. `service_role` anahtarını asla HTML veya JavaScript dosyalarına ekleme. İstatistikleri yalnızca admin rolü okuyabilir; olay ekleme politikası ziyaret ve analiz olaylarıyla sınırlıdır.

Admin kontrol merkezinde günlük ziyaret/analiz özeti, son analizler ve elle yenileme düğmesi bulunur. Önceki teknik kararlar, güvenlik notları ve sonraki geliştirme adımları admin oturumu açıldıktan sonra erişilen kapalı **Eski geliştirme notları** bölümünde gruplandırılır.

## Kontrol listesi

- Varlık araması: `BTCUSDT`, `Bitcoin`, `PGSUS.IS`, `Pegasus`
- Zaman aralığı: kripto ana testinde 15 dakika; ilk 20 aday için 1 saat, 4 saat ve günlük bağlam; genel grafik aramasında desteklenen periyotlar; BIST 100'de yalnızca günlük
- Görüntü analizi: mum okuma, isteğe bağlı yüksek/düşük fiyat kalibrasyonu
- Sonuç ve geçmiş: tarayıcının yerel depolaması
- Çevrimdışı: daha önce önbelleğe alınmış uygulama dosyaları

Piyasa verisi sağlayıcıları, internet erişimi ve üçüncü taraf servislerin kullanılabilirliğine bağlıdır. Otomatik teknik analiz yatırım tavsiyesi değildir.


## Kripto Intelligence 2.2 — 15 dakika test aşaması

`js/kripto-ajanlari.js` adds a crypto-only deep-analysis layer without changing the existing BIST council:

- All 216 listed coins are scanned on Binance Spot 15M candles. Agent decisions and the auditor's five-candle price forecast are evaluated after five consecutive closed 15M candles. The top 20 candidates additionally use 1H, 4H and 1D context.
- Order Flow uses Binance Kline quote volume and taker-buy quote volume. It measures executed aggressive flow, not whale identity or hidden orders.
- Kripto taraması yalnızca Binance Spot mum ve hacim verilerini kullanır; kaldıraç, vadeli işlem, fonlama ve açık pozisyon verisi kullanılmaz.
- BTC/ETH trend and 15M market breadth (four-candle movement) provide a market-regime veto.
- New agents can only downgrade a conflicting or unverified AL/SAT to WAIT. They cannot create an AL/SAT decision or override the existing technical, volume, auditor and risk/reward gates.
- Only the top 20 receive deep confirmation. An actionable signal outside that shortlist is downgraded to WAIT until it is confirmed.
- ADX14 trend strength, ATR volatility regime, 20-candle breakout/volume confirmation and relative strength versus BTC are recorded in shadow mode. They do not change decisions until their contribution is measured in out-of-sample tests.
- 15M forecasts are evaluated against Binance Spot candles only; missing or non-contiguous candles are not silently replaced with later candles.
- Spot mum ve Order Flow hesapları otomatik testlerde örnek verilerle doğrulanır; canlı API testleri ayrıca gerçek Spot erişimini kontrol eder.

The Spot-only phase does not use derivatives endpoints, API keys, paid feeds, order-book claims or automatic weight learning. Order Flow, BTC/ETH market regime and closed-candle multi-timeframe confirmation are contextual checks, not standalone trading signals.
