"""
Genera los iconos de la app y la imagen de previsualización a partir del arte.

Dos reglas mandan sobre todo lo demás:

1. **Nada sale con esquinas redondeadas.** El arte llega ya recortado en forma
   de icono, con su marco alrededor. Eso se ve mal en todas partes: cada
   sistema redondea con su propia forma, así que un redondeo propio encima deja
   una muesca, y al compartir el enlace deja un borde que no llena el recuadro.
   El script reconstruye el cuadrado pleno.
2. **Nada sale con transparencia.** Todo se aplana sobre el rojo de marca, que
   se toma del propio arte para que icono, splash y previsualización sean
   exactamente el mismo color y no se note ninguna costura.

El original vive en el repositorio a propósito: si saliera de la carpeta de
Descargas de alguien, dejaría de poder regenerarse.
"""
import os
from collections import Counter
from PIL import Image, ImageDraw, ImageFont

ORIGEN = os.path.join("public", "brand", "icono-app.png")


def es_rojo(p) -> bool:
    return p[0] > 140 and p[1] < 90 and p[2] < 90


def sin_redondeo(im: Image.Image) -> Image.Image:
    """Devuelve el arte como cuadrado pleno, sin esquinas curvas ni marco.

    El truco está en que el fondo que rodea al icono es negro y el gato también
    lo es: por abajo, dentro y fuera de la curva son del mismo color, así que
    las esquinas inferiores ya encajan solas. Sólo hay que rellenar de rojo las
    de arriba, donde el interior sí se distingue del fondo.
    """
    px = im.load()
    w, h = im.size

    # La caja del icono se mide por el rojo, que es lo único que se distingue
    # del fondo con seguridad. El arte es cuadrado, así que el alto se deduce.
    tramos: dict[int, tuple[int, int]] = {}
    x0, x1, y0 = w, 0, None
    for y in range(h):
        fila = [x for x in range(w) if es_rojo(px[x, y])]
        if not fila:
            continue
        if y0 is None:
            y0 = y
        tramos[y] = (fila[0], fila[-1])
        x0 = min(x0, fila[0])
        x1 = max(x1, fila[-1])
    if y0 is None:
        return im

    lado = x1 - x0 + 1
    caja = im.crop((x0, y0, x0 + lado, y0 + lado))
    pintar = ImageDraw.Draw(caja)
    rojo = im.getpixel((x0 + lado // 2, y0 + 20))

    # Se pinta dos pixeles más adentro de donde empieza el rojo, para tapar de
    # paso el borde suavizado que dejó el recorte original.
    for y, (a, b) in tramos.items():
        yy = y - y0
        if not 0 <= yy < lado or a <= x0 + 1:
            continue  # ya es borde recto: no hay curva que rellenar
        pintar.rectangle([0, yy, a - x0 + 2, yy], fill=rojo)
        pintar.rectangle([b - x0 - 2, yy, lado - 1, yy], fill=rojo)

    # El mismo borde suavizado corre por los cuatro lados rectos. Se tapa
    # estirando el color de tres pixeles adentro, que es rojo donde hay fondo y
    # negro donde llega el gato.
    pc = caja.load()
    for y in range(lado):
        pintar.rectangle([0, y, 2, y], fill=pc[3, y])
        pintar.rectangle([lado - 3, y, lado - 1, y], fill=pc[lado - 4, y])
    for x in range(lado):
        pintar.rectangle([x, 0, x, 2], fill=pc[x, 3])
        pintar.rectangle([x, lado - 3, x, lado - 1], fill=pc[x, lado - 4])

    return caja


src = sin_redondeo(Image.open(ORIGEN).convert("RGB")).convert("RGBA")
ancho, alto = src.size

# El rojo se lee del propio arte en vez de escribirse a mano: así el fondo del
# splash no puede desincronizarse del icono si algún día cambia el dibujo. Se
# toma el tono más repetido y no un pixel suelto, porque el arte llegó como
# JPEG y la compresión deja cada pixel ligeramente distinto del vecino.
_rgb = src.convert("RGB")
ROJO = Counter(
    _rgb.getpixel((x, y))
    for y in range(0, alto, 3)
    for x in range(0, ancho, 3)
    if es_rojo(_rgb.getpixel((x, y)))
).most_common(1)[0][0]
print("arte:", src.size, "rojo:", "#%02X%02X%02X" % ROJO)


def aplanar(imagen: Image.Image, tamano: tuple[int, int]) -> Image.Image:
    """Pega el arte sobre rojo opaco. Devuelve RGB: sin canal alfa, ni un pixel."""
    fondo = Image.new("RGB", tamano, ROJO)
    fondo.paste(imagen, (0, 0), imagen)
    return fondo


def icono(size: int) -> Image.Image:
    # El arte ya es un cuadrado que sangra hasta el borde: se escala tal cual,
    # sin márgenes ni esquinas propias. Las redondea cada sistema con su forma.
    return aplanar(src.resize((size, size), Image.LANCZOS), (size, size))


os.makedirs("public/icons", exist_ok=True)

master = icono(512)
master.save("public/icons/icon-512.png")
icono(192).save("public/icons/icon-192.png")
# iOS no respeta el alfa: lo que sea transparente lo pinta de negro. Opaco es
# la única forma de que el icono de la pantalla de inicio se vea bien.
icono(180).save("public/icons/apple-touch-icon.png")

# Maskable: sangrado completo, porque Android recorta con la forma de su
# lanzador. Lo que se pierde por los bordes es fondo, y la ficha y los ojos
# quedan dentro de la zona segura.
icono(512).save("public/icons/icon-maskable-512.png")

master.resize((256, 256), Image.LANCZOS).save(
    "public/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
master.resize((32, 32), Image.LANCZOS).save("public/icons/icon-32.png")

# ── La imagen que ven WhatsApp, Facebook y compañía al compartir el enlace ──
# 1200x630 es la proporción que esperan (1.91:1). Lleva el nombre además del
# dibujo: en una lista de chats, un enlace que sólo enseña el icono no dice de
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

# El icono entero va a la derecha, a sangre por arriba y por abajo. No se
# recorta: este arte ya es una composición cerrada —la ficha y el gato— y
# partirla la deja coja. Su fondo es el mismo rojo del lienzo, así que el
# cuadrado desaparece y sólo se ven el dibujo y el nombre.
COLUMNA = OG[0] - OG[1]
icono_og = src.resize((OG[1], OG[1]), Image.LANCZOS)
og.paste(icono_og, (COLUMNA, 0), icono_og)

# El gato ocupa todo el ancho del icono por abajo, así que pegarlo sin más
# dejaba su cuerpo cortado en vertical a media tarjeta, como un bloque negro
# suelto. Cada fila del lienzo se rellena con el color con el que **esa misma
# fila** empieza en el icono: rojo arriba, negro abajo. El corte desaparece y
# el gato queda apoyado en el suelo en lugar de recortado.
pi = icono_og.convert("RGB").load()
for y in range(OG[1]):
    dibujo.rectangle([0, y, COLUMNA, y], fill=pi[0, y])

# El texto va en la parte roja, encima del suelo negro. Se busca dónde empieza
# a oscurecerse en vez de fijar una altura a mano, que se rompería con el
# siguiente dibujo.
SUELO = next(
    (y for y in range(OG[1]) if sum(pi[0, y]) < 200),
    OG[1],
)

# El tamaño del nombre no se elige a ojo: se mide y se encoge hasta caber en la
# columna libre. Así el texto nunca se monta encima del dibujo aunque cambie el
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
    y = max(MARGEN, (SUELO - alto_bloque) // 2)
    dibujo.text((MARGEN, y), "WiwiPlan", font=titulo, fill="white")
    if bajada:
        dibujo.text((MARGEN + 3, y + tam + 24), BAJADA, font=bajada, fill=(255, 190, 200))

# El número del nombre no es capricho: WhatsApp y Facebook guardan la
# previsualización de cada enlace durante días, y cambiar el contenido de un
# archivo que ya conocen no basta para que la vuelvan a bajar. Un nombre nuevo
# sí. Va en el nombre y no en un "?v=" porque algunos rastreadores tropiezan
# con las cadenas de consulta al pedir la imagen.
og.save("public/icons/og-3.png")

print("iconos generados:", sorted(os.listdir("public/icons")))
