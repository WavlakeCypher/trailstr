import { useState } from 'react'
import { Star, Send, Upload, X, Calendar, Mountain, CloudSnow, Sun, Zap } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { buildReviewEvent } from '../../nostr/events'
import { uploadToNostrBuild } from '../../nostr/nip96'
import { resizeImageAndGenerateBlurhash } from '../../utils/media'

interface ReviewFormProps {
  trailAuthorPubkey: string
  trailSlug: string
  onSubmit?: () => void
  className?: string
}

interface ReviewData {
  rating: number
  comment: string
  hikedOn?: Date
  conditions: string[]
  images: File[]
}

const CONDITION_OPTIONS = [
  { value: 'dry', label: 'Dry', icon: Sun, color: 'text-yellow-600' },
  { value: 'muddy', label: 'Muddy', icon: Mountain, color: 'text-amber-600' },
  { value: 'icy', label: 'Icy', icon: CloudSnow, color: 'text-blue-600' },
  { value: 'snow', label: 'Snow', icon: CloudSnow, color: 'text-blue-600' },
  { value: 'crowded', label: 'Crowded', icon: Zap, color: 'text-red-600' },
  { value: 'quiet', label: 'Quiet', icon: Zap, color: 'text-green-600' },
  { value: 'overgrown', label: 'Overgrown', icon: Mountain, color: 'text-green-700' },
  { value: 'washed-out', label: 'Washed Out', icon: Mountain, color: 'text-red-700' }
]

