"""Finishes a TripoSR mesh for the game: smooth normals, so three.js doesn't
fall back to flat shading (TripoSR's export has none).

    python post.py <TripoSR output dir>/0/mesh.glb <out.glb>
    node tools/ai-model.mjs <out.glb> <creature id>

How the meshes were made (CPU, python3.11 venv, TripoSR @ 107cefd):
    pip install torch==2.3.1 scikit-image fast-simplification trimesh xatlas moderngl ...
    git apply triposr.patch   # skimage marching cubes (no torchmcubes), 30k-face
                              # decimation, and a real textured GLB facing +Z
    xvfb-run -a python run.py docs/concept-art/<name>.png --device cpu \
        --bake-texture --texture-resolution 1024 --model-save-format glb --output-dir out/<name>
"""

import sys

import numpy as np
import trimesh

src, dst = sys.argv[1], sys.argv[2]
g = list(trimesh.load(src).geometry.values())[0]
# One normal per position, so the copies of a vertex along UV seams match.
key = np.round(g.vertices, 6)
uniq, inv = np.unique(key, axis=0, return_inverse=True)
welded = trimesh.Trimesh(uniq, inv.ravel()[g.faces], process=False)
norms = welded.vertex_normals[inv.ravel()].copy()
bad = ~np.isfinite(norms).all(1) | (np.linalg.norm(norms, axis=1) < 1e-6)
norms[bad] = [0, 1, 0]
norms /= np.linalg.norm(norms, axis=1, keepdims=True)
out = trimesh.Trimesh(g.vertices, g.faces, vertex_normals=norms, process=False)
out.visual = g.visual
out.export(dst, include_normals=True)
