import FitParser from 'fit-file-parser'
import type { ParsedActivity, ParsedTrackPoint } from './gpx'

/**
 * Parse Garmin FIT file and extract activity data
 * Uses fit-file-parser to handle the binary FIT format
 */
export async function parseFit(fitBuffer: ArrayBuffer): Promise<ParsedActivity> {
  return new Promise((resolve, reject) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
        temperatureUnit: 'celcius',
        elapsedRecordField: true,
        mode: 'list'
      })
      
      fitParser.parse(fitBuffer, (error: any, data: any) => {
        if (error) {
          console.error('FIT parse error:', error)
          reject(new Error(`Failed to parse FIT file: ${error.message || error}`))
          return
        }
        
        try {
          const activity = processFitData(data)
          resolve(activity)
        } catch (processingError) {
          console.error('FIT processing error:', processingError)
          reject(processingError)
        }
      })
    } catch (error) {
      console.error('FIT parser initialization error:', error)
      reject(new Error(`Failed to initialize FIT parser: ${error instanceof Error ? error.message : 'Unknown error'}`))
    }
  })
}

/**
 * Process parsed FIT data into our standard activity format
 */
function processFitData(data: any): ParsedActivity {
  console.log('FIT data structure:', data)
  
  // Extract session data (overall activity summary)
  const sessions = data.sessions || []
  const session = sessions[0]
  
  if (!session) {
    throw new Error('No session data found in FIT file')
  }
  
  // Extract record data (GPS track points)
  const records = data.records || []
  
  if (records.length === 0) {
    throw new Error('No GPS track data found in FIT file')
  }
  
  // Extract activity metadata
  const activities = data.activities || []
  const activity = activities[0]
  
  // Process track points
  const trackPoints: ParsedTrackPoint[] = []
  let validGpsPoints = 0
  
  for (const record of records) {
    // Skip records without valid GPS coordinates
    if (record.position_lat === undefined || record.position_long === undefined ||
        record.position_lat === null || record.position_long === null) {
      continue
    }
    
    // Convert semicircles to degrees (FIT uses semicircles as position format)
    const lat = record.position_lat * (180 / Math.pow(2, 31))
    const lng = record.position_long * (180 / Math.pow(2, 31))
    
    // Validate coordinates are reasonable
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue
    }
    
    const trackPoint: ParsedTrackPoint = {
      lat,
      lng,
      elevation: record.altitude,
      time: record.timestamp ? new Date(record.timestamp) : undefined,
      heartRate: record.heart_rate,
      cadence: record.cadence
    }
    
    trackPoints.push(trackPoint)
    validGpsPoints++
  }
  
  if (validGpsPoints === 0) {
    throw new Error('No valid GPS coordinates found in FIT file')
  }
  
  // Calculate activity metrics
  const startTime = trackPoints.find(p => p.time)?.time || new Date(session.start_time || Date.now())
  const endTime = trackPoints.slice().reverse().find(p => p.time)?.time || 
                  new Date(startTime.getTime() + (session.total_elapsed_time || 0) * 1000)
  
  // Use session data when available, otherwise calculate from track
  const totalDistance = session.total_distance || calculateDistanceFromTrack(trackPoints)
  const elapsedTime = session.total_elapsed_time || ((endTime.getTime() - startTime.getTime()) / 1000)
  const movingTime = session.total_timer_time || elapsedTime
  
  // Calculate elevation gain/loss from track points if not in session
  let totalElevationGain = session.total_ascent || 0
  let totalElevationLoss = session.total_descent || 0
  
  if (!session.total_ascent || !session.total_descent) {
    const { gain, loss } = calculateElevationFromTrack(trackPoints)
    totalElevationGain = session.total_ascent || gain
    totalElevationLoss = session.total_descent || loss
  }
  
  // Calculate heart rate statistics
  const heartRateData = trackPoints.filter(p => p.heartRate).map(p => p.heartRate!)
  const averageHeartRate = heartRateData.length > 0 
    ? Math.round(heartRateData.reduce((sum, hr) => sum + hr, 0) / heartRateData.length)
    : session.avg_heart_rate
  const maxHeartRate = heartRateData.length > 0 
    ? Math.max(...heartRateData)
    : session.max_heart_rate
  
  // Calculate average pace (seconds per km)
  const averagePace = totalDistance > 0 && movingTime > 0 
    ? (movingTime / (totalDistance / 1000))
    : undefined
  
  // Determine activity type from sport or sub_sport
  const activityType = determineActivityTypeFromFit(session.sport, session.sub_sport)
  
  // Create activity name
  const activityName = activity?.name || 
                      `${formatActivityType(activityType)} Activity` ||
                      'Imported FIT Activity'
  
  return {
    name: activityName,
    type: activityType,
    startTime,
    endTime,
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
    movingTime,
    elapsedTime,
    averagePace,
    averageHeartRate,
    maxHeartRate,
    calories: session.total_calories,
    trackPoints,
    source: 'gpx' // Using 'gpx' as the source type for compatibility
  }
}

/**
 * Calculate total distance from track points
 */
function calculateDistanceFromTrack(trackPoints: ParsedTrackPoint[]): number {
  let totalDistance = 0
  
  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1]
    const curr = trackPoints[i]
    
    const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng)
    totalDistance += distance
  }
  
  return totalDistance
}

/**
 * Calculate elevation gain and loss from track points
 */
function calculateElevationFromTrack(trackPoints: ParsedTrackPoint[]): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  
  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1]
    const curr = trackPoints[i]
    
    if (prev.elevation !== undefined && curr.elevation !== undefined) {
      const change = curr.elevation - prev.elevation
      if (change > 0) {
        gain += change
      } else {
        loss += Math.abs(change)
      }
    }
  }
  
  return { gain, loss }
}

/**
 * Determine activity type from FIT sport and sub_sport fields
 */
function determineActivityTypeFromFit(sport?: string, subSport?: string): string {
  if (!sport) return 'run'
  
  const sportLower = sport.toLowerCase()
  const subSportLower = subSport?.toLowerCase() || ''
  
  // Map FIT sports to our activity types
  switch (sportLower) {
    case 'running':
      if (subSportLower.includes('trail')) return 'trail_run'
      return 'run'
    case 'cycling':
    case 'biking':
      return 'bike'
    case 'walking':
      return 'walk'
    case 'hiking':
      return 'hike'
    case 'swimming':
      return 'swim'
    case 'training':
      if (subSportLower.includes('strength')) return 'strength'
      return 'training'
    case 'mountaineering':
    case 'climbing':
      return 'climb'
    default:
      // Try to infer from sub-sport
      if (subSportLower.includes('run')) return 'run'
      if (subSportLower.includes('bike') || subSportLower.includes('cycling')) return 'bike'
      if (subSportLower.includes('walk')) return 'walk'
      if (subSportLower.includes('hike')) return 'hike'
      if (subSportLower.includes('trail')) return 'trail_run'
      
      return 'run' // Default fallback
  }
}

/**
 * Format activity type for display
 */
function formatActivityType(type: string): string {
  switch (type) {
    case 'trail_run': return 'Trail Run'
    case 'run': return 'Run'
    case 'bike': return 'Bike Ride'
    case 'walk': return 'Walk'
    case 'hike': return 'Hike'
    case 'swim': return 'Swim'
    case 'strength': return 'Strength Training'
    case 'training': return 'Training'
    case 'climb': return 'Climb'
    default: return type.charAt(0).toUpperCase() + type.slice(1)
  }
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