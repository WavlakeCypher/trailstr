import { gpx } from '@tmcw/togeojson'

export interface ParsedTrackPoint {
  lat: number
  lng: number
  elevation?: number
  time?: Date
  heartRate?: number
  cadence?: number
}

export interface ParsedActivity {
  name?: string
  type: string
  startTime: Date
  endTime: Date
  totalDistance: number
  totalElevationGain: number
  totalElevationLoss: number
  movingTime: number
  elapsedTime: number
  averagePace?: number
  averageHeartRate?: number
  maxHeartRate?: number
  calories?: number
  trackPoints: ParsedTrackPoint[]
  source: 'gpx'
}

/**
 * Parse GPX file content and extract activity data
 * Uses @tmcw/togeojson for parsing
 */
export async function parseGpx(gpxContent: string): Promise<ParsedActivity> {
  try {
    // Parse GPX to GeoJSON
    const parser = new DOMParser()
    const gpxDoc = parser.parseFromString(gpxContent, 'application/xml')
    
    // Check for parsing errors
    const parserError = gpxDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error('Invalid GPX format')
    }
    
    const geoJson = gpx(gpxDoc)
    
    if (geoJson.features.length === 0) {
      throw new Error('No track data found in GPX file')
    }
    
    // Process the first track feature
    const feature = geoJson.features[0]
    let coordinates: number[][]
    
    if (feature.geometry.type === 'LineString') {
      coordinates = feature.geometry.coordinates
    } else if (feature.geometry.type === 'MultiLineString') {
      coordinates = feature.geometry.coordinates[0]
    } else {
      throw new Error('Unsupported geometry type in GPX file')
    }
    
    const trackPoints: ParsedTrackPoint[] = []
    let totalDistance = 0
    let totalElevationGain = 0
    let totalElevationLoss = 0
    let previousElevation: number | undefined
    
    // Extract timestamps if available
    const times = feature.properties?.coordinateProperties?.times || []
    
    // Process coordinates
    coordinates.forEach((coord, index: number) => {
      const [lng, lat, elevation] = coord
      const trackPoint: ParsedTrackPoint = {
        lat,
        lng,
        elevation
      }
      
      // Add timestamp if available
      if (times[index]) {
        trackPoint.time = new Date(times[index])
      }
      
      // Calculate distance from previous point
      if (index > 0) {
        const [prevLng, prevLat] = coordinates[index - 1]
        const distance = calculateDistance(prevLat, prevLng, lat, lng)
        totalDistance += distance
      }
      
      // Calculate elevation gain/loss
      if (elevation !== undefined) {
        if (previousElevation !== undefined) {
          const elevationChange = elevation - previousElevation
          if (elevationChange > 0) {
            totalElevationGain += elevationChange
          } else {
            totalElevationLoss += Math.abs(elevationChange)
          }
        }
        previousElevation = elevation
      }
      
      trackPoints.push(trackPoint)
    })
    
    // Calculate times
    const startTime = trackPoints.find(p => p.time)?.time || new Date()
    const endTime = trackPoints.slice().reverse().find(p => p.time)?.time || new Date()
    const elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000
    
    // For moving time, we'll use elapsed time for now
    const movingTime = elapsedTime
    
    // Calculate average pace (seconds per km)
    const averagePace = totalDistance > 0 ? (movingTime / (totalDistance / 1000)) : undefined
    
    // Determine activity type from metadata
    const name = feature.properties?.name || 'Imported Activity'
    const activityType = determineActivityType(name)
    
    return {
      name,
      type: activityType,
      startTime,
      endTime,
      totalDistance,
      totalElevationGain,
      totalElevationLoss,
      movingTime,
      elapsedTime,
      averagePace,
      trackPoints,
      source: 'gpx'
    }
    
  } catch (error) {
    console.error('Failed to parse GPX:', error)
    throw new Error(`Failed to parse GPX file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Determine activity type from track name or metadata
 */
function determineActivityType(name: string): string {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('run') || lowerName.includes('jog')) return 'run'
  if (lowerName.includes('bike') || lowerName.includes('cycle') || lowerName.includes('cycling')) return 'bike'
  if (lowerName.includes('hike') || lowerName.includes('hiking')) return 'hike'
  if (lowerName.includes('walk') || lowerName.includes('walking')) return 'walk'
  if (lowerName.includes('trail')) return 'trail_run'
  if (lowerName.includes('swim')) return 'swim'
  
  // Default to run for track data
  return 'run'
}

/**
 * Calculate distance between two coordinates in meters
 * Using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}