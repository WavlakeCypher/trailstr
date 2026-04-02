// MapLibre GL v5 requires 'projection' in style spec.
// OpenFreeMap styles don't include it, so we patch it in.

const styleCache: Record<string, any> = {}

export async function loadMapStyle(url = 'https://tiles.openfreemap.org/styles/liberty'): Promise<any> {
  if (styleCache[url]) return JSON.parse(JSON.stringify(styleCache[url]))
  const res = await fetch(url)
  const style = await res.json()
  if (!style.projection) style.projection = { type: 'mercator' }
  styleCache[url] = style
  return JSON.parse(JSON.stringify(style))
}
