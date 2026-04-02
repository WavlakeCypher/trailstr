interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-lg', 
  xl: 'w-24 h-24 text-xl'
}

export default function Avatar({ src, alt, size = 'md', fallback }: AvatarProps) {
  const sizeClass = sizeClasses[size]
  const displayName = alt || fallback || 'User'
  
  if (src) {
    return (
      <img
        src={src}
        alt={`${displayName}'s avatar`}
        className={`${sizeClass} rounded-full object-cover bg-stone-200 dark:bg-stone-700`}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  const initials = fallback || alt?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'
  
  return (
    <div 
      className={`${sizeClass} rounded-full bg-forest-500 dark:bg-forest-600 flex items-center justify-center text-white font-semibold`}
      role="img"
      aria-label={`${displayName}'s avatar`}
    >
      {initials}
    </div>
  )
}
