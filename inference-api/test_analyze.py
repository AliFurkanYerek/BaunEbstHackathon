import json
import sys
from pathlib import Path

import requests

path = Path(
    r"C:\Users\MONSTER PC\.cursor\projects\c-Users-MONSTER-PC-Desktop-hackathon\assets"
    r"\c__Users_MONSTER_PC_AppData_Roaming_Cursor_User_workspaceStorage_3c4a5e01746fb60f3b3847909f5c36de_images_image-17f3af53-aa03-4d24-9395-0cafb65a51eb.png"
)
if len(sys.argv) > 1:
    path = Path(sys.argv[1])

with path.open("rb") as f:
    r = requests.post(
        "http://127.0.0.1:5000/api/analyze-image",
        files={"image": f},
        timeout=120,
    )
print("status", r.status_code)
d = r.json()
if "error" in d:
    print("error", d["error"])
    sys.exit(1)
print("summary", d.get("summary"))
print("detections", len(d.get("detections", [])))
for det in d.get("detections", [])[:8]:
    print(
        " -",
        repr(det.get("className")),
        det.get("type"),
        det.get("label"),
        round(det.get("confidence", 0), 3),
    )

raw = d.get("raw")
if isinstance(raw, list) and raw:
    raw = raw[0]
print("raw type", type(raw).__name__)
if isinstance(raw, dict):
    print("raw top keys", list(raw.keys())[:20])
