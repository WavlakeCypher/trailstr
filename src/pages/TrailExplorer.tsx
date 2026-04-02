import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, Plus, MapPin, Mountain, Ruler } from 'lucide-react'
import maplibregl, { Map as MapLibreMap, LngLat } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useTrailStore } from '../stores/trailStore'
import { calculateDistance } from '../utils/geo'

interface TrailFilter {
  search: string
  difficulty: string[]
  trailType: string[]
  distanceRange: [number, number]
  activityTypes: string[]
}

export default function TrailExplorer() {
  const { trails, fetchTrailsInBounds, isLoading } = useTrailStore()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [currentCenter, setCurrentCenter] = useState<LngLat | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [filteredTrails, setFilteredTrails] = useState<any[]>([])

  const [filter, setFilter] = useState<TrailFilter>({
    search: '',
    difficulty: [],
    trailType: [],
    distanceRange: [0, 50000],
    activityTypes: []
  })

  const difficultyOptions = [
    { value: 'easy', label: 'Easy', color: 'text-green-600' },
    { value: 'moderate', label: 'Moderate', color: 'text-yellow-600' },
    { value: 'hard', label: 'Hard', color: 'text-orange-600' },
    { value: 'expert', label: 'Expert', color: 'text-red-600' }
  ]

  const activityTypeOptions = [
    { value: 'hike', label: 'Hiking' },
    { value: 'walk', label: 'Walking' },
    { value: 'trail_run', label: 'Trail Running' },
    { value: 'run', label: 'Running' },
    { value: 'bike', label: 'Biking' },
    { value: 'mountain_bike', label: 'Mountain Biking' }
  ]

  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [-106.3468, 39.7392],
        zoom: 8
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
      map.current.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
      }), 'top-right')

      map.current.on('moveend', handleMapMove)
      map.current.on('zoomend', handleMapMove)

      handleMapMove()
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  useEffect(() => {
    let filtered = trails.filter(trail => {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        if (!trail.name.toLowerCase().includes(searchLower) &&
            !trail.location?.toLowerCase().includes(searchLower) &&
            !trail.summary?.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      if (filter.difficulty.length > 0 && !filter.difficulty.includes(trail.difficulty)) {
        return false
      }

      if (filter.trailType.length > 0 && !filter.trailType.includes(trail.type)) {
        return false
      }

      const distanceMeters = trail.distance * 1000
      if (distanceMeters < filter.distanceRange[0] || distanceMeters > filter.distanceRange[1]) {
        return false
      }

      return true
    })

    if (currentCenter) {
      filtered = filtered.sort((a, b) => {
        const latA = a.startCoordinates?.[1] || 0
        const lonA = a.startCoordinates?.[0] || 0
        const latB = b.startCoordinates?.[1] || 0
        const lonB = b.startCoordinates?.[0] || 0
        
        const distanceA = calculateDistance(
          { latitude: currentCenter.lat, longitude: currentCenter.lng },
          { latitude: latA, longitude: lonA }
        )
        const distanceB = calculateDistance(
          { latitude: currentCenter.lat, longitude: currentCenter.lng },
          { latitude: latB, longitude: lonB }
        )
        return distanceA - distanceB
      })
    }

    setFilteredTrails(filtered)
    updateMapMarkers(filtered)
  }, [trails, filter, currentCenter])

  const handleMapMove = () => {
    if (!map.current) return

    const center = map.current.getCenter()
    const bounds = map.current.getBounds()

    setCurrentCenter(center)

    fetchTrailsInBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    })
  }

  const updateMapMarkers = (trails: any[]) => {
    if (!map.current) return

    if (map.current.getSource('trails')) {
      map.current.removeLayer('trail-clusters')
      map.current.removeLayer('trail-cluster-count')
      map.current.removeLayer('trail-points')
      map.current.removeSource('trails')
    }

    if (trails.length === 0) return

    const geojson = {
      type: 'FeatureCollection' as const,
      features: trails.map(trail => ({
        type: 'Feature' as const,
        properties: {
          id: trail.id,
          name: trail.name,
          difficulty: trail.difficulty,
          trailType: trail.type,
          distanceMeters: trail.distance * 1000,
          elevationGainMeters: trail.elevationGain
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [
            trail.startCoordinates?.[0] || 0,
            trail.startCoordinates?.[1] || 0
          ]
        }
      }))
    }

    map.current.addSource('trails', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    })

    map.current.addLayer({
      id: 'trail-clusters',
      type: 'circle',
      source: 'trails',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#22c55e', 5, '#3b82f6', 10, '#f59e0b'
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          15, 5, 20, 10, 25
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    map.current.addLayer({
      id: 'trail-cluster-count',
      type: 'symbol',
      source: 'trails',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: { 'text-color': '#ffffff' }
    })

    map.current.addLayer({
      id: 'trail-points',
      type: 'circle',
      source: 'trails',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match', ['get', 'difficulty'],
          'easy', '#22c55e',
          'moderate', '#eab308',
          'hard', '#f97316',
          'expert', '#dc2626',
          '#6b7280'
        ],
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    map.current.on('click', 'trail-clusters', (e) => {
      const features = map.current!.queryRenderedFeatures(e.point, { layers: ['trail-clusters'] })
      if (features[0] && features[0].properties) {
        const clusterId = features[0].properties.cluster_id
        const source = map.current!.getSource('trails') as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          if (features[0].geometry.type === 'Point') {
            map.current!.easeTo({
              center: features[0].geometry.coordinates as [number, number],
              zoom: zoom
            })
          }
        }).catch((err) => {
          console.error('Failed to get cluster expansion zoom:', err)
        })
      }
    })

    map.current.on('click', 'trail-points', (e) => {
      if (e.features && e.features[0] && e.features[0].properties) {
        const trailId = e.features[0].properties.id
        const trail = trails.find(t => t.id === trailId)
        if (trail) {
          alert(`Trail: ${trail.name}\nDifficulty: ${trail.difficulty}\nDistance: ${trail.distance.toFixed(1)}km`)
        }
      }
    })

    map.current.on('mouseenter', 'trail-clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })
    map.current.on('mouseleave', 'trail-clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })
    map.current.on('mouseenter', 'trail-points', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })
    map.current.on('mouseleave', 'trail-points', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })
  }

  const toggleFilterValue = (filterKey: keyof TrailFilter, value: string) => {
    setFilter(prev => {
      const currentArray = prev[filterKey] as string[]
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value]
      return { ...prev, [filterKey]: newArray }
    })
  }

  const formatDistance = (meters: number): string => {
    const km = meters / 1000
    return km < 1 ? `${meters}m` : `${km.toFixed(1)}km`
  }

  const formatElevation = (meters: number): string => {
    return `${meters}m`
  }

  return (
    <div className="relative h-screen overflow-hidden dark:bg-stone-900">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Search and Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Search trails..."
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-stone-800 rounded-lg shadow-lg border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="px-4 py-3 bg-white dark:bg-stone-800 rounded-lg shadow-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center space-x-2 text-stone-700 dark:text-stone-300"
        >
          <Filter size={20} />
          <span className="hidden sm:inline">Filters</span>
        </button>

        <Link
          to="/create-trail"
          className="px-4 py-3 bg-forest-500 text-white rounded-lg shadow-lg hover:bg-forest-600 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Trail</span>
        </Link>
      </div>

      {/* Sidebar/Bottom Sheet */}
      <div className={`absolute bg-white dark:bg-stone-800 shadow-xl transition-transform duration-300 z-20 ${
        showSidebar
          ? 'translate-x-0 translate-y-0'
          : 'lg:-translate-x-full translate-y-full lg:translate-y-0'
      } bottom-0 left-0 lg:top-20 w-full lg:w-80 h-64 lg:h-[calc(100vh-5rem)] rounded-t-xl lg:rounded-r-xl lg:rounded-t-none`}>
        
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 rounded-t-xl lg:rounded-t-none lg:rounded-tr-xl">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-stone-800 dark:text-stone-100">
                Trails ({filteredTrails.length})
              </h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden text-stone-500 dark:text-stone-400"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-stone-200 dark:border-stone-700 space-y-4 bg-stone-50 dark:bg-stone-800/50">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                Difficulty
              </label>
              <div className="flex flex-wrap gap-1">
                {difficultyOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => toggleFilterValue('difficulty', option.value)}
                    className={`px-2 py-1 text-xs rounded border ${
                      filter.difficulty.includes(option.value)
                        ? 'bg-forest-100 dark:bg-forest-900/30 border-forest-300 dark:border-forest-700 text-forest-800 dark:text-forest-300'
                        : 'bg-white dark:bg-stone-700 border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                Activity Type
              </label>
              <div className="flex flex-wrap gap-1">
                {activityTypeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => toggleFilterValue('activityTypes', option.value)}
                    className={`px-2 py-1 text-xs rounded border ${
                      filter.activityTypes.includes(option.value)
                        ? 'bg-forest-100 dark:bg-forest-900/30 border-forest-300 dark:border-forest-700 text-forest-800 dark:text-forest-300'
                        : 'bg-white dark:bg-stone-700 border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trail List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-stone-500 dark:text-stone-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-500 mx-auto mb-2"></div>
                Loading trails...
              </div>
            ) : filteredTrails.length === 0 ? (
              <div className="p-4 text-center text-stone-500 dark:text-stone-400">
                <Mountain className="mx-auto mb-2 text-stone-400 dark:text-stone-600" size={24} />
                <p>No trails found</p>
                <p className="text-sm">Try adjusting your filters or zoom out</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {filteredTrails.slice(0, 50).map(trail => (
                  <div
                    key={trail.id}
                    className="p-3 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-stone-800 dark:text-stone-100 text-sm leading-tight">
                        {trail.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        trail.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                        trail.difficulty === 'moderate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                        trail.difficulty === 'hard' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400' :
                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>
                        {trail.difficulty}
                      </span>
                    </div>

                    {trail.location && (
                      <div className="flex items-center text-stone-600 dark:text-stone-400 mb-2">
                        <MapPin size={12} className="mr-1" />
                        <span className="text-xs">{trail.location}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-stone-600 dark:text-stone-400">
                      <div className="flex items-center">
                        <Ruler size={12} className="mr-1" />
                        {formatDistance(trail.distance * 1000)}
                      </div>
                      <div className="flex items-center">
                        <Mountain size={12} className="mr-1" />
                        {formatElevation(trail.elevationGain)}
                      </div>
                      {currentCenter && trail.startCoordinates && (
                        <div className="flex items-center">
                          <MapPin size={12} className="mr-1" />
                          {(calculateDistance(
                            { latitude: currentCenter.lat, longitude: currentCenter.lng },
                            { latitude: trail.startCoordinates[1], longitude: trail.startCoordinates[0] }
                          ) / 1000).toFixed(1)}km away
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
