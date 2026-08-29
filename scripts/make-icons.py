"""
Genera los iconos de la app a partir del isotipo.

El arte es blanco sobre transparente, así que el fondo lo pone este script.

El original vive en el repositorio a propósito: si el icono tuviera que salir
de la carpeta de Descargas de alguien, dejaría de poder regenerarse.
"""
import os
from PIL import Image, ImageDraw

# Rojo Pinterest #E60023. Más brillante y saturado que el rojo de marca
# (#c42c33): elegido a propósito para que el icono resalte en la pantalla de
# inicio, donde compite con decenas de otros.
FONDO = (230, 0, 35, 255)
ORIGEN = os.path.join("public", "brand", "isotipo.png")

src = Image.open(ORIGEN).convert("RGBA")
art = src.crop(src.getbbox())
print("arte recortado:", art.size)


def compose(size: int, art_ratio: float, rounded: bool) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), FONDO)
    inner = int(size * art_ratio)
    ratio = min(inner / art.width, inner / art.height)
    scaled = art.resize(
        (max(1, round(art.width * ratio)), max(1, round(art.height * ratio))),
        Image.LANCZOS,
    )
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.2), fill=255
        )
        canvas.putalpha(mask)
    return canvas


os.makedirs("public/icons", exist_ok=True)

# El isotipo mide casi el doble de ancho que de alto, así que al ajustarlo por
# el ancho el alto queda a la mitad. Por eso ocupa casi todo el lienzo: con
# proporciones que en un arte cuadrado serían excesivas, acá se ve pequeño.
master = compose(512, 0.90, rounded=True)
master.save("public/icons/icon-512.png")
compose(192, 0.90, rounded=True).save("public/icons/icon-192.png")
compose(180, 0.90, rounded=True).save("public/icons/apple-touch-icon.png")

# Maskable: sangrado completo sin esquinas. Android recorta con la forma que
# use el lanzador, y lo único garantizado es el círculo central del 80%. Para un
# arte de esta proporción, la diagonal cabe en ese círculo hasta un ancho de
# 0.70; 0.68 deja un margen para que ningún recorte se coma los extremos.
compose(512, 0.68, rounded=False).save("public/icons/icon-maskable-512.png")

master.resize((256, 256), Image.LANCZOS).save(
    "public/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
master.resize((32, 32), Image.LANCZOS).save("public/icons/icon-32.png")
print("iconos generados:", sorted(os.listdir("public/icons")))
