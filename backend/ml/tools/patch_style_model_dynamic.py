# One-time patch of an ONNX model-zoo "fast neural style" model so it
# accepts any input size. You do NOT need to run this — the resulting
# .onnx files are committed to the repo at backend/ml/models/. It exists
# so the models' provenance is reproducible:
#
#   source models: https://github.com/onnx/models/tree/main/validated/vision/style_transfer/fast_neural_style
#   (ONNX model zoo, exported from pytorch/examples fast_neural_style, MIT)
#
# The network (Johnson et al. transformer net) is fully convolutional, but
# the zoo export bakes a fixed 1x3x224x224 shape into the graph metadata.
# This script rewrites the spatial dims of the graph's real input/output
# to dynamic and verifies the result runs at a non-square size.
#
# The old exporter also listed every weight tensor as a graph INPUT, which
# makes onnxruntime print a "will not be treated as constant" warning per
# weight on session load and blocks const-folding. The patch drops the
# weights from the input list (the fix the warning itself suggests).
#
# Usage:  python patch_style_model_dynamic.py <in.onnx> <out.onnx>
# Needs:  pip install onnx onnxruntime numpy

import sys

import numpy as np
import onnx
import onnxruntime as ort


def make_dynamic(model):
    # Old exports list weights as graph inputs too — only the tensor that
    # isn't an initializer is the real image input.
    weights = {init.name for init in model.graph.initializer}
    image_inputs = [i for i in model.graph.input if i.name not in weights]
    assert len(image_inputs) == 1, f"expected one image input, got {[i.name for i in image_inputs]}"
    for value in [image_inputs[0], model.graph.output[0]]:
        dims = value.type.tensor_type.shape.dim
        dims[2].dim_param = "height"
        dims[3].dim_param = "width"
    # Keep only the image as a graph input; the weights stay as initializers.
    del model.graph.input[:]
    model.graph.input.extend(image_inputs)
    return image_inputs[0].name


def main():
    src, dst = sys.argv[1], sys.argv[2]
    model = onnx.load(src)
    input_name = make_dynamic(model)
    onnx.checker.check_model(model)
    onnx.save(model, dst)

    session = ort.InferenceSession(dst, providers=["CPUExecutionProvider"])
    x = np.random.rand(1, 3, 320, 256).astype(np.float32) * 255.0
    y = session.run(None, {input_name: x})[0]
    assert y.shape == (1, 3, 320, 256), f"unexpected output shape {y.shape}"
    print(f"OK: {dst} runs at arbitrary sizes (tested 320x256).")


if __name__ == "__main__":
    main()
