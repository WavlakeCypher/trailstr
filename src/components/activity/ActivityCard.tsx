import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Clock, TrendingUp, Heart, MessageCircle, Camera } from 'lucide-react'
import Avatar from '../common/Avatar'
import type { ActivityFeedItem, ActivityType } from '../../types/activity'
import { formatDuration, formatDistance, formatPace } from '../../utils/formatting'

interface ActivityCardProps {
  activity: ActivityFeedItem
}

const activityTypeIcons: Record<ActivityType, string> = {
  walk: '🚶',
  hike: '🥾',
  run: '🏃',
  trail_run: '🏃‍♂️',
  bike: '🚴',
  mountain_bike: '🚵',
  road_bike: '🚴‍♂️',
  swim: '🏊',
  kayak: '🛶',
  ski: '🎿',
  snowboard: '🏂',
  climb: '🧗',
  other: '🏃'
}

const activityTypeLabels: Record<ActivityType, string> = {
  walk: 'Walk',
  hike: 'Hike', 
  run: 'Run',
  trail_run: 'Trail Run',
  bike: 'Bike Ride',
  mountain_bike: 'Mountain Bike',
  road_bike: 'Road Bike',
  swim: 'Swim',
  kayak: 'Kayak',
  ski: 'Ski',
  snowboard: 'Snowboard',
  climb: 'Climb',
  other: 'Activity'
}


