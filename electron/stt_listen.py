#!/usr/bin/env python3
"""
ELYRA STT helper — graba desde el micrófono y transcribe con Groq Whisper.
Uso: python stt_listen.py <api_key> [segundos=5]
Imprime JSON: {"ok": true, "text": "..."} o {"ok": false, "error": "..."}
"""
import json
import sys
import tempfile
import wave
import os

def fail(msg):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(0)

def main():
    if len(sys.argv) < 2:
        fail("Falta API key")
    api_key = sys.argv[1].strip()
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
    seconds = max(2.0, min(seconds, 12.0))

    try:
        import sounddevice as sd
        import numpy as np
    except ImportError:
        fail("Instala dependencias: pip install sounddevice numpy")

    try:
        import urllib.request
    except ImportError:
        fail("urllib no disponible")

    sample_rate = 16000
    channels = 1

    try:
        audio = sd.rec(
            int(seconds * sample_rate),
            samplerate=sample_rate,
            channels=channels,
            dtype="int16",
        )
        sd.wait()
    except Exception as e:
        fail(f"No pude grabar el micrófono: {e}")

    # RMS simple: si casi silencio, avisar
    rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))
    if rms < 30:
        fail("No detecté voz. Habla más cerca del micrófono.")

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        with wave.open(tmp_path, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(audio.tobytes())

        boundary = "----elyraBoundary7MA4YWxkTrZu0gW"
        with open(tmp_path, "rb") as f:
            file_data = f.read()

        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
            f"Content-Type: audio/wav\r\n\r\n"
        ).encode("utf-8") + file_data + (
            f"\r\n--{boundary}\r\n"
            f'Content-Disposition: form-data; name="model"\r\n\r\n'
            f"whisper-large-v3\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="language"\r\n\r\n'
            f"es\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="response_format"\r\n\r\n'
            f"json\r\n"
            f"--{boundary}--\r\n"
        ).encode("utf-8")

        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = (data.get("text") or "").strip()
            if not text:
                fail("No entendí lo que dijiste.")
            print(json.dumps({"ok": True, "text": text}, ensure_ascii=False))
    except Exception as e:
        fail(str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

if __name__ == "__main__":
    main()
