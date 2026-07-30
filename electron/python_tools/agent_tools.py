#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ELYRA agent_tools — productividad nativa (pandas, docx, pptx, pdf).
Entrada: JSON por stdin {"tool": "...", "args": {...}}
Salida: una línea JSON {"ok": bool, "result": str, "path": optional}
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path


def out(ok: bool, result: str, **extra):
    payload = {"ok": ok, "result": result[:4000], **extra}
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def docs_root() -> Path:
    home = Path.home()
    d = home / "Documents"
    return d if d.exists() else home


def resolve_path(p: str) -> Path:
    if not p:
        return docs_root()
    path = Path(p)
    if path.is_absolute():
        return path
    return docs_root() / path


def tool_scan_folder(args: dict):
    root = resolve_path(args.get("root") or str(docs_root()))
    pattern = (args.get("pattern") or "*").lower()
    exts = args.get("extensions") or [".xlsx", ".xls", ".csv", ".pdf", ".docx", ".pptx", ".txt", ".md"]
    found = []
    if not root.exists():
        return out(False, f"No existe la carpeta {root}")
    for dirpath, _, files in os.walk(root):
        # limitar profundidad / ruido
        depth = Path(dirpath).relative_to(root).parts
        if len(depth) > 4:
            continue
        for name in files:
            low = name.lower()
            if pattern != "*" and pattern not in low:
                continue
            if any(low.endswith(e) for e in exts):
                full = str(Path(dirpath) / name)
                found.append(full)
            if len(found) >= 40:
                break
        if len(found) >= 40:
            break
    if not found:
        return out(True, f"Sin archivos coincidentes en {root}")
    return out(True, "Archivos:\n" + "\n".join(found[:40]))


def tool_analyze_excel(args: dict):
    try:
        import pandas as pd
    except ImportError:
        return out(False, "Falta pandas. pip install pandas openpyxl")

    path = resolve_path(args.get("path") or "")
    if not path.exists():
        return out(False, f"No existe {path}")
    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)
    except Exception as e:
        return out(False, f"Error leyendo Excel: {e}")

    summary_lines = [
        f"Archivo: {path.name}",
        f"Filas: {len(df)}, Columnas: {len(df.columns)}",
        f"Columnas: {', '.join(map(str, df.columns.tolist()[:30]))}",
    ]
    try:
        desc = df.describe(include="all").to_string()
        summary_lines.append("Estadísticas:\n" + desc[:2000])
    except Exception:
        pass
    summary_lines.append("Muestra (5 filas):\n" + df.head(5).to_string())

    # Export ejecutivo opcional
    export = args.get("export")
    export_path = None
    if export:
        out_dir = docs_root() / "Informes"
        out_dir.mkdir(parents=True, exist_ok=True)
        export_path = out_dir / f"analisis_{path.stem}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        with pd.ExcelWriter(export_path, engine="openpyxl") as writer:
            df.head(500).to_excel(writer, sheet_name="Datos", index=False)
            try:
                df.describe().to_excel(writer, sheet_name="Resumen")
            except Exception:
                pass
        summary_lines.append(f"Exportado: {export_path}")

    return out(True, "\n".join(summary_lines), path=str(export_path) if export_path else None)


def tool_summarize_pdf(args: dict):
    path = resolve_path(args.get("path") or "")
    if not path.exists():
        return out(False, f"No existe {path}")
    text = ""
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        for page in reader.pages[:30]:
            text += (page.extract_text() or "") + "\n"
    except Exception as e:
        return out(False, f"Error PDF (instala pypdf): {e}")

    text = " ".join(text.split())
    if not text:
        return out(False, "PDF sin texto extraíble (puede ser escaneado)")
    # Resumen extractivo simple (el LLM refinará)
    chunk = text[:3500]
    return out(True, f"Texto extraído de {path.name} ({len(text)} chars):\n{chunk}")


def tool_read_docx(args: dict):
    path = resolve_path(args.get("path") or "")
    if not path.exists():
        return out(False, f"No existe {path}")
    try:
        from docx import Document

        doc = Document(str(path))
        paras = [p.text for p in doc.paragraphs if p.text.strip()]
        body = "\n".join(paras)[:5000]
        return out(True, f"Documento {path.name}:\n{body}")
    except Exception as e:
        return out(False, f"Error docx: {e}. pip install python-docx")


