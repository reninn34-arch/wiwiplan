export function detectEmbed(url: string): { embedUrl: string; platform: string } | null {
  if (!url) return null

  const cleanUrl = url.split("?")[0].split("&")[0]

  const youtube = cleanUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
  )
  if (youtube) return { embedUrl: `https://www.youtube.com/embed/${youtube[1]}`, platform: "YOUTUBE" }

  const vimeo = cleanUrl.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`, platform: "VIMEO" }

  const tiktokFull = cleanUrl.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/)
  if (tiktokFull) return { embedUrl: `https://www.tiktok.com/embed/v2/${tiktokFull[1]}`, platform: "TIKTOK" }

  const tiktokShort = cleanUrl.match(/vm\.tiktok\.com\/([\w]+)/)
  if (tiktokShort) return { embedUrl: `https://www.tiktok.com/embed/v2/${tiktokShort[1]}`, platform: "TIKTOK" }

  const instagram = cleanUrl.match(/(?:instagram\.com\/(?:p|reel)\/|instagr\.am\/(?:p|reel)\/)([a-zA-Z0-9_-]+)/)
  if (instagram) return { embedUrl: `https://www.instagram.com/p/${instagram[1]}/embed`, platform: "INSTAGRAM" }

  const facebook = cleanUrl.match(/facebook\.com\/(?:watch\/?\?v=|[\w.]+\/videos\/)(\d+)/)
  if (facebook) return { embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`, platform: "FACEBOOK" }

  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(cleanUrl)
  if (isImage) return { embedUrl: url, platform: "IMAGE" }

  const isPinterest = url.match(/pinterest\.com\/pin\//)
  if (isPinterest) return { embedUrl: url, platform: "IMAGE" }

  return null
}

export function platformLabel(p: string): string {
  return { YOUTUBE: "YouTube", VIMEO: "Vimeo", TIKTOK: "TikTok", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", IMAGE: "Imagen", OTHER: "Otro" }[p] ?? p
}

export function postTypeLabel(p: string): string {
  return { CARROUSEL: "Carrusel", REEL: "Reel", VIDEO: "Video", IMAGE: "Imagen", STORY: "Historia", STATIC: "Post Estático", OTHER: "Otro" }[p] ?? p
}
