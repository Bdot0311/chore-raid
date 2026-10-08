"""Cuts one ElevenLabs batch recording (lines separated by long pauses) into
one clip per line, named by clip key, into public/voice.

  python tools/split_batch.py batch.mp3 key1 key2 ... [--lens n1 n2 ...]
Fails (writing nothing) unless it finds one pause per gap, and, when text
lengths are given, every piece's duration fits its text.
"""

import re
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "voice"


def silences(path: str, min_len: float):
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=noise=-40dB:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", r.stderr)]
    return list(zip(starts, ends))


def duration(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout)


def plausible(gaps, total, lens):
    """Each piece's share of the audio should roughly match its share of the text."""
    if not lens:
        return True
    edges = [0.0] + [(a + b) / 2 for a, b in gaps] + [total]
    durs = [edges[i + 1] - edges[i] for i in range(len(lens))]
    secs_per_char = sum(durs) / sum(lens)
    return all(0.5 < d / (n * secs_per_char) < 1.8 for d, n in zip(durs, lens))


def main():
    args = sys.argv[1:]
    lens = []
    if "--lens" in args:
        i = args.index("--lens")
        lens = [int(x) for x in args[i + 1 :]]
        args = args[:i]
    src, keys = args[0], args[1:]
    total = duration(src)
    gaps = []
    # The longest pauses are the line breaks; try a few thresholds.
    for d in (0.9, 0.75, 0.6, 1.05, 0.5, 0.4, 0.33):
        found = silences(src, d)
        if len(found) >= len(keys) - 1:
            found = sorted(sorted(found, key=lambda s: s[1] - s[0], reverse=True)[: len(keys) - 1])
            if len(found) == len(keys) - 1 and plausible(found, total, lens):
                gaps = found
                break
    if len(gaps) != len(keys) - 1:
        sys.exit(f"FAIL {src}: wanted {len(keys) - 1} pauses")
    cuts = [0.0] + [(a + b) / 2 for a, b in gaps] + [None]
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08"
    for i, key in enumerate(keys):
        args = ["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ss", f"{cuts[i]:.3f}"]
        if cuts[i + 1] is not None:
            args += ["-to", f"{cuts[i + 1]:.3f}"]
        args += ["-af", trim, "-ac", "1", "-ar", "44100", "-b:a", "64k", str(OUT / f"{key}.mp3")]
        subprocess.run(args, check=True)
    print(f"ok {src}: {len(keys)} clips")


if __name__ == "__main__":
    main()
