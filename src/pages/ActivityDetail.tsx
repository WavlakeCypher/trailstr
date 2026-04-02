import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  Edit, 
  Trash2, 
  Share,
  Link2
} from 'lucide-react'
import MapView from '../components/map/MapView'
import TrackLayer, { type ColorMode } from '../components/map/TrackLayer'
import ElevationChart from '../components/activity/ElevationChart'
import StatsGrid from '../components/activity/StatsGrid'
import PhotoGallery from '../components/activity/PhotoGallery'
import Avatar from '../components/common/Avatar'
import { ReactionBar } from '../components/social/ReactionBar'
import { CommentThread } from '../components/social/CommentThread'
import { FollowButton } from '../components/social/FollowButton'
import { ZapButton } from '../components/social/ZapButton'
import { useAuthStore } from '../stores/authStore'
import { useFeedStore } from '../stores/feedStore'
import type { Activity, ActivityType } from '../types/activity'
import { formatActivityDate, formatActivityTime } from '../utils/formatting'

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

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile: userProfile, pubkey: currentUserPubkey } = useAuthStore()
  const { activities } = useFeedStore()
  
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapColorMode, setMapColorMode] = useState<ColorMode>('default')
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [showAllPhotos, setShowAllPhotos] = useState(false)

  useEffect(() => {
    if (!id) return

    const foundActivity = activities.find(a => a.id === id)
    if (foundActivity) {
      const fullActivity: Activity = {
        id: foundActivity.id,
        authorPubkey: foundActivity.authorPubkey,
        createdAt: foundActivity.createdAt,
        activityId: foundActivity.dTag,
        type: foundActivity.type as ActivityType,
        title: foundActivity.title,
        startedAt: new Date(foundActivity.date).getTime() / 1000,
        
        metrics: {
          distanceMeters: foundActivity.distance,
          movingSeconds: foundActivity.duration,
          elevationGainMeters: foundActivity.elevationGain,
          avgPaceSecondsPerKm: foundActivity.distance && foundActivity.duration 
            ? (foundActivity.duration / (foundActivity.distance / 1000)) 
            : undefined
        },
        
        content: foundActivity.notes,
        reactionCount: foundActivity.reactionCount,
        commentCount: foundActivity.commentCount,
        zapAmount: foundActivity.zapAmount,
        
        images: foundActivity.photos.map(url => ({ url })),
        
        track: foundActivity.gpxData ? {
          points: foundActivity.gpxData.coordinates?.map((coord: [number, number, number?]) => ({
            longitude: coord[0],
            latitude: coord[1],
            elevation: coord[2]
          })) || []
        } : undefined
      }
      
      setActivity(fullActivity)
      setLoading(false)
      return
    }

    setError('Activity not found')
    setLoading(false)
  }, [id, activities])

  const { mapCenter, mapZoom } = useMemo(() => {
    if (!activity?.track?.points || activity.track.points.length === 0) {
      return { mapCenter: [0, 0] as [number, number], mapZoom: 2 }
    }

    const points = activity.track.points
    const bounds = {
      minLat: Math.min(...points.map(p => p.latitude)),
      maxLat: Math.max(...points.map(p => p.latitude)),
      minLng: Math.min(...points.map(p => p.longitude)),
      maxLng: Math.max(...points.map(p => p.longitude))
    }

    const center: [number, number] = [
      (bounds.minLng + bounds.maxLng) / 2,
      (bounds.minLat + bounds.maxLat) / 2
    ]

    const latDiff = bounds.maxLat - bounds.minLat
    const lngDiff = bounds.maxLng - bounds.minLng
    const maxDiff = Math.max(latDiff, lngDiff)
    
    let zoom = 15
    if (maxDiff > 0.1) zoom = 10
    else if (maxDiff > 0.05) zoom = 12
    else if (maxDiff > 0.01) zoom = 14

    return { mapCenter: center, mapZoom: zoom }
  }, [activity?.track])

  const isOwner = currentUserPubkey === activity?.authorPubkey

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center" role="status">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" aria-hidden="true"></div>
          <p className="text-stone-400">Loading activity...</p>
        </div>
      </div>
    )
  }

  if (error || !activity) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center" role="alert">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Activity not found'}</p>
          <Link 
            to="/feed" 
            className="text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
          >
            ← Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  return (
    <article className="min-h-screen bg-stone-900" aria-labelledby="activity-title">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur border-b border-stone-700/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                to="/feed"
                className="text-stone-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-1"
                aria-label="Back to feed"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </Link>
              <h1 id="activity-title" className="text-xl font-semibold text-white truncate">
                {activity.title}
              </h1>
            </div>

            <div className="flex items-center space-x-2">
              {isOwner && (
                <>
                  <button
                    className="p-2 text-stone-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                    aria-label="Edit activity"
                  >
                    <Edit size={18} aria-hidden="true" />
                  </button>
                  <button
                    className="p-2 text-stone-400 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                    aria-label="Delete activity"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </>
              )}
              <button
                className="p-2 text-stone-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                aria-label="Share activity"
              >
                <Share size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* Activity Header */}
        <section className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6" aria-label="Activity details">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Avatar 
                src={userProfile?.picture} 
                alt={userProfile?.display_name || userProfile?.name}
                fallback={userProfile?.display_name || userProfile?.name}
                size="md"
              />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {userProfile?.display_name || userProfile?.name || 'Anonymous'}
                </h2>
                <div className="flex items-center space-x-2 text-sm text-stone-400">
                  <span className="flex items-center space-x-1">
                    <span aria-hidden="true">{activityTypeIcons[activity.type]}</span>
                    <span>{activityTypeLabels[activity.type]}</span>
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center space-x-1">
                    <Calendar size={14} aria-hidden="true" />
                    <time dateTime={new Date(activity.startedAt * 1000).toISOString()}>
                      {formatActivityDate(activity.startedAt)} at {formatActivityTime(activity.startedAt)}
                    </time>
                  </span>
                </div>
              </div>
            </div>
            
            {!isOwner && (
              <FollowButton 
                targetPubkey={activity.authorPubkey}
                size="md"
              />
            )}
          </div>

          {activity.content && (
            <div className="prose prose-sm max-w-none">
              <p className="text-stone-300">{activity.content}</p>
            </div>
          )}
        </section>

        {/* Map and Track */}
        {activity.track && activity.track.points.length > 0 && (
          <section className="bg-stone-800/50 border border-stone-700/50 rounded-2xl overflow-hidden" aria-label="Route map">
            <div className="p-6 border-b border-stone-700/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  Route Map
                </h3>
                
                <div className="flex items-center space-x-2">
                  <label htmlFor="color-mode-select" className="text-xs text-stone-400">Color by:</label>
                  <select
                    id="color-mode-select"
                    value={mapColorMode}
                    onChange={(e) => setMapColorMode(e.target.value as ColorMode)}
                    className="text-sm bg-stone-800 border border-stone-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="default">Default</option>
                    <option value="pace">Pace</option>
                    <option value="elevation">Elevation</option>
                    <option value="heartRate">Heart Rate</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="h-80" role="img" aria-label="Activity route displayed on map">
              <MapView
                center={mapCenter}
                zoom={mapZoom}
                showControls={true}
                showScale={true}
                className="h-full"
              >
                <TrackLayer
                  points={activity.track.points}
                  colorMode={mapColorMode}
                  highlightPointIndex={highlightIndex || undefined}
                  onTrackClick={(_, index) => {
                    setHighlightIndex(index)
                  }}
                />
              </MapView>
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <section aria-label="Activity statistics">
          <StatsGrid 
            metrics={activity.metrics}
            activityType={activity.type}
          />
        </section>

        {/* Elevation Chart */}
        {activity.track && activity.track.points.length > 0 && (
          <section className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6" aria-label="Elevation profile">
            <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-4">
              Elevation Profile
            </h3>
            <ElevationChart
              points={activity.track.points}
              showHeartRate={activity.track.points.some(p => p.heartRate)}
              highlightIndex={highlightIndex || undefined}
              onHover={setHighlightIndex}
              height={200}
            />
          </section>
        )}

        {/* Photos */}
        {activity.images && activity.images.length > 0 && (
          <section className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6" aria-label="Activity photos">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                Photos ({activity.images.length})
              </h3>
            </div>
            <PhotoGallery 
              images={activity.images}
              maxPreview={showAllPhotos ? activity.images.length : 8}
              onPhotoClick={(image, _) => {
                if (image.latitude && image.longitude && activity.track?.points) {
                  const photoPoint = { latitude: image.latitude, longitude: image.longitude }
                  let closestIndex = 0
                  let closestDistance = Infinity
                  
                  activity.track.points.forEach((point, idx) => {
                    const distance = Math.sqrt(
                      Math.pow(point.latitude - photoPoint.latitude, 2) +
                      Math.pow(point.longitude - photoPoint.longitude, 2)
                    )
                    if (distance < closestDistance) {
                      closestDistance = distance
                      closestIndex = idx
                    }
                  })
                  
                  setHighlightIndex(closestIndex)
                }
              }}
            />
            {!showAllPhotos && activity.images.length > 8 && (
              <button
                onClick={() => setShowAllPhotos(true)}
                className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              >
                View all {activity.images.length} photos
              </button>
            )}
          </section>
        )}

        {/* Social Section */}
        <section className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6" aria-label="Social interactions">
          <div className="space-y-6">
            {/* Reaction Bar */}
            <div>
              <h4 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">Reactions</h4>
              <ReactionBar
                eventId={activity.id}
                authorPubkey={activity.authorPubkey}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-4 py-2 border-y border-stone-700/50">
              <ZapButton
                eventId={activity.id}
                authorPubkey={activity.authorPubkey}
              />
              
              <button className="flex items-center space-x-2 text-stone-400 hover:text-emerald-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1">
                <Link2 size={18} aria-hidden="true" />
                <span>Link to Trail</span>
              </button>
            </div>
            
            {/* Comment Thread */}
            <div>
              <h4 className="sr-only">Comments</h4>
              <CommentThread
                eventId={activity.id}
                authorPubkey={activity.authorPubkey}
              />
            </div>
          </div>
        </section>
      </div>
    </article>
  )
}
