# Tiled Real-ESRGAN x4 upscaling on ONNX Runtime.
#
# The model (realesr-general-x4v3) is committed to the repo at
# models/realesr-general-x4v3.onnx — converted once from the official
# xinntao release; see tools/convert_realesrgan_to_onnx.py for provenance.
#
# Inference is tiled: the image is processed in TILE-sized squares, each
# with an OVERLAP ring of context that gets cropped from the output, so
# seams don't show and memory stays flat regardless of input size.

import io
import os

import numpy as np
import onnxruntime as ort
from PIL import Image

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "realesr-general-x4v3.onnx")
SCALE = 4
TILE = 192  # tile size in source pixels
OVERLAP = 16  # context ring; cropped away in the output
MAX_SIDE = 2600  # refuse absurd inputs; Deeper sends working-canvas-sized crops


class Upscaler:
    def __init__(self):
        self.session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])

    def upscale_png(self, data: bytes) -> bytes:
        img = Image.open(io.BytesIO(data))
        if max(img.size) > MAX_SIDE:
            raise ValueError(f"Input too large ({img.size[0]}x{img.size[1]}); max side is {MAX_SIDE}px.")
        # The model is RGB-only: an alpha channel rides along via plain resize.
        alpha = img.getchannel("A") if "A" in img.getbands() else None
        arr = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
        out = self._run_tiled(arr)
        result = Image.fromarray((out * 255.0 + 0.5).astype(np.uint8))
        if alpha is not None:
            result.putalpha(alpha.resize(result.size, Image.BICUBIC))
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()

    def _run_tiled(self, arr):
        h, w, _ = arr.shape
        out = np.zeros((h * SCALE, w * SCALE, 3), dtype=np.float32)
        for y0 in range(0, h, TILE):
            for x0 in range(0, w, TILE):
                y1, x1 = min(y0 + TILE, h), min(x0 + TILE, w)
                py0, px0 = max(0, y0 - OVERLAP), max(0, x0 - OVERLAP)
                py1, px1 = min(h, y1 + OVERLAP), min(w, x1 + OVERLAP)
                inp = arr[py0:py1, px0:px1].transpose(2, 0, 1)[None]
                got = self.session.run(None, {"input": inp})[0][0].transpose(1, 2, 0)
                oy, ox = (y0 - py0) * SCALE, (x0 - px0) * SCALE
                out[y0 * SCALE : y1 * SCALE, x0 * SCALE : x1 * SCALE] = got[
                    oy : oy + (y1 - y0) * SCALE, ox : ox + (x1 - x0) * SCALE
                ]
        return np.clip(out, 0.0, 1.0)
