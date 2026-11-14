# Denetçi Ajan Becerisi: 15 Dakikalık Grafikte 5 Mum Sonrası Fiyat Tahmini

## Amaç
Yalnızca 15 dakikalık (15m) grafiklerde, son kapanmış mumun kapanış fiyatından başlayarak beş yeni kapanmış mumun beşincisinin kapanış fiyatını tahmin et. Tahmini ve gerçekleşen fiyatı Sonuçlar bölümünde ayrı bir ölçüm olarak takip et.

## Kesin kapsam
- Aktif zaman dilimi yalnızca \`15m\` olmalıdır.
- \`1h\`, \`4h\` ve \`1d\` grafiklerde bu beceriyi çalıştırma; tahmin veya tahmin kaydı üretme.
- Yalnızca gerçek piyasa sağlayıcısından alınmış OHLCV mumlarını kullan.
- Açık/devam eden mumu, ekran görüntüsünden çıkarılmış yaklaşık fiyatı, eksik fiyatı veya eski önbelleği kullanma.
- En az 60 geçerli ve kapanmış 15m mum yoksa tahmin üretme. Eksik veri durumunu açıkça bildir.
- Kaynak güncelliği doğrulanamıyorsa veya son kapanmış mum 45 dakikadan eskiyse tahmin üretme.

## Tahmin yöntemi
1. Son 10 kapanmış mumun log-getiri dizisini çıkar.
2. Geçmişteki 10 mumluk örüntülerle karşılaştır. Her tarihsel örüntünün sonraki 5 mumluk fiyat sonucu, tahmin anından önce tamamen gerçekleşmiş olmalıdır.
3. Örüntü benzerliğinde normalize edilmiş fiyat getirilerini; veri varsa hacim baskısını da yardımcı özellik olarak kullan.
4. Birbirine çok yakın/örtüşen örneklerin aynı sonucu tekrar tekrar ağırlıklandırmasını azaltmak için seçilen örnek uçları arasında en az 5 mum bırak.
5. En yakın en fazla 7 geçmiş örneğin sonraki 5 mumluk log-getirilerinin medyanını beklenen hareket olarak kullan. Aynı örneklerin yüzde 20 ve yüzde 80 kantillerini tahmini aralık olarak göster.
6. Tahmini fiyatı son kapanmış mumun gerçek kapanış fiyatına uygula. Başlangıç fiyatı, hedef fiyat, tahmini aralık, kaynak, veri zamanı, model sürümü ve kullanılan geçmiş örnek sayısını kaydet.
7. Geçmiş örüntü sayısı veya veri kalitesi yeterli değilse sayı uydurma; tahmin oluşturma.

## Sonuç değerlendirmesi
- Tahmin oluşturulurken kayıt \`pending\` olarak saklanır; tahmin sonradan değiştirilmez.
- Beş yeni kapanmış 15m mum oluştuğunda, beşinci mumun gerçek kapanışını gerçekleşen fiyat olarak kaydet.
- Mutlak fiyat hatasını \`abs(tahmin - gerçekleşen) / gerçekleşen × 100\` formülüyle hesapla.
- Tahmin yönünü (yukarı/aşağı/yatay) gerçekleşen yönle ayrı kaydet.
- Sonuçlar ekranında tahmin sayısı, tamamlanan/bekleyen kayıtlar, ortalama mutlak fiyat hatası ve her tahminin başlangıç/tahmin/gerçekleşen fiyatlarını göster.
- Bu ölçümü mevcut 10 mumluk AL/SAT performansıyla birleştirme. Ayrı bir beceri ve ayrı bir performans serisi olarak tut.
- Veri sağlayıcısı hata verirse tahmini başarısız diye işaretleme; veri hatası olarak beklet ve yeniden dene.

## Güvenlik ve raporlama
- Bu bir istatistiksel tahmindir; kesinlik, garanti veya yatırım tavsiyesi değildir.
- Model sürümünü kaydet. Örnek sayısı az iken ağırlıkları veya yöntemi otomatik değiştirme.
- Yalnızca kapanmış mumların gerçek fiyatlarıyla değerlendirme yap.
