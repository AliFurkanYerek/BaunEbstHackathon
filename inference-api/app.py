"""
Roboflow — Earthquake Damage Detection (collapsed) hosted model.
API anahtarı yalnızca sunucu tarafında (.env).
"""
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from inference_sdk import InferenceHTTPClient
from PIL import Image

from detectors import (
    DATASET_URL,
    DEFAULT_MODEL_ID,
    dataset_url_for_model_id,
    extract_workflow_predictions,
    merge_predictions_nms,
    parse_classes,
    run_hosted_model,
)
from geo_photo import geolocate_via_geoseer, gps_from_exif, normalize_geoseer_api_key

_API_DIR = Path(__file__).resolve().parent
# npm run api proje kökünden çalışsa bile inference-api/.env okunsun
load_dotenv(_API_DIR / ".env", override=True)

app = Flask(__name__)
CORS(app)


def _env_int(key: str, default: int) -> int:
    try:
        return int(str(os.getenv(key) or default).strip())
    except (TypeError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    try:
        v = float(str(os.getenv(key) or default).strip())
        if v != v or abs(v) == float("inf"):
            return default
        return v
    except (TypeError, ValueError):
        return default


API_KEY = (os.getenv("ROBOFLOW_API_KEY") or "").strip()
API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", DEFAULT_MODEL_ID)
CONFIDENCE = _env_int("ROBOFLOW_CONFIDENCE", 30)
MERGE_IOU = _env_float("ROBOFLOW_MERGE_IOU", 0.42)
CLASS_LIST = parse_classes(os.getenv("ROBOFLOW_CLASSES", "collapsed"))
USE_WORKFLOW = os.getenv("ROBOFLOW_USE_WORKFLOW", "").lower() in ("1", "true", "yes")
WORKSPACE = os.getenv("ROBOFLOW_WORKSPACE_NAME", "")
WORKFLOW_ID = os.getenv("ROBOFLOW_WORKFLOW_ID", "")

def geoseer_api_key() -> str:
    load_dotenv(_API_DIR / ".env", override=True)
    return normalize_geoseer_api_key(os.getenv("GEOSEER_API_KEY"))


client = None
if API_KEY:
    client = InferenceHTTPClient(api_url=API_URL, api_key=API_KEY)


def parse_model_ids() -> list[str]:
    raw = os.getenv("ROBOFLOW_MODEL_IDS", "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    mid = MODEL_ID.strip()
    return [mid] if mid else []


def map_class(class_name: str) -> dict:
    c = (class_name or "").lower().replace("ı", "i")
    if (
        "collapsed" in c
        or "yikik" in c
        or "yıkık" in (class_name or "").lower()
        or "damage" in c
        or "destroyed" in c
        or "rubble" in c
        or "debris" in c
    ):
        return {"type": "collapsed", "label": "Yıkık / enkaz", "color": "#ef4444", "damageLevel": 5}
    if "saglam" in c or "intact" in c:
        return {"type": "intact", "label": "Sağlam bina", "color": "#22c55e", "damageLevel": 2}
    return {"type": "unknown", "label": class_name or "?", "color": "#94a3b8", "damageLevel": 3}


def _normalize_prediction(p: dict, img_w: int, img_h: int, idx: int) -> dict:
    cls = p.get("class") or p.get("class_name") or p.get("label") or ""

    if all(k in p for k in ("x_min", "y_min", "x_max", "y_max")):
        x0, y0 = float(p["x_min"]), float(p["y_min"])
        w = float(p["x_max"]) - x0
        h = float(p["y_max"]) - y0
    elif "bbox" in p and isinstance(p["bbox"], (list, tuple)) and len(p["bbox"]) >= 4:
        x0, y0, bw, bh = [float(v) for v in p["bbox"][:4]]
        w, h = bw, bh
    else:
        w = float(p.get("width", p.get("w", 1)))
        h = float(p.get("height", p.get("h", 1)))
        cx = float(p.get("x", 0))
        cy = float(p.get("y", 0))
        x0, y0 = cx - w / 2, cy - h / 2

    conf = float(p.get("confidence", p.get("score", 0)) or 0)
    meta = map_class(cls)

    return {
        "id": p.get("detection_id") or f"det-{idx}",
        "className": cls,
        **meta,
        "confidence": conf,
        "x": (x0 / img_w) * 100 if img_w else 0,
        "y": (y0 / img_h) * 100 if img_h else 0,
        "width": (w / img_w) * 100 if img_w else 0,
        "height": (h / img_h) * 100 if img_h else 0,
        "pixelBox": {"x": x0, "y": y0, "width": w, "height": h},
    }


def build_response(
    raw_preds: list,
    img_w: int,
    img_h: int,
    analysis_source: str,
    extra: dict | None = None,
    *,
    model_ids_used: list[str] | None = None,
) -> dict:
    min_conf = CONFIDENCE / 100.0
    filtered = [p for p in raw_preds if float(p.get("confidence", p.get("score", 0)) or 0) >= min_conf]

    seen = set()
    unique = []
    for p in filtered:
        key = (
            p.get("class") or p.get("class_name"),
            round(float(p.get("x", 0)), 1),
            round(float(p.get("y", 0)), 1),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)

    detections = [_normalize_prediction(p, img_w, img_h, i) for i, p in enumerate(unique)]
    intact = sum(1 for d in detections if d["type"] == "intact")
    collapsed = sum(1 for d in detections if d["type"] == "collapsed")

    suggested = 2
    if collapsed > 0:
        suggested = 5 if collapsed > 2 else 4

    mids = model_ids_used if model_ids_used else parse_model_ids()
    urls = []
    for mid in mids:
        u = dataset_url_for_model_id(mid)
        if u and u not in urls:
            urls.append(u)

    payload = {
        "detections": detections,
        "summary": {
            "intact": intact,
            "collapsed": collapsed,
            "unknown": 0,
            "total": len(detections),
        },
        "image": {"width": img_w, "height": img_h},
        "suggestedDamageLevel": suggested,
        "analysisSource": analysis_source,
        "datasetUrl": urls[0] if urls else DATASET_URL,
        "datasetUrls": urls,
        "modelId": mids[0] if mids else MODEL_ID,
        "modelIds": mids,
        "mergeIou": MERGE_IOU,
    }
    if extra:
        payload.update(extra)
    return payload


def run_analysis_pipeline(temp_path: str, img_w: int, img_h: int) -> dict:
    model_ids = parse_model_ids()
    combined: list[dict] = []
    per_model_counts: dict[str, int] = {}

    for mid in model_ids:
        batch = run_hosted_model(temp_path, mid, API_KEY or "", CONFIDENCE)
        per_model_counts[mid] = len(batch)
        combined.extend(batch)

    if combined:
        merged = merge_predictions_nms(combined, MERGE_IOU)
        n_models = len(model_ids)
        msg_parts = [
            f"{n_models} Roboflow modeli birleştirildi"
            if n_models > 1
            else f"Roboflow modeli kullanıldı ({model_ids[0]})"
        ]
        msg_parts.append(f"güven >= %{CONFIDENCE}")
        msg_parts.append(f"IoU birleştirme {MERGE_IOU:.2f}")
        if n_models > 1:
            detail = ", ".join(f"{m}: {per_model_counts.get(m, 0)} kutu" for m in model_ids)
            msg_parts.append(f"({detail} → {len(merged)} birleşik)")

        return build_response(
            merged,
            img_w,
            img_h,
            "roboflow_ensemble" if n_models > 1 else "roboflow_model",
            {"message": " · ".join(msg_parts)},
            model_ids_used=model_ids,
        )

    if USE_WORKFLOW and client and WORKSPACE and WORKFLOW_ID:
        try:
            workflow_result = client.run_workflow(
                workspace_name=WORKSPACE,
                workflow_id=WORKFLOW_ID,
                images={"image": temp_path},
                parameters={"classes": CLASS_LIST},
                use_cache=True,
            )
            wf_preds = extract_workflow_predictions(workflow_result)
            if wf_preds:
                return build_response(
                    wf_preds, img_w, img_h, "roboflow_workflow", model_ids_used=model_ids
                )
        except Exception:
            pass

    return build_response(
        [],
        img_w,
        img_h,
        "none",
        {
            "message": (
                f"Hiçbir model kutu döndürmedi ({', '.join(model_ids)}). "
                "ROBOFLOW_API_KEY ve ROBOFLOW_MODEL_IDS değerlerini kontrol edin."
            ),
        },
        model_ids_used=model_ids,
    )


@app.route("/api/health", methods=["GET"])
def health():
    try:
        mids = parse_model_ids()
        urls = []
        for mid in mids:
            u = dataset_url_for_model_id(mid)
            if u and u not in urls:
                urls.append(u)
        return jsonify(
            {
                "ok": True,
                "roboflowConfigured": bool(API_KEY),
                "modelId": mids[0] if mids else MODEL_ID,
                "modelIds": mids,
                "datasetUrl": urls[0] if urls else DATASET_URL,
                "datasetUrls": urls,
                "mergeIou": MERGE_IOU,
                "classes": CLASS_LIST,
                "confidence": CONFIDENCE,
                "geoseerConfigured": bool(geoseer_api_key()),
            }
        )
    except Exception as e:
        app.logger.exception("GET /api/health")
        return jsonify({"ok": False, "roboflowConfigured": bool(API_KEY), "error": str(e)}), 500


@app.route("/api/photo-geolocate", methods=["POST"])
def photo_geolocate():
    """EXIF GPS (varsa) veya GeoSeer ile görsel konum tahmini."""
    if "image" not in request.files:
        return jsonify({"status": "error", "error": "Fotoğraf gönderilmedi"}), 400

    image = request.files["image"]
    if not image.filename:
        return jsonify({"status": "error", "error": "Geçersiz dosya"}), 400

    suffix = Path(image.filename).suffix or ".jpg"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            image.save(temp.name)
            temp_path = temp.name

        exif_point = gps_from_exif(temp_path)
        if exif_point:
            return jsonify(
                {
                    "status": "success",
                    "source": "exif",
                    "engine": "exif_gps",
                    "locations": [exif_point],
                }
            )

        geo_key = geoseer_api_key()
        if not geo_key:
            return jsonify(
                {
                    "status": "unavailable",
                    "error": "Fotoğrafta GPS (EXIF) yok ve inference-api/.env içinde GEOSEER_API_KEY tanımlı değil.",
                }
            )

        out = geolocate_via_geoseer(temp_path, geo_key, image.filename)
        if out.get("status") == "success":
            merged = dict(out)
            merged["source"] = "geoseeer"
            return jsonify(merged)

        merged = dict(out) if isinstance(out, dict) else {"status": "error", "error": str(out)}
        merged.setdefault("status", "error")
        return jsonify(merged), 422

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/api/analyze-image", methods=["POST"])
def analyze_image():
    if not API_KEY:
        return jsonify({"error": "ROBOFLOW_API_KEY tanımlı değil (inference-api/.env)"}), 503

    if "image" not in request.files:
        return jsonify({"error": "Fotoğraf gönderilmedi"}), 400

    image = request.files["image"]
    if not image.filename:
        return jsonify({"error": "Geçersiz dosya"}), 400

    suffix = Path(image.filename).suffix or ".jpg"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            image.save(temp.name)
            temp_path = temp.name

        with Image.open(temp_path) as im:
            img_w, img_h = im.size

        return jsonify(run_analysis_pipeline(temp_path, img_w, img_h))

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    port = _env_int("PORT", 5000)
    if not API_KEY:
        print("UYARI: ROBOFLOW_API_KEY eksik — inference-api/.env dosyasını doldurun")
    else:
        print(f"ROBOFLOW_API_KEY yüklendi ({API_KEY[:6]}…)")
    geo = geoseer_api_key()
    print(f"Models: {parse_model_ids()} | merge IoU: {MERGE_IOU}")
    print(f"GeoSeer foto konum: {'etkin (' + geo[:8] + '...)' if geo else 'GEOSEER_API_KEY yok'}")
    # Windows watchdog yeniden yükleyici bazen 500 / import hatasına yol açar
    app.run(debug=True, port=port, host="0.0.0.0", use_reloader=False)
