import { useRef, useState, useCallback, useEffect } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPull?: number
}

export function usePullToRefresh({ onRefresh, threshold = 80, maxPull = 140 }: PullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current
    if (!el || el.scrollTop > 0 || isRefreshing) return
    startY.current = e.touches[0].clientY
    isPulling.current = true
  }, [isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy < 0) { isPulling.current = false; setPullDistance(0); return }
    // Dampen the pull
    const dampened = Math.min(maxPull, dy * 0.5)
    setPullDistance(dampened)
    if (dampened > 10) e.preventDefault()
  }, [maxPull])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= threshold) {
      setIsRefreshing(true)
      setPullDistance(threshold * 0.5)
      try { await onRefresh() } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { containerRef, pullDistance, isRefreshing }
}
