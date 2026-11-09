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

`js/bist-arastirma.js`, mevcut teknik/hacim/denetçi ajanlarıyla birlikte çalışır.

- BIST taraması: uygulamadaki 100 sembollük liste üzerinden günlük veya saatlik teknik tarama.
- Tarama tablosu: son fiyat, son mum değişimi, son hacim, 20 mum ortalama hacmi, hacim oranı, RSI, ortak karar ve skor.
- Grafik bağlantısı: tablodaki Grafik düğmesi seçilen hisseyi teknik analiz ekranında açar.
- Araştırma raporu: Yahoo Finance üzerinden erişilebilen temel oranlar ve haber başlıkları; grafikte kısa vadeli teknik özet ve uzun vadeli temel görünüm.
- Değerleme: pozitif EPS varsa 8x/12x/16x F/K varsayım senaryoları gösterilir. Bunlar sektör medyanı veya kesin içsel değer değildir.
- Kaynaklar: Yahoo Finance, KAP bildirim sorgusu ve Borsa İstanbul veri sayfalarına bağlantılar.

**Veri ve güven sınırları:** BIST 100 üyeliği zamanla değişir; tarama sembol listesi düzenli güncellenmelidir. Yahoo Finance verileri gecikmeli veya eksik olabilir. KAP bağlantısı kullanıcıyı resmî bildirim sorgusuna götürür; bu statik GitHub Pages sürümü KAP'ın MKK API'sine doğrudan bağlanmaz. Resmî KAP/MKK otomatik veri erişimi için MKK API anahtarı ve IP yetkilendirmesi gerekir. Temel veri gelmezse ajan adil değer uydurmaz. Otomatik çıktılar yatırım tavsiyesi değildir.

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
