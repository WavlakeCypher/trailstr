import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useFeedStore } from '../stores/feedStore'
import { buildActivityEvent } from '../nostr/events'
import { useNostrClient } from '../hooks/useNostrClient'

// Activity types
const ACTIVITY_TYPES = [
  { value: 'hiking', label: 'Hiking', emoji: '🥾' },
  { value: 'running', label: 'Running', emoji: '🏃‍♂️' },
  { value: 'cycling', label: 'Cycling', emoji: '🚴‍♂️' },
  { value: 'walking', label: 'Walking', emoji: '🚶‍♂️' },
  { value: 'mountaineering', label: 'Mountaineering', emoji: '🧗‍♂️' },
  { value: 'skiing', label: 'Skiing', emoji: '⛷️' },
  { value: 'snowboarding', label: 'Snowboarding', emoji: '🏂' },
  { value: 'kayaking', label: 'Kayaking', emoji: '🛶' },
  { value: 'climbing', label: 'Climbing', emoji: '🧗‍♀️' },
  { value: 'swimming', label: 'Swimming', emoji: '🏊‍♂️' },
  { value: 'other', label: 'Other', emoji: '🏃‍♀️' },
]

interface ActivityFormData {
  title: string
  type: string
  date: string
  time: string
  distance: string
  duration: string
  elevationGain: string
  notes: string
  startLocation: string
  endLocation: string
}

