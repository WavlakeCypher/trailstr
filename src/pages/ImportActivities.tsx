import { useState } from 'react'
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FileDropZone } from '../components/import/FileDropZone'
import { ActivityPreviewList } from '../components/import/ActivityPreviewList'
import { useAuthStore } from '../stores/authStore'
import { buildActivityEvent } from '../nostr/events'
import { nostrClient } from '../nostr/client'
import type { ParsedActivity } from '../components/import/parsers/gpx'
import { v4 as uuid } from 'uuid'

interface ActivityPreview extends ParsedActivity {
  id: string
  selected: boolean
  editedName?: string
  editedType?: string
}

interface ImportResult {
  activity: ActivityPreview
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  eventId?: string
}

export default function ImportActivities() {
  const { pubkey, getSigner } = useAuthStore()
  const [parsedActivities, setParsedActivities] = useState<ParsedActivity[]>([])
  const [previewActivities, setPreviewActivities] = useState<ActivityPreview[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showResults, setShowResults] = useState(false)
  
  const handleActivitiesParsed = (activities: ParsedActivity[]) => {
    setParsedActivities(activities)
    setShowResults(false) // Reset results when new activities are parsed
  }
  
  const handleActivitiesChange = (activities: ActivityPreview[]) => {
    setPreviewActivities(activities)
  }
  
  const handleImportSelected = async () => {
    const signer = getSigner()
    if (!pubkey || !signer) {
      alert('Please log in to import activities')
      return
    }
    
    const selectedActivities = previewActivities.filter(a => a.selected)
    if (selectedActivities.length === 0) {
      alert('Please select at least one activity to import')
      return
    }
    
    setIsImporting(true)
    setShowResults(true)
    
    // Initialize results
    const results: ImportResult[] = selectedActivities.map(activity => ({
      activity,
      status: 'pending' as const
    }))
    setImportResults(results)
    
    // Import activities sequentially
    for (let i = 0; i < selectedActivities.length; i++) {
      const activity = selectedActivities[i]
      
      // Update status to uploading
      results[i] = { ...results[i], status: 'uploading' }
      setImportResults([...results])
      
      try {
        // Create the activity event
        const eventId = await importActivity(activity)
        
        // Update status to success
        results[i] = { ...results[i], status: 'success', eventId }
      } catch (error) {
        console.error('Failed to import activity:', activity.name, error)
        results[i] = { 
          ...results[i], 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
      setImportResults([...results])
      
      // Add a small delay between imports to avoid overwhelming relays
      if (i < selectedActivities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setIsImporting(false)
  }
  
  const importActivity = async (activity: ActivityPreview): Promise<string> => {
    const signer = getSigner()
    if (!pubkey || !signer) {
      throw new Error('Not authenticated')
    }
    
    // Convert track points to GeoJSON
    const geoJson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: activity.trackPoints.map(point => [
              point.lng,
              point.lat,
              point.elevation || 0
            ])
          },
          properties: {
            timestamps: activity.trackPoints.map(point => point.time?.toISOString()).filter(Boolean),
            heartRate: activity.trackPoints.map(point => point.heartRate).filter(Boolean),
            cadence: activity.trackPoints.map(point => point.cadence).filter(Boolean)
          }
        }
      ]
    }
    
    // For now, we'll store the track data in the content as JSON
    // In a real implementation, you'd upload to a media host first
    const trackData = JSON.stringify(geoJson)
    
    // Create the activity event
    const activityEvent = buildActivityEvent({
      d: uuid(),
      type: activity.editedType || activity.type,
      title: activity.editedName || activity.name || 'Imported Activity',
      startedAt: Math.floor(activity.startTime.getTime() / 1000),
      finishedAt: Math.floor(activity.endTime.getTime() / 1000),
      elapsedSeconds: activity.elapsedTime,
      movingSeconds: activity.movingTime,
      distanceMeters: activity.totalDistance,
      elevationGainMeters: activity.totalElevationGain,
      elevationLossMeters: activity.totalElevationLoss,
      avgPaceSecondsPerKm: activity.averagePace,
      avgHeartRateBpm: activity.averageHeartRate,
      calories: activity.calories,
      source: `import_${activity.source}`,
      content: `Imported ${activity.editedType || activity.type} activity.\n\nTrack data:\n\`\`\`json\n${trackData}\n\`\`\``
    }, pubkey)
    
    // Sign the event
    const signedEvent = await signer.signEvent(activityEvent)
    
    // Publish to relays
    await nostrClient.publish(signedEvent)
    
    return signedEvent.id
  }
  
  const resetImport = () => {
    setParsedActivities([])
    setPreviewActivities([])
    setImportResults([])
    setShowResults(false)
  }
  
  const selectedCount = previewActivities.filter(a => a.selected).length
  const successCount = importResults.filter(r => r.status === 'success').length
  const errorCount = importResults.filter(r => r.status === 'error').length
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/feed"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Import Activities
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Import your GPS activities from Garmin, Strava, Apple Health, Fitbit, and more
          </p>
        </div>
      </div>
      
      {!showResults ? (
        <div className="space-y-6">
          {/* File Drop Zone */}
          <FileDropZone
            onActivitiesParsed={handleActivitiesParsed}
          />
          
          {/* Activity Preview List */}
          {previewActivities.length > 0 && (
            <div className="space-y-4">
              <ActivityPreviewList
                activities={parsedActivities}
                onActivitiesChange={handleActivitiesChange}
              />
              
              {/* Import Button */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCount} activities selected for import
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={resetImport}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleImportSelected}
                    disabled={selectedCount === 0 || !pubkey}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import Selected ({selectedCount})
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Instructions */}
          {parsedActivities.length === 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Import from Popular Sources
              </h3>
              <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                <div>
                  <strong>Garmin Connect:</strong> Go to Settings → Data Export → "Export Your Data" → Download the ZIP file
                </div>
                <div>
                  <strong>Strava:</strong> Go to Settings → Privacy Controls → "Download or Delete Your Account" → Request archive
                </div>
                <div>
                  <strong>Apple Health:</strong> Export workout as GPX, or use HealthFit app to export as FIT files
                </div>
                <div>
                  <strong>Fitbit:</strong> Go to Data Export in your account settings → Download your archive (contains TCX files)
                </div>
                <div>
                  <strong>Individual files:</strong> Upload any .gpx, .fit, or .tcx file from any fitness app or device
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Import Results */
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Import Results
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {successCount} successful, {errorCount} failed out of {importResults.length} activities
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResults(false)}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Back to Import
              </button>
              <button
                onClick={resetImport}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Import More
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {isImporting && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(importResults.filter(r => r.status !== 'pending').length / importResults.length) * 100}%`
                }}
              />
            </div>
          )}
          
          {/* Results List */}
          <div className="space-y-3">
            {importResults.map((result) => (
              <div
                key={result.activity.id}
                className={`
                  flex items-center gap-4 p-4 rounded-lg border
                  ${result.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                    result.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                    result.status === 'uploading' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                    'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {result.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {result.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  {result.status === 'uploading' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-600 border-t-transparent" />
                  )}
                  {result.status === 'pending' && (
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                {/* Activity Info */}
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {result.activity.editedName || result.activity.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {result.activity.editedType || result.activity.type} •{' '}
                    {(result.activity.totalDistance / 1000).toFixed(1)} km •{' '}
                    {Math.floor(result.activity.movingTime / 60)} min
                  </div>
                  {result.error && (
                    <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Error: {result.error}
                    </div>
                  )}
                </div>
                
                {/* Status Text */}
                <div className="flex-shrink-0 text-sm font-medium">
                  {result.status === 'success' && (
                    <span className="text-green-600">Imported</span>
                  )}
                  {result.status === 'error' && (
                    <span className="text-red-600">Failed</span>
                  )}
                  {result.status === 'uploading' && (
                    <span className="text-yellow-600">Importing...</span>
                  )}
                  {result.status === 'pending' && (
                    <span className="text-gray-400">Waiting</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Final Summary */}
          {!isImporting && importResults.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
              <div className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Import Complete!
              </div>
              <div className="text-blue-800 dark:text-blue-200">
                {successCount} activities successfully imported to your Nostr profile.
                {successCount > 0 && (
                  <div className="mt-3">
                    <Link
                      to="/feed"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                    >
                      View in Feed
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}