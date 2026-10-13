#!/usr/bin/env python3
"""Génère assets/js/devis-assets.js : les polices et le logo utilisés dans les devis PDF.

À relancer seulement si les polices du site ou le logo changent :
    pip install fonttools brotli
    python3 outils/build-pdf-assets.py

Ce que fait le script :
- Space Grotesk (variable) est figée en Regular (400) et SemiBold (600), Space Mono est reprise telle quelle ;
- chaque police est réduite aux caractères du codage WinAnsi (français, €, guillemets, tirets…), puis compressée
  (zlib) : le PDF l'embarque directement avec /Filter /FlateDecode, sans recompression à l'exécution ;
- les largeurs des caractères sont calculées ici, pour que le navigateur n'ait pas à lire la police ;
- le logo smilt. est converti en opérateurs de tracé PDF à partir des contours de Space Grotesk Bold,
  avec la même géométrie que le logo SVG du site (voir assets/img/smilt-logo.svg).
"""
import base64
import io
import json
import os
import zlib

from fontTools import subset
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, 'assets', 'fonts')
OUT = os.path.join(ROOT, 'assets', 'js', 'devis-assets.js')

# Codes 32 à 255 du codage WinAnsi (cp1252). Les cinq codes non attribués restent à None.
CODES = list(range(32, 256))
def winansi_char(code):
    try:
        return bytes([code]).decode('cp1252')
    except UnicodeDecodeError:
        return None
CHARS = {code: winansi_char(code) for code in CODES}
UNICODES = {ord(c) for c in CHARS.values() if c}


def num(v):
    """Nombre compact pour le flux PDF (une décimale au plus)."""
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)


def subset_font(font):
    opts = subset.Options()
    opts.glyph_names = True        # garde la table post : certains lecteurs passent par les noms de glyphes
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.layout_features = []
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    font.flavor = None
    font.recalcTimestamp = False      # sortie identique d'une exécution à l'autre
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def describe(font_bytes, ps_name, fixed_pitch=False):
    f = TTFont(io.BytesIO(font_bytes))
    upm = f['head'].unitsPerEm
    k = 1000.0 / upm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    missing = [CHARS[c] for c in CODES if CHARS[c] and ord(CHARS[c]) not in cmap and CHARS[c] != '\u00ad']
    if missing:
        # encode() dans devis-pdf.js remplace ces caractères par la lettre la plus proche (table CP1252) : à tenir à jour.
        print(ps_name, ': pas de glyphe pour', ' '.join(missing))
    space = round(hmtx[cmap[0x20]][0] * k)
    widths = []
    for code in CODES:
        ch = CHARS[code]
        g = cmap.get(ord(ch)) if ch else None
        widths.append(round(hmtx[g][0] * k) if g else space)
    os2, hhea, head = f['OS/2'], f['hhea'], f['head']
    return {
        'name': ps_name,
        'flags': 32 + (1 if fixed_pitch else 0),   # Nonsymbolic (+ FixedPitch)
        'ascent': round(hhea.ascent * k),
        'descent': round(hhea.descent * k),
        'capHeight': round(getattr(os2, 'sCapHeight', 700) * k),
        'xHeight': round(getattr(os2, 'sxHeight', 500) * k),
        'bbox': [round(head.xMin * k), round(head.yMin * k), round(head.xMax * k), round(head.yMax * k)],
        'stemV': 80,
        'widths': widths,
        'length1': len(font_bytes),
        'data': base64.b64encode(zlib.compress(font_bytes, 9)).decode('ascii'),
    }


class PdfPathPen(BasePen):
    """Écrit les contours en opérateurs PDF (m, l, c, h). Les courbes quadratiques sont converties en cubiques par BasePen."""
    def __init__(self, glyphset, dx=0.0):
        super().__init__(glyphset)
        self.ops, self.dx = [], dx
    def _p(self, pt):
        return num(pt[0] + self.dx) + ' ' + num(pt[1])
    def _moveTo(self, pt): self.ops.append(self._p(pt) + ' m')
    def _lineTo(self, pt): self.ops.append(self._p(pt) + ' l')
    def _curveToOne(self, p1, p2, p3): self.ops.append(' '.join(self._p(p) for p in (p1, p2, p3)) + ' c')
    def _closePath(self): self.ops.append('h')


