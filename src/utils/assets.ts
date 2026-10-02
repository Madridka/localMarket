const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export function publicAsset(path: string): string {
  return `${base}${path.replace(/^\.?\//, '')}`
}

export function safeImage(url: unknown): string {
  if (typeof url !== 'string') return publicAsset('assets/placeholder.svg')
  if (/^https:\/\//i.test(url) || /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(url)) {
    return url
  }
  const assetPath = url.match(/(?:^|\/)assets\/(.+)$/)?.[1]
  return assetPath ? publicAsset(`assets/${assetPath}`) : publicAsset('assets/placeholder.svg')
}
