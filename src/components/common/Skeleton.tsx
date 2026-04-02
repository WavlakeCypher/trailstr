interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-stone-200 dark:bg-stone-700'
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could implement wave animation with CSS
    none: ''
  }
  
  const style = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined
  }
  
  // Default dimensions based on variant
  let defaultClasses = ''
  if (variant === 'text') {
    defaultClasses = !height ? 'h-4' : ''
    defaultClasses += !width ? ' w-full' : ''
  } else if (variant === 'circular') {
    defaultClasses = !width && !height ? 'w-12 h-12' : ''
  } else if (variant === 'rectangular') {
    defaultClasses = !width && !height ? 'w-full h-32' : ''
  }
  
  return (
    <div
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${defaultClasses}
        ${className}
      `}
      style={style}
    />
  )
}

// Convenience components for common patterns
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(lines)].map((_, index) => (
        <Skeleton 
          key={index} 
          variant="text" 
          width={index === lines - 1 ? '75%' : '100%'} // Last line slightly shorter
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 space-y-3 ${className}`}>
      <div className="flex items-center space-x-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={200} />
      <SkeletonText lines={2} />
    </div>
  )
}