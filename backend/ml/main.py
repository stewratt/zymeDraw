# The Deck ML sidecar — a small FastAPI app hosting the two models the
# browser can't run: rembg (Stamp's cutouts) and Real-ESRGAN (Deeper's
# detail restore). Pure compute: image bytes in, PNG bytes out. It knows
# nothing about folders, decks or sessions — Express proxies /api/ml/*
# here, and the frontend treats any failure as "degrade, don't block".
#
# Models lazy-load on first use and stay warm. rembg downloads its u2net
# weights (~170 MB) to ~/.u2net on first cutout; the ESRGAN weights are
# committed to the repo (see tools/convert_realesrgan_to_onnx.py).

import threading

from fastapi import FastAPI, Request, Response
from starlette.concurrency import run_in_threadpool

from styler import STYLES, Styler
from upscaler import Upscaler

app = FastAPI(title="Deck ML sidecar")

_lock = threading.Lock()
_models = {"rembg": None, "upscaler": None, "styler": None}


def _rembg_session():
    with _lock:
        if _models["rembg"] is None:
            from rembg import new_session

            _models["rembg"] = new_session("u2net")
    return _models["rembg"]


def _upscaler():
    with _lock:
        if _models["upscaler"] is None:
            _models["upscaler"] = Upscaler()
    return _models["upscaler"]


def _styler():
    with _lock:
        if _models["styler"] is None:
            _models["styler"] = Styler()
    return _models["styler"]


@app.get("/health")
def health():
    return {
        "ok": True,
        "cutoutLoaded": _models["rembg"] is not None,
        "upscaleLoaded": _models["upscaler"] is not None,
        "styles": sorted(STYLES),
    }


@app.post("/cutout")
async def cutout(request: Request):
    data = await request.body()
    if not data:
        return Response(status_code=400, content="Empty body.")

    def work():
        from rembg import remove

        return remove(data, session=_rembg_session())

    png = await run_in_threadpool(work)
    return Response(content=png, media_type="image/png")


@app.post("/upscale")
async def upscale(request: Request):
    data = await request.body()
    if not data:
        return Response(status_code=400, content="Empty body.")
    try:
        png = await run_in_threadpool(lambda: _upscaler().upscale_png(data))
    except ValueError as err:
        return Response(status_code=400, content=str(err))
    return Response(content=png, media_type="image/png")


@app.post("/style")
async def style(request: Request, style: str = "pointilism"):
    data = await request.body()
    if not data:
        return Response(status_code=400, content="Empty body.")
    try:
        png = await run_in_threadpool(lambda: _styler().stylize_png(style, data))
    except ValueError as err:
        return Response(status_code=400, content=str(err))
    return Response(content=png, media_type="image/png")
