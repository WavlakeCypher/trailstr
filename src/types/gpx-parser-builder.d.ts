declare module 'gpx-parser-builder' {
  export interface GpxPoint {
    lat: number
    lon: number
    elevation?: number
    time?: string | Date
    extensions?: any
  }

  export interface GpxSegment {
    points: GpxPoint[]
  }

  export interface GpxTrack {
    name?: string
    segments?: GpxSegment[]
  }

  export interface GpxMetadata {
    name?: string
    description?: string
    author?: string
    link?: string
    time?: string | Date
  }

  export interface GpxData {
    tracks?: GpxTrack[]
    waypoints?: GpxPoint[]
    metadata?: GpxMetadata
  }

  export class GpxParser {
    constructor()
    parse(gpxString: string): GpxData
  }

  export default GpxParser
}