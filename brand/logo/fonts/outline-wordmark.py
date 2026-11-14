"""Rebuild the outlined wordmark using fontTools (Python 3)."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parent.parent
font = TTFont(root / 'fonts/outfit-variable.ttf')
glyphs = font.getGlyphSet(location={'wght': 800})
cmap = font.getBestCmap()
x = 0
paths = []
bounds = []
for char in 'ruta cibao':
    glyph = glyphs[cmap[ord(char)]]
    pen = SVGPathPen(glyphs)
    transform = (1, 0, 0, -1, x, 800)
    glyph.draw(TransformPen(pen, transform))
    if pen.getCommands():
        paths.append(f'<path d="{pen.getCommands()}"/>')
        box = BoundsPen(glyphs)
        glyph.draw(TransformPen(box, transform))
        bounds.append(box.bounds)
    x += glyph.width - (18 if char != ' ' else 0)
left = min(b[0] for b in bounds)
top = min(b[1] for b in bounds)
right = max(b[2] for b in bounds)
bottom = max(b[3] for b in bounds)
(root / 'wordmark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {right-left:.3f} {bottom-top:.3f}" fill="#0F1419" role="img" aria-label="ruta cibao"><g transform="translate({-left:.3f} {-top:.3f})">'+''.join(paths)+'</g></svg>\n')
