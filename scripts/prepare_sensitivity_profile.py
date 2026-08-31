"""Convert a one-map BrainVoyager SMP sensitivity profile to a web float buffer."""

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
    args = parser.parse_args()

    surface_name, values = read_sensitivity_profile(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    values.astype("<f4", copy=False).tofile(args.output)
    metadata = {
        "version": 1,
        "vertexCount": int(len(values)),
        "valueRange": [float(values.min()), float(values.max())],
        "surface": surface_name,
        "cutoff": 0.25,
        "palette": {
            "neutral": "#aba8a1",
            "stops": ["#1425d8", "#00a9ff", "#00e5d1", "#f3ff28", "#ff9800", "#ec1010"],
        },
    }
    args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {len(values):,} vertex values, range {metadata['valueRange']}")


if __name__ == "__main__":
    main()
