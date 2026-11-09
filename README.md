# Graph AI

Graph AI, GitHub Pages üzerinde çalışan statik bir piyasa analiz uygulamasıdır. Projede derleme adımı yoktur; `index.html` doğrudan yüklenir.

## Uygulama modülleri

- `js/veri.js` ve `js/liste.js`: varlık eşleştirme ve piyasa verisi
- `js/goruntu.js`: grafik görüntüsünden mum okuma
- `js/analiz.js`, `js/formasyon.js`, `js/formasyon2.js`: teknik analiz ve formasyonlar
- `js/cizim.js`: analiz grafiğini canvas üzerinde çizme
- `js/ajan.js`, `js/ajan2.js`: hacim, teknik ve denetçi değerlendirmeleri
- `js/tahmin.js`, `js/coin-tahmin.js`: BIST ve kripto tarama ekranları
- `js/admin.js`: Supabase oturumu, yönetici yetkisi ve olay istatistikleri

## Yayınlama

1. Değişiklikleri GitHub deposunun `main` dalına gönder.
2. GitHub Pages ayarında kaynak olarak `main` dalı ve kök klasör (`/`) seçili olmalı.
3. Yayın tamamlandıktan sonra sayfayı önbelleksiz yenile (Windows: `Ctrl + Shift + R`).
4. Uygulama önbelleği `sw.js` üzerinden yönetilir. Yeni sürümlerde `SURUM` değerini artır.

## BIST 100 Araştırma Ajanı

`js/bist-arastirma.js` teknik araştırmayı, `js/finansal-panel.js` ise ücretsiz temel araştırma panelini sağlar.

- BIST taraması: uygulamadaki 100 sembollük liste üzerinden günlük veya saatlik teknik tarama.
- Tarama tablosu: son fiyat, son mum değişimi, son hacim, 20 mum ortalama hacmi, hacim oranı, RSI, ortak karar ve skor.
- Ücretsiz fiyat/hacim: Yahoo Finance herkese açık chart uçları; uygulamanın mevcut proxy'si üzerinden alınır. Gecikme, erişim kesintisi ve kullanım kısıtları olabilir.
- Teknik göstergeler: RSI(14), EMA(20/50/100/200), 20/60 günlük getiri, son hacim/20 günlük ortalama hacim ve trend yönü tarayıcıda hesaplanır.
- Temel oranlar ve haberler: Yahoo Finance'ın herkese açık quoteSummary ve search uçlarından erişilebilen alanlar kullanılır. Bu uçlar resmî/garantili API değildir ve her BIST hissesi için veri sunmayabilir.
- KAP: şirket kodu ve şirket kimliği, kamuya açık KAP sayfalarından; finansal rapor ve özel durum bildirim listeleri KAP'ın herkese açık sayfalarından alınır. KAP'ın ücretli kurumsal veri dağıtım hizmeti kullanılmaz.
- Ajan paylaşımı: son araştırma `window.TahminAI.temelAnaliz`, `window.TahminAI.arastirmaBaglami`, `window.Ajan.temelAnaliz` ve `window.GrafikAI.temelAnaliz` alanlarına verilir.
- Değerleme: ücretsiz kaynaktan F/K, PD/DD veya EPS gelmiyorsa sayı uydurulmaz; adil değer hesaplanmış gibi gösterilmez.

**Veri ve güven sınırları:** BIST 100 üyeliği zamanla değişir; sembol listesi güncel tutulmalıdır. Ücretsiz fiyat ve haber uçları gecikmeli, eksik veya geçici olarak erişilemez olabilir. KAP bildirim listesi şirketin finansal tablosunun tamamını tarayıcıya indirmez; rapor bağlantıları kullanıcıyı KAP'a götürür. Veri gelmediğinde ilgili alan boş/uyarı olarak gösterilir. Otomatik çıktılar yatırım tavsiyesi değildir. Ücretli API anahtarı veya kullanıcı aboneliği gerekmez.

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

## Kontrol listesi

- Varlık araması: `BTCUSDT`, `Bitcoin`, `PGSUS.IS`, `Pegasus`
- Zaman aralığı: 15 dakika, 1 saat ve günlük
- Görüntü analizi: mum okuma, isteğe bağlı yüksek/düşük fiyat kalibrasyonu
- Sonuç ve geçmiş: tarayıcının yerel depolaması
- Çevrimdışı: daha önce önbelleğe alınmış uygulama dosyaları

Piyasa verisi sağlayıcıları, internet erişimi ve üçüncü taraf servislerin kullanılabilirliğine bağlıdır. Otomatik teknik analiz yatırım tavsiyesi değildir.
