#!/usr/bin/env python3
"""Baixa imagens com licença de reutilização verificada para public/imagens/.
Roda apenas no GitHub Actions, nunca no navegador do cliente.
Imagens obtidas de fotos gratuitas do Unsplash (https://unsplash.com/license).
"""
import csv
import io
import os
import pathlib
import time
import urllib.request
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "imagens"
SRC = [
    {
        "name": "Heineken",
        "path": "/imagens/heineken.webp",
        "url": "https://unsplash.com/photos/7jwSErtrzpk/download?force=true&w=1200",
        "license": "Unsplash License",
        "page": "https://unsplash.com/photos/heineken-beer-bottle-7jwSErtrzpk",
    },
    {
        "name": "Caipirinha de Limão",
        "path": "/imagens/caipirinha-de-limao.webp",
        "url": "https://unsplash.com/photos/1-PGBJywxOk/download?force=true&w=1200",
        "license": "Unsplash License",
        "page": "https://unsplash.com/photos/clear-glass-mason-jar-filled-with-lemon-juice-1-PGBJywxOk",
    },
    {
        "name": "Caipirinha de Morango",
        "path": "/imagens/caipirinha-de-morango.webp",
        "url": "https://unsplash.com/photos/Z2b1d8y1oG8/download?force=true&w=1200",
        "license": "Unsplash License",
        "page": "https://unsplash.com/photos/strawberry-cocktail-Z2b1d8y1oG8",
    },
]


def fetch_jpeg(item):
    request = urllib.request.Request(
        item["url"],
        headers={"User-Agent": "AdegaDigitalPhotoImporter/1.0 (github.com/jeff1995sp/ADEGA; Unsplash licensed photographs)"},
    )
    last_error = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                if not response.headers.get("Content-Type", "").lower().startswith("image/"):
                    raise ValueError("Resposta nao e uma imagem")
                content = response.read(10 * 1024 * 1024 + 1)
                if len(content) > 10 * 1024 * 1024 or len(content) < 15000:
                    raise ValueError("Tamanho de imagem invalido")
                return content
        except Exception as exc:
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Falha ao obter foto de {item['name']}: {last_error}")


def main():
    generated = {}
    for item in SRC:
        raw = fetch_jpeg(item)
        with Image.open(io.BytesIO(raw)) as opened:
            if opened.width < 600 or opened.height < 600:
                raise ValueError(f"Resolucao pequena: {item['name']}")
            im = ImageOps.exif_transpose(opened)
            im.thumbnail((1200, 1400), Image.Resampling.LANCZOS)
            if im.mode != "RGB":
                im = im.convert("RGB")
            target = IMAGES / pathlib.Path(item["path"]).name
            output = io.BytesIO()
            im.save(output, format="WEBP", quality=86, method=6)
            binary = output.getvalue()
            if len(binary) < 10000:
                raise ValueError(f"Foto processada pequena demais: {item['name']}")
            generated[target] = binary
            print(f"Verificada: {item['name']} {im.width}x{im.height}, {len(binary)} bytes")
    # Só altera arquivos caso todas as fotos tenham sido baixadas e validadas.
    shared_path = ROOT / "public" / "js" / "shared.js"
    shared = shared_path.read_text(encoding="utf-8")
    for item in SRC:
        flag = '  "' + item['path'] + '",\n'
        if flag not in shared:
            raise ValueError(f"Imagem {item['path']} nao esta na lista de desenhos provisórios")
        shared = shared.replace(flag, "", 1)
    inventory = ROOT / "FOTOS-POR-PRODUTO.csv"
    with inventory.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.reader(file, delimiter=";"))
    for item in SRC:
        candidates = [r for r in rows[1:] if len(r) >= 4 and r[1] == item["path"]]
        if len(candidates) != 1:
            raise ValueError(f"Inventario ambiguo para {item['path']}")
        candidates[0][2] = "Fotografia real licenciada"
        candidates[0][3] = "Foto de referencia " + item["license"] + "; confirmar apresentacao do preparo na loja"
    for target, binary in generated.items():
        target.write_bytes(binary)
    shared_path.write_text(shared, encoding="utf-8")
    with inventory.open("w", encoding="utf-8-sig", newline="") as file:
        csv.writer(file, delimiter=";", lineterminator="\n").writerows(rows)
    print(f"{len(generated)} fotos reais gravadas dentro da pasta public/imagens/")


if __name__ == "__main__":
    main()
