# Hackathon Deprem Projesi — AfetKoordinasyon AI

Deprem sonrası bina bildirimi, risk analizi ve güvenli bölge koordinasyonu — React + Vite.

## Kurulum

```bash
cd frontend
npm install
cp .env.example .env
# .env içine Gemini API anahtarınızı yazın
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

- **Kullanıcı Paneli** — Haritadan konum seç, bina bildir
- **Yetkili Paneli** — Risk tablosu, yardım özeti, güvenli bölge dağılımı

Veriler `localStorage` içinde saklanır.

## AFAD toplanma alanları

Haritadaki mor noktalar [AFAD açık veri](https://github.com/RKursatV/afad-toplanma-alani-acik-veri) kaynağından gelir (şu an deprem bölgesi illeri). Tüm Türkiye için `npm run build:afad` (frontend klasöründe).

## npm paketleri

- react, react-dom
- vite, @vitejs/plugin-react
- tailwindcss, @tailwindcss/vite
- leaflet, react-leaflet, leaflet.markercluster
