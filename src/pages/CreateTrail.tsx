import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Camera, X, Plus, Save } from 'lucide-react'
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useAuthStore } from '../stores/authStore'
import { uploadToNostrBuild } from '../nostr/nip96'
import { resizeImageAndGenerateBlurhash } from '../utils/media'
import { v4 as uuidv4 } from 'uuid'

interface TrailFormData {
  name: string
  description: string
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert'
  trailType: 'loop' | 'out-and-back' | 'point-to-point'
  location: string
  activityTypes: string[]
  heroImage?: File
  additionalImages: File[]
  routeCoordinates: [number, number][]
  gpxFile?: File
}

export default function CreateTrail() {
  const navigate = useNavigate()
  const { profile, getSigner, isAuthenticated, pubkey } = useAuthStore()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState<TrailFormData>({
    name: '',
    description: '',
    difficulty: 'moderate',
    trailType: 'out-and-back',
    location: '',
    activityTypes: ['hike'],
    additionalImages: [],
    routeCoordinates: []
  })

  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    message: string
  } | null>(null)

  const activityOptions = [
    { value: 'hike', label: 'Hiking' },
    { value: 'walk', label: 'Walking' },
    { value: 'trail_run', label: 'Trail Running' },
    { value: 'run', label: 'Running' },
    { value: 'bike', label: 'Biking' },
    { value: 'mountain_bike', label: 'Mountain Biking' }
  ]

  // Initialize map
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [-106.3468, 39.7392], // Default to Colorado
        zoom: 10
      })

      // Add click handler for route drawing
      map.current.on('click', handleMapClick)
      
      // Add drawing controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  const handleMapClick = (e: maplibregl.MapMouseEvent) => {
    if (!isDrawing || !map.current) return

    const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat]
    
    // Add marker
    const marker = new maplibregl.Marker()
      .setLngLat(coords)
      .addTo(map.current)
    
    setMarkers(prev => [...prev, marker])
    setFormData(prev => ({
      ...prev,
      routeCoordinates: [...prev.routeCoordinates, coords]
    }))

    // Update route line
    updateRouteLine([...formData.routeCoordinates, coords])
  }

  const updateRouteLine = (coordinates: [number, number][]) => {
    if (!map.current || coordinates.length < 2) return

    if (map.current.getSource('route')) {
      (map.current.getSource('route') as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      })
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        }
      })

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#22c55e',
          'line-width': 4
        }
      })
    }
  }

  const clearRoute = () => {
    markers.forEach(marker => marker.remove())
    setMarkers([])
    setFormData(prev => ({ ...prev, routeCoordinates: [] }))
    
    if (map.current?.getSource('route')) {
      map.current.removeLayer('route')
      map.current.removeSource('route')
    }
  }

  const handleGpxUpload = async (file: File) => {
    try {
      // For now, just store the file - in a real app we'd parse GPX
      setFormData(prev => ({ ...prev, gpxFile: file }))
      // TODO: Parse GPX and extract coordinates
      alert('GPX upload functionality will be implemented')
    } catch (error) {
      alert('Failed to process GPX file')
    }
  }

  const handleImageUpload = (files: FileList | null, isHero: boolean = false) => {
    if (!files) return

    const fileArray = Array.from(files)
    
    if (isHero && fileArray.length > 0) {
      setFormData(prev => ({ ...prev, heroImage: fileArray[0] }))
    } else {
      setFormData(prev => ({
        ...prev,
        additionalImages: [...prev.additionalImages, ...fileArray]
      }))
    }
  }

  const removeAdditionalImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalImages: prev.additionalImages.filter((_, i) => i !== index)
    }))
  }

  const handleActivityTypeToggle = (activityType: string) => {
    setFormData(prev => {
      const isSelected = prev.activityTypes.includes(activityType)
      return {
        ...prev,
        activityTypes: isSelected
          ? prev.activityTypes.filter(t => t !== activityType)
          : [...prev.activityTypes, activityType]
      }
    })
  }

  const calculateRouteStats = () => {
    if (formData.routeCoordinates.length < 2) {
      return { distance: 0, elevationGain: 0 }
    }
    
    // Simple distance calculation (in reality we'd use more sophisticated methods)
    let distance = 0
    for (let i = 1; i < formData.routeCoordinates.length; i++) {
      const [lon1, lat1] = formData.routeCoordinates[i - 1]
      const [lon2, lat2] = formData.routeCoordinates[i]
      
      const R = 6371000 // Earth radius in meters
      const φ1 = lat1 * Math.PI / 180
      const φ2 = lat2 * Math.PI / 180
      const Δφ = (lat2 - lat1) * Math.PI / 180
      const Δλ = (lon2 - lon1) * Math.PI / 180

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      distance += R * c
    }
    
    // TODO: Calculate elevation gain from elevation service
    return { distance, elevationGain: 0 }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const signer = getSigner()
    if (!isAuthenticated || !profile || !signer) {
      alert('Please log in to create a trail')
      return
    }

    if (!formData.name || !formData.description) {
      alert('Please fill in trail name and description')
      return
    }

    if (formData.routeCoordinates.length < 2 && !formData.gpxFile) {
      alert('Please draw a route or upload a GPX file')
      return
    }

    setIsSubmitting(true)
    setUploadProgress({ current: 0, total: 1, message: 'Starting upload...' })

    try {
      const { distance, elevationGain } = calculateRouteStats()
      
      let heroImageData
      let additionalImagesData: Array<{url: string, blurhash?: string}> = []
      
      // Upload hero image
      if (formData.heroImage) {
        setUploadProgress({ current: 0, total: 1, message: 'Processing hero image...' })
        const resized = await resizeImageAndGenerateBlurhash(formData.heroImage)
        const url = await uploadToNostrBuild(resized.blob, signer.signEvent.bind(signer))
        heroImageData = { url, blurhash: resized.blurhash }
      }
      
      // Upload additional images
      if (formData.additionalImages.length > 0) {
        for (let i = 0; i < formData.additionalImages.length; i++) {
          setUploadProgress({ 
            current: i, 
            total: formData.additionalImages.length, 
            message: `Processing image ${i + 1}...` 
          })
          
          const resized = await resizeImageAndGenerateBlurhash(formData.additionalImages[i])
          const url = await uploadToNostrBuild(resized.blob, signer.signEvent.bind(signer))
          additionalImagesData.push({ url, blurhash: resized.blurhash })
        }
      }
      
      // Get center point for geohash
      let centerLat = 0, centerLon = 0
      if (formData.routeCoordinates.length > 0) {
        centerLat = formData.routeCoordinates.reduce((sum, coord) => sum + coord[1], 0) / formData.routeCoordinates.length
        centerLon = formData.routeCoordinates.reduce((sum, coord) => sum + coord[0], 0) / formData.routeCoordinates.length
      }
      
      setUploadProgress({ current: 1, total: 1, message: 'Publishing trail...' })
      
      // Build and publish trail event
      const trailData = {
        d: uuidv4(),
        name: formData.name,
        summary: formData.description.substring(0, 100),
        difficulty: formData.difficulty,
        trailType: formData.trailType,
        distanceMeters: Math.round(distance),
        elevationGainMeters: Math.round(elevationGain),
        location: formData.location,
        latitude: centerLat,
        longitude: centerLon,
        activityTypes: formData.activityTypes,
        heroImage: heroImageData,
        additionalImages: additionalImagesData,
        content: formData.description
      }
      
      const { buildTrailEvent } = await import('../nostr/events')
      const trailEvent = buildTrailEvent(trailData, pubkey || '')
      const signedEvent = await signer.signEvent(trailEvent)
      
      // TODO: Publish to relays
      console.log('Trail event created:', signedEvent)
      
      alert('Trail created successfully!')
      navigate('/trail-explorer')
      
    } catch (error) {
      console.error('Failed to create trail:', error)
      alert('Failed to create trail. Please try again.')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-2xl font-bold text-forest-800 mb-4">Create Trail</h1>
        <p>Please log in to create a trail.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-forest-800 mb-6">Create New Trail</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Trail Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trail Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Rocky Mountain National Park, CO"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500"
                >
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="hard">Hard</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trail Type
                </label>
                <select
                  value={formData.trailType}
                  onChange={(e) => setFormData(prev => ({ ...prev, trailType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500"
                >
                  <option value="out-and-back">Out and Back</option>
                  <option value="loop">Loop</option>
                  <option value="point-to-point">Point to Point</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500"
                placeholder="Describe the trail, what to expect, highlights, etc."
                required
              />
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Types
              </label>
              <div className="flex flex-wrap gap-2">
                {activityOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleActivityTypeToggle(option.value)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      formData.activityTypes.includes(option.value)
                        ? 'bg-forest-100 border-forest-300 text-forest-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Route Drawing */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Trail Route</h2>
            
            <div className="mb-4 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDrawing(!isDrawing)}
                className={`px-4 py-2 rounded-md ${
                  isDrawing
                    ? 'bg-forest-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isDrawing ? 'Stop Drawing' : 'Start Drawing Route'}
              </button>
              
              <button
                type="button"
                onClick={clearRoute}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Clear Route
              </button>
              
              <label className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 cursor-pointer">
                <Upload size={16} className="inline mr-1" />
                Upload GPX
                <input
                  type="file"
                  accept=".gpx"
                  onChange={(e) => e.target.files && handleGpxUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="h-96 rounded-md overflow-hidden border">
              <div ref={mapContainer} className="w-full h-full" />
            </div>
            
            <p className="text-sm text-gray-600 mt-2">
              {isDrawing 
                ? 'Click on the map to add waypoints to your trail route.'
                : 'Click "Start Drawing Route" and then click on the map to create your trail route.'
              }
            </p>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Photos</h2>
            
            <div className="space-y-4">
              {/* Hero Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hero Image
                </label>
                <label className="block w-full p-4 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                  <div className="text-center">
                    {formData.heroImage ? (
                      <div className="text-green-600">
                        <Camera className="mx-auto mb-2" />
                        <p>{formData.heroImage.name}</p>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <Camera className="mx-auto mb-2" />
                        <p>Click to upload hero image</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files, true)}
                    className="hidden"
                  />
                </label>
              </div>
              
              {/* Additional Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Images
                </label>
                <label className="block w-full p-4 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                  <div className="text-center text-gray-500">
                    <Plus className="mx-auto mb-2" />
                    <p>Click to add more images</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
                
                {formData.additionalImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {formData.additionalImages.map((file, index) => (
                      <div key={index} className="relative">
                        <div className="aspect-square bg-gray-200 rounded-md flex items-center justify-center">
                          <span className="text-xs text-gray-600 text-center px-1">
                            {file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAdditionalImage(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/trail-explorer')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-forest-500 text-white rounded-md hover:bg-forest-600 disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Create Trail</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-500 mx-auto mb-4"></div>
                <p className="text-gray-700 mb-2">{uploadProgress.message}</p>
                {uploadProgress.total > 1 && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-forest-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}