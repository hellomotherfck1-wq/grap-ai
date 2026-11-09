// ====== SUPABASE AYARLARI ======
const SUPABASE_URL = 'https://qkkhguyngmsddnkunyws.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_21uKtVP_-Es7lWeTDefk7Q_r-pb8i0-';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== ZİYARET + ANALİZ KAYDI ======
async function eventKaydet(tip, asset = null) {
  try {
    await supabase.from('events').insert({
      event_type: tip,
      asset_name: asset
    });
  } catch (e) {
    console.warn('Event kaydedilemedi', e);
  }
}

// Sayfa açılınca ziyaret kaydı
eventKaydet('visit');

// Analiz yapıldığında çağıracağız
window.adminAnalizKaydet = function(assetName) {
  eventKaydet('analiz', assetName || null);
};

// ====== ADMIN GİRİŞ / ÇIKIŞ ======
const girisDiv = document.getElementById('admin-giris');
const panelDiv = document.getElementById('admin-panel');
const hataEl = document.getElementById('admin-hata');

async function sessionKontrol() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    girisDiv.hidden = true;
    panelDiv.hidden = false;
    istatistikYukle();
  } else {
    girisDiv.hidden = false;
    panelDiv.hidden = true;
  }
}

document.getElementById('admin-giris-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const sifre = document.getElementById('admin-sifre').value;
  hataEl.textContent = '';

  const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
  if (error) {
    hataEl.textContent = 'Giriş başarısız: ' + error.message;
    return;
  }
  sessionKontrol();
});

document.getElementById('admin-cikis-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionKontrol();
});

// ====== İSTATİSTİKLER ======
async function istatistikYukle() {
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const dun = new Date(bugun);
  dun.setDate(dun.getDate() - 1);
  const yediGun = new Date(bugun);
  yediGun.setDate(yediGun.getDate() - 7);

  const { data: events, error } = await supabase
    .from('events')
    .select('event_type, asset_name, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    document.getElementById('istatistikler').textContent = 'Veri yüklenemedi: ' + error.message;
    return;
  }

  const ziyaret = events.filter(e => e.event_type === 'visit');
  const analiz = events.filter(e => e.event_type === 'analiz');

  const bugunZiyaret = ziyaret.filter(e => new Date(e.created_at) >= bugun).length;
  const dunZiyaret = ziyaret.filter(e => {
    const t = new Date(e.created_at);
    return t >= dun && t < bugun;
  }).length;
  const yediZiyaret = ziyaret.filter(e => new Date(e.created_at) >= yediGun).length;

  const bugunAnaliz = analiz.filter(e => new Date(e.created_at) >= bugun).length;
  const toplamAnaliz = analiz.length;

  document.getElementById('istatistikler').innerHTML = `
    <div>🟢 Bugün ziyaret: <b>${bugunZiyaret}</b></div>
    <div>🟡 Dün ziyaret: <b>${dunZiyaret}</b></div>
    <div>🔵 Son 7 gün ziyaret: <b>${yediZiyaret}</b></div>
    <hr style="border:0;border-top:1px solid #2a333d;margin:12px 0">
    <div>📊 Bugün analiz: <b>${bugunAnaliz}</b></div>
    <div>📈 Toplam analiz: <b>${toplamAnaliz}</b></div>
  `;

  // Son analizler
  const sonlar = analiz.slice(0, 20);
  if (sonlar.length === 0) {
    document.getElementById('son-analizler').textContent = 'Henüz analiz yok.';
  } else {
    document.getElementById('son-analizler').innerHTML = sonlar.map(e => {
      const tarih = new Date(e.created_at).toLocaleString('tr-TR');
      const ad = e.asset_name || 'Ekran görüntüsü';
      return `<div style="padding:6px 0;border-bottom:1px solid #2a333d">${tarih} — <b>${ad}</b></div>`;
    }).join('');
  }
}

// Sayfa yüklenince session kontrol
sessionKontrol();
