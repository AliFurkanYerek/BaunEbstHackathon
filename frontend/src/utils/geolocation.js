/** Cihaz GPS konumu (tarayıcı / mobil WebView). */
export function getDevicePosition(options = {}) {
  const { timeout = 20000, maximumAge = 0, enableHighAccuracy = true } = options;

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Bu cihaz konum (GPS) desteklemiyor.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        const code = err?.code;
        if (code === 1) {
          reject(new Error('Konum izni verilmedi. Tarayıcı veya uygulama ayarlarından konuma izin verin.'));
        } else if (code === 2) {
          reject(new Error('Konum alınamadı. GPS veya internet bağlantısını kontrol edin.'));
        } else if (code === 3) {
          reject(new Error('Konum isteği zaman aşımına uğradı. Tekrar deneyin.'));
        } else {
          reject(new Error(err?.message || 'Konum alınamadı.'));
        }
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}
