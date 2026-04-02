import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import type { ActivityImage } from '../../types/activity'
import BlurhashImage from '../common/BlurhashImage'

export interface PhotoGalleryProps {
  images: ActivityImage[]
  onPhotoClick?: (image: ActivityImage, index: number) => void
  className?: string
  maxPreview?: number
}

export default function PhotoGallery({ 
  images, 
  onPhotoClick, 
  className = '',
  maxPreview = 4 
}: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!images || images.length === 0) {
    return null
  }

  const handleImageClick = (image: ActivityImage, index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
    onPhotoClick?.(image, index)
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious()
    if (e.key === 'ArrowRight') handleNext()
    if (e.key === 'Escape') setLightboxOpen(false)
  }

  return (
    <div className={`${className}`}>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {images.slice(0, maxPreview).map((image, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
            onClick={() => handleImageClick(image, index)}
          >
            <BlurhashImage
              src={image.url}
              blurhash={image.blurhash || ''}
              alt={`Activity photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            
            {/* Overlay for additional images count */}
            {index === maxPreview - 1 && images.length > maxPreview && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center text-white font-semibold">
                +{images.length - maxPreview + 1}
              </div>
            )}
            
            {/* GPS indicator */}
            {image.latitude && image.longitude && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white p-1 rounded">
                <MapPin size={12} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevious()
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors"
              >
                <ChevronLeft size={32} />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Main image */}
          <div
            className="max-w-[90vw] max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[currentIndex].url}
              alt={`Activity photo ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Image info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
              <div className="text-white">
                <p className="text-sm opacity-75">
                  {currentIndex + 1} of {images.length}
                </p>
                
                {/* GPS coordinates */}
                {images[currentIndex].latitude && images[currentIndex].longitude && (
                  <p className="text-xs opacity-75 mt-1 flex items-center space-x-1">
                    <MapPin size={12} />
                    <span>
                      {images[currentIndex].latitude!.toFixed(6)}, {images[currentIndex].longitude!.toFixed(6)}
                    </span>
                  </p>
                )}
                
                {/* Timestamp */}
                {images[currentIndex].timestamp && (
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(images[currentIndex].timestamp! * 1000).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 max-w-[90vw] overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                  className={`flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}