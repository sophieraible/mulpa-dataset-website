"""Apply fOLD Brodmann labels from the verified MULPA channel CSV."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LABELS = ROOT / "data" / "mulpa-fold-brodmann-channel-areas.csv"
OUTPUT = ROOT / "app" / "derived-data.json"


def main() -> None:
    with LABELS.open(encoding="utf-8-sig", newline="") as handle:
        labels = {
            row["channel_id"].strip(): row["Brodmann_primary_area"].strip()
            for row in csv.DictReader(handle)
        }

    if len(labels) != 134:
        raise ValueError(f"Expected 134 unique channel rows in fOLD CSV, found {len(labels)}")

    payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    channels = payload["channels"]
    channel_ids = {channel["id"] for channel in channels}
    if channel_ids != set(labels):
        missing = sorted(channel_ids - set(labels))
        extra = sorted(set(labels) - channel_ids)
        raise ValueError(f"fOLD channel IDs do not match website data; missing={missing}, extra={extra}")

    for channel in channels:
        label = labels[channel["id"]]
        if channel["type"] == "long" and not label:
            raise ValueError(f"Missing fOLD Brodmann label for long channel {channel['id']}")
        channel["brodmannArea"] = label

    payload["brodmannLabels"] = {
        "source": "fOLD 10-10 channel table",
        "atlas": "Brodmann",
        "selection": "primary area by fOLD specificity",
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Updated fOLD Brodmann labels for {len(channels)} channels.")


if __name__ == "__main__":
    main()
