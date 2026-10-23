#!/usr/bin/env python3
"""Build public/assets/words-v1.js from SCOWL (npm package wordlist-english 1.2.1).

    npm pack wordlist-english@1.2.1 && tar xzf wordlist-english-1.2.1.tgz
    python3 -I scripts/build-words.py package/

The output is FROZEN: the word games pick each day's puzzle from these lists, so
rebuilding it would change every past puzzle. Make a words-v2.js with a cutover date
instead of editing v1.

Tiers (SCOWL size levels, English + American spellings, lowercase a-z only):
  common = 10, 20      everyday words: Word answers, Hive pangrams, Box seed words
  mid    = 35          also counts toward Hive's answer list
  extra  = 40, 50      accepted as guesses / Box words, never required
"""
import json
import re
import sys
from pathlib import Path

# Kept out of every list, so no puzzle asks for or accepts them.
BLOCK = set("""
anal anus arse arses ass asses bastard bastards bitch bitches bitchy boob boobs bugger
butt butts clit cock cocks coon coons crap crappy cunt cunts damn damned dick dicks
dildo dyke dykes fag fags faggot fart farts fuck fucked fucker fucking fucks gook gooks
homo hooker horny jap japs jerkoff kike kikes negro nigga nigger niggers nazi nazis
orgasm penis pimp piss pissed porn porno prick pricks pube pubes pussy queer rape raped
rapes rapist retard retarded scrotum semen sexy shit shits shitty slut sluts smut spic
spics tit tits titty turd twat vagina wank wanker whore whores wop wops
""".split())


def level(pkg, n):
    words = set()
    for prefix in ("english", "american"):
        words |= set(json.loads((pkg / f"{prefix}-words-{n}.json").read_text()))
    return {w for w in words if re.fullmatch(r"[a-z]{3,15}", w) and w not in BLOCK}


def main():
    pkg = Path(sys.argv[1])
    common = level(pkg, 10) | level(pkg, 20)
    mid = level(pkg, 35) - common
    extra = (level(pkg, 40) | level(pkg, 50)) - common - mid
    out = Path(__file__).resolve().parent.parent / "public/assets/words-v1.js"
    data = {k: " ".join(sorted(v)) for k, v in (("common", common), ("mid", mid), ("extra", extra))}
    out.write_text(
        "// Mint Puzzles word list v1, built from SCOWL (c) Kevin Atkinson, see /assets/scowl-copyright.txt.\n"
        "// FROZEN: past Word, Hive and Box puzzles depend on it. Build words-v2.js instead of editing.\n"
        f"(function (root) {{ root.MintWords = {json.dumps(data)}; }})(typeof window !== \"undefined\" ? window : globalThis);\n"
    )
    (out.parent / "scowl-copyright.txt").write_text((pkg / "Copyright").read_text())
    print(out, out.stat().st_size, {k: len(v) for k, v in (("common", common), ("mid", mid), ("extra", extra))})


main()
