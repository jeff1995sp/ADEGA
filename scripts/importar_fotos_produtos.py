#!/usr/bin/env python3
"""Importa referencias de produtos conferidas visualmente. Não altera estoque, preços ou pedidos."""
import csv, io, json, pathlib, re, urllib.request, concurrent.futures
from PIL import Image, ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'scripts/fotos-produtos-referencia.json').read_text(encoding='utf-8'))
def fetch(row):
    ident,slug,url,note=row
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; catalog-photo-import/1.0)','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw=resp.read(12000001)
        if not 1000<len(raw)<=12000000: raise ValueError('arquivo vazio ou excessivo')
        with Image.open(io.BytesIO(raw)) as im:
            if min(im.size)<90: raise ValueError('imagem pequena')
            im=ImageOps.exif_transpose(im).convert('RGBA')
            bg=Image.new('RGBA',im.size,'#f8f8f8');bg.alpha_composite(im);im=bg.convert('RGB')
            im.thumbnail((900,900),Image.Resampling.LANCZOS)
            out=io.BytesIO();im.save(out,'WEBP',quality=86,method=4)
        return row,out.getvalue(),None
    except Exception as e:
        return row,None,str(e)
def main():
    shared=ROOT/'public/js/shared.js'
    code=shared.read_text(encoding='utf-8')
    alias_pattern=r'const PHOTO_ALIAS=(\{[^\n]*\});'
    ill_pattern=r'export const ILLUSTRATIVE_LOCAL_PATHS=new Set\((\[[\s\S]*?\])\);'
    aliases=json.loads(re.search(alias_pattern,code).group(1))
    ill=json.loads(re.search(ill_pattern,code).group(1))
    preview=ROOT/'public/catalogo-previa.json'
    catalog=json.loads(preview.read_text(encoding='utf-8'))
    applied=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for row,binary,error in pool.map(fetch,DATA):
            ident,slug,url,note=row
            if error:
                print('NAO BAIXADA:',slug,error,flush=True);continue
            path='/imagens/'+slug+'.webp'
            (ROOT/'public'/path.lstrip('/')).write_bytes(binary)
            aliases[ident]=path
            if path not in ill: ill.append(path)
            for p in catalog['products']:
                if p['id']==ident and (not p.get('image_url') or p['image_url']=='/imagens/foto-pendente.webp'):
                    p['image_url']=path
            applied.append((ident,path,url,note))
            print('SALVA:',slug,len(binary),flush=True)
    if not applied: raise RuntimeError('Nenhuma foto foi obtida; arquivos existentes preservados.')
    code=re.sub(alias_pattern,lambda m:'const PHOTO_ALIAS='+json.dumps(aliases,ensure_ascii=False,separators=(',',':'))+';',code,count=1)
    code=re.sub(ill_pattern,lambda m:'export const ILLUSTRATIVE_LOCAL_PATHS=new Set('+json.dumps(ill,ensure_ascii=False)+');',code,count=1)
    shared.write_text(code,encoding='utf-8')
    preview.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    inventory=ROOT/'FOTOS-REFERENCIAS-WEB.csv'
    previous=[]
    if inventory.exists():
        with inventory.open('r',encoding='utf-8-sig',newline='') as f: previous=list(csv.reader(f,delimiter=';'))[1:]
    ids={r[0] for r in applied}
    with inventory.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f,delimiter=';');w.writerow(['id','arquivo','fonte','observacao']);w.writerows([r for r in previous if r and r[0] not in ids]+applied)
    pending=[p['name'] for p in catalog['products'] if p.get('image_url')=='/imagens/foto-pendente.webp' and p['id'] not in aliases]
    print('Fotos obtidas:',len(applied),'de',len(DATA),'Pendentes no catalogo:',pending,flush=True)
if __name__=='__main__':main()
