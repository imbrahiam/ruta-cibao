"""Merge council score files into one table: screen x mode x platform -> min(judges).

Usage: python3 scripts/design/ui-scores.py <round-dir> [<round-dir> ...]
Prints one row per screen/mode/platform for the last round and, when two rounds are
given, the delta from the first. The screen's council score is the lowest judge's score,
so a single strict reviewer is enough to fail it.
"""

import json
import pathlib
import sys


def load(round_dir: pathlib.Path) -> dict[tuple[str, str, str], int]:
    scores: dict[tuple[str, str, str], int] = {}
    files = sorted(round_dir.glob("score-*.json"))
    if not files:
        sys.exit(f"no score-*.json in {round_dir}")
    for path in files:
        for entry in json.loads(path.read_text()):
            for platform in ("ios", "android"):
                if platform not in entry:
                    continue
                key = (entry["screen"], entry["mode"], platform)
                value = int(entry[platform]["score"])
                scores[key] = min(scores.get(key, 10), value)
    return scores


def main() -> None:
    rounds = [pathlib.Path(arg) for arg in sys.argv[1:]]
    if not rounds:
        sys.exit(__doc__)
    first, last = load(rounds[0]), load(rounds[-1])
    for key in sorted(last, key=lambda k: (last[k], k)):
        delta = f"{last[key] - first[key]:+d}" if len(rounds) > 1 and key in first else ""
        print(f"{last[key]:>2} {delta:>3}  {key[0]:<17} {key[1]:<5} {key[2]}")
    values = list(last.values())
    print(f"min={min(values)} mean={sum(values) / len(values):.2f} passing={sum(v >= 9 for v in values)}/{len(values)}")


if __name__ == "__main__":
    main()
