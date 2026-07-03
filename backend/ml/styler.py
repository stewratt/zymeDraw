# Fast neural style transfer on ONNX Runtime.
#
# Models are committed to the repo at models/style-<name>.onnx — patched
# once from the ONNX model zoo's fixed-224x224 exports to accept any input
# size; see tools/patch_style_model_dynamic.py for provenance. The STYLES
# dict is the drop-in point for future home-trained models.
#
# Unlike the upscaler there is no tiling: style transfer judges the whole
# image at once, and tiling would seam. Instead the input size is capped —
# the frontend sends a working-resolution copy, and the painterly result
# upscales fine.

import io
import os

import numpy as np
import onnxruntime as ort
from PIL import Image

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
STYLES = {
    "pointilism": "style-pointilism.onnx",
    "rain-princess": "style-rain-princess.onnx",
}
MAX_SIDE = 1600


class Styler:
    def __init__(self):
        self._sessions = {}

    def style_names(self):
        return sorted(STYLES)

    def _session(self, style):
        if style not in self._sessions:
            path = os.path.join(MODELS_DIR, STYLES[style])
            self._sessions[style] = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        return self._sessions[style]

    def stylize_png(self, style, data: bytes) -> bytes:
        if style not in STYLES:
            raise ValueError(f"Unknown style '{style}'; available: {', '.join(self.style_names())}.")
        img = Image.open(io.BytesIO(data)).convert("RGB")
        if max(img.size) > MAX_SIDE:
            raise ValueError(f"Input too large ({img.size[0]}x{img.size[1]}); max side is {MAX_SIDE}px.")

        session = self._session(style)
        # These models take/return RGB in the 0-255 float range (no 0-1 norm).
        arr = np.asarray(img, dtype=np.float32).transpose(2, 0, 1)[None]
        out = session.run(None, {session.get_inputs()[0].name: arr})[0][0]
        result = Image.fromarray(np.clip(out, 0.0, 255.0).transpose(1, 2, 0).astype(np.uint8))

        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()
