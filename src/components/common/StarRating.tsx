import { useState } from 'react'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
}

export default function StarRating({ 
  rating, 
  maxRating = 5, 
  size = 'md',
  interactive = false,
  onChange,
  className = ''
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = useState(0)
  const sizeClass = sizeClasses[size]
  
  const handleClick = (newRating: number) => {
    if (interactive && onChange) {
      onChange(newRating)
    }
  }
  
  const handleMouseEnter = (newRating: number) => {
    if (interactive) {
      setHoveredRating(newRating)
    }
  }
  
  const handleMouseLeave = () => {
    if (interactive) {
      setHoveredRating(0)
    }
  }

  const displayRating = interactive && hoveredRating > 0 ? hoveredRating : rating
  
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {[...Array(maxRating)].map((_, index) => {
        const starRating = index + 1
        const isFilled = starRating <= displayRating
        const isPartial = !isFilled && starRating - 0.5 <= displayRating
        
        return (
          <button
            key={index}
            type="button"
            className={`${sizeClass} ${
              interactive 
                ? 'cursor-pointer hover:scale-110 transition-transform' 
                : 'cursor-default'
            }`}
            onClick={() => handleClick(starRating)}
            onMouseEnter={() => handleMouseEnter(starRating)}
            onMouseLeave={handleMouseLeave}
            disabled={!interactive}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isFilled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              className={`${
                isFilled
                  ? 'text-earth-400'
                  : isPartial
                  ? 'text-earth-200'
                  : 'text-stone-300 dark:text-stone-600'
              }`}
            >
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          </button>
        )
      })}
      
      {/* Optional rating text */}
      {!interactive && (
        <span className="ml-2 text-sm text-stone-600 dark:text-stone-400">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}