export default function ActivityCard({ activity }: ActivityCardProps) {
  const [miniMapUrl, setMiniMapUrl] = useState<string | null>(null)
  const [isLoadingMap, setIsLoadingMap] = useState(false)

  // Generate mini map thumbnail
  useEffect(() => {
    if (activity.hasTrack && activity.track?.points && activity.track.points.length > 0) {
      generateMiniMap()
    }
  }, [activity.track])

  const generateMiniMap = async () => {
    if (!activity.track?.points || activity.track.points.length === 0) return

    setIsLoadingMap(true)
    
    try {
      // Use a simple static map approach for now
      // In a full implementation, you'd use MapLibre to render a static image
      const points = activity.track.points
      const bounds = calculateBounds(points)
      
      // For demo purposes, create a placeholder colored rectangle
      const canvas = document.createElement('canvas')
      canvas.width = 120
      canvas.height = 80
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Background
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(0, 0, 120, 80)
        
        // Simple track representation
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2
        ctx.beginPath()
        
        const xScale = 100 / Math.abs(bounds.maxLng - bounds.minLng || 0.01)
        const yScale = 60 / Math.abs(bounds.maxLat - bounds.minLat || 0.01)
        
        points.forEach((point, index) => {
          const x = 10 + (point.longitude - bounds.minLng) * xScale
          const y = 70 - (point.latitude - bounds.minLat) * yScale
          
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        
        ctx.stroke()
        
        // Start point
        ctx.fillStyle = '#16a34a'
        ctx.beginPath()
        const startX = 10 + (points[0].longitude - bounds.minLng) * xScale
        const startY = 70 - (points[0].latitude - bounds.minLat) * yScale
        ctx.arc(startX, startY, 3, 0, Math.PI * 2)
        ctx.fill()
        
        // End point
        if (points.length > 1) {
          ctx.fillStyle = '#dc2626'
          ctx.beginPath()
          const endPoint = points[points.length - 1]
          const endX = 10 + (endPoint.longitude - bounds.minLng) * xScale
          const endY = 70 - (endPoint.latitude - bounds.minLat) * yScale
          ctx.arc(endX, endY, 3, 0, Math.PI * 2)
          ctx.fill()
        }
        
        setMiniMapUrl(canvas.toDataURL())
      }
    } catch (error) {
      console.error('Failed to generate mini map:', error)
    } finally {
      setIsLoadingMap(false)
    }
  }

  const calculateBounds = (points: Array<{latitude: number, longitude: number}>) => {
    return points.reduce(
      (bounds, point) => ({
        minLat: Math.min(bounds.minLat, point.latitude),
        maxLat: Math.max(bounds.maxLat, point.latitude),
        minLng: Math.min(bounds.minLng, point.longitude),
        maxLng: Math.max(bounds.maxLng, point.longitude)
      }),
      {
        minLat: points[0]?.latitude || 0,
        maxLat: points[0]?.latitude || 0,
        minLng: points[0]?.longitude || 0,
        maxLng: points[0]?.longitude || 0
      }
    )
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <Link to={`/activity/${activity.id}`} className="block">
      <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <Avatar 
                src={activity.author.picture} 
                alt={activity.author.displayName || activity.author.name}
                fallback={activity.author.displayName || activity.author.name}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-white truncate">
                    {activity.author.displayName || activity.author.name || 'Anonymous'}
                  </p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-300">
                    {activityTypeIcons[activity.type]} {activityTypeLabels[activity.type]}
                  </span>
                </div>
                <p className="text-xs text-stone-400">
                  {formatDate(activity.createdAt)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Activity Title */}
          <h3 className="mt-2 text-lg font-semibold text-white line-clamp-2">
            {activity.title}
          </h3>
        </div>

        {/* Mini Map / Track Thumbnail */}
        {(activity.hasTrack || miniMapUrl) && (
          <div className="px-6 pb-4">
            <div className="relative bg-stone-700 rounded-xl overflow-hidden" style={{ height: '120px' }}>
              {isLoadingMap ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                </div>
              ) : miniMapUrl ? (
                <img 
                  src={miniMapUrl} 
                  alt="Activity track" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-stone-500">
                  <MapPin size={24} />
                </div>
              )}
              
              {/* Track overlay info */}
              {activity.hasTrack && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  GPS Track
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Row */}
        {activity.metrics && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {activity.metrics.distanceMeters && (
                <div className="flex items-center space-x-1 text-stone-300">
                  <MapPin size={14} className="text-emerald-400" />
                  <span>{formatDistance(activity.metrics.distanceMeters)}</span>
                </div>
              )}
              
              {activity.metrics.movingSeconds && (
                <div className="flex items-center space-x-1 text-stone-300">
                  <Clock size={14} className="text-emerald-400" />
                  <span>{formatDuration(activity.metrics.movingSeconds)}</span>
                </div>
              )}
              
              {activity.metrics.elevationGainMeters && (
                <div className="flex items-center space-x-1 text-stone-300">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span>{Math.round(activity.metrics.elevationGainMeters)}m</span>
                </div>
              )}
              
              {activity.metrics.avgPaceSecondsPerKm && (
                <div className="flex items-center space-x-1 text-stone-300">
                  <span className="text-xs text-emerald-400">⚡</span>
                  <span>{formatPace(activity.metrics.avgPaceSecondsPerKm, activity.type)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Thumbnails */}
        {activity.images && activity.images.length > 0 && (
          <div className="px-6 pb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {activity.images.slice(0, 4).map((image, index) => (
                <div key={index} className="flex-shrink-0 relative">
                  <img
                    src={image.url}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                  {index === 3 && activity.images!.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center text-white text-xs">
                      +{activity.images!.length - 3}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Stats Footer */}
        <div className="px-6 py-4 bg-stone-800/30 border-t border-stone-700/50">
          <div className="flex items-center justify-between text-sm text-stone-400">
            <div className="flex items-center space-x-4">
              {activity.reactionCount && activity.reactionCount > 0 && (
                <div className="flex items-center space-x-1">
                  <Heart size={14} className="text-emerald-400" />
                  <span>{activity.reactionCount}</span>
                </div>
              )}
              
              {activity.commentCount && activity.commentCount > 0 && (
                <div className="flex items-center space-x-1">
                  <MessageCircle size={14} className="text-emerald-400" />
                  <span>{activity.commentCount}</span>
                </div>
              )}
              
              {activity.hasPhotos && (
                <div className="flex items-center space-x-1">
                  <Camera size={14} className="text-emerald-400" />
                  <span>{activity.images?.length || 0}</span>
                </div>
              )}
            </div>
            
            {activity.location && (
              <div className="text-xs text-stone-500 truncate">
                {activity.location}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}