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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            ← Cancel
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Record Activity
          </h1>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-100 dark:bg-green-900/50 border border-green-400 rounded-lg">
            <p className="text-green-700 dark:text-green-400 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Basic Information
            </h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Activity Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., Morning hike at Bear Mountain"
                required
              />
            </div>

            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Activity Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => updateField('type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {ACTIVITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.emoji} {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => updateField('time', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Activity Stats
            </h2>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.distance}
                onChange={(e) => updateField('distance', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 5.2"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Duration (hours)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.duration}
                onChange={(e) => updateField('duration', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 2.5"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter duration in decimal hours (e.g., 2.5 for 2 hours 30 minutes)
              </p>
            </div>

            {/* Elevation Gain */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Elevation Gain (m)
              </label>
              <input
                type="number"
                value={formData.elevationGain}
                onChange={(e) => updateField('elevationGain', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., 450"
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Location
            </h2>

            {/* Start Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Location
              </label>
              <input
                type="text"
                value={formData.startLocation}
                onChange={(e) => updateField('startLocation', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., Bear Mountain State Park"
              />
            </div>

            {/* End Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Location
              </label>
              <input
                type="text"
                value={formData.endLocation}
                onChange={(e) => updateField('endLocation', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="e.g., Summit lookout point"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Leave blank if same as start location
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Notes & Description
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Activity Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="Share details about your adventure - trail conditions, weather, highlights, challenges, or any other memorable moments..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Recording Activity...' : 'Record Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}