def circle(cx, cy, r):
    k = 0.5522847498 * r
    pts = [
        f'{num(cx + r)} {num(cy)} m',
        f'{num(cx + r)} {num(cy + k)} {num(cx + k)} {num(cy + r)} {num(cx)} {num(cy + r)} c',
        f'{num(cx - k)} {num(cy + r)} {num(cx - r)} {num(cy + k)} {num(cx - r)} {num(cy)} c',
        f'{num(cx - r)} {num(cy - k)} {num(cx - k)} {num(cy - r)} {num(cx)} {num(cy - r)} c',
        f'{num(cx + k)} {num(cy - r)} {num(cx + r)} {num(cy - k)} {num(cx + r)} {num(cy)} c',
        'h',
    ]
    return ' '.join(pts)


def build_logo(bold):
    """Même construction que le logo SVG : s m ı l t avec une chasse de -70, tête et sourire sur le i, point corail."""
    gs = bold.getGlyphSet()
    track, x, ops = -70, 0, []
    origin = {}
    for name in ['s', 'm', 'dotlessi', 'l', 't']:
        origin[name] = x
        pen = PdfPathPen(gs, dx=x)
        gs[name].draw(pen)
        ops += pen.ops
        x += gs[name].width + track
    i_cx = origin['dotlessi'] + 133
    t_right = origin['t'] + 412
    ops.append(circle(i_cx, 624, 72))                          # tête du « i »
    p0, q, p2 = (i_cx - 141, 825), (i_cx, 625), (i_cx + 141, 825)
    c1 = (p0[0] + 2 / 3 * (q[0] - p0[0]), p0[1] + 2 / 3 * (q[1] - p0[1]))
    c2 = (p2[0] + 2 / 3 * (q[0] - p2[0]), p2[1] + 2 / 3 * (q[1] - p2[1]))
    smile = f'{num(p0[0])} {num(p0[1])} m {num(c1[0])} {num(c1[1])} {num(c2[0])} {num(c2[1])} {num(p2[0])} {num(p2[1])} c'
    period = circle(t_right + 75, -36, 60)
    return {
        'x0': 42, 'y0': -96, 'width': t_right + 75 + 60 - 42, 'height': 951,
        'letters': ' '.join(ops), 'smile': smile, 'smileWidth': 60, 'period': period,
    }


def main():
    sg = os.path.join(FONTS_DIR, 'SpaceGrotesk-Latin.woff2')
    mono = os.path.join(FONTS_DIR, 'SpaceMono-Regular-Latin.woff2')
    regular = subset_font(instancer.instantiateVariableFont(TTFont(sg), {'wght': 400}))
    semibold = subset_font(instancer.instantiateVariableFont(TTFont(sg), {'wght': 600}))
    mono_b = subset_font(TTFont(mono))
    fonts = {
        'regular': describe(regular, 'SpaceGrotesk-Regular'),
        'semibold': describe(semibold, 'SpaceGrotesk-SemiBold'),
        'mono': describe(mono_b, 'SpaceMono-Regular', fixed_pitch=True),
    }
    logo = build_logo(instancer.instantiateVariableFont(TTFont(sg), {'wght': 700}))
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('// Fichier généré par outils/build-pdf-assets.py : ne pas modifier à la main.\n')
        fh.write('// Polices : Space Grotesk et Space Mono, SIL Open Font License 1.1 (voir assets/fonts/).\n')
        fh.write('// widths : largeur (sur 1000) des codes WinAnsi 32 à 255. data : police TrueType compressée (zlib), en base64.\n')
        fh.write('export const FONTS = ' + json.dumps(fonts, separators=(',', ':')) + ';\n')
        fh.write('// Logo en unités de police (y vers le haut, ligne de base à 0). smile : trait à bouts ronds, épaisseur smileWidth.\n')
        fh.write('export const LOGO = ' + json.dumps(logo, separators=(',', ':')) + ';\n')
    print('écrit', OUT, os.path.getsize(OUT), 'octets')


if __name__ == '__main__':
    main()
