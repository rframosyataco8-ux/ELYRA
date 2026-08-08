#!/usr/bin/env python3
"""
ELYRA / LUNA TTS helper — síntesis neural natural (edge-tts).
Calibrado para perfil Luna: cálida, conversacional, no locutora.

Uso:
  python tts_speak.py --text "Hola" --out out.mp3
  python tts_speak.py --text "Hola" --out out.mp3 --voice es-MX-DaliaNeural --rate -10% --pitch +1Hz
"""
import argparse
import asyncio
import re
import sys


def clean(text: str) -> str:
    if not text:
        return ""
    t = text
    t = re.sub(r"```[\s\S]*?```", " ", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*\*?([^*]+)\*\*?", r"\1", t)
    t = re.sub(r"__?([^_]+)__?", r"\1", t)
    t = re.sub(r"^#+\s+", "", t, flags=re.M)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"^[-•*]\s+", "", t, flags=re.M)
    t = re.sub(r"https?://\S+", " un enlace ", t)
    t = re.sub(r"[A-Za-z]:\\[^\s\]\"']+", " la carpeta ", t)
    t = re.sub(r"[_|<>{}\[\]#~^]", " ", t)
    t = t.replace("&", " y ")
    t = re.sub(r"\bOK\b", "de acuerdo", t, flags=re.I)
    t = re.sub(r"\bPDF\b", "pe de efe", t)
    t = re.sub(r"\bAPI\b", "a pe i", t)
    t = re.sub(r"\bCPU\b", "procesador", t)
    t = re.sub(r"\bRAM\b", "memoria", t)
    t = re.sub(r"\b(\d+)\s*%", r"\1 por ciento", t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > 1400:
        t = t[:1400]
        last = t.rfind(".")
        if last > 500:
            t = t[: last + 1]
        else:
            t += "."
    return t


def humanize(text: str) -> str:
    t = clean(text)
    if not t:
        return ""
    t = re.sub(r"([.,;:!?])([A-Za-zÁÉÍÓÚáéíóúñÑ0-9])", r"\1 \2", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"\s+y\s+", ", y ", t, flags=re.I)
    t = re.sub(r",\s*,", ",", t)
    # Cortar frases largas antes de conectores (mejora prosodia)
    t = re.sub(
        r"([^.!?]{60,}?)\s+(y|pero|aunque|además|también|entonces|así que|porque|cuando)\s+",
        r"\1. \2 ",
        t,
        flags=re.I,
    )
    t = t.replace(";", ".")
    t = re.sub(r":\s*", ". ", t)
    t = re.sub(r"\s+", " ", t).strip()
    if t and not re.search(r"[.!?…]$", t):
        t += "."
    return t


def split_chunks(text: str, max_len: int = 150):
    """Chunks más cortos → mejor ritmo conversacional."""
    parts = re.split(r"(?<=[.!?])\s+", text)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return [text]
    groups = []
    buf = ""
    for p in parts:
        candidate = (buf + " " + p).strip() if buf else p
        if len(candidate) <= max_len:
            buf = candidate
        else:
            if buf:
                groups.append(buf)
            buf = p
    if buf:
        groups.append(buf)
    return groups or [text]


async def synthesize(text: str, out_path: str, voice: str, rate: str, pitch: str, volume: str):
    try:
        import edge_tts
    except ImportError:
        print("MISSING_EDGE_TTS", file=sys.stderr)
        sys.exit(2)

    spoken = humanize(text)
    if not spoken:
        print("EMPTY", file=sys.stderr)
        sys.exit(3)

    chunks = split_chunks(spoken)
    if len(chunks) == 1:
        communicate = edge_tts.Communicate(chunks[0], voice, rate=rate, pitch=pitch, volume=volume)
        await communicate.save(out_path)
        return

    import os
    import tempfile

    part_paths = []
    try:
        for i, chunk in enumerate(chunks):
            fd, part = tempfile.mkstemp(suffix=f"-{i}.mp3")
            os.close(fd)
            communicate = edge_tts.Communicate(chunk, voice, rate=rate, pitch=pitch, volume=volume)
            await communicate.save(part)
            part_paths.append(part)
        with open(out_path, "wb") as out:
            for p in part_paths:
                with open(p, "rb") as f:
                    out.write(f.read())
    finally:
        for p in part_paths:
            try:
                os.unlink(p)
            except OSError:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--voice", default="es-MX-DaliaNeural")
    parser.add_argument("--rate", default="-10%")
    parser.add_argument("--pitch", default="+1Hz")
    parser.add_argument("--volume", default="+0%")
    args = parser.parse_args()
    try:
        asyncio.run(
            synthesize(args.text, args.out, args.voice, args.rate, args.pitch, args.volume)
        )
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
