import { useEffect, useMemo, useState } from 'react'
import { useMap } from './MapView'
import type { GpsPoint } from '../../types/activity'

export type ColorMode = 'pace' | 'elevation' | 'heartRate' | 'default'

export interface TrackLayerProps {
  // Track data
  points: GpsPoint[]
  
  // Styling
  colorMode?: ColorMode
  lineWidth?: number
  opacity?: number
  
  // Source and layer IDs (for multiple tracks)
  sourceId?: string
  layerId?: string
  
  // Events
  onTrackClick?: (point: GpsPoint, index: number) => void
  
  // Highlight specific point
  highlightPointIndex?: number
}

export default function TrackLayer({
  points,
  colorMode = 'default',
  lineWidth = 3,
  opacity = 0.8,
  sourceId = 'track',
  layerId = 'track-line',
  onTrackClick,
  highlightPointIndex
}: TrackLayerProps) {
  const map = useMap()
  const [isLayerAdded, setIsLayerAdded] = useState(false)

  // Convert points to GeoJSON LineString
  const trackGeoJSON = useMemo(() => {
    if (!points || points.length === 0) return null

    const coordinates = points.map(point => [
      point.longitude,
      point.latitude,
      point.elevation || 0
    ])

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates
      },
      properties: {
        colorMode
      }
    }
  }, [points, colorMode])

  // Calculate color values for gradient
  const colorData = useMemo(() => {
    if (!points || points.length === 0) return null

    switch (colorMode) {
      case 'pace':
        return calculatePaceColors(points)
      case 'elevation':
        return calculateElevationColors(points)
      case 'heartRate':
        return calculateHeartRateColors(points)
      default:
        return null
    }
  }, [points, colorMode])

  // Add or update track layer
  useEffect(() => {
    if (!map || !trackGeoJSON) return

    const sourceExists = map.getSource(sourceId)
    
    if (sourceExists) {
      // Update existing source
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
      source.setData({
        type: 'FeatureCollection',
        features: [trackGeoJSON]
      })
    } else {
      // Add new source
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [trackGeoJSON]
        },
        lineMetrics: true // Enable line metrics for gradients
      })

      // Add the track line layer
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': colorMode === 'default' ? '#22c55e' : '#22c55e', // Simplified for now
          'line-width': lineWidth,
          'line-opacity': opacity
        }
      })

      setIsLayerAdded(true)
    }

    // Add click handler if provided
    if (onTrackClick) {
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [layerId]
        })

        if (features.length > 0) {
          // Find the closest point on the track
          const clickedLng = e.lngLat.lng
          const clickedLat = e.lngLat.lat
          
          let closestIndex = 0
          let closestDistance = Infinity
          
          points.forEach((point, index) => {
            const distance = Math.sqrt(
              Math.pow(point.longitude - clickedLng, 2) +
              Math.pow(point.latitude - clickedLat, 2)
            )
            
            if (distance < closestDistance) {
              closestDistance = distance
              closestIndex = index
            }
          })
          
          onTrackClick(points[closestIndex], closestIndex)
        }
      }

      map.on('click', layerId, handleClick)
      
      // For now, skip cursor changes due to type issues

      // Cleanup
      return () => {
        map.off('click', layerId, handleClick)
      }
    }
  }, [map, trackGeoJSON, colorMode, colorData, lineWidth, opacity, sourceId, layerId, onTrackClick, points])

  // Update highlight point
  useEffect(() => {
    if (!map || !isLayerAdded || highlightPointIndex === undefined) return

    const highlightSourceId = `${sourceId}-highlight`
    const highlightLayerId = `${layerId}-highlight`

    // Remove existing highlight
    if (map.getLayer(highlightLayerId)) {
      map.removeLayer(highlightLayerId)
    }
    if (map.getSource(highlightSourceId)) {
      map.removeSource(highlightSourceId)
    }

    // Add new highlight point
    if (highlightPointIndex >= 0 && highlightPointIndex < points.length) {
      const point = points[highlightPointIndex]
      
      map.addSource(highlightSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude]
          },
          properties: {}
        }
      })

      map.addLayer({
        id: highlightLayerId,
        type: 'circle',
        source: highlightSourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3b82f6'
        }
      })
    }

    // Cleanup highlight on unmount
    return () => {
      if (map.getLayer(highlightLayerId)) {
        map.removeLayer(highlightLayerId)
      }
      if (map.getSource(highlightSourceId)) {
        map.removeSource(highlightSourceId)
      }
    }
  }, [map, isLayerAdded, highlightPointIndex, points, sourceId, layerId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map && isLayerAdded) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId)
        }
        
        // Also cleanup highlight layers
        const highlightSourceId = `${sourceId}-highlight`
        const highlightLayerId = `${layerId}-highlight`
        
        if (map.getLayer(highlightLayerId)) {
          map.removeLayer(highlightLayerId)
        }
        if (map.getSource(highlightSourceId)) {
          map.removeSource(highlightSourceId)
        }
      }
    }
  }, [map, isLayerAdded, sourceId, layerId])

  // This component doesn't render anything visible - it just manages the map layer
  return null
}

// Helper functions for color calculations
function calculatePaceColors(points: GpsPoint[]): number[] {
  const paces = points.map((point, index) => {
    if (index === 0 || !point.timestamp) return 0
    
    const prevPoint = points[index - 1]
    if (!prevPoint.timestamp) return 0
    
    const distance = calculateDistance(prevPoint, point)
    const time = (point.timestamp - prevPoint.timestamp) / 1000 // seconds
    
    if (time === 0) return 0
    return distance / time // m/s
  })
  
  const minPace = Math.min(...paces.filter(p => p > 0))
  const maxPace = Math.max(...paces)
  
  return paces.map(pace => {
    if (pace === 0) return 0
    return (pace - minPace) / (maxPace - minPace)
  })
}

function calculateElevationColors(points: GpsPoint[]): number[] {
  const elevations = points.map(p => p.elevation || 0)
  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)
  
  if (maxElevation === minElevation) return elevations.map(() => 0.5)
  
  return elevations.map(elevation => 
    (elevation - minElevation) / (maxElevation - minElevation)
  )
}

function calculateHeartRateColors(points: GpsPoint[]): number[] {
  const heartRates = points.map(p => p.heartRate || 0).filter(hr => hr > 0)
  
  if (heartRates.length === 0) return points.map(() => 0)
  
  const minHR = Math.min(...heartRates)
  const maxHR = Math.max(...heartRates)
  
  if (maxHR === minHR) return points.map(() => 0.5)
  
  return points.map(point => {
    const hr = point.heartRate || 0
    if (hr === 0) return 0
    return (hr - minHR) / (maxHR - minHR)
  })
}

// Helper functions for color calculations (currently simplified)

function calculateDistance(point1: GpsPoint, point2: GpsPoint): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRadians(point2.latitude - point1.latitude)
  const dLon = toRadians(point2.longitude - point1.longitude)
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}