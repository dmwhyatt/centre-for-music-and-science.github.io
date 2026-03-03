#!/usr/bin/env python3
"""
Generate a spectral data JSON file from an audio file for the 3D hero visualisation.

Usage:
    python generate_spectrogram.py <audio_file> [--output ../static/data/spectral_data.json]

Requires: librosa, numpy
"""

import argparse
import json
import gzip
import sys
from pathlib import Path

import librosa
import numpy as np


def generate_spectrogram(audio_path: str, output_path: str, target_fps: int = 30, n_mels: int = 128):
    print(f"Loading audio: {audio_path}")
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"  Sample rate: {sr}, Duration: {duration:.1f}s")

    hop_length = int(sr / target_fps)
    print(f"  Hop length: {hop_length} (targeting {target_fps} fps)")

    print("Computing mel spectrogram...")
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels, hop_length=hop_length, fmax=sr / 2)
    S_db = librosa.power_to_db(S, ref=np.max)

    s_min = S_db.min()
    s_max = S_db.max()
    S_norm = (S_db - s_min) / (s_max - s_min)

    actual_fps = sr / hop_length
    n_frames = S_norm.shape[1]
    print(f"  Mel bands: {n_mels}, Frames: {n_frames}, Actual FPS: {actual_fps:.2f}")

    mel_freqs = librosa.mel_frequencies(n_mels=n_mels, fmax=sr / 2).tolist()

    # Quantise to 2 decimal places to reduce file size
    frames = np.round(S_norm, 2).T.tolist()  # [time_steps x freq_bins]

    payload = {
        "fps": round(actual_fps, 4),
        "duration": round(duration, 4),
        "nMels": n_mels,
        "nFrames": n_frames,
        "freqLabels": [round(f, 1) for f in mel_freqs],
        "frames": frames,
    }

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing JSON to {out} ...")
    with open(out, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"  Output size: {size_mb:.2f} MB")

    # Also write a gzipped version for smaller transfer
    gz_path = out.with_suffix(".json.gz")
    with gzip.open(gz_path, "wt") as f:
        json.dump(payload, f, separators=(",", ":"))
    gz_mb = gz_path.stat().st_size / (1024 * 1024)
    print(f"  Gzipped size: {gz_mb:.2f} MB")

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate spectrogram JSON from audio")
    parser.add_argument("audio_file", help="Path to audio file (MP3, WAV, etc.)")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent.parent / "static" / "data" / "spectral_data.json"),
        help="Output JSON path",
    )
    parser.add_argument("--fps", type=int, default=30, help="Target frames per second")
    parser.add_argument("--n-mels", type=int, default=128, help="Number of mel bands")
    args = parser.parse_args()

    generate_spectrogram(args.audio_file, args.output, args.fps, args.n_mels)
