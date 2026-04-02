import { useState, useEffect, useRef } from 'react'
import { decode } from 'blurhash'

interface BlurhashImageProps {
  src: string
  blurhash: string
  alt: string
  width?: number
  height?: number
  className?: string
}

export default function BlurhashImage({ 
  src, 
  blurhash, 
  alt, 
  width = 400, 
  height = 300, 
  className = '' 
}: BlurhashImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render blurhash placeholder
  useEffect(() => {
    if (!canvasRef.current || !blurhash) return

    try {
      const pixels = decode(blurhash, 32, 24) // Small size for placeholder
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return

      const imageData = ctx.createImageData(32, 24)
      imageData.data.set(pixels)
      ctx.putImageData(imageData, 0, 0)
    } catch (error) {
      console.warn('Failed to decode blurhash:', error)
    }
  }, [blurhash])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blurhash placeholder */}
      <canvas
        ref={canvasRef}
        width={32}
        height={24}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(true)} // Show broken state instead of blurhash
      />
      
      {/* Loading overlay */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}