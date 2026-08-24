from PIL import Image, ImageDraw

BRAND = (196, 44, 51, 255)  # #c42c33

src = Image.open(r"C:\Users\Alex\Downloads\Recurso 2@4x-8.png").convert("RGBA")
bbox = src.getbbox()
art = src.crop(bbox)
print("arte recortado:", art.size)

def compose(size: int, art_ratio: float, rounded: bool) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BRAND)
    inner = int(size * art_ratio)
    ratio = min(inner / art.width, inner / art.height)
    scaled = art.resize((max(1, round(art.width * ratio)), max(1, round(art.height * ratio))), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    if rounded:
        mask = Image.new("L", (size, size), 0)
        d = ImageDraw.Draw(mask)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.2), fill=255)
        canvas.putalpha(mask)
    return canvas

import os
os.makedirs("public/icons", exist_ok=True)

master = compose(512, 0.80, rounded=True)
master.save("public/icons/icon-512.png")
compose(192, 0.80, rounded=True).save("public/icons/icon-192.png")
compose(180, 0.80, rounded=True).save("public/icons/apple-touch-icon.png")

# Maskable: sangrado completo sin esquinas, arte más chico por la zona segura.
compose(512, 0.58, rounded=False).save("public/icons/icon-maskable-512.png")

# Favicon multi-tamaño
ico_sizes = [(16, 16), (32, 32), (48, 48)]
master.resize((256, 256), Image.LANCZOS).save(
    "public/icons/favicon.ico", sizes=ico_sizes
)
master.resize((32, 32), Image.LANCZOS).save("public/icons/icon-32.png")
print("iconos generados:", os.listdir("public/icons"))
