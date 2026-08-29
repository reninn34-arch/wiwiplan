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
from PIL import Image, ImageDraw, ImageFont

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
# 1200x630 es la proporción que esperan (1.91:1). Lleva el nombre además del
# gato: en una lista de chats, un enlace que sólo enseña el dibujo no dice de
# qué app es, y quien lo recibe suele ser un cliente que nunca la ha visto.
OG = (1200, 630)
MARGEN = 84

# La tipografía se busca entre varias porque el script se corre a mano y no
# siempre desde la misma máquina; si no hay ninguna, el nombre se omite antes
# que romper la generación de todo lo demás.
FUENTES = ["seguibl.ttf", "ariblk.ttf", "arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"]


def fuente(tam: int):
    for nombre in FUENTES:
        try:
            return ImageFont.truetype(nombre, tam)
        except OSError:
            continue
    return None


og = Image.new("RGB", OG, ROJO)
dibujo = ImageDraw.Draw(og)

# El gato se apoya en la esquina inferior derecha y **sangra por el borde**:
# recortado a propósito, no encajado con un marco de aire alrededor. Deja libre
# la mitad izquierda, que es donde va el nombre.
gato = src.crop((0, int(alto * 0.30), ancho, alto))
escala = 500 / gato.height
gato = gato.resize((round(gato.width * escala), 500), Image.LANCZOS)
COLUMNA = OG[0] - gato.width + 120  # lo que se sale por la derecha
og.paste(gato, (COLUMNA, OG[1] - gato.height), gato)

# El tamaño del nombre no se elige a ojo: se mide y se encoge hasta caber en la
# columna libre. Así el texto nunca se monta encima del gato aunque cambie el
# arte o la tipografía disponible.
disponible = COLUMNA - MARGEN * 2


def ajustar(texto: str, tope: int, desde: int):
    for tam in range(desde, 15, -2):
        f = fuente(tam)
        if f is None:
            return None, 0
        if dibujo.textlength(texto, font=f) <= tope:
            return f, tam
    return None, 0


BAJADA = "Planificaciones para tus clientes"
titulo, tam = ajustar("WiwiPlan", disponible, 104)
if titulo is None:
    print("aviso: sin tipografía disponible, la previsualización va sin nombre")
else:
    bajada, _ = ajustar(BAJADA, disponible, max(18, tam // 3))
    alto_bloque = tam + (24 + bajada.size if bajada else 0)
    y = (OG[1] - alto_bloque) // 2
    dibujo.text((MARGEN, y), "WiwiPlan", font=titulo, fill="white")
    if bajada:
        dibujo.text((MARGEN + 3, y + tam + 24), BAJADA, font=bajada, fill=(255, 190, 200))

og.save("public/icons/og.png")

print("iconos generados:", sorted(os.listdir("public/icons")))
