import ngeohash from 'ngeohash'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}

export interface GeohashBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/**
 * Encode coordinates to geohash at specified precision
 */
export function encodeGeohash(latitude: number, longitude: number, precision: number = 9): string {
  return ngeohash.encode(latitude, longitude, precision)
}

/**
 * Decode geohash to coordinates with error bounds
 */
export function decodeGeohash(geohash: string): GeohashBounds {
  const decoded = ngeohash.decode_bbox(geohash)
  return {
    minLat: decoded[0],
    maxLat: decoded[1], 
    minLon: decoded[2],
    maxLon: decoded[3]
  }
}

/**
 * Get center coordinates from geohash
 */
export function getGeohashCenter(geohash: string): Coordinates {
  const { latitude, longitude } = ngeohash.decode(geohash)
  return { latitude, longitude }
}

/**
 * Compute geohash at multiple precision levels for publishing
 */
export function computeGeohashLevels(latitude: number, longitude: number): string[] {
  const baseHash = ngeohash.encode(latitude, longitude, 9)
  
  // Return geohashes at precision levels 4, 6, 8, 9 for filtering
  return [
    baseHash.substring(0, 4), // ~20km precision
    baseHash.substring(0, 6), // ~1.2km precision  
    baseHash.substring(0, 8), // ~150m precision
    baseHash // ~40m precision
  ]
}

/**
 * Convert viewport bounding box to geohash prefixes for querying
 */
