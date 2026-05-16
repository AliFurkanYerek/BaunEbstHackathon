# AfetKoordinasyon AI — Mobil (Flutter WebView)

Mevcut React web uygulamasını Android ve iOS’ta **WebView** ile saran cross-platform kabuk.

## Gereksinimler

Bu makinede kurulu:

| Bileşen | Konum |
|---------|--------|
| Flutter 3.41.9 | `%LOCALAPPDATA%\flutter` |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` |
| JDK 21 | `C:\Program Files\Java\jdk-21` |

Yeni terminalde ortam için: `mobile` klasöründe `. .\scripts\env.ps1`

- Android Studio ve/veya Xcode (hedef platforma göre)
- Web sunucusu: `frontend` klasöründe `npm run dev`

**Windows:** Eklenti derlemesi için [Geliştirici Modu](ms-settings:developers) açık olmalı (Ayarlar → Gizlilik ve güvenlik → Geliştirici için → Geliştirici Modu).

## İlk kurulum

```powershell
cd mobile
.\setup.ps1
```

`setup.ps1` platform klasörlerini (`android/`, `ios/`) oluşturur, HTTP ve konum/kamera izinlerini ekler, bağımlılıkları indirir.

## Geliştirme akışı

**1. Web uygulamasını ağdan erişilebilir başlatın** (telefon/emülatör bağlanabilsin):

```powershell
cd frontend
npm install
npm run api    # Terminal 1 — Flask analiz API (port 5000)
npm run dev    # Terminal 2 — Vite (port 5173, 0.0.0.0)
```

**2. Mobil uygulamayı çalıştırın:**

```powershell
cd mobile
flutter run
```

### Varsayılan adresler

| Ortam | URL |
|--------|-----|
| Android emülatör | `http://10.0.2.2:5173` |
| iOS simülatör | `http://127.0.0.1:5173` |
| Fiziksel telefon | Bilgisayarınızın yerel IP’si, örn. `http://192.168.1.10:5173` |

Fiziksel cihazda derleme:

```powershell
flutter run --dart-define=WEB_APP_URL=http://192.168.1.10:5173
```

Uygulama içindeki **dişli (⚙)** ile adresi kaydedebilirsiniz (SharedPreferences).

## Üretim / mağaza

1. Web’i derleyin: `cd frontend && npm run build`
2. `dist/` klasörünü HTTPS ile bir sunucuya deploy edin (veya backend ile birlikte statik servis).
3. Mobil uygulamayı production URL ile derleyin:

```powershell
flutter build apk --dart-define=WEB_APP_URL=https://sizin-domain.com
flutter build ios --dart-define=WEB_APP_URL=https://sizin-domain.com
```

`frontend/.env` içindeki `VITE_INFERENCE_API_URL` ve `VITE_GEMINI_API_KEY` değerleri **web build** sırasında gömülür; mobil kabuk yalnızca bu siteyi gösterir.

## Özellikler

- Tam ekran WebView (harita, paneller, chatbot)
- Konum ve kamera izinleri (harita + fotoğraf analizi)
- Android’de dosya seçici (hasar fotoğrafı yükleme)
- HTTP geliştirme (cleartext) — yalnızca dev; production’da HTTPS kullanın
- Yükleme çubuğu, hata ekranı, yenile ve URL ayarı
