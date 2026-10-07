"""Apply fOLD Brodmann-area channel selections from the fOLD 10-10 landmark table.

For each Brodmann area, the fOLD ``3_Lnd`` sheet lists the 10-10 source-detector
pairs that are sensitive to it. Following the fOLD toolbox (specificity cutoff,
"Force Symmetry" on), the pairs at or above the cutoff define a set of optode
positions, mirrored across the midline; every MULPA channel that connects two
selected positions is part of the area's selection, together with the
short-separation channels at the selected sources.

Requires pandas and xlrd. Usage:

    python scripts/apply_fold_area_selection.py path/to/fOLD/Supplementary/10-10.xls
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
LABELS = ROOT / "data" / "mulpa-fold-brodmann-channel-areas.csv"
OUTPUT = ROOT / "app" / "derived-data.json"
SPECIFICITY_CUTOFF = 0.30


def mirror(position: str) -> str:
    """Mirror a 10-10 position across the midline (odd numbers left, even right)."""
    match = re.fullmatch(r"([A-Z]+)(\d+)", position)
    if not match:
        return position  # midline positions (…Z) map onto themselves
    prefix, number = match[1], int(match[2])
    return f"{prefix}{number + 1 if number % 2 else number - 1}"


def read_area_pairs(path: Path, cutoff: float) -> dict[str, list[tuple[str, str]]]:
    sheet = pd.read_excel(path, sheet_name="3_Lnd", header=None)
    areas: dict[str, list[tuple[str, str]]] = {}
    current = None
    for row in sheet.itertuples(index=False):
        if isinstance(row[0], str):
            current = row[0].strip()
            areas[current] = []
        elif isinstance(row[1], str) and row[1] != "Source" and float(row[3]) >= cutoff:
            areas[current].append((row[1].strip().upper(), row[2].strip().upper()))
    return areas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fold_table", type=Path)
    parser.add_argument("--cutoff", type=float, default=SPECIFICITY_CUTOFF, help="minimum fOLD specificity (0-1)")
    args = parser.parse_args()

    with LABELS.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    optode_by_landmark = {}
    for row in rows:
        optode_by_landmark.setdefault(row["source_landmark"].upper(), row["source_optode"])
        if row["channel_type"] == "long":
            optode_by_landmark.setdefault(row["detector_landmark"].upper(), row["detector_optode"])

    payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    channels = payload["channels"]
    selections = []
    for area, pairs in read_area_pairs(args.fold_table, args.cutoff).items():
        positions = {position for pair in pairs for position in pair}
        positions |= {mirror(position) for position in positions}
        optode_ids = {optode_by_landmark[p] for p in positions if p in optode_by_landmark}
        selected = [
            channel for channel in channels
            if channel["source"] in optode_ids and (channel["type"] == "short" or channel["detector"] in optode_ids)
        ]
        if not any(channel["type"] == "long" for channel in selected):
            continue
        channel_ids = [channel["id"] for channel in selected]
        selections.append({
            "area": area,
            "optodes": sorted(optode_ids, key=lambda value: (value[0], int(value[1:]))),
            "channels": channel_ids,
        })

    payload["foldAreaSelections"] = selections
    payload["foldAreaSelectionSettings"] = {"specificityCutoff": args.cutoff, "forceSymmetry": True}
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote fOLD selections for {len(selections)} Brodmann areas.")


if __name__ == "__main__":
    main()