def tool_write_docx(args: dict):
    try:
        from docx import Document
        from docx.shared import Pt
    except ImportError:
        return out(False, "Falta python-docx. pip install python-docx")

    title = args.get("title") or "Informe ELYRA"
    body = args.get("body") or args.get("content") or ""
    out_name = args.get("path") or f"Informes/informe_{datetime.now().strftime('%Y%m%d_%H%M')}.docx"
    path = resolve_path(out_name)
    path.parent.mkdir(parents=True, exist_ok=True)

    doc = Document()
    doc.add_heading(title, 0)
    doc.add_paragraph(f"Generado por ELYRA · {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    for block in str(body).split("\n"):
        block = block.strip()
        if not block:
            continue
        if block.startswith("# "):
            doc.add_heading(block[2:], level=1)
        elif block.startswith("## "):
            doc.add_heading(block[3:], level=2)
        elif block.startswith("- ") or block.startswith("• "):
            doc.add_paragraph(block.lstrip("-• "), style="List Bullet")
        else:
            p = doc.add_paragraph(block)
            for run in p.runs:
                run.font.size = Pt(11)
    doc.save(str(path))
    return out(True, f"Word creado: {path}", path=str(path))


def tool_write_pptx(args: dict):
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt
    except ImportError:
        return out(False, "Falta python-pptx. pip install python-pptx")

    title = args.get("title") or "Presentación ELYRA"
    slides_data = args.get("slides")  # lista de {title, bullets: []}
    if isinstance(slides_data, str):
        try:
            slides_data = json.loads(slides_data)
        except Exception:
            slides_data = [{"title": title, "bullets": [slides_data]}]
    if not slides_data:
        body = args.get("body") or "Contenido"
        slides_data = [{"title": title, "bullets": [b.strip() for b in body.split("\n") if b.strip()][:8]}]

    out_name = args.get("path") or f"Informes/presentacion_{datetime.now().strftime('%Y%m%d_%H%M')}.pptx"
    path = resolve_path(out_name)
    path.parent.mkdir(parents=True, exist_ok=True)

    prs = Presentation()
    # portada
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = title
    if slide.placeholders and len(slide.placeholders) > 1:
        try:
            slide.placeholders[1].text = f"ELYRA · {datetime.now().strftime('%Y-%m-%d')}"
        except Exception:
            pass

    for s in slides_data[:12]:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = str(s.get("title") or "Apartado")
        body = slide.shapes.placeholders[1].text_frame
        body.clear()
        bullets = s.get("bullets") or s.get("points") or []
        if isinstance(bullets, str):
            bullets = [bullets]
        for i, b in enumerate(bullets[:10]):
            p = body.paragraphs[0] if i == 0 else body.add_paragraph()
            p.text = str(b)
            p.level = 0
    prs.save(str(path))
    return out(True, f"PowerPoint creado: {path}", path=str(path))


def tool_html_dashboard(args: dict):
    title = args.get("title") or "Dashboard ELYRA"
    body = args.get("body") or args.get("html") or "<p>Sin datos</p>"
    out_name = args.get("path") or f"Informes/dashboard_{datetime.now().strftime('%Y%m%d_%H%M')}.html"
    path = resolve_path(out_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>{title}</title>
<style>
body{{font-family:Segoe UI,system-ui,sans-serif;margin:0;background:#0b1220;color:#e2e8f0}}
header{{padding:24px 32px;background:linear-gradient(135deg,#0ea5e9,#0369a1)}}
main{{padding:24px 32px;max-width:1100px;margin:0 auto}}
.card{{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:20px;margin-bottom:16px}}
h1{{margin:0;font-size:1.5rem}} h2{{color:#7dd3fc;font-size:1.1rem}}
table{{width:100%;border-collapse:collapse}} td,th{{border:1px solid #334155;padding:8px;text-align:left}}
</style></head>
<body><header><h1>{title}</h1><p>Generado por ELYRA · {datetime.now().isoformat(timespec='minutes')}</p></header>
<main class="card">{body}</main></body></html>"""
    path.write_text(html, encoding="utf-8")
    return out(True, f"Dashboard HTML: {path}", path=str(path))


TOOLS = {
    "scan_folder": tool_scan_folder,
    "analyze_excel": tool_analyze_excel,
    "summarize_pdf": tool_summarize_pdf,
    "read_docx": tool_read_docx,
    "write_docx": tool_write_docx,
    "write_pptx": tool_write_pptx,
    "html_dashboard": tool_html_dashboard,
}


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        tool = data.get("tool")
        args = data.get("args") or {}
        fn = TOOLS.get(tool)
        if not fn:
            return out(False, f"Herramienta desconocida: {tool}")
        return fn(args)
    except Exception:
        return out(False, traceback.format_exc()[-1500:])


if __name__ == "__main__":
    main()
