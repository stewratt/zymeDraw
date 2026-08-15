# SHARP gaussian-splat prediction for the Splatt card: one image in, one
# .ply (a cloud of 3D gaussians) out.
#
# torch and SHARP are an OPT-IN extra (requirements-splat.txt) — a machine
# without them still runs the sidecar, so every import of them happens
# inside a function and `available()` only asks whether they *could* be
# imported. The 2.7 GB checkpoint is too big to commit: torch caches it in
# ~/.cache/torch on first load, which is why /splat/warm exists.

import importlib.util
import os
import tempfile
import threading
from pathlib import Path

MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"

# Must be set before torch's first import (torch loads lazily below): grow
# allocator segments on demand instead of pre-claiming large fixed blocks,
# which fragments less when other processes are also competing for VRAM.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

# One predict at a time: a single GPU, and the predictor isn't reentrant.
_predict_lock = threading.Lock()
_load_lock = threading.Lock()
_model = None
_device = None
_warming = False


def available() -> bool:
    """Can this machine splat? find_spec answers without importing torch."""
    return all(importlib.util.find_spec(name) is not None for name in ("torch", "sharp"))


def loaded() -> bool:
    return _model is not None


def device():
    """The device the model landed on, or None until it has loaded."""
    return _device


def load():
    """Load the predictor once and keep it resident (mirrors sharp/cli/predict.py)."""
    global _model, _device
    with _load_lock:
        if _model is None:
            import torch
            from sharp.models import PredictorParams, create_predictor

            if torch.cuda.is_available():
                dev = "cuda"
            elif torch.backends.mps.is_available():
                dev = "mps"
            else:
                dev = "cpu"
            print(f"[splat] loading model on {dev} …", flush=True)
            state_dict = torch.hub.load_state_dict_from_url(MODEL_URL, progress=False)
            model = create_predictor(PredictorParams())
            model.load_state_dict(state_dict)
            model.eval()
            model.to(dev)
            _model, _device = model, dev
            print("[splat] model ready", flush=True)
    return _model, _device


def warm():
    """Kick the (slow, download-then-load) warm-up on a background thread."""
    global _warming
    if not available() or _model is not None or _warming:
        return
    _warming = True

    def work():
        global _warming
        try:
            load()
        except Exception as err:  # a failed warm must not kill the sidecar
            print(f"[splat] warm failed: {type(err).__name__}: {err}", flush=True)
        finally:
            _warming = False

    threading.Thread(target=work, daemon=True).start()


def predict_png(data: bytes) -> bytes:
    """Predict gaussians for one image; returns the .ply bytes."""
    import torch
    from sharp.cli.predict import predict_image
    from sharp.utils import io
    from sharp.utils.gaussians import save_ply

    model, dev = load()
    # SHARP reads and writes paths, not buffers, so the exchange goes
    # through a scratch dir that dies with the request.
    with tempfile.TemporaryDirectory() as tmp:
        image_path = Path(tmp) / "input.png"
        ply_path = Path(tmp) / "output.ply"
        image_path.write_bytes(data)
        image, _, f_px = io.load_rgb(image_path)
        height, width = image.shape[:2]
        with _predict_lock:
            try:
                gaussians = predict_image(model, image, f_px, torch.device(dev))
            except torch.cuda.OutOfMemoryError:
                # one retry after dropping the allocator cache — survives
                # transient pressure from other GPU processes
                if dev != "cuda":
                    raise
                torch.cuda.empty_cache()
                gaussians = predict_image(model, image, f_px, torch.device(dev))
            save_ply(gaussians, f_px, (height, width), ply_path)
            # Give the activation memory back instead of keeping it cached —
            # a warm torch process otherwise camps on GBs between runs.
            del gaussians
            if dev == "cuda":
                torch.cuda.empty_cache()
            elif dev == "mps":
                torch.mps.empty_cache()
        return ply_path.read_bytes()
