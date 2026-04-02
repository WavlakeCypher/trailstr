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
    <div className="min-h-screen bg-stone-900">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/feed"
            className="p-2 text-stone-400 hover:text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Import Activities
            </h1>
            <p className="text-stone-400">
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
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-stone-400">
                    {selectedCount} activities selected for import
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={resetImport}
                      className="px-4 py-2 text-sm font-medium text-stone-400 hover:text-white transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleImportSelected}
                      disabled={selectedCount === 0 || !pubkey}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl h-12 px-6 font-medium hover:from-emerald-700 hover:to-emerald-600 disabled:from-stone-600 disabled:to-stone-500 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Import Selected ({selectedCount})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Instructions */}
          {parsedActivities.length === 0 && (
            <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
              <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-4">
                Import from Popular Sources
              </h3>
              <div className="space-y-4 text-sm text-stone-300">
                <div>
                  <strong className="text-emerald-400">Garmin Connect:</strong> Go to Settings → Data Export → "Export Your Data" → Download the ZIP file
                </div>
                <div>
                  <strong className="text-emerald-400">Strava:</strong> Go to Settings → Privacy Controls → "Download or Delete Your Account" → Request archive
                </div>
                <div>
                  <strong className="text-emerald-400">Apple Health:</strong> Export workout as GPX, or use HealthFit app to export as FIT files
                </div>
                <div>
                  <strong className="text-emerald-400">Fitbit:</strong> Go to Data Export in your account settings → Download your archive (contains TCX files)
                </div>
                <div>
                  <strong className="text-emerald-400">Individual files:</strong> Upload any .gpx, .fit, or .tcx file from any fitness app or device
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
              <h2 className="text-xl font-semibold text-white">
                Import Results
              </h2>
              <p className="text-sm text-stone-400">
                {successCount} successful, {errorCount} failed out of {importResults.length} activities
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResults(false)}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium text-stone-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                Back to Import
              </button>
              <button
                onClick={resetImport}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-600 disabled:from-stone-600 disabled:to-stone-500 transition-colors"
              >
                Import More
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {isImporting && (
            <div className="w-full bg-stone-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 h-2 rounded-full transition-all duration-300"
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
                  bg-stone-800/50 border rounded-2xl p-4 flex items-center gap-4
                  ${result.status === 'success' ? 'border-emerald-700/50' :
                    result.status === 'error' ? 'border-red-700/50' :
                    result.status === 'uploading' ? 'border-yellow-700/50' :
                    'border-stone-700/50'
                  }
                `}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {result.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  )}
                  {result.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  {result.status === 'uploading' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
                  )}
                  {result.status === 'pending' && (
                    <AlertCircle className="h-5 w-5 text-stone-400" />
                  )}
                </div>
                
                {/* Activity Info */}
                <div className="flex-1">
                  <div className="font-medium text-white">
                    {result.activity.editedName || result.activity.name}
                  </div>
                  <div className="text-sm text-stone-400">
                    {result.activity.editedType || result.activity.type} •{' '}
                    {(result.activity.totalDistance / 1000).toFixed(1)} km •{' '}
                    {Math.floor(result.activity.movingTime / 60)} min
                  </div>
                  {result.error && (
                    <div className="text-sm text-red-400 mt-1">
                      Error: {result.error}
                    </div>
                  )}
                </div>
                
                {/* Status Text */}
                <div className="flex-shrink-0 text-sm font-medium">
                  {result.status === 'success' && (
                    <span className="text-emerald-400">Imported</span>
                  )}
                  {result.status === 'error' && (
                    <span className="text-red-400">Failed</span>
                  )}
                  {result.status === 'uploading' && (
                    <span className="text-emerald-400">Importing...</span>
                  )}
                  {result.status === 'pending' && (
                    <span className="text-stone-400">Waiting</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Final Summary */}
          {!isImporting && importResults.length > 0 && (
            <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-center">
              <div className="text-lg font-semibold text-white mb-2">
                Import Complete!
              </div>
              <div className="text-stone-300">
                {successCount} activities successfully imported to your Nostr profile.
                {successCount > 0 && (
                  <div className="mt-4">
                    <Link
                      to="/feed"
                      className="inline-flex items-center bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl h-12 px-6 font-medium hover:from-emerald-700 hover:to-emerald-600 transition-colors"
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