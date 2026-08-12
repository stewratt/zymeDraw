#!/usr/bin/env python
"""SHARP MVP server: static files + an in-process, model-warm /api/predict.

Stdlib only. Serves splat_mvp/ on :8787 so viewer.html and out/*.ply keep working,
and adds:
  GET  /api/health  -> {"ok": true, "modelLoaded": bool}
  GET  /api/plys    -> {"plys": [names]}  (newest first)
  POST /api/predict -> raw image bytes, filename in the X-Filename header
                       {"ok": true, "ply": "<stem>.ply", "seconds": 12.3}
"""

import json
import os
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "input"
OUT_DIR = ROOT / "out"
PORT = int(os.environ.get("PORT", 8787))
MAX_UPLOAD = 64 * 1024 * 1024
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp", ".heic"}

MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"

# Must be set before torch's first import (torch loads lazily in get_model):
# grow allocator segments on demand instead of pre-claiming large fixed blocks,
# which fragments less when other processes are also competing for VRAM.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

# One predict at a time: a single GPU, and the predictor isn't reentrant.
# Static requests are unaffected — ThreadingHTTPServer handles them on other threads.
_predict_lock = threading.Lock()
_model = None
_device = None


def get_model():
    """Load the predictor once and keep it resident (mirrors sharp/cli/predict.py)."""
    global _model, _device
    if _model is None:
        import torch

        from sharp.models import PredictorParams, create_predictor

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"loading model on {_device} …", flush=True)
        state_dict = torch.hub.load_state_dict_from_url(MODEL_URL, progress=False)
        model = create_predictor(PredictorParams())
        model.load_state_dict(state_dict)
        model.eval()
        model.to(_device)
        _model = model
        print("model ready", flush=True)
    return _model, _device


def run_predict(image_path: Path) -> str:
    """Predict one image; returns the written .ply filename."""
    import torch

    from sharp.cli.predict import predict_image
    from sharp.utils import io
    from sharp.utils.gaussians import save_ply

    model, device = get_model()
    image, _, f_px = io.load_rgb(image_path)
    height, width = image.shape[:2]
    try:
        gaussians = predict_image(model, image, f_px, torch.device(device))
    except torch.cuda.OutOfMemoryError:
        # one retry after dropping the allocator cache — survives transient
        # pressure from other GPU processes
        torch.cuda.empty_cache()
        gaussians = predict_image(model, image, f_px, torch.device(device))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_name = image_path.stem + ".ply"
    save_ply(gaussians, f_px, (height, width), OUT_DIR / out_name)

    # Give the activation memory back to the OS instead of keeping it cached —
    # a warm torch process otherwise camps on GBs of idle VRAM between runs.
    del gaussians
    if device == "cuda":
        torch.cuda.empty_cache()
    return out_name


def list_plys():
    if not OUT_DIR.is_dir():
        return []
    plys = [p for p in OUT_DIR.iterdir() if p.suffix.lower() == ".ply"]
    plys.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return [p.name for p in plys]


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/health":
            return self.send_json({"ok": True, "modelLoaded": _model is not None})
        if self.path.split("?")[0] == "/api/plys":
            return self.send_json({"plys": list_plys()})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/predict":
            return self.send_json({"ok": False, "error": "not found"}, 404)
        try:
            self.handle_predict()
        except Exception as exc:  # the browser should see the reason, not a dead socket
            import traceback

            traceback.print_exc()
            self.send_json({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, 500)

    def handle_predict(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return self.send_json({"ok": False, "error": "empty upload"}, 400)
        if length > MAX_UPLOAD:
            return self.send_json({"ok": False, "error": "file too large"}, 413)

        # The client percent-encodes the name — HTTP headers can't carry raw non-ASCII.
        raw_name = unquote(self.headers.get("X-Filename") or "upload.jpg")
        name = os.path.basename(raw_name)
        stem, ext = os.path.splitext(name)
        stem = "".join(c for c in stem if c.isalnum() or c in "-_") or "upload"
        ext = ext.lower()
        if ext not in IMAGE_EXTS:
            return self.send_json({"ok": False, "error": f"unsupported type {ext!r}"}, 400)

        data = self.rfile.read(length)
        INPUT_DIR.mkdir(parents=True, exist_ok=True)
        image_path = INPUT_DIR / (stem + ext)
        image_path.write_bytes(data)

        started = time.time()
        with _predict_lock:
            ply = run_predict(image_path)
        self.send_json({"ok": True, "ply": ply, "seconds": round(time.time() - started, 1)})


def main():
    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"serving {ROOT} on http://localhost:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
