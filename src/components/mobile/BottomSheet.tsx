import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Snap points as fractions of viewport height (e.g. [0.4, 0.8]) */
  snapPoints?: number[]
}

export default function BottomSheet({ isOpen, onClose, title, children, snapPoints = [0.5, 0.9] }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const currentTranslateY = useRef(0)
  const [snapIndex, setSnapIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [translateY, setTranslateY] = useState(0)
  const [visible, setVisible] = useState(false)

  const sheetHeight = snapPoints[snapIndex] * window.innerHeight

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      setSnapIndex(0)
      setTranslateY(0)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  // Touch drag on the handle
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    currentTranslateY.current = 0
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const dy = e.touches[0].clientY - dragStartY.current
    currentTranslateY.current = Math.max(0, dy) // only allow dragging down
    setTranslateY(currentTranslateY.current)
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    const dy = currentTranslateY.current

    if (dy > 100) {
      // If at first snap and dragged down enough, try to go to lower snap or close
      if (snapIndex === 0) {
        handleClose()
      } else {
        setSnapIndex(Math.max(0, snapIndex - 1))
      }
    } else if (dy < -60 && snapIndex < snapPoints.length - 1) {
      // Dragged up — go to higher snap
      setSnapIndex(snapIndex + 1)
    }
    setTranslateY(0)
  }, [snapIndex, snapPoints.length, handleClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, handleClose])

  if (!isOpen && !visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-200 ${visible && isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
        className={`fixed bottom-0 left-0 right-0 z-[70] bg-stone-800 rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out ${
          visible && isOpen ? '' : 'translate-y-full'
        }`}
        style={{
          height: `${sheetHeight}px`,
          transform: visible && isOpen
            ? `translateY(${translateY}px)`
            : 'translateY(100%)',
          maxHeight: '95vh',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-stone-600" aria-hidden="true" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-stone-700">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain px-4 py-4" style={{ maxHeight: `calc(${sheetHeight}px - 60px)` }}>
          {children}
        </div>
      </div>
    </>
  )
}
