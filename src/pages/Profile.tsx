import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useNostrClient } from '../hooks/useNostrClient'
import { KINDS } from '../nostr/kinds'
import { ActivitiesEmptyState, ReviewsEmptyState, TrailsEmptyState } from '../components/common/EmptyState'

interface ProfileMetadata {
  display_name?: string
  name?: string
  about?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string
  website?: string
  location?: string
}

type ProfileTab = 'activities' | 'trails' | 'reviews' | 'stats'

export default function Profile() {
  const navigate = useNavigate()
  const { pubkey, isAuthenticated } = useAuthStore()
  const nostrClient = useNostrClient()
  const [profile, setProfile] = useState<ProfileMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ProfileTab>('activities')

  useEffect(() => {
    if (!isAuthenticated || !pubkey || !nostrClient) {
      setIsLoading(false)
      return
    }

    fetchProfile()
  }, [pubkey, isAuthenticated, nostrClient])

  const fetchProfile = async () => {
    if (!pubkey || !nostrClient) return

    setIsLoading(true)
    setError('')

    try {
      const filter = {
        kinds: [KINDS.SET_METADATA],
        authors: [pubkey],
        limit: 1
      }

      const events = await nostrClient.query(filter, 5000)
      
      if (events.length > 0) {
        const event = events[0]
        try {
          const metadata: ProfileMetadata = JSON.parse(event.content)
          setProfile(metadata)
        } catch (err) {
          console.error('Failed to parse profile metadata:', err)
          setError('Failed to parse profile data')
        }
      } else {
        setProfile({}) // Empty profile
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError(err.message || 'Failed to fetch profile')
    } finally {
      setIsLoading(false)
    }
  }

  const formatPubkey = (pubkey: string) => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center">
        <p className="text-slate-600 dark:text-slate-400">Please login to view your profile</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4">
        {/* Loading skeleton */}
        <div className="animate-pulse">
          {/* Banner skeleton */}
          <div className="h-40 bg-slate-300 dark:bg-slate-700 rounded-lg mb-4"></div>
          
          {/* Avatar and info skeleton */}
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-slate-300 dark:bg-slate-700 rounded-full mr-4"></div>
            <div className="flex-1">
              <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-32"></div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="flex space-x-1 bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mb-6">
            {['activities', 'trails', 'reviews', 'stats'].map((tab) => (
              <div key={tab} className="flex-1 h-10 bg-slate-300 dark:bg-slate-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 pb-20"> {/* Bottom padding for navigation */}
      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-r from-emerald-600 to-emerald-500 overflow-hidden">
        {profile?.banner && (
          <img
            src={profile.banner}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Profile Info Section */}
        <div className="relative -mt-12 pb-6">
          {/* Avatar */}
          <div className="flex items-end mb-6">
            <div className="relative">
              <img
                src={profile?.picture || `https://robohash.org/${pubkey}.png?set=set4`}
                alt="Profile avatar"
                className="w-24 h-24 rounded-full border-4 border-emerald-500 bg-stone-800"
              />
            </div>
            
            <div className="ml-4 flex-1 min-h-[6rem] flex flex-col justify-end">
              <button 
                onClick={() => navigate('/profile/edit')}
                className="self-end bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-medium rounded-xl h-12 px-6 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-stone-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">0 km</div>
              <div className="text-xs text-stone-400 uppercase">Distance</div>
            </div>
            <div className="bg-stone-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-xs text-stone-400 uppercase">Activities</div>
            </div>
            <div className="bg-stone-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">0 m</div>
              <div className="text-xs text-stone-400 uppercase">Elevation</div>
            </div>
          </div>

          {/* Name and Details */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-white">
              {profile?.display_name || profile?.name || 'Anonymous'}
            </h1>
            
            <p className="text-stone-400 text-sm">
              {formatPubkey(pubkey || '')}
            </p>

            {profile?.about && (
              <p className="text-stone-300 leading-relaxed">
                {profile.about}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-stone-400">
              {profile?.location && (
                <div className="flex items-center">
                  <span className="mr-1">📍</span>
                  {profile.location}
                </div>
              )}
              
              {profile?.website && (
                <div className="flex items-center">
                  <span className="mr-1">🌐</span>
                  <a 
                    href={profile.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              
              {profile?.nip05 && (
                <div className="flex items-center">
                  <span className="mr-1">✓</span>
                  <span className="text-emerald-400">
                    {profile.nip05}
                  </span>
                </div>
              )}
              
              {profile?.lud16 && (
                <div className="flex items-center">
                  <span className="mr-1">⚡</span>
                  <span className="text-emerald-400">
                    {profile.lud16}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pt-6">
          <div className="flex space-x-1 bg-stone-800/30 rounded-xl p-1 mb-6">
            {[
              { id: 'activities', label: 'Activities', count: 0 },
              { id: 'trails', label: 'Trails', count: 0 },
              { id: 'reviews', label: 'Reviews', count: 0 },
              { id: 'stats', label: 'Stats', count: null }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ProfileTab)}
                className={`relative flex-1 py-3 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="ml-1 text-xs opacity-75">({tab.count})</span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === 'activities' && (
              <ActivitiesEmptyState
                isOwnProfile={true}
                onRecordActivity={() => navigate('/record')}
              />
            )}

            {activeTab === 'trails' && (
              <TrailsEmptyState onCreateTrail={() => navigate('/trail/create')} />
            )}

            {activeTab === 'reviews' && (
              <ReviewsEmptyState
                isOwnProfile={true}
                onExploreTrails={() => navigate('/trails')}
              />
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Total Distance</div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Activities</div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0h</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Total Time</div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0m</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Elevation Gain</div>
                  </div>
                </div>

                <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
                  Stats will be calculated from your recorded activities
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}