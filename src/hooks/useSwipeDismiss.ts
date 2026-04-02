import { useRef, useState, useCallback } from 'react'

interface SwipeDismissOptions {
  onDismiss: () => void
  direction?: 'left' | 'right' | 'both'
  threshold?: number
}

export function useSwipeDismiss({ onDismiss, direction = 'right', threshold = 120 }: SwipeDismissOptions) {
  const startX = useRef(0)
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    setSwiping(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return
    const dx = e.touches[0].clientX - startX.current
    if (direction === 'right' && dx < 0) return setOffsetX(0)
    if (direction === 'left' && dx > 0) return setOffsetX(0)
    setOffsetX(dx)
  }, [swiping, direction])

  const onTouchEnd = useCallback(() => {
    setSwiping(false)
    if (Math.abs(offsetX) >= threshold) {
      onDismiss()
    }
    setOffsetX(0)
  }, [offsetX, threshold, onDismiss])

  return {
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd },
    offsetX,
    swiping,
    style: {
      transform: `translateX(${offsetX}px)`,
      transition: swiping ? 'none' : 'transform 0.2s ease-out',
      opacity: 1 - Math.abs(offsetX) / (threshold * 2),
    }
  }
}
