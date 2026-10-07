"""Convert a one-map BrainVoyager SMP sensitivity profile to a web float buffer.

The SMP must be computed on the same SRF that ``prepare_brain_surface.py`` turned
into ``public/brain-surface.bin`` (currently mni152_2009_bvbabel_blender20k.srf),
so the vertex indices match.

The Satori export stores normalized values in steps of 1/129 where 0 is the
highest sensitivity (top of the Satori color bar) and 1 the lowest. The most
frequent value marks vertices without sensitivity. The output stores the color
bar position for each vertex (1 = top, 0 = bottom) and -1 for those vertices.
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

import numpy as np


def read_c_string(handle) -> str:
    data = bytearray()
    while (byte := handle.read(1)) not in (b"", b"\0"):
        data.extend(byte)
    if byte == b"":
        raise ValueError("Unexpected end of SMP file while reading a string")
    return data.decode("utf-8", "replace")


def read_sensitivity_profile(path: Path) -> tuple[str, np.ndarray]:
    """Read a version-5, one-map BrainVoyager SMP file without external dependencies."""
    with path.open("rb") as handle:
        version = struct.unpack("<h", handle.read(2))[0]
        vertex_count = struct.unpack("<i", handle.read(4))[0]
        map_count = struct.unpack("<h", handle.read(2))[0]
        surface_name = read_c_string(handle)
        if version != 5 or map_count != 1:
            raise ValueError(f"Expected one version-5 SMP map, got version={version}, maps={map_count}")

        map_type = struct.unpack("<i", handle.read(4))[0]
        if map_type == 3:  # cross-correlation maps store four additional integer fields
            handle.seek(4 * 4, 1)
        handle.seek(4 + 1 + 4 + 4 + 4 + 4 + 4 + 4 + 4, 1)
        handle.seek(3 + 3 + 3 + 3 + 1, 1)  # positive/negative RGB settings + LUT switch
        read_c_string(handle)  # LUT filename
        handle.seek(4, 1)  # transparency
        read_c_string(handle)  # map name

        values = np.fromfile(handle, dtype="<f4", count=vertex_count)

    if len(values) != vertex_count or not np.isfinite(values).all():
        raise ValueError("SMP map contains incomplete or non-finite sensitivity values")
    return surface_name, values


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--surface", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "brain-surface.bin")
    parser.add_argument("--range", type=float, nargs=2, default=(-3.92, -0.92), metavar=("BOTTOM", "TOP"),
                        help="Satori color-bar labels for the bottom and top of the scale")
    args = parser.parse_args()

    surface_name, values = read_sensitivity_profile(args.source)
    surface_vertices = struct.unpack("<I", args.surface.read_bytes()[8:12])[0]
    if surface_vertices != len(values):
        raise ValueError(f"SMP has {len(values)} vertices but {args.surface} has {surface_vertices}")

    stored, counts = np.unique(values, return_counts=True)
    no_signal = stored[np.argmax(counts)]
    positions = np.where(values == no_signal, -1.0, 1.0 - values).astype("<f4")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    positions.tofile(args.output)
    metadata = {
        "version": 2,
        "vertexCount": int(len(values)),
        "surface": surface_name,
        "noSignalStoredValue": float(no_signal),
        "noSignalVertices": int(counts.max()),
        "colorBarRange": list(args.range),
        "encoding": "float32 color-bar position per vertex: 1 = top (highest), 0 = bottom, -1 = no sensitivity",
    }
    args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {len(values):,} vertices, {counts.max():,} without sensitivity")


if __name__ == "__main__":
    main()
