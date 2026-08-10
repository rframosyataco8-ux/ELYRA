# ELYRA Files & Data (0.7)

## Dependencias

```bash
pip install -r electron/python_tools/requirements.txt
```

Comprobar desde el agente o tool `health` (Python).

## Capacidades

| Tool | Uso |
|------|-----|
| analyze_excel | CSV/XLSX resumen + stats + export opcional a Informes |
| summarize_pdf | Extrae texto (no OCR de escaneados) |
| read_docx | Párrafos + tablas |
| write_docx / write_pptx / html_dashboard | Salida en Documentos/Informes |
| scan_folder / find_files | Localizar archivos |

## Rutas

ELYRA busca en: Documentos, Informes, Descargas, Escritorio.
Puedes pasar solo el nombre del archivo si está en esas carpetas.
