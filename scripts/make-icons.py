"""
Genera los iconos de la app y la imagen de previsualización a partir del arte.

Una regla manda sobre todo lo demás: **nada sale con transparencia**. El arte de
origen trae las esquinas recortadas en alfa, y eso viajaba hasta el resultado:
en el icono se veía como una muesca, y al compartir el enlace como un borde
transparente que no llenaba el recuadro. Todo se aplana sobre el rojo de marca,
que se toma del propio arte para que icono, splash y previsualización sean
exactamente el mismo color y no se note ninguna costura.

El original vive en el repositorio a propósito: si saliera de la carpeta de
Descargas de alguien, dejaría de poder regenerarse.
"""
import os
from PIL import Image

ORIGEN = os.path.join("public", "brand", "icono-app.png")

src = Image.open(ORIGEN).convert("RGBA")
ancho, alto = src.size

# El rojo se lee del centro del arte en vez de escribirse a mano: así el fondo
# del splash no puede desincronizarse del icono si algún día cambia el dibujo.
ROJO = src.convert("RGB").getpixel((ancho // 2, alto // 2))
print("arte:", src.size, "rojo:", "#%02X%02X%02X" % ROJO)


def aplanar(imagen: Image.Image, tamano: tuple[int, int]) -> Image.Image:
    """Pega el arte sobre rojo opaco. Devuelve RGB: sin canal alfa, ni un pixel."""
    fondo = Image.new("RGB", tamano, ROJO)
    fondo.paste(imagen, (0, 0), imagen)
    return fondo


def icono(size: int) -> Image.Image:
    # El arte es cuadrado y sangra hasta el borde: se escala tal cual, sin
    # márgenes. Las esquinas las redondea cada sistema con su propia forma;
    # redondearlas acá sólo devolvía la transparencia que estamos quitando.
    return aplanar(src.resize((size, size), Image.LANCZOS), (size, size))


os.makedirs("public/icons", exist_ok=True)

master = icono(512)
master.save("public/icons/icon-512.png")
icono(192).save("public/icons/icon-192.png")
# iOS no respeta el alfa: lo que sea transparente lo pinta de negro. Opaco es
# la única forma de que el icono de la pantalla de inicio se vea bien.
icono(180).save("public/icons/apple-touch-icon.png")

# Maskable: sangrado completo, porque Android recorta con la forma de su
# lanzador. Lo que se pierde por los bordes es fondo rojo, y los ojos y las
# orejas quedan dentro de la zona segura.
icono(512).save("public/icons/icon-maskable-512.png")

master.resize((256, 256), Image.LANCZOS).save(
    "public/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
master.resize((32, 32), Image.LANCZOS).save("public/icons/icon-32.png")

# ── La imagen que ven WhatsApp, Facebook y compañía al compartir el enlace ──
# 1200x630 es la proporción que esperan (1.91:1). El arte es cuadrado, así que
# no se estira: se recorta la cabeza —desde encima de las orejas hasta abajo—,
# se escala a la altura completa y se centra sobre rojo, que llena los lados.
OG = (1200, 630)
RECORTE_SUPERIOR = int(alto * 0.235)  # deja aire sobre las orejas

cabeza = src.crop((0, RECORTE_SUPERIOR, ancho, alto))
escala = OG[1] / cabeza.height
cabeza = cabeza.resize((round(cabeza.width * escala), OG[1]), Image.LANCZOS)

og = Image.new("RGB", OG, ROJO)
og.paste(cabeza, ((OG[0] - cabeza.width) // 2, 0), cabeza)
og.save("public/icons/og.png")

print("iconos generados:", sorted(os.listdir("public/icons")))