export function ReviewForm({ trailAuthorPubkey, trailSlug, onSubmit, className = '' }: ReviewFormProps) {
  const { isAuthenticated, getSigner } = useAuthStore()
  
  const [reviewData, setReviewData] = useState<ReviewData>({
    rating: 0,
    comment: '',
    hikedOn: undefined,
    conditions: [],
    images: []
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    message: string
  } | null>(null)

  const handleRatingChange = (newRating: number) => {
    setReviewData(prev => ({ ...prev, rating: newRating }))
  }

  const handleConditionToggle = (condition: string) => {
    setReviewData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter(c => c !== condition)
        : [...prev.conditions, condition]
    }))
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return
    
    const fileArray = Array.from(files).slice(0, 5) // Max 5 images
    setReviewData(prev => ({
      ...prev,
      images: [...prev.images, ...fileArray].slice(0, 5)
    }))
  }

  const removeImage = (index: number) => {
    setReviewData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isAuthenticated || reviewData.rating === 0 || !reviewData.comment.trim()) {
      return
    }

    const signer = getSigner()
    if (!signer) return

    setIsSubmitting(true)
    setUploadProgress({ current: 0, total: 1, message: 'Starting submission...' })

    try {
      let imageData: Array<{url: string, blurhash?: string}> = []

      // Upload images if any
      if (reviewData.images.length > 0) {
        for (let i = 0; i < reviewData.images.length; i++) {
          setUploadProgress({
            current: i,
            total: reviewData.images.length,
            message: `Uploading image ${i + 1}...`
          })

          const resized = await resizeImageAndGenerateBlurhash(reviewData.images[i])
          const url = await uploadToNostrBuild(resized.blob, signer.signEvent.bind(signer))
          imageData.push({ url, blurhash: resized.blurhash })
        }
      }

      setUploadProgress({ current: 1, total: 1, message: 'Publishing review...' })

      // Build review event
      const reviewEventData = {
        trailAuthorPubkey,
        trailSlug,
        rating: reviewData.rating as 1 | 2 | 3 | 4 | 5,
        content: reviewData.comment,
        hikedOn: reviewData.hikedOn ? Math.floor(reviewData.hikedOn.getTime() / 1000) : undefined,
        conditions: reviewData.conditions.length > 0 ? reviewData.conditions : undefined,
        images: imageData.length > 0 ? imageData : undefined
      }

      // Get pubkey from auth store
      const { pubkey } = useAuthStore.getState()
      if (!pubkey) throw new Error('No pubkey available')

      const reviewEvent = buildReviewEvent(reviewEventData, pubkey)
      const signedEvent = await signer.signEvent(reviewEvent)

      // Publish to relays
      const { nostrClient } = await import('../../nostr/client')
      await nostrClient.publish(signedEvent)

      // Reset form
      setReviewData({
        rating: 0,
        comment: '',
        hikedOn: undefined,
        conditions: [],
        images: []
      })

      // Call onSubmit callback
      onSubmit?.()

    } catch (error) {
      console.error('Failed to submit review:', error)
      alert('Failed to submit review. Please try again.')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className={`bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-6 text-center ${className}`}>
        <Star className="mx-auto mb-3 text-stone-400 dark:text-stone-500" size={24} />
        <p className="text-stone-600 dark:text-stone-400 mb-3">Sign in to write a review</p>
        <button className="text-forest-600 hover:text-forest-700 font-medium">
          Sign In
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 ${className}`}>
      <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-6">Write a Review</h3>

      {/* Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          Your Rating *
        </label>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(star)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                size={24}
                fill={star <= reviewData.rating ? '#F59E0B' : 'none'}
                stroke={star <= reviewData.rating ? '#F59E0B' : '#D1D5DB'}
                className="transition-colors"
              />
            </button>
          ))}
          <span className="ml-3 text-sm text-stone-600 dark:text-stone-400">
            {reviewData.rating > 0 && (
              ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewData.rating - 1]
            )}
          </span>
        </div>
      </div>

      {/* Review Text */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          Your Review *
        </label>
        <textarea
          value={reviewData.comment}
          onChange={(e) => setReviewData(prev => ({ ...prev, comment: e.target.value }))}
          rows={4}
          placeholder="Share your experience on this trail..."
          className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-md bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500 resize-none"
          required
        />
      </div>

      {/* Hike Date */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          When did you hike this trail?
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500" size={16} />
          <input
            type="date"
            value={reviewData.hikedOn ? reviewData.hikedOn.toISOString().split('T')[0] : ''}
            onChange={(e) => setReviewData(prev => ({ 
              ...prev, 
              hikedOn: e.target.value ? new Date(e.target.value) : undefined 
            }))}
            className="w-full pl-10 pr-3 py-2 border border-stone-300 dark:border-stone-600 rounded-md bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>
      </div>

      {/* Trail Conditions */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          Trail Conditions
        </label>
        <div className="flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((condition) => {
            const Icon = condition.icon
            const isSelected = reviewData.conditions.includes(condition.value)
            
            return (
              <button
                key={condition.value}
                type="button"
                onClick={() => handleConditionToggle(condition.value)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  isSelected
                    ? 'bg-forest-100 border-forest-300 text-forest-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-stone-50 dark:hover:bg-stone-700'
                }`}
              >
                <Icon size={14} className={condition.color} />
                <span>{condition.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Photo Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
          Photos (optional)
        </label>
        
        <label className="block w-full p-4 border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-md cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700">
          <div className="text-center">
            <Upload className="mx-auto mb-2 text-stone-400 dark:text-stone-500" size={24} />
            <p className="text-sm text-stone-600 dark:text-stone-400">Click to add photos (max 5)</p>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleImageUpload(e.target.files)}
            className="hidden"
            disabled={reviewData.images.length >= 5}
          />
        </label>

        {/* Image Previews */}
        {reviewData.images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {reviewData.images.map((file, index) => (
              <div key={index} className="relative">
                <div className="aspect-square bg-stone-200 dark:bg-stone-700 rounded-md flex items-center justify-center">
                  <span className="text-xs text-stone-600 dark:text-stone-400 text-center px-1">
                    {file.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || reviewData.rating === 0 || !reviewData.comment.trim()}
          className="flex items-center space-x-2 px-6 py-2 bg-forest-500 text-white rounded-md hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Posting...</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Post Review</span>
            </>
          )}
        </button>
      </div>

      {/* Upload Progress Modal */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-500 mx-auto mb-4"></div>
              <p className="text-gray-700 mb-2">{uploadProgress.message}</p>
              {uploadProgress.total > 1 && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-forest-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}