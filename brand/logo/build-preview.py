"""Build the standalone local review sheet; no web server required."""
from pathlib import Path
from html import escape
root=Path(__file__).resolve().parent

def image(file, width, caption=None):
    return f'<figure><a href="{file}"><img src="{file}" width="{width}" alt="{escape(caption or file)}"></a><figcaption>{escape(caption or file)}</figcaption></figure>'

def row(content):
    return '<div class="row">'+content+'</div>'

panels=[]
for dark in (False,True):
    body='<h2>'+('Fondo oscuro' if dark else 'Fondo claro')+'</h2>'
    body+='<p>Tamaño real · sin ampliación</p>'+row(''.join(image(f'mark-{n}.png',n,f'{n} px') for n in [16,32,48]))
    body+=row(''.join(image(f,48) for f in ['mark.svg','mark-ink.svg','mark-mono.svg','mark-white.svg','streets.svg','wordmark.svg']))
    body+=image('lockup-dark.svg' if dark else 'lockup.svg',540)
    body+='<h3>Exportaciones PNG</h3>'+row(''.join(image(f'mark-{n}.png',n if n<=192 else 128,f'mark-{n}.png · '+(str(n) if n<=192 else '128')+' px en pantalla') for n in [16,32,48,192,512,1024]))
    body+=image('lockup-2000w.png',540,'lockup-2000w.png · 540 px en pantalla')
    body+='<h3>iOS · 64 px en pantalla</h3>'+row(''.join(image('ios/'+f,64) for f in ['AppIcon-1024.png','AppIcon-1024-dark.png','AppIcon-1024-tinted.png']))
    body+='<h3>Android</h3>'+row(''.join(image(f,64,label) for f,label in [('android/foreground-preview.svg','ic_launcher_foreground.xml · 64 px'),('android/monochrome-preview.svg','ic_launcher_monochrome.xml · 64 px'),('android/play-store-512.png','Play Store · 64 px')])+image('android/notification-preview.svg',24,'ic_notification.xml · 24 px'))
    body+='<h3>Web</h3>'+row(image('web/icon.svg',32)+image('web/favicon-16.png',16)+image('web/favicon-32.png',32)+image('web/apple-icon.png',180))
    body+=image('web/og-1200x630.png',540,'OG · 540 × 283.5 px en pantalla')
    panels.append('<section class="'+('dark' if dark else 'light')+'">'+body+'</section>')

# Render XML path geometry into SVG for a browser; XML files themselves stay Android-native.
import re
for filename,out in [('ic_launcher_foreground.xml','foreground-preview.svg'),('ic_launcher_monochrome.xml','monochrome-preview.svg'),('ic_notification.xml','notification-preview.svg')]:
    xml=(root/'android'/filename).read_text()
    size=re.search(r'viewportWidth="([\d.]+)"',xml)[1]
    offset=re.search(r'translateX="([\d.]+)"',xml)[1]
    scale=re.search(r'scaleX="([\d.]+)"',xml)[1]
    paths=re.findall(r'android:pathData="([^"]+)"',xml)
    (root/'android'/out).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="Ruta Cibao"><defs><clipPath id="edge"><path d="{paths[0]}"/></clipPath></defs><g transform="translate({offset} {offset}) scale({scale})" clip-path="url(#edge)" fill="white"><path d="{paths[1]}"/></g></svg>')

html='''<!doctype html><html lang="es-DO"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ruta Cibao · Identidad</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;font:14px/1.4 system-ui,sans-serif;color:#0f1419;background:#eff3f4}h1{font-size:28px;margin:0}h2{font-size:22px;margin:0 0 16px}h3{font-size:15px;margin:28px 0 12px}p{margin:8px 0 20px}.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section{padding:28px;border-radius:16px;min-width:0}.light{background:white}.dark{background:#0f1419;color:white}.row{display:flex;align-items:center;gap:24px;flex-wrap:wrap}figure{margin:12px 0;max-width:100%}img{display:block;max-width:100%;height:auto}figcaption{font:11px/1.3 ui-monospace,monospace;margin-top:10px;max-width:180px;overflow-wrap:anywhere;min-height:28px}.concepts{display:flex;gap:20px;margin-top:24px}.concepts figure{flex:1}a{color:inherit}.dark a{color:white}footer{margin-top:28px}@media(max-width:900px){.panels{grid-template-columns:1fr}body{padding:16px}}
</style><h1>ruta cibao</h1><p>Unión de tres calles · concepto 01 · #1D9BF0 / #0F1419 / blanco<br>Los iconos de 16, 32 y 48 px se muestran a tamaño real. Los archivos grandes indican su tamaño de revisión; abre cada imagen para ver el original.</p><main class="panels">'''+''.join(panels)+'</main><h2 style="margin-top:32px">Exploración</h2><div class="concepts">'+''.join(image(f'concepts/0{i}.png',260,f'0{i}'+(' · elegido' if i==1 else '')) for i in range(1,5))+'</div><footer>Outfit ExtraBold · SIL OFL 1.1 · Letras convertidas a trazados. <a href="README.md">Documentación y archivos</a></footer></html>'
originals = ''.join(f'<figure><figcaption>{p.relative_to(root)}</figcaption><img style="max-width:none;width:auto" src="{p.relative_to(root)}" alt="{p.name}"></figure>' for p in sorted(root.rglob('*.png')) if p.name != 'preview.png')
html = html.replace('<footer>', '<details><summary>Originales PNG al 100 % · desplázate para revisar cada píxel</summary><div style="overflow:auto;max-height:640px;background:#ddd">'+originals+'</div></details><footer>')
(root/'preview.html').write_text(html)
