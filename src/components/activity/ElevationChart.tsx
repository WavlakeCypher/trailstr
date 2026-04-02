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
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
          Distance: {data.distanceFormatted}
        </p>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.elevation || '#22c55e' }}
            />
            <span className="text-sm text-stone-700 dark:text-stone-300">
              Elevation: {data.elevationFormatted}
            </span>
          </div>
          {showHeartRate && data.heartRate && (
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors.heartRate || '#ef4444' }}
              />
              <span className="text-sm text-stone-700 dark:text-stone-300">
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
      <div className={`flex items-center justify-center bg-stone-50 dark:bg-stone-800 rounded-lg ${className}`} style={{ height }}>
        <p className="text-stone-500 dark:text-stone-400 text-sm">No elevation data available</p>
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
              stroke={colors.grid || '#e5e7eb'}
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
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          
          <YAxis
            yAxisId="elevation"
            domain={elevationDomain}
            orientation="left"
            tickFormatter={(value) => `${value}m`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
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
            cursor={{ strokeDasharray: '5 5', stroke: '#6b7280' }}
          />

          {/* Elevation area */}
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke={colors.elevation || '#22c55e'}
            strokeWidth={2}
            fill={colors.elevationFill || '#22c55e'}
            fillOpacity={0.3}
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
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
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