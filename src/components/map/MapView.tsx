import React, { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapViewProps {
  // Map configuration
  center?: [number, number] // [longitude, latitude]
  zoom?: number
  bearing?: number
  pitch?: number
  
  // Map style and appearance
  style?: string
  darkMode?: boolean
  
  // Size and layout
  width?: string | number
  height?: string | number
  className?: string
  
  // Interaction controls
  interactive?: boolean
  showControls?: boolean
  showScale?: boolean
  
  // Events
  onLoad?: (map: maplibregl.Map) => void
  onMove?: (map: maplibregl.Map) => void
  onClick?: (event: maplibregl.MapMouseEvent) => void
  
  // Children (for overlays, markers, etc.)
  children?: React.ReactNode
}

// Context for child components to access the map instance
export const MapContext = React.createContext<maplibregl.Map | null>(null)

export default function MapView({
  center = [0, 0],
  zoom = 2,
  bearing = 0,
  pitch = 0,
  style,
  darkMode,
  width = '100%',
  height = '400px',
  className = '',
  interactive = true,
  showControls = true,
  showScale = false,
  onLoad,
  onMove,
  onClick,
  children
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // Determine the map style to use
  const getMapStyle = () => {
    if (style) return style
    
    // Use OpenFreeMap Liberty style
    if (darkMode) {
      // For dark mode, we could use a different style or modify the Liberty style
      // For now, we'll use the same style and let CSS handle dark mode adjustments
      return 'https://tiles.openfreemap.org/styles/liberty'
    } else {
      return 'https://tiles.openfreemap.org/styles/liberty'
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let cancelled = false
    const styleUrl = getMapStyle()

    // Fetch style and patch projection for maplibre-gl v5
    const initMap = async () => {
      let resolvedStyle: any = styleUrl
      if (typeof styleUrl === 'string') {
        try {
          const { loadMapStyle } = await import('../../utils/mapStyle')
          resolvedStyle = await loadMapStyle(styleUrl)
        } catch (e) {
          console.warn('Failed to pre-fetch map style, using URL directly', e)
        }
      }
      if (cancelled || !mapContainerRef.current) return
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: resolvedStyle,
        center,
        zoom,
        bearing,
        pitch,
        interactive,
        attributionControl: false
      })
      setupMap(map)
    }
    initMap()
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setupMap(map: maplibregl.Map) {

    // Add custom attribution
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      })
    )

    // Add navigation controls if enabled
    if (showControls) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
    }

    // Add scale control if enabled
    if (showScale) {
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
    }

    // Store map reference
    mapRef.current = map

    // Set up event handlers
    map.on('load', () => {
      setIsMapLoaded(true)
      onLoad?.(map)
    })

    if (onMove) {
      map.on('move', () => onMove(map))
    }

    if (onClick) {
      map.on('click', onClick)
    }

  }

  // Update map center when prop changes
  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
      mapRef.current.flyTo({ center, zoom })
    }
  }, [center, zoom, isMapLoaded])

  // Update map style when dark mode changes
  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
      mapRef.current.setStyle(getMapStyle())
    }
  }, [darkMode, style, isMapLoaded])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize()
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const containerStyle: React.CSSProperties = {
    width,
    height,
  }

  return (
    <div className={`relative ${className}`} style={containerStyle}>
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ touchAction: interactive ? 'none' : 'pan-x pan-y' }}
      />
      
      {/* Loading indicator */}
      {!isMapLoaded && (
        <div className="absolute inset-0 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center">
          <div className="flex items-center space-x-2 text-stone-600 dark:text-stone-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-forest-500"></div>
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      )}

      {/* Render children with map context */}
      {isMapLoaded && mapRef.current && (
        <MapContext.Provider value={mapRef.current}>
          {children}
        </MapContext.Provider>
      )}
    </div>
  )
}

// Hook for child components to access the map instance
export function useMap(): maplibregl.Map | null {
  return React.useContext(MapContext)
}