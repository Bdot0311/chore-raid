"""Records the narrator with ElevenLabs instead of Kokoro (same files, same keys).

Reads the API key from the ELEVENLABS_API_KEY environment variable; never pass
it on the command line. Resumable: clips already recorded with ElevenLabs are
listed in public/voice/elevenlabs.json and skipped on the next run.

  npx tsx tools/narration-lines.ts > /tmp/lines.json
  python tools/narrate_elevenlabs.py /tmp/lines.json --voice <voice id> [--model eleven_turbo_v2_5] [--dry-run]
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "voice"
DONE = OUT / "elevenlabs.json"
MANIFEST = ROOT / "src" / "audio" / "voiceManifest.json"


def speakable(text: str) -> str:
    # All-caps words are labels on screen ("BOSS:"); spoken, they are just words.
    text = re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).capitalize(), text)
    return text.replace(":", ",")


def synth(text: str, voice: str, model: str, key: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_64"
    body = json.dumps(
        {
            "text": text,
            "model_id": model,
            # Lower stability and some style: a more theatrical read.
            "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
        }
    ).encode()
    req = urllib.request.Request(url, data=body, headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"ElevenLabs error {e.code}: {e.read().decode(errors='replace')[:300]}")
    raise SystemExit("ElevenLabs kept failing; try again later")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines")
    ap.add_argument("--voice", required=True, help="ElevenLabs voice ID")
    ap.add_argument("--model", default="eleven_turbo_v2_5")
    ap.add_argument("--dry-run", action="store_true", help="Only count the characters this run would use")
    ap.add_argument("--limit", type=int, default=0, help="Record at most this many clips (for a test run)")
    args = ap.parse_args()

    lines = json.loads(Path(args.lines).read_text())
    done = set(json.loads(DONE.read_text())) if DONE.exists() else set()
    todo = [l for l in lines if l["key"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    chars = sum(len(speakable(l["text"])) for l in todo)
    print(f"{len(lines)} clips, {len(todo)} to record, {chars} characters")
    if args.dry_run:
        return

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY in the environment")
    OUT.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(todo):
        audio = synth(speakable(line["text"]), args.voice, args.model, key)
        (OUT / f"{line['key']}.mp3").write_bytes(audio)
        done.add(line["key"])
        DONE.write_text(json.dumps(sorted(done)) + "\n")
        if i % 25 == 0:
            print(f"  {i}/{len(todo)}: {line['text']}")

    keys = {l["key"] for l in lines}
    MANIFEST.write_text(json.dumps(sorted(keys)) + "\n")
    print("done")


if __name__ == "__main__":
    main()