export default function RecordActivity() {
  const navigate = useNavigate()
  const { isAuthenticated, getSigner, pubkey } = useAuthStore()
  const { addActivity } = useFeedStore()
  const nostrClient = useNostrClient()

  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    type: 'hiking',
    date: new Date().toISOString().split('T')[0], // Today's date
    time: new Date().toTimeString().slice(0, 5), // Current time HH:MM
    distance: '',
    duration: '',
    elevationGain: '',
    notes: '',
    startLocation: '',
    endLocation: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const updateField = (field: keyof ActivityFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Activity title is required')
      return false
    }

    if (!formData.date) {
      setError('Activity date is required')
      return false
    }

    // Validate numeric fields if provided
    if (formData.distance && isNaN(parseFloat(formData.distance))) {
      setError('Distance must be a valid number')
      return false
    }

    if (formData.duration && isNaN(parseFloat(formData.duration))) {
      setError('Duration must be a valid number')
      return false
    }

    if (formData.elevationGain && isNaN(parseFloat(formData.elevationGain))) {
      setError('Elevation gain must be a valid number')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const signer = getSigner()
      if (!signer || !pubkey || !nostrClient) {
        throw new Error('Not properly authenticated')
      }

      // Prepare activity data in the expected format
      const activityDateTime = new Date(`${formData.date}T${formData.time}:00.000Z`)
      const startedAt = Math.floor(activityDateTime.getTime() / 1000)
      
      const activityData = {
        title: formData.title.trim(),
        type: formData.type,
        startedAt,
        distanceMeters: formData.distance ? parseFloat(formData.distance) * 1000 : undefined, // Convert km to meters
        elevationGainMeters: formData.elevationGain ? parseFloat(formData.elevationGain) : undefined,
        elapsedSeconds: formData.duration ? parseFloat(formData.duration) * 3600 : undefined, // Convert hours to seconds
        content: formData.notes.trim() || undefined,
        // TODO: Add additional fields
        latitude: undefined,
        longitude: undefined,
        images: [], // TODO: Add photo upload functionality
      }

      // Create activity event
      const eventTemplate = buildActivityEvent(activityData, pubkey)
      const signedEvent = await signer.signEvent(eventTemplate)

      // Add to feed optimistically (before relay confirmation)
      const optimisticActivity = {
        id: signedEvent.id || `temp-${Date.now()}`,
        authorPubkey: pubkey,
        createdAt: signedEvent.created_at,
        title: activityData.title,
        type: activityData.type,
        date: activityDateTime.toISOString(),
        distance: activityData.distanceMeters ? activityData.distanceMeters / 1000 : undefined, // Convert back to km for display
        duration: activityData.elapsedSeconds ? activityData.elapsedSeconds / 3600 : undefined, // Convert back to hours for display
        elevationGain: activityData.elevationGainMeters,
        notes: activityData.content || '',
        geoTags: [],
        dTag: signedEvent.tags.find(tag => tag[0] === 'd')?.[1] || '',
        reactionCount: 0,
        commentCount: 0,
        zapAmount: 0,
        photos: [],
        rawEvent: signedEvent
      }

      addActivity(optimisticActivity, true)

      // Publish to relays
      await nostrClient.publish(signedEvent)

      setSuccessMessage('Activity recorded successfully!')

      // Clear form
      setFormData({
        title: '',
        type: 'hiking',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        distance: '',
        duration: '',
        elevationGain: '',
        notes: '',
        startLocation: '',
        endLocation: ''
      })

      // Navigate back to feed after a delay
      setTimeout(() => {
        navigate('/')
      }, 2000)

    } catch (err: any) {
      console.error('Failed to record activity:', err)
      setError(err.message || 'Failed to record activity')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate(-1) // Go back to previous page
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-stone-900 pb-20">
      {/* Header */}
      <header className="bg-stone-900 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center relative">
            <button
              onClick={handleCancel}
              className="absolute left-0 text-stone-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              aria-label="Go back"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-white">
              Record Activity
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* Featured Live Recording Block */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 border border-emerald-500/50 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-emerald-500/10 rounded-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <h3 className="text-lg font-semibold text-white">Live Recording</h3>
            </div>
            <p className="text-stone-300 mb-4 text-sm">
              Track your adventure in real-time with GPS, live stats, and route mapping for the most accurate activity data.
            </p>
            <button
              onClick={() => navigate('/record/live')}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              🏃‍♂️ Start Live Recording
            </button>
          </div>
        </div>

        {/* Messages */}
        <div aria-live="polite">
          {error && (
            <div className="bg-red-900/50 border border-red-700/50 rounded-2xl p-4" role="alert">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-900/50 border border-emerald-700/50 rounded-2xl p-4" role="status">
              <p className="text-emerald-300 text-sm">{successMessage}</p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-stone-400 font-medium">Basic Information</p>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="activity-title" className="block text-sm font-medium text-white mb-3">
                  Activity Title *
                </label>
                <input
                  id="activity-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Morning hike at Bear Mountain"
                  required
                />
              </div>

              {/* Activity Type - Visual Pills */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Activity Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ACTIVITY_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField('type', type.value)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        formData.type === type.value
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <span className="text-lg">{type.emoji}</span>
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="activity-date" className="block text-sm font-medium text-white mb-3">
                    Date *
                  </label>
                  <input
                    id="activity-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="activity-time" className="block text-sm font-medium text-white mb-3">
                    Start Time
                  </label>
                  <input
                    id="activity-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => updateField('time', e.target.value)}
                    className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-stone-400 font-medium">Activity Stats</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Distance */}
              <div>
                <label htmlFor="activity-distance" className="block text-sm font-medium text-white mb-3">
                  Distance (km)
                </label>
                <input
                  id="activity-distance"
                  type="number"
                  step="0.1"
                  value={formData.distance}
                  onChange={(e) => updateField('distance', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="5.2"
                />
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="activity-duration" className="block text-sm font-medium text-white mb-3">
                  Duration (hours)
                </label>
                <input
                  id="activity-duration"
                  type="number"
                  step="0.1"
                  value={formData.duration}
                  onChange={(e) => updateField('duration', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="2.5"
                />
                <p className="text-xs text-stone-500 mt-2">
                  Decimal format (2.5 = 2h 30m)
                </p>
              </div>

              {/* Elevation Gain */}
              <div>
                <label htmlFor="activity-elevation" className="block text-sm font-medium text-white mb-3">
                  Elevation (m)
                </label>
                <input
                  id="activity-elevation"
                  type="number"
                  value={formData.elevationGain}
                  onChange={(e) => updateField('elevationGain', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="450"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-stone-400 font-medium">Location</p>
            </div>

            <div className="space-y-4">
              {/* Start Location */}
              <div>
                <label htmlFor="activity-start-location" className="block text-sm font-medium text-white mb-3">
                  Start Location
                </label>
                <input
                  id="activity-start-location"
                  type="text"
                  value={formData.startLocation}
                  onChange={(e) => updateField('startLocation', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Bear Mountain State Park"
                />
              </div>

              {/* End Location */}
              <div>
                <label htmlFor="activity-end-location" className="block text-sm font-medium text-white mb-3">
                  End Location
                </label>
                <input
                  id="activity-end-location"
                  type="text"
                  value={formData.endLocation}
                  onChange={(e) => updateField('endLocation', e.target.value)}
                  className="w-full min-h-[48px] bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Summit lookout point"
                />
                <p className="text-xs text-stone-500 mt-2">
                  Leave blank if same as start location
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-stone-400 font-medium">Notes & Description</p>
            </div>

            <div>
              <label htmlFor="activity-notes" className="block text-sm font-medium text-white mb-3">
                Activity Notes
              </label>
              <textarea
                id="activity-notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={6}
                className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors resize-none"
                placeholder="Share details about your adventure - trail conditions, weather, highlights, challenges, or any other memorable moments..."
              />
              <p className="text-xs text-stone-500 mt-2">
                Tell your story - what made this adventure special?
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="sm:flex-1 bg-transparent border border-stone-600 text-stone-300 hover:text-white hover:border-stone-500 font-medium py-4 px-6 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-stone-600 disabled:to-stone-600 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              {isSubmitting ? 'Recording Activity...' : 'Save Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}