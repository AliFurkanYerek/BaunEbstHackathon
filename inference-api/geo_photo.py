"""EXIF GPS ve GeoSeer Photo Geolocation (https://geoseeer.com/api-docs)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import requests
from PIL import Image
from PIL.ExifTags import GPSTAGS

_GPS_IFD = 0x8825
_ANALYZE_URL = "https://geoseeer.com/api/v1/analyze"


def _rational_to_float(v) -> float:
    if hasattr(v, "numerator"):
        return float(v.numerator) / float(max(v.denominator, 1))
    return float(v)


def gps_from_exif(path: str) -> dict | None:
    try:
        with Image.open(path) as img:
            exif = img.getexif()
        if not exif:
            return None
        gps_ifd = exif.get_ifd(_GPS_IFD)
        if not gps_ifd:
            return None

        gps: dict[str, object] = {}
        for tag_id, value in gps_ifd.items():
            name = GPSTAGS.get(tag_id, tag_id)
            gps[str(name)] = value

        lat = gps.get("GPSLatitude")
        lng = gps.get("GPSLongitude")
        if not lat or not lng:
            return None

        lat_ref_raw = gps.get("GPSLatitudeRef") or "N"
        lng_ref_raw = gps.get("GPSLongitudeRef") or "E"
        lat_ref = (
            lat_ref_raw.decode("ascii", errors="ignore")
            if isinstance(lat_ref_raw, bytes)
            else str(lat_ref_raw)
        ).upper()[0]
        lng_ref = (
            lng_ref_raw.decode("ascii", errors="ignore")
            if isinstance(lng_ref_raw, bytes)
            else str(lng_ref_raw)
        ).upper()[0]

        def to_deg(coords) -> float:
            h, m, s = coords[0], coords[1], coords[2]
            return _rational_to_float(h) + _rational_to_float(m) / 60.0 + _rational_to_float(s) / 3600.0

        lat_d = to_deg(tuple(lat))
        lng_d = to_deg(tuple(lng))
        if lat_ref != "N":
            lat_d = -lat_d
        if lng_ref != "E":
            lng_d = -lng_d

        return {
            "latitude": round(lat_d, 7),
            "longitude": round(lng_d, 7),
            "confidence": 1.0,
            "address": "EXIF GPS",
            "reasoning": "Konum fotoğrafın EXIF GPS metadata kayıtlarından okundu.",
        }
    except Exception:
        return None


def normalize_geoseer_api_key(raw: str | None) -> str:
    if not raw:
        return ""
    s = raw.strip().lstrip("\ufeff")
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()
    return "".join(s.split())


def _mime_for_filename(name: str) -> str:
    low = (name or "").lower()
    if low.endswith(".png"):
        return "image/png"
    if low.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def _prepare_upload(path: str, filename: str) -> tuple[str, bool]:
    max_edge = int(os.getenv("GEOSEER_MAX_IMAGE_EDGE", "2048"))
    max_bytes = int(os.getenv("GEOSEER_MAX_UPLOAD_BYTES", str(9 * 1024 * 1024)))

    try:
        nbytes = os.path.getsize(path)
    except OSError:
        nbytes = 0

    need_resize = nbytes > max_bytes
    if not need_resize:
        try:
            with Image.open(path) as probe:
                if max(probe.size) > max_edge:
                    need_resize = True
        except Exception:
            pass

    if not need_resize:
        return path, False

    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            fd, tmp = tempfile.mkstemp(suffix=".jpg")
            os.close(fd)
            q = 88
            while q >= 55:
                im.save(tmp, format="JPEG", quality=q, optimize=True)
                try:
                    sz = os.path.getsize(tmp)
                except OSError:
                    sz = max_bytes + 1
                if sz <= max_bytes:
                    break
                q -= 6
            return tmp, True
    except Exception:
        pass
    return path, False


def geolocate_via_geoseer(path: str, api_key: str, original_filename: str) -> dict:
    key = normalize_geoseer_api_key(api_key)
    if not key:
        return {"status": "error", "error": "GEOSEER_API_KEY boş"}

    mode = (os.getenv("GEOSEER_ANALYSIS_MODE") or "fast").strip().lower()
    timeout = int(os.getenv("GEOSEER_TIMEOUT", "180"))

    upload_path, is_temp = _prepare_upload(path, original_filename)
    fname = Path(original_filename).name or "photo.jpg"
    mime = "image/jpeg" if is_temp else _mime_for_filename(fname)

    try:
        with open(upload_path, "rb") as f:
            res = requests.post(
                _ANALYZE_URL,
                headers={"X-API-Key": key},
                files={"file": (fname if not is_temp else f"{Path(fname).stem}.jpg", f, mime)},
                data={"analysis_mode": mode},
                timeout=timeout,
            )
    finally:
        if is_temp and upload_path != path:
            try:
                os.unlink(upload_path)
            except OSError:
                pass

    try:
        body = res.json()
    except Exception:
        return {
            "status": "error",
            "error": (res.text or f"HTTP {res.status_code}")[:800],
            "httpStatus": res.status_code,
        }

    if res.status_code == 200 and isinstance(body, dict) and body.get("status") == "success":
        locs = body.get("locations")
        if isinstance(locs, list) and locs:
            out: dict = {"status": "success", "locations": locs}
            for k in ("processing_time", "API_Requests_remaining"):
                if k in body:
                    out[k] = body[k]
            return out

    err_msg = None
    if isinstance(body, dict):
        err_msg = body.get("error") or body.get("message") or body.get("detail")
    if not err_msg:
        err_msg = (res.text[:500] if res.text else None) or f"HTTP {res.status_code}"

    hint = ""
    if res.status_code == 403:
        hint = " Ücretsiz planda yalnızca analysis_mode=fast kullanılabilir."
    elif res.status_code == 401:
        hint = " GEOSEER_API_KEY geçersiz veya iptal edilmiş olabilir."

    return {"status": "error", "error": f"{err_msg}{hint}", "httpStatus": res.status_code}
