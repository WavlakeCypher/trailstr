import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useNostrClient } from '../hooks/useNostrClient'
import { KINDS } from '../nostr/kinds'
import { buildMetadataEvent } from '../nostr/events'

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

export default function ProfileEdit() {
  const navigate = useNavigate()
  const { pubkey, isAuthenticated, getSigner } = useAuthStore()
  const nostrClient = useNostrClient()
  
  const [profile, setProfile] = useState<ProfileMetadata>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    fetchCurrentProfile()
  }, [isAuthenticated, navigate])

  const fetchCurrentProfile = async () => {
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
          setProfile({}) // Start with empty profile
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError('Failed to load current profile')
    } finally {
      setIsLoading(false)
    }
  }

  const updateField = (field: keyof ProfileMetadata, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value.trim() || undefined
    }))
  }

  const handleSave = async () => {
    const signer = getSigner()
    if (!pubkey || !nostrClient || !signer) {
      setError('Not properly authenticated')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    try {
      // Create metadata event
      const eventTemplate = buildMetadataEvent(profile)
      
      // Sign the event
      const signedEvent = await signer.signEvent(eventTemplate)
      
      // Publish to relays
      await nostrClient.publish(signedEvent)
      
      setSuccessMessage('Profile updated successfully!')
      
      // Navigate back to profile after a delay
      setTimeout(() => {
        navigate('/profile')
      }, 2000)
      
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    navigate('/profile')
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-48"></div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-24"></div>
                <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
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
            Edit Profile
          </h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
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
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={profile.display_name || ''}
              onChange={(e) => updateField('display_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="Your display name"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="username"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Bio
            </label>
            <textarea
              value={profile.about || ''}
              onChange={(e) => updateField('about', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
              placeholder="Tell us about yourself and your outdoor adventures..."
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Avatar URL
            </label>
            <input
              type="url"
              value={profile.picture || ''}
              onChange={(e) => updateField('picture', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="https://example.com/avatar.jpg"
            />
            {profile.picture && (
              <div className="mt-2">
                <img
                  src={profile.picture}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600"
                />
              </div>
            )}
          </div>

          {/* Banner URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Banner URL
            </label>
            <input
              type="url"
              value={profile.banner || ''}
              onChange={(e) => updateField('banner', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="https://example.com/banner.jpg"
            />
            {profile.banner && (
              <div className="mt-2">
                <img
                  src={profile.banner}
                  alt="Banner preview"
                  className="w-full h-24 rounded-lg object-cover border-2 border-slate-300 dark:border-slate-600"
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={profile.location || ''}
              onChange={(e) => updateField('location', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="City, Country"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={profile.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* NIP-05 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              NIP-05 Identifier
            </label>
            <input
              type="text"
              value={profile.nip05 || ''}
              onChange={(e) => updateField('nip05', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="username@domain.com"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verified identity (requires domain setup)
            </p>
          </div>

          {/* Lightning Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Lightning Address (LUD16)
            </label>
            <input
              type="text"
              value={profile.lud16 || ''}
              onChange={(e) => updateField('lud16', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="username@walletprovider.com"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              For receiving lightning payments (zaps)
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}