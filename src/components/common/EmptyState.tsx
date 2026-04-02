import React from 'react'

export interface EmptyStateProps {
  emoji?: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  className?: string
}

export default function EmptyState({
  emoji = '🏃‍♂️',
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
        <span className="text-2xl" role="img" aria-label="Empty state illustration">
          {emoji}
        </span>
      </div>
      
      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
        {title}
      </h3>
      
      <p className="text-stone-600 dark:text-stone-400 mb-6 max-w-sm mx-auto">
        {description}
      </p>
      
      {action && (
        <button
          onClick={action.onClick}
          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            action.variant === 'secondary'
              ? 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
              : 'bg-forest-600 text-white hover:bg-forest-700'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Specific empty states for common use cases
export const FeedEmptyState: React.FC<{ followingOnly: boolean; onCreateActivity: () => void }> = ({
  followingOnly,
  onCreateActivity
}) => (
  <EmptyState
    emoji="🏃‍♂️"
    title="No activities yet"
    description={
      followingOnly
        ? "Follow some people or create your first activity to see your feed come to life!"
        : "Be the first to share an activity and inspire others to get moving!"
    }
    action={{
      label: "Record Activity",
      onClick: onCreateActivity
    }}
  />
)

export const TrailsEmptyState: React.FC<{ onCreateTrail: () => void }> = ({
  onCreateTrail
}) => (
  <EmptyState
    emoji="🥾"
    title="No trails in this area"
    description="Be the first to map out a trail in this location! Share your favorite routes with the community."
    action={{
      label: "Create Trail",
      onClick: onCreateTrail
    }}
  />
)

export const ActivitiesEmptyState: React.FC<{ isOwnProfile: boolean; onRecordActivity?: () => void }> = ({
  isOwnProfile,
  onRecordActivity
}) => (
  <EmptyState
    emoji="📊"
    title={isOwnProfile ? "No activities recorded" : "No activities shared"}
    description={
      isOwnProfile
        ? "Start tracking your outdoor adventures! Your activities will appear here."
        : "This person hasn't shared any activities yet."
    }
    action={
      isOwnProfile && onRecordActivity
        ? {
            label: "Record Activity",
            onClick: onRecordActivity
          }
        : undefined
    }
  />
)

export const ReviewsEmptyState: React.FC<{ isOwnProfile: boolean; onExploreTrails?: () => void }> = ({
  isOwnProfile,
  onExploreTrails
}) => (
  <EmptyState
    emoji="⭐"
    title={isOwnProfile ? "No reviews written" : "No reviews shared"}
    description={
      isOwnProfile
        ? "Share your experiences! Review trails you've explored to help other adventurers."
        : "This person hasn't reviewed any trails yet."
    }
    action={
      isOwnProfile && onExploreTrails
        ? {
            label: "Explore Trails",
            onClick: onExploreTrails
          }
        : undefined
    }
  />
)

export const NotificationsEmptyState: React.FC = () => (
  <EmptyState
    emoji="🔔"
    title="All caught up!"
    description="No new notifications. Your outdoor activities are waiting for you!"
  />
)

export const SearchEmptyState: React.FC<{ query: string; onClearSearch?: () => void }> = ({
  query,
  onClearSearch
}) => (
  <EmptyState
    emoji="🔍"
    title="No results found"
    description={`No trails or activities found for "${query}". Try adjusting your search terms.`}
    action={
      onClearSearch
        ? {
            label: "Clear Search",
            onClick: onClearSearch,
            variant: 'secondary'
          }
        : undefined
    }
  />
)

export const OfflineEmptyState: React.FC<{ onRetry?: () => void }> = ({
  onRetry
}) => (
  <EmptyState
    emoji="📱"
    title="You're offline"
    description="Check your internet connection to load fresh content. Cached activities are still available."
    action={
      onRetry
        ? {
            label: "Try Again",
            onClick: onRetry,
            variant: 'secondary'
          }
        : undefined
    }
  />
)

export const ErrorEmptyState: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message = "Something went wrong while loading content.",
  onRetry
}) => (
  <EmptyState
    emoji="⚠️"
    title="Oops!"
    description={message}
    action={
      onRetry
        ? {
            label: "Try Again",
            onClick: onRetry
          }
        : undefined
    }
  />
)