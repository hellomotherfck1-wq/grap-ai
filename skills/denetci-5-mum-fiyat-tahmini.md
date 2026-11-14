# Denetçi Ajan Becerisi: 15 Dakikalık Grafikte 5 Mum Sonrası Fiyat Tahmini

## Amaç
Yalnızca 15 dakikalık (15m) grafiklerde, son kapanmış mumun kapanış fiyatından başlayarak beş yeni kapanmış mumun beşincisinin kapanış fiyatını tahmin et. Tahmini ve gerçekleşen fiyatı Sonuçlar bölümünde ayrı bir ölçüm olarak takip et.

## Kesin kapsam
- Aktif zaman dilimi yalnızca `15m` olmalıdır.
- `1h`, `4h` ve `1d` grafiklerde bu beceriyi çalıştırma; tahmin veya tahmin kaydı üretme.
- Yalnızca gerçek piyasa sağlayıcısından alınmış OHLCV mumlarını kullan.
- Açık/devam eden mumu, ekran görüntüsünden çıkarılmış yaklaşık fiyatı, eksik fiyatı veya eski önbelleği kullanma.
- En az 60 geçerli ve kapanmış 15m mum yoksa tahmin üretme. Eksik veri durumunu açıkça bildir.
- Kaynak güncelliği doğrulanamıyorsa veya son kapanmış mum 45 dakikadan eskiyse tahmin üretme.

## Tahmin yöntemi: grafiği teknik olarak okuma
1. Tahmin öncesinde yalnızca gerçek sağlayıcıdan gelen, en az 60 geçerli ve kapanmış 15m OHLCV mumunu kullan.
2. Son 5 mumun gövde yönü, gövde/range oranı, üst-alt fitilleri ve kapanışın mum içindeki konumunu çıkar. Doji, çekiç, kayan yıldız ve yutan mum gibi formasyonları yalnızca kuralları gerçekten karşılanıyorsa etiketle.
3. EMA9 ve EMA21 ile kısa trendi; RSI14 ile momentumu; ATR14 ile oynaklığı hesapla. Son 5 mumun fiyat momentumunu ATR'ye göre normalize et.
4. Son 40 kapanmış mum içindeki gerçek pivot tepe/diplerden en yakın destek ve direnci bul. Bulunamazsa yalnızca geçmiş aralıktaki gerçek yüksek/düşükleri kullan; seviye uydurma.
5. Hacim verisi varsa son 10 mumdaki hacim ağırlıklı alıcı/satıcı baskısını hesapla. Hacim yoksa hacim teyidi varmış gibi davranma.
6. Bu grafik özelliklerini son 10 mumun normalize getiri örüntüsüyle birlikte kullanarak geçmişteki benzer örüntüleri seç. Aday örneğin sonraki 5 mumluk sonucu, bugünkü örüntünün başlangıcından önce tamamen gerçekleşmiş olmalıdır.
7. Birbirine çok yakın/örtüşen örneklerin aynı sonucu tekrar tekrar ağırlıklandırmasını azaltmak için seçilen örnek uçları arasında en az 5 mum bırak.
8. En yakın en fazla 7 geçmiş örneğin sonraki 5 mumluk log-getirilerinin medyanını beklenen hareket olarak kullan. Aynı örneklerin yüzde 20 ve yüzde 80 kantillerini tahmini aralık olarak göster.
9. Tahmini fiyatı son kapanmış mumun gerçek kapanış fiyatına uygula. Grafik okumasını (trend, RSI, son mum formasyonu, 5 mum momentumu, destek/direnç ve varsa hacim baskısı), yöntem sürümünü, kaynak ve veri zamanını, örnek sayısını kaydet.
10. Grafik özellikleri veya geçmiş örnek sayısı yeterli değilse tahmin üretme. Göstergeler bir yönü zorla dayatmasın; grafik özellikleri benzer geçmiş örnekleri seçmeye yardım etsin.

Not: “Grafiği okuma”, grafiği oluşturan doğrulanmış OHLCV mumlarını teknik olarak yorumlamaktır; ekran görüntüsünden yaklaşık fiyat çıkarılmaz. Bu yöntem görsel sezgi veya kesin gelecek bilgisi değildir.

## Sonuç değerlendirmesi
- Tahmin oluşturulurken kayıt `pending` olarak saklanır; tahmin sonradan değiştirilmez.
- Beş yeni kapanmış 15m mum oluştuğunda, beşinci mumun gerçek kapanışını gerçekleşen fiyat olarak kaydet.
- Mutlak fiyat hatasını `abs(tahmin - gerçekleşen) / gerçekleşen × 100` formülüyle hesapla.
- Tahmin yönünü (yukarı/aşağı/yatay) gerçekleşen yönle ayrı kaydet.
- Sonuçlar ekranında tahmin sayısı, tamamlanan/bekleyen kayıtlar, ortalama mutlak fiyat hatası ve her tahminin başlangıç/tahmin/gerçekleşen fiyatlarını göster.
- Bu ölçümü mevcut 10 mumluk AL/SAT performansıyla birleştirme. Ayrı bir beceri ve ayrı bir performans serisi olarak tut.
- Veri sağlayıcısı hata verirse tahmini başarısız diye işaretleme; veri hatası olarak beklet ve yeniden dene.

## Güvenlik ve raporlama
- Bu bir istatistiksel tahmindir; kesinlik, garanti veya yatırım tavsiyesi değildir.
- Model sürümünü kaydet. Örnek sayısı az iken ağırlıkları veya yöntemi otomatik değiştirme.
- Yalnızca kapanmış mumların gerçek fiyatlarıyla değerlendirme yap.
