"""
Genera los iconos de la app a partir del arte de marca.

El arte ya viene completo —fondo rojo, gato negro, ojos blancos— así que acá no
se compone nada: sólo se redimensiona y se recortan las esquinas donde toca.

El original vive en el repositorio a propósito: si saliera de la carpeta de
Descargas de alguien, dejaría de poder regenerarse.
"""
import os
from PIL import Image, ImageDraw

ORIGEN = os.path.join("public", "brand", "icono-app.png")

src = Image.open(ORIGEN).convert("RGBA")
print("arte:", src.size)


def render(size: int, rounded: bool) -> Image.Image:
    # El arte es cuadrado y sangra hasta el borde: se escala tal cual, sin
    # márgenes. Añadirlos dejaría un marco de otro color alrededor del rojo.
    icon = src.resize((size, size), Image.LANCZOS)
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.2), fill=255
        )
        icon.putalpha(mask)
    return icon


os.makedirs("public/icons", exist_ok=True)

master = render(512, rounded=True)
master.save("public/icons/icon-512.png")
render(192, rounded=True).save("public/icons/icon-192.png")
render(180, rounded=True).save("public/icons/apple-touch-icon.png")

# Maskable: sangrado completo y sin esquinas propias, porque Android recorta con
# la forma de su lanzador. El arte sirve tal cual: lo que se pierde por los
# bordes es fondo rojo, y los ojos y las orejas quedan dentro de la zona segura.
render(512, rounded=False).save("public/icons/icon-maskable-512.png")

master.resize((256, 256), Image.LANCZOS).save(
    "public/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
master.resize((32, 32), Image.LANCZOS).save("public/icons/icon-32.png")
print("iconos generados:", sorted(os.listdir("public/icons")))
