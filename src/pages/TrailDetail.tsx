import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  MapPin, 
  Ruler, 
  Mountain, 
  Star, 
  Heart, 
  Share2, 
  ArrowLeft,
  Users,
  Camera,
  Calendar
} from 'lucide-react'
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useTrailStore } from '../stores/trailStore'
import { useAuthStore } from '../stores/authStore'
import BlurhashImage from '../components/common/BlurhashImage'
import PhotoGallery from '../components/activity/PhotoGallery'
import { ReactionBar } from '../components/social/ReactionBar'
import { CommentThread } from '../components/social/CommentThread'
import { ReviewForm } from '../components/trail/ReviewForm'
import { ReviewList } from '../components/trail/ReviewList'

export default function TrailDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentTrail, currentTrailReviews, fetchTrailById, fetchTrailReviews, isLoadingTrail } = useTrailStore()
  const { isAuthenticated } = useAuthStore()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'activities'>('overview')
  const [isWishlisted, setIsWishlisted] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTrailById(id)
      fetchTrailReviews(id)
    }
  }, [id, fetchTrailById, fetchTrailReviews])

  // Initialize map when trail data loads
  useEffect(() => {
    if (currentTrail && mapContainer.current && !map.current) {
      const coordinates = currentTrail.startCoordinates || [0, 0]
      
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [coordinates[0], coordinates[1]],
        zoom: 13
      })

      // Add controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

      // Add trail marker
      new maplibregl.Marker({
        color: '#22c55e'
      })
        .setLngLat([coordinates[0], coordinates[1]])
        .addTo(map.current)

      // Add route if available (simplified - in real app would show full track)
      if (currentTrail.routeData) {
        // TODO: Add route polyline visualization
        console.log('Route data available for visualization:', currentTrail.routeData)
      }
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [currentTrail])

  const formatDistance = (meters: number): string => {
    const km = meters / 1000
    return km < 1 ? `${meters}m` : `${km.toFixed(1)}km`
  }

  const formatElevation = (meters: number): string => {
    return `${meters}m`
  }

  const handleWishlistToggle = () => {
    setIsWishlisted(!isWishlisted)
    // TODO: Implement wishlist functionality
  }

  const handleShare = async () => {
    if (navigator.share && currentTrail) {
      try {
        await navigator.share({
          title: currentTrail.name,
          text: currentTrail.summary,
          url: window.location.href
        })
      } catch (error) {
        // Fallback to copying URL
        navigator.clipboard.writeText(window.location.href)
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
    }
  }

  if (isLoadingTrail) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          {/* Hero skeleton */}
          <div className="h-64 bg-gray-300"></div>
          
          {/* Content skeleton */}
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="h-8 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-300 rounded"></div>
              <div className="h-16 bg-gray-300 rounded"></div>
              <div className="h-16 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentTrail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mountain className="mx-auto mb-4 text-gray-400" size={48} />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Trail not found</h2>
          <p className="text-gray-500 mb-4">The trail you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/trail-explorer"
            className="inline-flex items-center px-4 py-2 bg-forest-500 text-white rounded-md hover:bg-forest-600"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Explorer
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Image */}
      <div className="relative h-64 bg-gradient-to-br from-forest-500 to-forest-700">
        {currentTrail.heroPhoto ? (
          <BlurhashImage
            src={currentTrail.heroPhoto}
            blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj" // Default fallback
            alt={currentTrail.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mountain className="text-white/20" size={80} />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        
        {/* Back button */}
        <Link
          to="/trail-explorer"
          className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        
        {/* Action buttons */}
        <div className="absolute top-4 right-4 flex space-x-2">
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              className={`p-2 backdrop-blur-sm rounded-full transition-colors ${
                isWishlisted 
                  ? 'bg-red-500 text-white' 
                  : 'bg-black/30 text-white hover:bg-black/50'
              }`}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            onClick={handleShare}
            className="p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition-colors"
          >
            <Share2 size={20} />
          </button>
        </div>

        {/* Trail title overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold text-white mb-1">{currentTrail.name}</h1>
          <div className="flex items-center space-x-3 text-white/90">
            <div className="flex items-center">
              <MapPin size={16} className="mr-1" />
              <span className="text-sm">{currentTrail.location}</span>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              currentTrail.difficulty === 'easy' ? 'bg-green-500' :
              currentTrail.difficulty === 'moderate' ? 'bg-yellow-500' :
              currentTrail.difficulty === 'hard' ? 'bg-orange-500' :
              'bg-red-500'
            }`}>
              {currentTrail.difficulty}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 -mt-8 relative z-10">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <Ruler className="mx-auto mb-2 text-forest-500" size={24} />
            <div className="text-xl font-bold text-gray-800">{formatDistance(currentTrail.distance * 1000)}</div>
            <div className="text-sm text-gray-600">Distance</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <Mountain className="mx-auto mb-2 text-forest-500" size={24} />
            <div className="text-xl font-bold text-gray-800">{formatElevation(currentTrail.elevationGain)}</div>
            <div className="text-sm text-gray-600">Elevation Gain</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <Star className="mx-auto mb-2 text-forest-500" size={24} />
            <div className="text-xl font-bold text-gray-800">{currentTrail.averageRating.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Rating</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <Users className="mx-auto mb-2 text-forest-500" size={24} />
            <div className="text-xl font-bold text-gray-800">{currentTrail.reviewCount}</div>
            <div className="text-sm text-gray-600">Reviews</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'reviews', label: `Reviews (${currentTrail.reviewCount})` },
              { id: 'activities', label: `Activities (${currentTrail.activityCount})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-forest-500 text-forest-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Description */}
            {currentTrail.summary && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">About This Trail</h3>
                <p className="text-gray-600 leading-relaxed">{currentTrail.summary}</p>
              </div>
            )}

            {/* Map */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Map & Route</h3>
              <div className="h-64 rounded-md overflow-hidden">
                <div ref={mapContainer} className="w-full h-full" />
              </div>
            </div>

            {/* Photos */}
            {currentTrail.photos && currentTrail.photos.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Camera className="mr-2" size={20} />
                  Photos ({currentTrail.photos.length})
                </h3>
                <PhotoGallery images={currentTrail.photos.map(url => ({ url }))} />
              </div>
            )}

            {/* Social Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <ReactionBar eventId={currentTrail.id} authorPubkey={currentTrail.authorPubkey} />
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* Review Form */}
            <ReviewForm
              trailAuthorPubkey={currentTrail.authorPubkey}
              trailSlug={currentTrail.dTag}
              onSubmit={() => {
                // Refresh reviews after submission
                fetchTrailReviews(currentTrail.id)
              }}
            />

            {/* Reviews List */}
            <ReviewList
              reviews={currentTrailReviews.map(review => ({
                id: review.id,
                authorPubkey: review.authorPubkey,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                hikedOn: review.hikedOn,
                conditions: review.conditions,
                images: review.images
              }))}
              hasMore={false} // TODO: Implement pagination
              isLoading={false}
            />
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No activities yet</h3>
            <p className="text-gray-500 mb-4">Activities on this trail will appear here.</p>
          </div>
        )}

        {/* Comments */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Comments</h3>
          <CommentThread eventId={currentTrail.id} authorPubkey={currentTrail.authorPubkey} />
        </div>
      </div>
    </div>
  )
}