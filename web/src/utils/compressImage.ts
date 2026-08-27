// Downscales and re-encodes a photo before upload. A raw phone-camera photo can be
// several MB — well past Claude's per-image size limit — so this mirrors the
// compression mobile's ImagePicker already does (quality: 0.7) for the web capture flow.
export async function compressImage(file: File, maxDimension = 1600, quality = 0.7): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob ?? file
}
