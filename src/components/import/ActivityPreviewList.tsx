import { useState } from 'react'
import { Calendar, Clock, Mountain, Route, Edit2, MapPin } from 'lucide-react'
import type { ParsedActivity } from './parsers/gpx'

interface ActivityPreview extends ParsedActivity {
  id: string
  selected: boolean
  editedName?: string
  editedType?: string
}

interface ActivityPreviewListProps {
  activities: ParsedActivity[]
  onActivitiesChange: (activities: ActivityPreview[]) => void
  className?: string
}

const ACTIVITY_TYPES = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike Ride' },
  { value: 'swim', label: 'Swim' },
  { value: 'strength', label: 'Strength Training' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' }
]

export function ActivityPreviewList({ activities, onActivitiesChange, className = '' }: ActivityPreviewListProps) {
  const [previewActivities, setPreviewActivities] = useState<ActivityPreview[]>(() =>
    activities.map((activity, index) => ({
      ...activity,
      id: `activity-${index}-${Date.now()}`,
      selected: true // Select all by default
    }))
  )
  
  const updateActivity = (id: string, updates: Partial<ActivityPreview>) => {
    const updated = previewActivities.map(activity =>
      activity.id === id ? { ...activity, ...updates } : activity
    )
    setPreviewActivities(updated)
    onActivitiesChange(updated)
  }
  
  const toggleSelection = (id: string) => {
    updateActivity(id, { selected: !previewActivities.find(a => a.id === id)?.selected })
  }
  
  const toggleSelectAll = () => {
    const allSelected = previewActivities.every(a => a.selected)
    const updated = previewActivities.map(activity => ({
      ...activity,
      selected: !allSelected
    }))
    setPreviewActivities(updated)
    onActivitiesChange(updated)
  }
  
  const selectedCount = previewActivities.filter(a => a.selected).length
  
  if (activities.length === 0) {
    return null
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Found {activities.length} Activities
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedCount} selected
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {selectedCount === activities.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>
      
      {/* Activity List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {previewActivities.map((activity) => (
          <ActivityPreviewCard
            key={activity.id}
            activity={activity}
            onUpdate={(updates) => updateActivity(activity.id, updates)}
            onToggleSelection={() => toggleSelection(activity.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ActivityPreviewCardProps {
  activity: ActivityPreview
  onUpdate: (updates: Partial<ActivityPreview>) => void
  onToggleSelection: () => void
}

function ActivityPreviewCard({ activity, onUpdate, onToggleSelection }: ActivityPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(activity.editedName || activity.name)
  const [editType, setEditType] = useState(activity.editedType || activity.type)
  
  const handleSaveEdit = () => {
    onUpdate({
      editedName: editName,
      editedType: editType
    })
    setIsEditing(false)
  }
  
  const handleCancelEdit = () => {
    setEditName(activity.editedName || activity.name)
    setEditType(activity.editedType || activity.type)
    setIsEditing(false)
  }
  
  const displayName = activity.editedName || activity.name
  const displayType = activity.editedType || activity.type
  const typeLabel = ACTIVITY_TYPES.find(t => t.value === displayType)?.label || displayType
  
  return (
    <div
      className={`
        relative border rounded-lg p-4 transition-all cursor-pointer
        ${activity.selected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-60'
        }
      `}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-4 right-4">
        <input
          type="checkbox"
          checked={activity.selected}
          onChange={onToggleSelection}
          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
        />
      </div>
      
      <div className="pr-8 space-y-3">
        {/* Activity Name and Type */}
        <div>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Activity name"
              />
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ACTIVITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                  {displayName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {typeLabel}
                </p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        {/* Activity Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(activity.startTime)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Route className="h-4 w-4" />
            <span>{formatDistance(activity.totalDistance)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(activity.movingTime)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Mountain className="h-4 w-4" />
            <span>{Math.round(activity.totalElevationGain)} m</span>
          </div>
        </div>
        
        {/* Mini Track Preview */}
        {activity.trackPoints.length > 0 && (
          <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
            <MiniTrackMap trackPoints={activity.trackPoints} />
          </div>
        )}
        
        {/* Source Info */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
            {activity.source.toUpperCase()}
          </span>
          <span>•</span>
          <span>{activity.trackPoints.length} points</span>
          {activity.averageHeartRate && (
            <>
              <span>•</span>
              <span>❤️ {activity.averageHeartRate} bpm avg</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface MiniTrackMapProps {
  trackPoints: Array<{ lat: number; lng: number }>
}

function MiniTrackMap({ trackPoints }: MiniTrackMapProps) {
  if (trackPoints.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <MapPin className="h-6 w-6" />
      </div>
    )
  }
  
  // Calculate bounding box
  const lats = trackPoints.map(p => p.lat)
  const lngs = trackPoints.map(p => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  
  // Add padding to bounding box
  const latPadding = (maxLat - minLat) * 0.1
  const lngPadding = (maxLng - minLng) * 0.1
  
  const bounds = {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding
  }
  
  // Convert track points to SVG coordinates
  const svgWidth = 200
  const svgHeight = 64
  
  const points = trackPoints.map(point => {
    const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * svgWidth
    const y = svgHeight - ((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * svgHeight
    return `${x},${y}`
  }).join(' ')
  
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full h-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-500"
      />
      {/* Start point */}
      {trackPoints.length > 0 && (
        <circle
          cx={((trackPoints[0].lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * svgWidth}
          cy={svgHeight - ((trackPoints[0].lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * svgHeight}
          r="3"
          fill="green"
        />
      )}
      {/* End point */}
      {trackPoints.length > 1 && (
        <circle
          cx={((trackPoints[trackPoints.length - 1].lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * svgWidth}
          cy={svgHeight - ((trackPoints[trackPoints.length - 1].lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * svgHeight}
          r="3"
          fill="red"
        />
      )}
    </svg>
  )
}

// Utility functions
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}