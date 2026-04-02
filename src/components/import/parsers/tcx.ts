import type { ParsedActivity, ParsedTrackPoint } from './gpx'

/**
 * Parse TCX (Training Center XML) file and extract activity data
 * Common format from Fitbit and other fitness platforms
 * Uses browser-native DOMParser for XML parsing
 */
export async function parseTcx(tcxContent: string): Promise<ParsedActivity> {
  try {
    const parser = new DOMParser()
    const tcxDoc = parser.parseFromString(tcxContent, 'application/xml')
    
    // Check for parsing errors
    const parserError = tcxDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`)
    }
    
    // Find the first activity
    const activities = tcxDoc.querySelectorAll('Activity')
    if (activities.length === 0) {
      throw new Error('No activities found in TCX file')
    }
    
    const activity = activities[0]
    const activitySport = activity.getAttribute('Sport') || 'Other'
    
    // Extract activity ID and creation time
    const activityId = activity.querySelector('Id')?.textContent
    const activityCreationTime = activityId ? new Date(activityId) : new Date()
    
    // Find all laps
    const laps = activity.querySelectorAll('Lap')
    if (laps.length === 0) {
      throw new Error('No laps found in TCX activity')
    }
    
    // Process all track points from all laps
    const trackPoints: ParsedTrackPoint[] = []
    let totalDistance = 0
    let totalElapsedTime = 0
    let totalMovingTime = 0
    let totalCalories = 0
    let heartRateSum = 0
    let heartRateCount = 0
    let maxHeartRate: number | undefined
    let startTime: Date | undefined
    let endTime: Date | undefined
    
    for (const lap of Array.from(laps)) {
      // Extract lap summary data
      const lapStartTime = new Date(lap.getAttribute('StartTime') || activityCreationTime)
      const lapTotalTime = parseFloat(lap.querySelector('TotalTimeSeconds')?.textContent || '0')
      const lapDistance = parseFloat(lap.querySelector('DistanceMeters')?.textContent || '0')
      const lapCalories = parseInt(lap.querySelector('Calories')?.textContent || '0', 10)
      
      if (!startTime || lapStartTime < startTime) {
        startTime = lapStartTime
      }
      
      const lapEndTime = new Date(lapStartTime.getTime() + lapTotalTime * 1000)
      if (!endTime || lapEndTime > endTime) {
        endTime = lapEndTime
      }
      
      totalElapsedTime += lapTotalTime
      totalDistance += lapDistance
      totalCalories += lapCalories
      
      // Extract heart rate summary from lap
      const avgHr = lap.querySelector('AverageHeartRateBpm Value')?.textContent
      const maxHr = lap.querySelector('MaximumHeartRateBpm Value')?.textContent
      
      if (avgHr) {
        const hr = parseInt(avgHr, 10)
        heartRateSum += hr
        heartRateCount++
      }
      
      if (maxHr) {
        const hr = parseInt(maxHr, 10)
        if (!maxHeartRate || hr > maxHeartRate) {
          maxHeartRate = hr
        }
      }
      
      // Process track points in this lap
      const tracks = lap.querySelectorAll('Track')
      for (const track of Array.from(tracks)) {
        const trackpoints = track.querySelectorAll('Trackpoint')
        
        for (const trackpoint of Array.from(trackpoints)) {
          const timeElement = trackpoint.querySelector('Time')
          const positionElement = trackpoint.querySelector('Position')
          
          if (!timeElement || !positionElement) {
            continue // Skip trackpoints without time or position
          }
          
          const time = new Date(timeElement.textContent!)
          const lat = parseFloat(positionElement.querySelector('LatitudeDegrees')?.textContent || '0')
          const lng = parseFloat(positionElement.querySelector('LongitudeDegrees')?.textContent || '0')
          
          // Validate coordinates
          if (lat === 0 && lng === 0) {
            continue // Skip invalid coordinates
          }
          
          const altitude = trackpoint.querySelector('AltitudeMeters')?.textContent
          const heartRate = trackpoint.querySelector('HeartRateBpm Value')?.textContent
          const cadence = trackpoint.querySelector('Cadence')?.textContent
          
          const trackPoint: ParsedTrackPoint = {
            lat,
            lng,
            time,
            elevation: altitude ? parseFloat(altitude) : undefined,
            heartRate: heartRate ? parseInt(heartRate, 10) : undefined,
            cadence: cadence ? parseInt(cadence, 10) : undefined
          }
          
          trackPoints.push(trackPoint)
        }
      }
    }
    
    if (trackPoints.length === 0) {
      throw new Error('No valid track points found in TCX file')
    }
    
    // Fallback times if not calculated from laps
    if (!startTime) {
      startTime = trackPoints[0].time || activityCreationTime
    }
    if (!endTime) {
      endTime = trackPoints[trackPoints.length - 1].time || new Date(startTime.getTime() + totalElapsedTime * 1000)
    }
    
    // Calculate moving time (for now, same as elapsed time)
    totalMovingTime = totalElapsedTime
    
    // Calculate distance from track points if not available from laps
    if (totalDistance === 0) {
      totalDistance = calculateDistanceFromTrack(trackPoints)
    }
    
    // Calculate elevation gain/loss
    const { gain, loss } = calculateElevationFromTrack(trackPoints)
    
    // Calculate average heart rate
    const averageHeartRate = heartRateCount > 0 
      ? Math.round(heartRateSum / heartRateCount)
      : undefined
    
    // Calculate average pace (seconds per km)
    const averagePace = totalDistance > 0 && totalMovingTime > 0 
      ? (totalMovingTime / (totalDistance / 1000))
      : undefined
    
    // Determine activity type
    const activityType = determineActivityTypeFromTcx(activitySport)
    
    // Create activity name
    const activityName = createActivityName(activityType, startTime)
    
    return {
      name: activityName,
      type: activityType,
      startTime,
      endTime,
      totalDistance,
      totalElevationGain: gain,
      totalElevationLoss: loss,
      movingTime: totalMovingTime,
      elapsedTime: totalElapsedTime,
      averagePace,
      averageHeartRate,
      maxHeartRate,
      calories: totalCalories > 0 ? totalCalories : undefined,
      trackPoints,
      source: 'gpx' // Using 'gpx' as the source type for compatibility
    }
    
  } catch (error) {
    console.error('Failed to parse TCX:', error)
    throw new Error(`Failed to parse TCX file: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
 * Determine activity type from TCX sport attribute
 */
function determineActivityTypeFromTcx(sport: string): string {
  if (!sport) return 'run'
  
  const sportLower = sport.toLowerCase()
  
  switch (sportLower) {
    case 'running':
    case 'run':
      return 'run'
    case 'biking':
    case 'cycling':
    case 'bike':
      return 'bike'
    case 'walking':
    case 'walk':
      return 'walk'
    case 'hiking':
    case 'hike':
      return 'hike'
    case 'swimming':
    case 'swim':
      return 'swim'
    case 'other':
    default:
      // Try to infer from common patterns
      if (sportLower.includes('run')) return 'run'
      if (sportLower.includes('bike') || sportLower.includes('cycling')) return 'bike'
      if (sportLower.includes('walk')) return 'walk'
      if (sportLower.includes('hike')) return 'hike'
      if (sportLower.includes('trail')) return 'trail_run'
      
      return 'run' // Default fallback
  }
}

/**
 * Create a descriptive activity name
 */
function createActivityName(type: string, startTime: Date): string {
  const timeString = startTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
  
  const typeMap: { [key: string]: string } = {
    'run': 'Run',
    'trail_run': 'Trail Run',
    'bike': 'Bike Ride',
    'walk': 'Walk',
    'hike': 'Hike',
    'swim': 'Swim'
  }
  
  const typeName = typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1)
  
  return `${typeName} - ${timeString}`
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