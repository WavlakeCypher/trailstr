import { 
  Clock, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Heart, 
  Zap, 
  Flame,
  Timer,
  Activity
} from 'lucide-react'
import type { ActivityMetrics, ActivityType } from '../../types/activity'
import { 
  formatDistance, 
  formatDuration, 
  formatPace, 
  formatElevation, 
  formatHeartRate, 
  formatCalories 
} from '../../utils/formatting'

export interface StatsGridProps {
  metrics: ActivityMetrics
  activityType?: ActivityType
  className?: string
  compact?: boolean
}

interface StatItem {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  show: boolean
}

export default function StatsGrid({ 
  metrics, 
  activityType, 
  className = '',
  compact = false 
}: StatsGridProps) {
  
  const stats: StatItem[] = [
    {
      label: 'Distance',
      value: metrics.distanceMeters ? formatDistance(metrics.distanceMeters) : '—',
      icon: <MapPin size={16} />,
      color: 'text-blue-600 dark:text-blue-400',
      show: !!metrics.distanceMeters
    },
    {
      label: compact ? 'Moving' : 'Moving Time',
      value: metrics.movingSeconds ? formatDuration(metrics.movingSeconds) : '—',
      icon: <Clock size={16} />,
      color: 'text-green-600 dark:text-green-400',
      show: !!metrics.movingSeconds
    },
    {
      label: compact ? 'Elapsed' : 'Elapsed Time',
      value: metrics.elapsedSeconds ? formatDuration(metrics.elapsedSeconds) : '—',
      icon: <Timer size={16} />,
      color: 'text-purple-600 dark:text-purple-400',
      show: !!metrics.elapsedSeconds && metrics.elapsedSeconds !== metrics.movingSeconds
    },
    {
      label: compact ? 'Pace' : 'Average Pace',
      value: metrics.avgPaceSecondsPerKm ? formatPace(metrics.avgPaceSecondsPerKm, activityType) : '—',
      icon: <Zap size={16} />,
      color: 'text-orange-600 dark:text-orange-400',
      show: !!metrics.avgPaceSecondsPerKm
    },
    {
      label: compact ? 'Elev. Gain' : 'Elevation Gain',
      value: metrics.elevationGainMeters ? formatElevation(metrics.elevationGainMeters) : '—',
      icon: <TrendingUp size={16} />,
      color: 'text-emerald-600 dark:text-emerald-400',
      show: !!metrics.elevationGainMeters && metrics.elevationGainMeters > 0
    },
    {
      label: compact ? 'Elev. Loss' : 'Elevation Loss',
      value: metrics.elevationLossMeters ? formatElevation(metrics.elevationLossMeters) : '—',
      icon: <TrendingDown size={16} />,
      color: 'text-red-600 dark:text-red-400',
      show: !!metrics.elevationLossMeters && metrics.elevationLossMeters > 0
    },
    {
      label: compact ? 'Avg HR' : 'Average Heart Rate',
      value: metrics.avgHeartRateBpm ? formatHeartRate(metrics.avgHeartRateBpm) : '—',
      icon: <Heart size={16} />,
      color: 'text-red-500 dark:text-red-400',
      show: !!metrics.avgHeartRateBpm
    },
    {
      label: 'Calories',
      value: metrics.calories ? formatCalories(metrics.calories) : '—',
      icon: <Flame size={16} />,
      color: 'text-yellow-600 dark:text-yellow-400',
      show: !!metrics.calories
    }
  ]

  // Filter stats to only show those with data
  const visibleStats = stats.filter(stat => stat.show)

  if (visibleStats.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Activity size={48} className="mx-auto mb-4 text-stone-300 dark:text-stone-600" />
        <p className="text-stone-500 dark:text-stone-400">No activity data available</p>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {!compact && (
        <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
          Activity Stats
        </h3>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-stone-800 rounded-lg p-4 border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {stat.value}
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-tight">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Additional derived stats */}
      {!compact && (metrics.distanceMeters && metrics.movingSeconds) && (
        <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Average speed */}
            {metrics.distanceMeters && metrics.movingSeconds && (
              <div className="text-center">
                <p className="text-stone-500 dark:text-stone-400 mb-1">Avg Speed</p>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {((metrics.distanceMeters / 1000) / (metrics.movingSeconds / 3600)).toFixed(1)} km/h
                </p>
              </div>
            )}

            {/* Pace per mile (for runners) */}
            {activityType && ['run', 'walk', 'hike', 'trail_run'].includes(activityType) && metrics.avgPaceSecondsPerKm && (
              <div className="text-center">
                <p className="text-stone-500 dark:text-stone-400 mb-1">Pace per Mile</p>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {formatPace(metrics.avgPaceSecondsPerKm * 1.60934, activityType)}
                </p>
              </div>
            )}

            {/* Moving vs Elapsed ratio */}
            {metrics.elapsedSeconds && metrics.movingSeconds && metrics.elapsedSeconds !== metrics.movingSeconds && (
              <div className="text-center">
                <p className="text-stone-500 dark:text-stone-400 mb-1">Moving Time %</p>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {Math.round((metrics.movingSeconds / metrics.elapsedSeconds) * 100)}%
                </p>
              </div>
            )}

            {/* Elevation ratio */}
            {metrics.elevationGainMeters && metrics.distanceMeters && (
              <div className="text-center">
                <p className="text-stone-500 dark:text-stone-400 mb-1">Climb Rate</p>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {((metrics.elevationGainMeters / (metrics.distanceMeters / 1000)) * 100).toFixed(1)} m/km
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}