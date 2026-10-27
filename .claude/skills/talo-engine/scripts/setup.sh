#!/bin/sh
# One-time setup: LibreDWG for DWG conversion, and the Python libraries in a virtual environment inside the skill.
set -e
cd "$(dirname "$0")/.."
command -v dwg2dxf >/dev/null || { command -v brew >/dev/null && brew install libredwg || { echo "Install LibreDWG (dwg2dxf) first"; exit 1; }; }
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r scripts/requirements.txt
.venv/bin/python -c "import ezdxf, trimesh, fcl, manifold3d, rtree, openpyxl, lxml; print('ready')"
