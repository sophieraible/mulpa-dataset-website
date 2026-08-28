"""Prepare the small, browser-friendly data files used by the MULPA website.

The source files stay outside the website. Only montage geometry, participant-level
QC summaries, and a downsampled motor-action example are written to JSON.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import h5py
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OPTODES = Path(r"D:\mulpa\mulpa_bids_4publication\sub-01\nirs\sub-01_optodes.tsv")
SNIRF = Path(r"D:\mulpa\mulpa_preproc\sub-01\nirs\sub-01_task-motoraction_nirs_preproc_4glm.snirf")
QC = Path(r"C:\Users\P70091213\Downloads\QA - MULPA Dataset - qc_final.csv")
OUTPUT = ROOT / "app" / "derived-data.json"


def scalar(group: h5py.Group, name: str):
    value = group[name][()]
    if isinstance(value, np.ndarray):
        value = value.flat[0]
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value.item() if hasattr(value, "item") else value


def read_optodes() -> list[dict]:
    with OPTODES.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))

    optodes = []
    for row in rows:
        x, y, z = (float(row[f"template_{axis}"]) for axis in "xyz")
        optodes.append(
            {
                "id": row["name"],
                "type": row["type"],
                "mni": [round(x, 3), round(y, 3), round(z, 3)],
                "x": round(50 + x / 2.2, 2),
                "y": round(8 + (89.3 - y) / 2.5, 2),
            }
        )
    return optodes


def region_for_channel(x: float, y: float, z: float) -> str:
    """Broad cortical approximation from the channel midpoint in MNI space.

    The sidecar specifies a coordinate template, not a parcellation. These labels
    intentionally stay broad until authoritative fOLD output is available.
    """
    side = "Left" if x < -8 else "Right" if x > 8 else "Medial"
    lateral = abs(x)

    if y > 63:
        area = "frontal pole"
    elif y > 30:
        area = "superior frontal gyrus" if z > 55 else "middle frontal gyrus"
    elif y > 2:
        area = "precentral gyrus" if z > 55 else "inferior frontal gyrus"
    elif y > -32:
        if lateral > 62 and z < 48:
            area = "superior temporal gyrus"
        else:
            area = "postcentral gyrus" if y < -12 else "precentral gyrus"
    elif y > -70:
        area = "superior parietal lobule" if z > 58 else "middle temporal gyrus"
    elif z > 60:
        area = "superior occipital gyrus"
    else:
        area = "middle occipital gyrus"
    return f"{side} {area}"


def normalized(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    center = np.nanmedian(values)
    scale = np.nanpercentile(np.abs(values - center), 95)
    if not np.isfinite(scale) or scale == 0:
        scale = 1.0
    return np.clip((values - center) / scale, -1.4, 1.4)


def interpolate(group: h5py.Group, target_time: np.ndarray) -> np.ndarray:
    time = np.asarray(group["time"][:], dtype=float)
    values = np.asarray(group["dataTimeSeries"][:], dtype=float).reshape(-1)
    return np.interp(target_time, time, values)


def read_snirf(optodes: list[dict]) -> tuple[list[dict], dict]:
    numeric_id = lambda item: int(item["id"][1:])
    sources = sorted((item for item in optodes if item["type"] == "source"), key=numeric_id)
    detectors = sorted((item for item in optodes if item["type"] == "detector"), key=numeric_id)

    with h5py.File(SNIRF, "r") as file:
        nirs = file["nirs"]
        data = nirs["data1"]
        landmark_labels = [label.decode("utf-8") for label in nirs["probe"]["landmarkLabels"][:]]
        landmark_positions = np.asarray(nirs["probe"]["landmarkPos3D"][:, :3], dtype=float)

        for optode in optodes:
            distances = np.linalg.norm(landmark_positions - np.asarray(optode["mni"]), axis=1)
            optode["position"] = landmark_labels[int(np.argmin(distances))]
        measurements = sorted(
            (name for name in data if name.startswith("measurementList")),
            key=lambda name: int(name.replace("measurementList", "", 1)),
        )

        channels = []
        column_by_pair_and_label = {}
        for column, name in enumerate(measurements):
            measurement = data[name]
            source_index = int(scalar(measurement, "sourceIndex")) - 1
            detector_index = int(scalar(measurement, "detectorIndex")) - 1
            label = str(scalar(measurement, "dataTypeLabel"))
            pair = (source_index, detector_index)
            column_by_pair_and_label[(pair, label)] = column

            if label != "HbO":
                continue
            source = sources[source_index]
            detector = detectors[detector_index]
            source_mni = np.asarray(source["mni"])
            detector_mni = np.asarray(detector["mni"])
            midpoint = (source_mni + detector_mni) / 2
            distance = float(np.linalg.norm(source_mni - detector_mni))
            channel_type = "short" if distance < 15 else "long"
            channels.append(
                {
                    "id": f"Ch-{len(channels) + 1:03d}",
                    "source": source["id"],
                    "detector": detector["id"],
                    "type": channel_type,
                    "distance": round(distance, 1),
                    "x": round((source["x"] + detector["x"]) / 2, 2),
                    "y": round((source["y"] + detector["y"]) / 2, 2),
                    "mni": [round(float(value), 1) for value in midpoint],
                    "region": region_for_channel(*midpoint),
                    "pair": pair,
                }
            )

        short = [channel for channel in channels if channel["type"] == "short"]
        # Figure 6 of the preprint highlights S10-D7 as the strongest motor-action response.
        long_channel = next(channel for channel in channels if channel["source"] == "S10" and channel["detector"] == "D7")
        short_channel = min(short, key=lambda item: np.linalg.norm(np.asarray(item["mni"]) - np.asarray(long_channel["mni"])))

        nirs_time = np.asarray(data["time"][:], dtype=float)
        events = np.asarray(nirs["stim1"]["data"][:], dtype=float)
        event_onset = float(events[0, 0])
        event_duration = float(events[0, 1])
        start, end = event_onset - 10, event_onset + event_duration + 20
        sample_time = np.linspace(start, end, 280)

        nirs_values = np.asarray(data["dataTimeSeries"][:], dtype=float)
        long_hbo_column = column_by_pair_and_label[(tuple(long_channel["pair"]), "HbO")]
        long_hbr_column = column_by_pair_and_label[(tuple(long_channel["pair"]), "HbR")]
        short_hbo_column = column_by_pair_and_label[(tuple(short_channel["pair"]), "HbO")]
        short_hbr_column = column_by_pair_and_label[(tuple(short_channel["pair"]), "HbR")]
        long_hbo = np.interp(sample_time, nirs_time, nirs_values[:, long_hbo_column])
        long_hbr = np.interp(sample_time, nirs_time, nirs_values[:, long_hbr_column])
        short_hbo = np.interp(sample_time, nirs_time, nirs_values[:, short_hbo_column])
        short_hbr = np.interp(sample_time, nirs_time, nirs_values[:, short_hbr_column])

        aux_by_name = {}
        for name in nirs:
            if name.startswith("aux"):
                group = nirs[name]
                aux_by_name[str(scalar(group, "name"))] = group

        trace_sources = [
            ("hbo", f"{long_channel['id']} · HbO", "z", long_hbo),
            ("hbr", f"{long_channel['id']} · HbR", "z", long_hbr),
            ("shortHbo", f"Short {short_channel['id']} · HbO", "z", short_hbo),
            ("shortHbr", f"Short {short_channel['id']} · HbR", "z", short_hbr),
            ("ppg", "PPG", "ADU", interpolate(aux_by_name["PPG"], sample_time)),
            ("resp", "Respiration", "Ohm", interpolate(aux_by_name["Respiration"], sample_time)),
            ("ecg", "ECG", "V", interpolate(aux_by_name["ECG"], sample_time)),
            ("emg", "Hand EMG", "V", interpolate(aux_by_name["ExGa1"], sample_time)),
            ("gsr", "Skin conductance", "S", interpolate(aux_by_name["GSR"], sample_time)),
            ("hr", "Heart rate", "1/min", interpolate(aux_by_name["Heartrate"], sample_time)),
            ("spo2", "Oxygen saturation", "%", interpolate(aux_by_name["SpO2"], sample_time)),
            ("temp", "Room temperature", "°C", interpolate(aux_by_name["Temperature"], sample_time)),
        ]

        signal = {
            "task": "motorAction",
            "participant": "sub-01",
            "channel": {
                "id": long_channel["id"],
                "source": long_channel["source"],
                "detector": long_channel["detector"],
                "sourcePosition": next(item["position"] for item in optodes if item["id"] == long_channel["source"]),
                "detectorPosition": next(item["position"] for item in optodes if item["id"] == long_channel["detector"]),
            },
            "shortChannel": {
                "id": short_channel["id"],
                "source": short_channel["source"],
                "detector": short_channel["detector"],
                "sourcePosition": next(item["position"] for item in optodes if item["id"] == short_channel["source"]),
                "detectorPosition": next(item["position"] for item in optodes if item["id"] == short_channel["detector"]),
            },
            "eventOnset": 0,
            "eventDuration": round(event_duration, 1),
            "time": [round(float(value - event_onset), 3) for value in sample_time],
            "traces": [
                {
                    "key": key,
                    "label": label,
                    "unit": unit,
                    "values": [round(float(value), 4) for value in normalized(values)],
                }
                for key, label, unit, values in trace_sources
            ],
        }

    for channel in channels:
        del channel["pair"]
    return channels, signal


def read_qc() -> list[dict]:
    measures = ["resp", "hr", "ppg", "ecg", "emg", "gsr"]
    grouped: dict[str, list[dict]] = {}
    with QC.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            grouped.setdefault(row["sub"], []).append(row)

    summaries = []
    for participant, rows in sorted(grouped.items()):
        rates = {
            measure: round(100 * sum(int(row[measure]) for row in rows) / len(rows))
            for measure in measures
        }
        all_checks = [int(row[measure]) for row in rows for measure in measures]
        summaries.append(
            {
                "id": participant,
                "runs": len(rows),
                "overall": round(100 * sum(all_checks) / len(all_checks)),
                "runDetails": [
                    {
                        "task": row["task"],
                        **{measure: bool(int(row[measure])) for measure in measures},
                    }
                    for row in rows
                ],
                **rates,
            }
        )
    return summaries


def main() -> None:
    optodes = read_optodes()
    channels, signal = read_snirf(optodes)
    payload = {
        "coordinateSystem": "MNI152NLin2009aSym",
        "optodes": optodes,
        "channels": channels,
        "motorExample": signal,
        "physiologyQc": read_qc(),
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        f"Wrote {OUTPUT.name}: {len(optodes)} optodes, {len(channels)} channels, "
        f"{len(payload['physiologyQc'])} participant QC summaries."
    )


if __name__ == "__main__":
    main()
