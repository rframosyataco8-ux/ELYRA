# ELYRA OCR & Vision (1.4)

## OCR local (opcional)

```bash
pip install pillow pytesseract
```

Además instala **Tesseract** en el sistema:

- Windows: instalador desde https://github.com/UB-Mannheim/tesseract/wiki  
  (incluye spa si eliges idiomas)
- Linux: `sudo apt install tesseract-ocr tesseract-ocr-spa`

## Tools

| Tool | Uso |
|------|-----|
| `ocr_image` | Texto desde PNG/JPG |
| `ocr_pdf` | PDF escaneado (pocas páginas) |
| `extract_pdf_smart` | Nativo → si vacío, OCR |
| `analyze_image` | Visión multimodal (API) |
| `analyze_screenshot` | Captura + visión |

## IPC UI

- `elyra.pickAndAnalyzeImage(prompt?)` — diálogo de archivo + visión/OCR
- `elyra.analyzeImagePath(path, prompt?)`

## Sin Tesseract

ELYRA avisa y recomienda `analyze_image` con modelo multimodal.
