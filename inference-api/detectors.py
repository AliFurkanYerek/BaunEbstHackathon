"""Roboflow hosted model inference (detect API)."""
from __future__ import annotations

import os
from typing import Any

import requests


DATASET_URL = "https://universe.roboflow.com/roads-aihh0/earthquake-damage-detection-xmfgr"
DEFAULT_MODEL_ID = "earthquake-damage-detection-xmfgr/1"

# Universe — model slug → proje sayfası
MODEL_DATASET_URLS: dict[str, str] = {
    "earthquake-damage-detection-xmfgr": (
        "https://universe.roboflow.com/roads-aihh0/earthquake-damage-detection-xmfgr"
    ),
    "collapsed-building-detection2-ku0yq": (
        "https://universe.roboflow.com/new-workspace-jejih/collapsed-building-detection2-ku0yq"
    ),
}


def dataset_url_for_model_id(model_id: str) -> str | None:
    slug = (model_id or "").split("/")[0].strip()
    return MODEL_DATASET_URLS.get(slug)


def _xyxy_from_center_pred(p: dict) -> tuple[float, float, float, float]:
    cx = float(p.get("x", 0))
    cy = float(p.get("y", 0))
    w = float(p.get("width", p.get("w", 0)))
    h = float(p.get("height", p.get("h", 0)))
    return cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2


def iou_xyxy(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0.0, ix1 - ix0), max(0.0, iy1 - iy0)
    inter = iw * ih
    area_a = max(0.0, ax1 - ax0) * max(0.0, ay1 - ay0)
    area_b = max(0.0, bx1 - bx0) * max(0.0, by1 - by0)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def merge_predictions_nms(preds: list[dict], iou_threshold: float = 0.42) -> list[dict]:
    """Birden fazla model çıktısını birleştirir; IoU ile örtüşen kutulardan güveni yüksek olanı kalır."""
    if len(preds) <= 1:
        return preds
    scored = sorted(
        preds,
        key=lambda p: float(p.get("confidence", p.get("score", 0)) or 0),
        reverse=True,
    )
    kept: list[dict] = []
    boxes_kept: list[tuple[float, float, float, float]] = []
    for p in scored:
        box = _xyxy_from_center_pred(p)
        if box[2] <= box[0] or box[3] <= box[1]:
            continue
        duplicate = False
        for kb in boxes_kept:
            if iou_xyxy(box, kb) >= iou_threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(p)
            boxes_kept.append(box)
    return kept


def parse_classes(env_value: str) -> list[str]:
    return [c.strip() for c in (env_value or "collapsed").split(",") if c.strip()]


def run_hosted_model(
    image_path: str,
    model_id: str,
    api_key: str,
    confidence: int = 30,
) -> list[dict]:
    """Universe deploy edilmiş object detection modeli (detect.roboflow.com)."""
    if not api_key or not model_id:
        return []
    url = f"https://detect.roboflow.com/{model_id}"
    try:
        with open(image_path, "rb") as f:
            response = requests.post(
                url,
                params={"api_key": api_key, "confidence": confidence},
                files={"file": f},
                timeout=120,
            )
        if not response.ok:
            return []
        data = response.json()
        preds = data.get("predictions", [])
        return preds if isinstance(preds, list) else []
    except Exception:
        return []


def extract_workflow_predictions(workflow_result: Any) -> list[dict]:
    """Workflow JSON içinden kutu listesi (isteğe bağlı)."""
    out: list[dict] = []
    item = workflow_result
    if isinstance(workflow_result, list) and workflow_result:
        item = workflow_result[0]
    if not isinstance(item, dict):
        return out
    preds = item.get("predictions")
    if isinstance(preds, dict):
        inner = preds.get("predictions")
        if isinstance(inner, list):
            out.extend(inner)
    _walk_for_predictions(workflow_result, out)
    return out


def _walk_for_predictions(node: Any, out: list[dict]) -> None:
    if isinstance(node, dict):
        if _looks_like_prediction(node):
            out.append(node)
        for k, v in node.items():
            if k in ("annotated_image", "image") and isinstance(v, str) and len(v) > 500:
                continue
            _walk_for_predictions(v, out)
    elif isinstance(node, list):
        for item in node:
            _walk_for_predictions(item, out)


def _looks_like_prediction(obj: dict) -> bool:
    if not isinstance(obj, dict):
        return False
    has_class = any(k in obj for k in ("class", "class_name", "label", "category"))
    has_box = (
        ("x" in obj and "y" in obj and ("width" in obj or "w" in obj))
        or all(k in obj for k in ("x_min", "y_min", "x_max", "y_max"))
        or "bbox" in obj
    )
    return has_class and has_box
