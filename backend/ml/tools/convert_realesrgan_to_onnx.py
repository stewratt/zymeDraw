# One-time conversion of the official Real-ESRGAN "general" model to ONNX.
# You do NOT need to run this — the resulting .onnx is committed to the repo
# at backend/ml/models/realesr-general-x4v3.onnx. It exists so the model's
# provenance is reproducible:
#
#   source weights: https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
#   (xinntao/Real-ESRGAN official release, BSD-3-Clause)
#
# The architecture below is SRVGGNetCompact, transcribed from basicsr's
# srvgg_arch.py — inlined here so the conversion doesn't depend on basicsr
# (unmaintained, breaks against current torch).
#
# Usage:  python convert_realesrgan_to_onnx.py <weights.pth> <out.onnx>
# Needs:  pip install torch onnx onnxruntime numpy   (in a throwaway venv)

import sys

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class SRVGGNetCompact(nn.Module):
    # realesr-general-x4v3 config: num_feat=64, num_conv=32, upscale=4, prelu
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4):
        super().__init__()
        self.upscale = upscale
        self.body = nn.ModuleList()
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        self.body.append(nn.PReLU(num_parameters=num_feat))
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
        self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        # residual over a nearest-neighbour upscale of the input
        base = F.interpolate(x, scale_factor=self.upscale, mode="nearest")
        return out + base


def main(pth_path, onnx_path):
    model = SRVGGNetCompact()
    ckpt = torch.load(pth_path, map_location="cpu", weights_only=True)
    state = ckpt.get("params_ema") or ckpt.get("params") or ckpt
    model.load_state_dict(state, strict=True)
    model.eval()

    dummy = torch.rand(1, 3, 64, 64)
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {2: "h", 3: "w"}, "output": {2: "h4", 3: "w4"}},
        opset_version=17,
        dynamo=False,
    )

    # Verify: ONNX output must match torch on a non-square dynamic shape.
    import onnxruntime as ort

    test = torch.rand(1, 3, 51, 37)
    with torch.no_grad():
        want = model(test).numpy()
    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    got = sess.run(None, {"input": test.numpy()})[0]
    diff = float(np.abs(want - got).max())
    assert got.shape == (1, 3, 51 * 4, 37 * 4), got.shape
    assert diff < 1e-4, diff
    print(f"ok: wrote {onnx_path}, max torch/onnx diff {diff:.2e}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
