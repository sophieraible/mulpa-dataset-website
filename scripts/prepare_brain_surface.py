"""Convert the supplied BrainVoyager SRF surface to a compact web mesh.

The output is deliberately simple so the browser can load it without a second
file-format dependency:

    4 bytes  magic (MUL3)
    uint32   format version
    uint32   vertex count
    uint32   triangle count
    float32  XYZ positions, interleaved
    float32  XYZ normals, interleaved
    uint32   triangle indices, interleaved

SRF coordinates use BrainVoyager's framing cube. DOTImager's MNI-to-SRF
mapping is q = [127.5-y, 127.5-z, 127.5+x]. This converter applies its inverse
and writes Three.js-ready [MNI-x, MNI-z, MNI-y] coordinates. The triangle
winding is reversed because that axis mapping contains a reflection.
"""

from __future__ import annotations

import argparse
import struct
from pathlib import Path

import numpy as np


def read_srf(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    with path.open("rb") as handle:
        version = struct.unpack("<f", handle.read(4))[0]
        _surface_type, vertex_count, triangle_count = struct.unpack("<iii", handle.read(12))
        handle.seek(12, 1)  # mesh-center XYZ

        positions = np.fromfile(handle, dtype="<f4", count=vertex_count * 3).reshape(3, vertex_count).T
        normals = np.fromfile(handle, dtype="<f4", count=vertex_count * 3).reshape(3, vertex_count).T

        if version >= 1.0:
            handle.seek(8 * 4, 1)  # convex + concave RGBA

        handle.seek(vertex_count * 4, 1)  # vertex color indices

        for _ in range(vertex_count):
            neighbor_count = struct.unpack("<i", handle.read(4))[0]
            handle.seek(neighbor_count * 4, 1)

        faces = np.fromfile(handle, dtype="<i4", count=triangle_count * 3).reshape(triangle_count, 3)

    return positions, normals, faces


def to_three_space(values: np.ndarray, *, translate: bool) -> np.ndarray:
    offset = 127.5 if translate else 0.0
    x = values[:, 2] - offset
    y = offset - values[:, 1]
    z = offset - values[:, 0]
    return np.column_stack((x, y, z)).astype("<f4", copy=False)


def write_mesh(output: Path, positions: np.ndarray, normals: np.ndarray, faces: np.ndarray) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    faces = faces[:, [0, 2, 1]].astype("<u4", copy=False)
    with output.open("wb") as handle:
        handle.write(b"MUL3")
        handle.write(struct.pack("<III", 1, len(positions), len(faces)))
        handle.write(positions.tobytes(order="C"))
        handle.write(normals.tobytes(order="C"))
        handle.write(faces.tobytes(order="C"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    positions, normals, faces = read_srf(args.source)
    positions = to_three_space(positions, translate=True)
    normals = to_three_space(normals, translate=False)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    write_mesh(args.output, positions, normals, faces)

    bounds = np.row_stack((positions.min(axis=0), positions.max(axis=0)))
    print(
        f"Wrote {args.output}: {len(positions):,} vertices, {len(faces):,} triangles; "
        f"bounds {np.round(bounds, 1).tolist()}"
    )


if __name__ == "__main__":
    main()
