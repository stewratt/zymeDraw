#!/usr/bin/env bash
# SHARP MVP — fetch image(s), predict gaussian splats, report where the PLYs landed.
# usage: ./run.sh <image-url-or-local-path> [more...]
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
  echo "usage: ./run.sh <image-url-or-local-path> [more...]" >&2
  exit 1
fi

mkdir -p input out
rm -f input/*

for src in "$@"; do
  case "$src" in
    http://* | https://*)
      name="$(basename "${src%%\?*}")"
      echo "fetching $name"
      curl -fsS "$src" -o "input/$name"
      ;;
    *)
      cp -f "$src" input/
      ;;
  esac
done

time .venv/bin/sharp predict -i input -o out

echo
echo "newest PLYs in out/:"
ls -t out/*.ply | head -5
echo
echo "view: ./serve.sh  then open  http://localhost:8787/viewer.html"
