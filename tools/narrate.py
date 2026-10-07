"""Records the narrator: every sentence from tools/narration-lines.ts, one MP3 each.

Uses Kokoro (an open-weights TTS model) with a natural voice, so the game does
not depend on the device's built-in speech voice. Re-run after changing lines;
existing clips are kept and clips for removed lines are deleted.

  npx tsx tools/narration-lines.ts > /tmp/lines.json
  python tools/narrate.py /tmp/lines.json --model kokoro-v1.0.onnx --voices voices-v1.0.bin
"""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "voice"
MANIFEST = ROOT / "src" / "audio" / "voiceManifest.json"


def speakable(text: str) -> str:
    # All-caps words are labels on screen ("BOSS:"); spoken, they are just words.
    text = re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).capitalize(), text)
    return text.replace(":", ",")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines")
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    ap.add_argument("--voice", default="bm_george")
    ap.add_argument("--speed", type=float, default=0.92)
    args = ap.parse_args()

    lines = json.loads(Path(args.lines).read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(args.model, args.voices)
    keys = {l["key"] for l in lines}

    todo = [l for l in lines if not (OUT / f"{l['key']}.mp3").exists()]
    print(f"{len(lines)} sentences, {len(todo)} to record")
    with tempfile.TemporaryDirectory() as tmp:
        for i, line in enumerate(todo):
            samples, rate = kokoro.create(speakable(line["text"]), voice=args.voice, speed=args.speed, lang="en-us")
            wav = Path(tmp) / "line.wav"
            sf.write(wav, samples, rate)
            # Trim the silence at both ends, then encode small: mono speech at 40 kbps.
            trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-af", trim, "-ac", "1", "-b:a", "40k", str(OUT / f"{line['key']}.mp3")],
                check=True,
            )
            if i % 50 == 0:
                print(f"  {i}/{len(todo)}: {line['text']}")

    for stale in OUT.glob("*.mp3"):
        if stale.stem not in keys:
            stale.unlink()
    MANIFEST.write_text(json.dumps(sorted(keys)) + "\n")
    print("done")


if __name__ == "__main__":
    main()
