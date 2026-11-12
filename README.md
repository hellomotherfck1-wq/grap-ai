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

**Sonuç** ekranındaki ajan performans paneli, gerçek analiz ve BIST/coin taramalarından gelen sinyalleri tarayıcının IndexedDB alanında 365 gün saklar.

- Ham fiyat mumları depolanmaz; sonuç kontrol edilirken ücretsiz Yahoo Finance / Binance herkese açık geçmiş verisi yeniden çekilir. Geçmiş fiyatlar yalnızca gerçek analiz ve tarama sinyallerinin performansını ölçmek için kullanılır; ayrı bir manuel geçmiş sinyal simülasyonu bulunmaz.
- Aynı sembol, zaman dilimi ve kapanmış mum için tekrar eden sinyaller tek kayıtta birleştirilir.
- Coin taramasında verisi alınan tüm adaylar (tam listede 216 coin); nihai karar, genel/teknik/hacim/Order Flow oyları, piyasa rejimi, MTF ve ilk 20 derin tarama bilgisiyle kaydedilir. Ham mumlar saklanmaz.
- Spot AL işlemi sonraki mum açılışından simüle edilir; varsayılan toplam maliyet %0,20, hedef/stop aynı mumda görülürse stop önceliklidir.
- Spot SAT için short açılmaz. Elde coin olduğu varsayımıyla sonraki mum açılışındaki satış fiyatı, 10 kapanmış mum tutmaya kıyaslanır. Bu fiyat farkı komisyonu, önceki alış maliyetini ve gerçek pozisyon miktarını içermez; gerçek portföy PnL'si değildir.
- Genel analiz, teknik, hacim ve nihai kurulun yön isabeti kaydedilen tüm AL/SAT oyları için 10 kapanmış mum sonraki fiyat yönüyle ölçülür. BEKLE kararları kazanma oranına eklenmez; düşüşten kaçınma / yükseliş kaçırma olarak raporlanır.
- Denetçi ajanının Düşük/Orta/Yüksek risk seviyesi ve bulgu sayısı saklanır; her risk seviyesinden sonra 10 mumdaki düşüş/yükseliş dağılımı ayrı gösterilir. F/K ajanının AL → BEKLE veto kararları da sonraki fiyat hareketiyle karşılaştırılır.
- Tarama kayıtlarında F/K ajanı çalıştırılmadıysa bu eksik açıkça belirtilir. Grafik analizinde F/K sonucu sonradan kararı değiştirirse aynı sinyal kaydı güncellenir.
- Ajan yön isabeti piyasa, zaman dilimi ve her ajanın kendi sürümüne göre ayrı gösterilir. AL/SAT oyları, 10 kapanmış mum sonrası fiyat yönüyle ölçülür; BEKLE oyları ayrı sayılır.
- Aynı sembol/periyotta ileriye dönük 10 mum pencereleri çakışan sinyaller bağımsız örnek sayılmaz. İleri dönem bitiş zamanı eksik eski kayıtlar bağımsız örnek hesabına katılmaz; 30'dan az bağımsız örnek güvenilir başarı oranı sayılmaz.
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
- Zaman aralığı: kriptoda 15 dakika, 1 saat, 4 saat ve günlük; BIST 100'de yalnızca günlük
- Görüntü analizi: mum okuma, isteğe bağlı yüksek/düşük fiyat kalibrasyonu
- Sonuç ve geçmiş: tarayıcının yerel depolaması
- Çevrimdışı: daha önce önbelleğe alınmış uygulama dosyaları

Piyasa verisi sağlayıcıları, internet erişimi ve üçüncü taraf servislerin kullanılabilirliğine bağlıdır. Otomatik teknik analiz yatırım tavsiyesi değildir.


## Kripto Intelligence 2.0 — Faz 1

`js/kripto-ajanlari.js` adds a crypto-only deep-analysis layer without changing the existing BIST council:

- All listed coins are first scanned on the 1-hour timeframe. The top 20 candidates are then checked on 1D, 4H and 15M; the 1H result is reused.
- Order Flow uses Binance Kline quote volume and taker-buy quote volume. It measures executed aggressive flow, not whale identity or hidden orders.
- Kripto taraması yalnızca Binance Spot mum ve hacim verilerini kullanır; kaldıraç, vadeli işlem, fonlama ve açık pozisyon verisi kullanılmaz.
- BTC/ETH trend and the breadth of the scanned coin universe provide a market-regime veto.
- New agents can only downgrade a conflicting or unverified AL/SAT to WAIT. They cannot create an AL/SAT decision or override the existing technical, volume, auditor and risk/reward gates.
- Only the top 20 receive deep confirmation. An actionable signal outside that shortlist is downgraded to WAIT until it is confirmed.
- Spot mum ve Order Flow hesapları otomatik testlerde örnek verilerle doğrulanır; canlı API testleri ayrıca gerçek Spot erişimini kontrol eder.

The Spot-only phase does not use derivatives endpoints, API keys, paid feeds, order-book claims or automatic weight learning. Order Flow, BTC/ETH market regime and closed-candle multi-timeframe confirmation are contextual checks, not standalone trading signals.
