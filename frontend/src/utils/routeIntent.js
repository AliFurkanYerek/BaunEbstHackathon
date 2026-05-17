/** Kullanıcı hastaneye yol / rota istiyor mu? */
export function wantsRouteToHospital(text) {
  const t = (text || '').toLocaleLowerCase('tr-TR');
  if (!/hastane|sağlık\s+ocağı|acil\s+servis|112.*hastane/i.test(t)) return false;
  return (
    /nasıl\s+gide|nasıl\s+ulaş|yol\s+tarifi|rota|yürüyüş\s+yolu|haritada\s+göster|yolu\s+göster|en\s+yakın.*(nasıl|yol|git|gider|ulaş|rota)|buradan.*hastane/i.test(
      t
    ) || /en\s+yakın\s+hastaneye?\s+nasıl/i.test(t)
  );
}

/** Kullanıcı güvenli bölgeye yol / rota istiyor mu? */
export function wantsRouteToSafeZone(text) {
  if (wantsRouteToHospital(text)) return false;
  const t = (text || '').toLocaleLowerCase('tr-TR');
  if (!/güvenli|toplanma|güvenli\s+alan|güvenli\s+bölge/i.test(t)) {
    return (
      /nasıl\s+gide|nasıl\s+ulaş|yol\s+tarifi|rota|yürüyüş\s+yolu|haritada\s+göster|yolu\s+göster|buradan.*(güvenli|toplanma|alan)/i.test(
        t
      )
    );
  }
  return (
    /nasıl\s+gide|nasıl\s+ulaş|yol\s+tarifi|rota|yürüyüş\s+yolu|haritada\s+göster|yolu\s+göster|güvenli\s+(alan|bölge).*(nasıl|yol|git|gider|ulaş)|en\s+yakın.*(nasıl|yol|git|gider|ulaş|rota)|buradan.*(güvenli|toplanma|alan)/i.test(
      t
    ) ||
    /güvenli alana nasıl/i.test(t) ||
    /güvenli\s+(alan|bölge).*(götür|çiz|göster|rota)/i.test(t)
  );
}

/** «Nerede» sorusunda da (konum seçiliyse) rota çizilsin mi? */
export function wantsDrawRouteOnMap(text) {
  return wantsRouteToHospital(text) || wantsRouteToSafeZone(text);
}
