#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ELYRA OCR runner 1.4 — stdin JSON {tool, args} → stdout JSON"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path


def out(ok: bool, result: str, **extra):
    sys.stdout.write(json.dumps({"ok": ok, "result": str(result)[:6000], **extra}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def tool_ocr_image(args: dict):
    path = Path(str(args.get("path") or ""))
    if not path.exists():
        return out(False, f"No existe {path}")
    lang = args.get("lang") or "spa+eng"
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        return out(
            False,
            "Falta OCR local. Instala: pip install pillow pytesseract  y el binario Tesseract (idioma spa).",
        )
    try:
        img = Image.open(str(path))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        text = pytesseract.image_to_string(img, lang=lang)
        text = " ".join((text or "").split())
        if not text:
            # fallback eng only
            try:
                text = pytesseract.image_to_string(img, lang="eng")
                text = " ".join((text or "").split())
            except Exception:
                pass
        if not text:
            return out(False, "OCR no detectó texto legible en la imagen.")
        return out(True, f"OCR {path.name}:\n{text[:5000]}")
    except Exception as e:
        msg = str(e)
        if "tesseract" in msg.lower():
            return out(
                False,
                "Tesseract no está instalado en el sistema. Windows: UB Mannheim Tesseract. Linux: apt install tesseract-ocr tesseract-ocr-spa",
            )
        return out(False, f"Error OCR: {msg}")


def tool_ocr_pdf(args: dict):
    path = Path(str(args.get("path") or ""))
    if not path.exists():
        return out(False, f"No existe {path}")
    max_pages = int(args.get("max_pages") or 5)
    max_pages = max(1, min(max_pages, 15))
    lang = args.get("lang") or "spa+eng"
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        return out(False, "Falta pillow/pytesseract. pip install pillow pytesseract")

    # Intentar renderizar páginas: pypdfium2 o pdf2image; si no, mensaje
    images = []
    try:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(str(path))
        n = len(doc)
        for i in range(min(n, max_pages)):
            page = doc[i]
            bitmap = page.render(scale=2)
            pil = bitmap.to_pil()
            images.append(pil)
    except Exception:
        try:
            from pdf2image import convert_from_path

            images = convert_from_path(str(path), dpi=200, first_page=1, last_page=max_pages)
        except Exception as e:
            return out(
                False,
                "No pude renderizar el PDF para OCR. Instala pypdfium2 (pip install pypdfium2) "
                "o pdf2image+poppler. Detalle: "
                + str(e)[:200],
            )

    if not images:
        return out(False, "PDF sin páginas renderizables")

    chunks = []
    for i, img in enumerate(images):
        try:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            t = pytesseract.image_to_string(img, lang=lang)
            t = " ".join((t or "").split())
            if t:
                chunks.append(f"[Página {i + 1}] {t}")
        except Exception as e:
            chunks.append(f"[Página {i + 1}] error: {e}")

    if not chunks:
        return out(False, "OCR no extrajo texto del PDF escaneado.")
    body = "\n".join(chunks)
    return out(True, f"OCR PDF {path.name} ({len(images)} págs):\n{body[:5500]}")


TOOLS = {"ocr_image": tool_ocr_image, "ocr_pdf": tool_ocr_pdf}


def main():
    try:
        data = json.loads(sys.stdin.read())
        fn = TOOLS.get(data.get("tool"))
        if not fn:
            return out(False, "tool OCR desconocida")
        return fn(data.get("args") or {})
    except Exception:
        return out(False, traceback.format_exc()[-1200:])


if __name__ == "__main__":
    main()
