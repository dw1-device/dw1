import base64
s=open('template.html').read()
DATA=open('data.json').read()
open('dw1.html','w').write(s.replace('/*DATA*/',DATA).replace("/*BUILD*/'offline'","'offline'"))
open('dw1_live.html','w').write(s.replace('/*DATA*/',DATA).replace("/*BUILD*/'offline'","'live'"))
open('app.js','w').write(s[s.index('<script>')+8:s.rindex('</script>')].replace('/*DATA*/','{}'))

import os, re as _re
def _js(t):
    out=[]
    for ch in t:
        o=ord(ch)
        if o<128: out.append(ch)
        elif o<=0xFFFF: out.append('\\u%04x'%o)
        else:
            o-=0x10000; out.append('\\u%04x\\u%04x'%(0xD800+(o>>10),0xDC00+(o&0x3FF)))
    return ''.join(out)
def _css(t): return ''.join(ch if ord(ch)<128 else '\\%x '%ord(ch) for ch in t)
def _html(t): return ''.join(ch if ord(ch)<128 else '&#x%x;'%ord(ch) for ch in t)
def standalone(src_file, out_file, desc):
    h=open(src_file).read(); i=h.index('</style>')+len('</style>')
    full=('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
          '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
          '<meta name="description" content="'+desc+'">\n'+h[:i]+'\n</head>\n<body>\n'+h[i:]+'\n</body>\n</html>\n')
    parts=_re.split(r'(<script>.*?</script>|<style>.*?</style>)',full,flags=_re.S)
    asc=''.join(_js(p) if p.startswith('<script>') else _css(p) if p.startswith('<style>') else _html(p) for p in parts)
    assert all(ord(c)<128 for c in asc)
    os.makedirs(os.path.dirname(out_file),exist_ok=True)
    open(out_file,'w',encoding='ascii').write(asc)
DESC='數碼暴龍世界（PS1）育成、進化、學招、地圖、繁榮度與鬥技場輔助工具。非官方愛好者工具。'
standalone('dw1_live.html','dist/index.html',DESC)          # 實時版（由 dw1_bridge.py 顯示）
standalone('dw1.html','dist/web/index.html',DESC)           # 網頁版（可放任何網站或直接開啟）
