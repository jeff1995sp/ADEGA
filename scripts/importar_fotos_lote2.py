#!/usr/bin/env python3
"""Salva fotografias de referência licenciadas na pasta local sem substituir imagens próprias."""
import csv, io, json, pathlib, re, time, urllib.request
from PIL import Image, ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1]
IMGS=ROOT/"public"/"imagens"
SRC=json.loads((ROOT/"scripts"/"fotos_lote2.json").read_text(encoding="utf-8"))
def fetch(item):
    req=urllib.request.Request(item["url"],headers={"User-Agent":"AdegaDigitalPhotoImporter/2.0 (github.com/jeff1995sp/ADEGA; Unsplash License)","Accept":"image/jpeg,image/webp,image/*"})
    last=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=30) as rsp:
                if not rsp.headers.get("Content-Type","").startswith("image/"): raise ValueError("Resposta nao e imagem")
                raw=rsp.read(10000001)
                if not 10000<len(raw)<10000000: raise ValueError("Tamanho incorreto")
            with Image.open(io.BytesIO(raw)) as src:
                if min(src.size)<600: raise ValueError("Resolucao insuficiente")
                im=ImageOps.exif_transpose(src).convert("RGB")
                im.thumbnail((1200,1500),Image.Resampling.LANCZOS)
                out=io.BytesIO()
                im.save(out,"WEBP",quality=86,method=6)
                if len(out.getvalue())<10000: raise ValueError("WebP muito pequeno")
                return out.getvalue()
        except Exception as e:
            last=e; time.sleep(1+attempt)
    raise RuntimeError(str(last))
def main():
    shared_path=ROOT/"public"/"js"/"shared.js"
    shared=shared_path.read_text(encoding="utf-8")
    pattern=r"export const LICENSED_LOCAL_PATHS=new Set\((\[[\s\S]*?\])\);"
    match=re.search(pattern,shared)
    if not match: raise RuntimeError("Lista de fotos licenciadas nao encontrada")
    licensed=json.loads(match.group(1))
    inv=ROOT/"FOTOS-POR-PRODUTO.csv"
    with inv.open("r",encoding="utf-8-sig",newline="") as file: rows=list(csv.reader(file,delimiter=";"))
    new={}
    for item in SRC:
        path=item["path"]
        if path in licensed:
            print("Mantida: "+path); continue
        flag='  "'+path+'",\n'
        if flag not in shared:
            print("Nao eh pendente, nao altera: "+path);continue
        row=[r for r in rows[1:] if len(r)>=4 and r[1]==path]
        if len(row)!=1:
            print("Inventario ambiguo: "+path);continue
        try:
            contents=fetch(item)
            new[path]=contents
            row[0][2]="Fotografia real licenciada"
            row[0][3]=item["note"]+"; Unsplash License; "+item["page"]+"; "+item["author"]
            licensed.append(path)
            shared=shared.replace(flag,"",1)
            print("Aprovado: "+path+" "+str(len(contents))+" bytes")
        except Exception as exc:
            print("FOTO PENDENTE: "+path+" "+str(exc))
    if not new:
        print("Nenhuma fotografia nova aprovada")
        return
    for path,data in new.items(): (IMGS/pathlib.Path(path).name).write_bytes(data)
    shared=re.sub(pattern,"export const LICENSED_LOCAL_PATHS=new Set("+json.dumps(licensed,ensure_ascii=False)+");",shared,count=1)
    shared_path.write_text(shared,encoding="utf-8")
    with inv.open("w",encoding="utf-8-sig",newline="") as file:
        csv.writer(file,delimiter=";",lineterminator="\n").writerows(rows)
    print("TOTAL FOTOGRAFIAS NOVAS: "+str(len(new)))
if __name__=="__main__":main()
