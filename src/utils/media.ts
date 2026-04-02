import { encode as encodeBlurhash } from 'blurhash'

export interface ResizedImageResult {
  blob: Blob
  blurhash: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

export interface ResizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
  blurhashResolution?: number
}

/**
 * Resize an image file and generate blurhash
 */
export async function resizeImageAndGenerateBlurhash(
  file: File | Blob,
  options: ResizeOptions = {}
): Promise<ResizedImageResult> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85,
    format = 'jpeg',
    blurhashResolution = 32
  } = options

  return new Promise((resolve, reject) => {
    // Create an image element to load the file
    const img = new Image()
    
    img.onload = async () => {
      try {
        // Calculate new dimensions
        const { width: newWidth, height: newHeight } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        )

        // Create canvas for resizing
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        canvas.width = newWidth
        canvas.height = newHeight

        // Draw the resized image
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        // Generate blurhash from a smaller version of the image
        const blurhash = await generateBlurhashFromCanvas(canvas, blurhashResolution)

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'))
              return
            }

            const result: ResizedImageResult = {
              blob,
              blurhash,
              width: newWidth,
              height: newHeight,
              originalSize: file.size,
              compressedSize: blob.size
            }

            resolve(result)
          },
          format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
          quality
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Load the image
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // If image is already smaller than max dimensions, return original
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  // Calculate scaling factor
  const widthRatio = maxWidth / width
  const heightRatio = maxHeight / height
  const scale = Math.min(widthRatio, heightRatio)

  // Apply scaling
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  return { width, height }
}

/**
 * Generate blurhash from canvas
 */
async function generateBlurhashFromCanvas(
  canvas: HTMLCanvasElement,
  resolution: number = 32
): Promise<string> {
  // Create a smaller canvas for blurhash generation to improve performance
  const smallCanvas = document.createElement('canvas')
  const smallCtx = smallCanvas.getContext('2d')
  
  if (!smallCtx) {
    throw new Error('Could not get small canvas context')
  }

  // Calculate small canvas dimensions (maintain aspect ratio)
  const aspectRatio = canvas.width / canvas.height
  let smallWidth: number
  let smallHeight: number

  if (aspectRatio > 1) {
    smallWidth = resolution
    smallHeight = Math.round(resolution / aspectRatio)
  } else {
    smallWidth = Math.round(resolution * aspectRatio)
    smallHeight = resolution
  }

  smallCanvas.width = smallWidth
  smallCanvas.height = smallHeight

  // Draw scaled-down image
  smallCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight)

  // Get image data
  const imageData = smallCtx.getImageData(0, 0, smallWidth, smallHeight)
  
  // Convert to Uint8ClampedArray if needed
  const pixels = new Uint8ClampedArray(imageData.data.buffer)

  // Generate blurhash (4x4 components is a good balance)
  const componentsX = Math.min(4, Math.ceil(smallWidth / 8))
  const componentsY = Math.min(4, Math.ceil(smallHeight / 8))

  return encodeBlurhash(pixels, smallWidth, smallHeight, componentsX, componentsY)
}

/**
 * Extract EXIF data from image file
 */
export async function extractImageMetadata(file: File): Promise<{
  latitude?: number
  longitude?: number
  timestamp?: number
  camera?: string
  orientation?: number
}> {
  return new Promise((resolve) => {
    const img = new Image()
    
    img.onload = () => {
      // Basic metadata extraction
      // For more advanced EXIF reading, we'd need a library like exif-js
      // For now, we'll return empty metadata
      resolve({})
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      resolve({})
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Check if file is a valid image
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  return validTypes.includes(file.type.toLowerCase())
}

/**
 * Get optimized resize settings based on file size and type
 */
export function getOptimalResizeSettings(file: File): ResizeOptions {
  const fileSizeMB = file.size / (1024 * 1024)
  
  // For very large files, be more aggressive with compression
  if (fileSizeMB > 10) {
    return {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.75,
      format: 'jpeg'
    }
  }
  
  // For medium files, use balanced settings
  if (fileSizeMB > 5) {
    return {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.8,
      format: 'jpeg'
    }
  }
  
  // For smaller files, preserve more quality
  return {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.85,
    format: file.type.includes('png') ? 'png' : 'jpeg'
  }
}

/**
 * Batch process multiple images
 */
export async function resizeMultipleImages(
  files: File[],
  options?: ResizeOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<ResizedImageResult[]> {
  const results: ResizedImageResult[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    if (!isValidImageFile(file)) {
      throw new Error(`Invalid image file: ${file.name}`)
    }
    
    const optimalSettings = options || getOptimalResizeSettings(file)
    const result = await resizeImageAndGenerateBlurhash(file, optimalSettings)
    
    results.push(result)
    onProgress?.(i + 1, files.length)
  }
  
  return results
}

/**
 * Generate a data URL from a resized image for preview
 */
export function createImagePreviewUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as data URL'))
      }
    }
    
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}