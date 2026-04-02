import { useMemo } from 'react'
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart
} from 'recharts'
import type { GpsPoint } from '../../types/activity'
import { formatDistance, formatElevation, formatHeartRate } from '../../utils/formatting'

export interface ElevationChartProps {
  // Track data
  points: GpsPoint[]
  
  // Display options
  showHeartRate?: boolean
  showGrid?: boolean
  height?: number
  
  // Interaction
  onHover?: (pointIndex: number | null) => void
  highlightIndex?: number
  
  // Styling
  className?: string
  colors?: {
    elevation?: string
    elevationFill?: string
    heartRate?: string
    grid?: string
  }
}

interface ChartDataPoint {
  index: number
  distance: number
  elevation: number
  heartRate?: number
  distanceFormatted: string
  elevationFormatted: string
  heartRateFormatted?: string
}

export default function ElevationChart({
  points,
  showHeartRate = false,
  showGrid = true,
  height = 200,
  onHover,
  highlightIndex,
  className = '',
  colors = {}
}: ElevationChartProps) {
  // Process points into chart data
  const chartData = useMemo(() => {
    if (!points || points.length === 0) return []

    let totalDistance = 0
    
    return points.map((point, index) => {
      // Calculate cumulative distance
      if (index > 0) {
        const prevPoint = points[index - 1]
        const distance = calculateDistance(prevPoint, point)
        totalDistance += distance
      }

      return {
        index,
        distance: totalDistance / 1000, // Convert to kilometers
        elevation: point.elevation || 0,
        heartRate: point.heartRate,
        distanceFormatted: formatDistance(totalDistance),
        elevationFormatted: formatElevation(point.elevation || 0),
        heartRateFormatted: point.heartRate ? formatHeartRate(point.heartRate) : undefined
      }
    })
  }, [points])

  // Calculate chart domain for better visualization
  const { elevationDomain, heartRateDomain } = useMemo(() => {
    if (chartData.length === 0) {
      return { elevationDomain: [0, 100], heartRateDomain: [60, 200] }
    }

    const elevations = chartData.map(d => d.elevation)
    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    
    // Add some padding to elevation domain
    const elevationRange = maxElevation - minElevation
    const elevationPadding = Math.max(10, elevationRange * 0.1)
    
    const heartRates = chartData
      .map(d => d.heartRate)
      .filter(hr => hr !== undefined) as number[]
    
    let hrDomain = [60, 200] // default
    if (heartRates.length > 0) {
      const minHR = Math.min(...heartRates)
      const maxHR = Math.max(...heartRates)
      const hrPadding = Math.max(10, (maxHR - minHR) * 0.1)
      hrDomain = [
        Math.max(0, Math.floor(minHR - hrPadding)),
        Math.ceil(maxHR + hrPadding)
      ]
    }

    return {
      elevationDomain: [
        Math.floor(minElevation - elevationPadding),
        Math.ceil(maxElevation + elevationPadding)
      ],
      heartRateDomain: hrDomain
    }
  }, [chartData])

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload as ChartDataPoint

    return (
      <div className="bg-stone-800/90 backdrop-blur border border-stone-600 rounded-xl p-3 shadow-lg">
        <p className="text-sm font-medium text-white mb-2">
          Distance: {data.distanceFormatted}
        </p>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.elevation || '#10b981' }}
            />
            <span className="text-sm text-stone-300">
              Elevation: {data.elevationFormatted}
            </span>
          </div>
          {showHeartRate && data.heartRate && (
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors.heartRate || '#ef4444' }}
              />
              <span className="text-sm text-stone-300">
                Heart Rate: {data.heartRateFormatted}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Handle mouse move for hover interaction
  const handleMouseMove = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const pointData = data.activePayload[0].payload as ChartDataPoint
      onHover?.(pointData.index)
    }
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    onHover?.(null)
  }

  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-stone-800/50 rounded-xl ${className}`} style={{ height }}>
        <p className="text-stone-400 text-sm">No elevation data available</p>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={colors.grid || '#44403c'}
              className="opacity-30"
            />
          )}
          
          <XAxis
            dataKey="distance"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => `${value.toFixed(1)}km`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#a8a29e' }}
          />
          
          <YAxis
            yAxisId="elevation"
            domain={elevationDomain}
            orientation="left"
            tickFormatter={(value) => `${value}m`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#a8a29e' }}
          />
          
          {showHeartRate && (
            <YAxis
              yAxisId="heartRate"
              domain={heartRateDomain}
              orientation="right"
              tickFormatter={(value) => `${value}`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#ef4444' }}
            />
          )}

          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ strokeDasharray: '5 5', stroke: '#a8a29e' }}
          />

          {/* Elevation area */}
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke={colors.elevation || '#10b981'}
            strokeWidth={2}
            fill="url(#elevationGradient)"
            fillOpacity={1}
          />

          {/* Heart rate line */}
          {showHeartRate && (
            <Line
              yAxisId="heartRate"
              type="monotone"
              dataKey="heartRate"
              stroke={colors.heartRate || '#ef4444'}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          )}

          {/* Highlight reference line */}
          {highlightIndex !== undefined && highlightIndex >= 0 && highlightIndex < chartData.length && (
            <ReferenceLine
              x={chartData[highlightIndex].distance}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}

          {/* Define gradient */}
          <defs>
            <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Helper function to calculate distance between two points
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