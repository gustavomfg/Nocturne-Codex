export function safeExternalUrl(value: string | undefined) {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null }
  catch { return null }
}
