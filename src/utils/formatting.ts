import type { ActivityType } from '../types/activity'

/**
 * Format distance in meters to human readable format
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  } else {
    const km = meters / 1000
    if (km < 10) {
      return `${km.toFixed(2)}km`
    } else {
      return `${km.toFixed(1)}km`
    }
  }
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${Math.floor(remainingSeconds).toString().padStart(2, '0')}`
  } else if (minutes > 0) {
    return `${minutes}:${Math.floor(remainingSeconds).toString().padStart(2, '0')}`
  } else {
    return `${Math.floor(remainingSeconds)}s`
  }
}

/**
 * Format duration in seconds to short human readable format
 */
export function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${hours}h`
    }
  } else {
    return `${minutes}m`
  }
}

/**
 * Format pace in seconds per km to human readable format
 * Adjusts format based on activity type
 */
export function formatPace(secondsPerKm: number, activityType?: ActivityType): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.floor(secondsPerKm % 60)
  
  // For cycling activities, show speed instead of pace
  if (activityType && ['bike', 'mountain_bike', 'road_bike'].includes(activityType)) {
    const speedKmh = 3600 / secondsPerKm
    return `${speedKmh.toFixed(1)} km/h`
  }
  
  // For swimming, show per 100m
  if (activityType === 'swim') {
    const per100m = secondsPerKm / 10
    const mins = Math.floor(per100m / 60)
    const secs = Math.floor(per100m % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}/100m`
  }
  
  // Default pace format (min/km)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

/**
 * Format elevation gain/loss
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters)}m`
}

/**
 * Format heart rate
 */
export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`
}

/**
 * Format calories
 */
export function formatCalories(calories: number): string {
  if (calories >= 1000) {
    return `${(calories / 1000).toFixed(1)}k cal`
  } else {
    return `${Math.round(calories)} cal`
  }
}

/**
 * Format date relative to now
 */
export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7)
    return `${diffWeeks}w ago`
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Format date for activity start time
 */
export function formatActivityDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format time for activity start time
 */
export function formatActivityTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Convert meters per second to pace (seconds per km)
 */
export function speedToPace(metersPerSecond: number): number {
  if (metersPerSecond === 0) return 0
  return 1000 / metersPerSecond
}

/**
 * Convert pace (seconds per km) to speed (m/s)
 */
export function paceToSpeed(secondsPerKm: number): number {
  if (secondsPerKm === 0) return 0
  return 1000 / secondsPerKm
}

/**
 * Calculate pace from distance and time
 */
export function calculatePace(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters === 0 || timeSeconds === 0) return 0
  return (timeSeconds / distanceMeters) * 1000
}

/**
 * Calculate speed from distance and time
 */
export function calculateSpeed(distanceMeters: number, timeSeconds: number): number {
  if (timeSeconds === 0) return 0
  return distanceMeters / timeSeconds
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format large numbers with appropriate suffixes
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  } else {
    return value.toString()
  }
}