export function getGeohashPrefixesForViewport(bounds: BoundingBox, precision: number = 6): string[] {
  const prefixes = new Set<string>()
  
  // Sample points across the viewport and get their geohash prefixes
  const latStep = (bounds.north - bounds.south) / 10
  const lonStep = (bounds.east - bounds.west) / 10
  
  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lon = bounds.west; lon <= bounds.east; lon += lonStep) {
      const hash = ngeohash.encode(lat, lon, precision)
      prefixes.add(hash)
      
      // Also add parent prefixes for broader coverage
      for (let i = precision - 1; i >= 4; i--) {
        prefixes.add(hash.substring(0, i))
      }
    }
  }
  
  // Add neighbors to handle edge cases
  const centerLat = (bounds.north + bounds.south) / 2
  const centerLon = (bounds.east + bounds.west) / 2
  const centerHash = ngeohash.encode(centerLat, centerLon, precision)
  
  try {
    const neighbors = ngeohash.neighbors(centerHash)
    Object.values(neighbors).forEach(neighbor => {
      if (typeof neighbor === 'string') {
        prefixes.add(neighbor)
      }
    })
  } catch (error) {
    // Neighbors calculation might fail at edges, ignore
  }
  
  return Array.from(prefixes).sort()
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRadians(coord2.latitude - coord1.latitude)
  const dLon = toRadians(coord2.longitude - coord1.longitude)
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) * Math.cos(toRadians(coord2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(coord1: Coordinates, coord2: Coordinates): number {
  const dLon = toRadians(coord2.longitude - coord1.longitude)
  const lat1 = toRadians(coord1.latitude)
  const lat2 = toRadians(coord2.latitude)
  
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  
  let bearing = toDegrees(Math.atan2(y, x))
  return (bearing + 360) % 360
}

/**
 * Calculate bounding box around a center point with radius
 */
export function getBoundingBoxFromRadius(
  center: Coordinates, 
  radiusMeters: number
): BoundingBox {
  const R = 6371000 // Earth radius in meters
  const latDelta = radiusMeters / R * (180 / Math.PI)
  const lonDelta = radiusMeters / (R * Math.cos(toRadians(center.latitude))) * (180 / Math.PI)
  
  return {
    north: center.latitude + latDelta,
    south: center.latitude - latDelta,
    east: center.longitude + lonDelta,
    west: center.longitude - lonDelta
  }
}

/**
 * Check if a coordinate is within a bounding box
 */
export function isWithinBounds(coordinate: Coordinates, bounds: BoundingBox): boolean {
  return coordinate.latitude >= bounds.south &&
         coordinate.latitude <= bounds.north &&
         coordinate.longitude >= bounds.west &&
         coordinate.longitude <= bounds.east
}

/**
 * Get the precision level needed for a given map zoom level
 */
export function getGeohashPrecisionForZoom(zoom: number): number {
  if (zoom >= 16) return 9 // ~40m precision
  if (zoom >= 14) return 8 // ~150m precision
  if (zoom >= 12) return 7 // ~600m precision
  if (zoom >= 10) return 6 // ~1.2km precision
  if (zoom >= 8) return 5  // ~5km precision
  return 4 // ~20km precision
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(coord: Coordinates, precision: number = 6): string {
  const lat = coord.latitude.toFixed(precision)
  const lon = coord.longitude.toFixed(precision)
  const latDir = coord.latitude >= 0 ? 'N' : 'S'
  const lonDir = coord.longitude >= 0 ? 'E' : 'W'
  
  return `${Math.abs(Number(lat))}° ${latDir}, ${Math.abs(Number(lon))}° ${lonDir}`
}

/**
 * Parse DMS (Degrees, Minutes, Seconds) format to decimal degrees
 */
export function parseDMS(dms: string): number | null {
  // Example: "40° 44' 54.36\" N" or "40°44'54.36\"N"
  const regex = /(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/i
  const match = dms.match(regex)
  
  if (!match) return null
  
  const degrees = parseInt(match[1])
  const minutes = parseInt(match[2])
  const seconds = parseFloat(match[3])
  const direction = match[4].toUpperCase()
  
  let decimal = degrees + (minutes / 60) + (seconds / 3600)
  
  if (direction === 'S' || direction === 'W') {
    decimal *= -1
  }
  
  return decimal
}

/**
 * Convert decimal degrees to DMS format
 */
export function toDMS(decimal: number, isLatitude: boolean = true): string {
  const abs = Math.abs(decimal)
  const degrees = Math.floor(abs)
  const minutes = Math.floor((abs - degrees) * 60)
  const seconds = ((abs - degrees - minutes / 60) * 3600)
  
  const direction = isLatitude 
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W')
  
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`
}

/**
 * Simplify a track/route by removing redundant points
 */
export function simplifyTrack(
  points: Coordinates[], 
  tolerance: number = 10 // meters
): Coordinates[] {
  if (points.length <= 2) return points
  
  // Douglas-Peucker algorithm
  function douglasPeucker(points: Coordinates[], tolerance: number): Coordinates[] {
    if (points.length <= 2) return points
    
    let maxDistance = 0
    let maxIndex = 0
    
    // Find the point with maximum distance from the line segment
    for (let i = 1; i < points.length - 1; i++) {
      const distance = perpendicularDistance(
        points[i], 
        points[0], 
        points[points.length - 1]
      )
      
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = i
      }
    }
    
    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const leftPart = douglasPeucker(points.slice(0, maxIndex + 1), tolerance)
      const rightPart = douglasPeucker(points.slice(maxIndex), tolerance)
      
      return [...leftPart.slice(0, -1), ...rightPart]
    } else {
      return [points[0], points[points.length - 1]]
    }
  }
  
  return douglasPeucker(points, tolerance)
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(
  point: Coordinates,
  lineStart: Coordinates,
  lineEnd: Coordinates
): number {
  // This is a simplified version - in reality we'd need to project 
  // to a flat coordinate system for accuracy
  const A = point.latitude - lineStart.latitude
  const B = point.longitude - lineStart.longitude
  const C = lineEnd.latitude - lineStart.latitude
  const D = lineEnd.longitude - lineStart.longitude
  
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  
  if (lenSq === 0) {
    return calculateDistance(point, lineStart)
  }
  
  const param = dot / lenSq
  
  let xx: number, yy: number
  
  if (param < 0) {
    xx = lineStart.latitude
    yy = lineStart.longitude
  } else if (param > 1) {
    xx = lineEnd.latitude
    yy = lineEnd.longitude
  } else {
    xx = lineStart.latitude + param * C
    yy = lineStart.longitude + param * D
  }
  
  return calculateDistance(point, { latitude: xx, longitude: yy })
}