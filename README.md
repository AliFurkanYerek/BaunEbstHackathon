# Hackathon Deprem Projesi — AfetKoordinasyon AI

Deprem sonrası bina bildirimi, risk analizi ve güvenli bölge koordinasyonu — React + Vite.

## Kurulum

```bash
cd frontend
npm install
cp .env.example .env
# .env içine Gemini API anahtarınızı yazın (chatbot için)

# Terminal 1 — analiz sunucusu (Flask, port 5000)
npm run api
# veya: cd ../inference-api && pip install -r requirements.txt && copy .env.example .env
# inference-api/.env içinde ROBOFLOW_API_KEY doldurun, sonra: python app.py

# Terminal 2 — arayüz (Vite /api isteklerini 5000'e proxy eder)
npm run dev
```

http://localhost:5173

### Gemini Chatbot (Kullanıcı Paneli)

1. [Google AI Studio](https://aistudio.google.com/apikey) üzerinden API anahtarı alın
2. `frontend/.env` dosyası oluşturun:

```
VITE_GEMINI_API_KEY=your_key_here
```

3. Dev sunucusunu yeniden başlatın (`npm run dev`)
4. Kullanıcı panelinde sağ alttaki **💬** butonuna tıklayın

Alternatif: Sohbet penceresindeki **⚙️** ile anahtarı oturum boyunca girebilirsiniz.

## Paneller

- **Kullanıcı Paneli** — Haritadan konum seç, bina bildir; güvenli bölgeye vardığınızda **«Güvenli bölgedeyim»** ile kişi sayısı bildirin (doluluk ve malzeme önerisi yerelde saklanır, yetkili panelinde görülür).
- **Yetkili Paneli** — Risk tablosu, yardım özeti, güvenli bölge doluluğu (yönlendirilen + ulaşan bildirimi), ulaşan kişiye göre önerilen malzeme miktarları, **Roboflow bina hasar analizi**

### Roboflow — yıkık / sağlam bina tespiti (Yetkili Paneli)

API anahtarı **yalnızca backend**'de (`inference-api/.env`). Eski anahtarı [Roboflow ayarlarından](https://app.roboflow.com/settings/api) silip yenileyin.

```bash
# Terminal 1 — analiz sunucusu
cd inference-api
pip install -r requirements.txt
copy .env.example .env
# .env içine ROBOFLOW_API_KEY=yeni_anahtar
python app.py

# Terminal 2 — frontend
cd frontend
npm run dev
```

Yetkili Panel → fotoğraf yükle → **Yıkık bina tespit et** → `POST /api/analyze-image`. Varsayılan olarak iki Universe modeli birleştirilir ([earthquake-damage-detection-xmfgr](https://universe.roboflow.com/roads-aihh0/earthquake-damage-detection-xmfgr), [collapsed-building-detection2-ku0yq](https://universe.roboflow.com/new-workspace-jejih/collapsed-building-detection2-ku0yq)); `inference-api/.env` içinde `ROBOFLOW_MODEL_IDS` ile yapılandırılır.

Veriler `localStorage` içinde saklanır.

## AFAD toplanma alanları

Haritadaki mor noktalar [AFAD açık veri](https://github.com/RKursatV/afad-toplanma-alani-acik-veri) kaynağından gelir (şu an deprem bölgesi illeri). Tüm Türkiye için `npm run build:afad` (frontend klasöründe).

## Mobil (Flutter WebView)

Cross-platform Android / iOS kabuğu: `mobile/` klasörü. Kurulum ve çalıştırma: [mobile/README.md](mobile/README.md).

```powershell
cd mobile
.\setup.ps1
# frontend: npm run dev  |  mobile: flutter run
```

## npm paketleri

- react, react-dom
- vite, @vitejs/plugin-react
- tailwindcss, @tailwindcss/vite
- leaflet, react-leaflet, leaflet.markercluster
