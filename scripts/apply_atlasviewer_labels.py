"""Apply AtlasViewer-exported AAL labels to the browser-ready montage data."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LABELS = ROOT / "data" / "atlasviewer-channel-labels.csv"
OUTPUT = ROOT / "app" / "derived-data.json"


def main() -> None:
    with LABELS.open(encoding="utf-8-sig", newline="") as handle:
        labels = {
            (f"S{row['Src'].strip()}", f"D{row['Det'].strip()}"): row["label"].strip()
            for row in csv.DictReader(handle)
        }

    payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    channels = payload["channels"]
    channel_pairs = {(channel["source"], channel["detector"]) for channel in channels}
    if channel_pairs != set(labels):
        missing = sorted(channel_pairs - set(labels))
        extra = sorted(set(labels) - channel_pairs)
        raise ValueError(f"AtlasViewer pairs do not match website channels; missing={missing}, extra={extra}")

    for channel in channels:
        channel["region"] = labels[(channel["source"], channel["detector"])]

    payload["anatomicalLabels"] = {
        "source": "AtlasViewer projection export",
        "atlas": "Colin27",
        "parcellation": "AAL",
        "coordinateSpace": "MNI",
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(channels)} channel labels from AtlasViewer's AAL export.")


if __name__ == "__main__":
    main()
