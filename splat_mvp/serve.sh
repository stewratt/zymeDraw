#!/usr/bin/env bash
# Serve the viewer + PLYs. The viewer pulls three.js from a CDN, so it needs the network.
cd "$(dirname "$0")"
echo "open http://localhost:8787/viewer.html"
exec .venv/bin/python server.py
