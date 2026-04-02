import { type Event } from 'nostr-tools'
import { KINDS } from './kinds'
import { v4 as uuidv4 } from 'uuid'
import ngeohash from 'ngeohash'

// Type definitions for TrailStr events
export interface TrailEventData {
  d: string // unique slug
  name: string
  summary?: string
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert'
  trailType: 'loop' | 'out-and-back' | 'point-to-point'
  distanceMeters: number
  elevationGainMeters: number
  location: string
  latitude: number
  longitude: number
  activityTypes: string[] // e.g., ['hike', 'walk', 'trail_run']
  heroImage?: {url: string, blurhash?: string}
  additionalImages?: Array<{url: string, blurhash?: string}>
  routeUrl?: string // URL to GeoJSON file
  content: string // Full markdown description
}

export interface ActivityEventData {
  d?: string // UUID, auto-generated if not provided
  type: string // 'hike' | 'walk' | 'run' | 'trail_run' | 'bike' etc.
  title: string
  startedAt: number // unix timestamp
  finishedAt?: number // unix timestamp
  elapsedSeconds?: number
  movingSeconds?: number
  distanceMeters?: number
  elevationGainMeters?: number
  elevationLossMeters?: number
  avgPaceSecondsPerKm?: number
  avgHeartRateBpm?: number
  calories?: number
  source?: string // import source identifier
  latitude?: number
  longitude?: number
  linkedTrail?: {authorPubkey: string, slug: string, relay?: string}
  trackUrl?: string // URL to GeoJSON or GPX file
  images?: Array<{url: string, blurhash?: string}>
  content?: string // Optional user notes in markdown
}

export interface ReviewEventData {
  trailAuthorPubkey: string
  trailSlug: string
  trailRelay?: string
  rating: 1 | 2 | 3 | 4 | 5
  hikedOn?: number // unix timestamp
  conditions?: string[] // e.g., ['muddy', 'icy', 'crowded']
  images?: Array<{url: string, blurhash?: string}>
  content: string // Review text in markdown
}

export interface ProfileEventData {
  name?: string
  displayName?: string
  about?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string // Lightning address
  [key: string]: any // Allow additional fields
}

/**
 * Build a trail event (kind 30530)
 */
export function buildTrailEvent(
  data: TrailEventData, 
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)
  
  // Generate geohash at multiple precision levels
  const geohash = ngeohash.encode(data.latitude, data.longitude, 9)
  const geohashPrefixes = [
    geohash.substring(0, 4),
    geohash.substring(0, 6), 
    geohash.substring(0, 8),
    geohash
  ]

  const tags: string[][] = [
    ['d', data.d],
    ['name', data.name],
    ['difficulty', data.difficulty],
    ['trail_type', data.trailType],
    ['distance_m', data.distanceMeters.toString()],
    ['elevation_gain_m', data.elevationGainMeters.toString()],
    ['location', data.location],
    ['L', 'run'], // Activity namespace label
    ['published_at', now.toString()]
  ]

  // Add geohashes
  geohashPrefixes.forEach(hash => {
    tags.push(['g', hash])
  })

  // Add summary if provided
  if (data.summary) {
    tags.push(['summary', data.summary])
  }

  // Add supported activity types
  data.activityTypes.forEach(activityType => {
    tags.push(['l', activityType, 'run'])
  })

  // Add hero image
  if (data.heroImage) {
    const imageTag = ['image', data.heroImage.url]
    if (data.heroImage.blurhash) {
      imageTag.push(data.heroImage.blurhash)
    }
    tags.push(imageTag)
  }

  // Add additional images  
  if (data.additionalImages) {
    data.additionalImages.forEach(img => {
      const imageTag = ['image', img.url]
      if (img.blurhash) {
        imageTag.push(img.blurhash)
      }
      tags.push(imageTag)
    })
  }

  // Add route file URL
  if (data.routeUrl) {
    tags.push(['route', data.routeUrl])
  }

  return {
    kind: KINDS.TRAIL,
    pubkey,
    created_at: now,
    tags,
    content: data.content
  }
}

/**
 * Build an activity event (kind 30531)
 */
export function buildActivityEvent(
  data: ActivityEventData,
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)
  const activityId = data.d || uuidv4()

  const tags: string[][] = [
    ['d', activityId],
    ['type', data.type],
    ['title', data.title],
    ['started_at', data.startedAt.toString()],
    ['published_at', now.toString()]
  ]

  // Add optional timestamps
  if (data.finishedAt) {
    tags.push(['finished_at', data.finishedAt.toString()])
  }

  // Add optional metrics
  if (data.elapsedSeconds !== undefined) {
    tags.push(['elapsed_s', data.elapsedSeconds.toString()])
  }
  if (data.movingSeconds !== undefined) {
    tags.push(['moving_s', data.movingSeconds.toString()])
  }
  if (data.distanceMeters !== undefined) {
    tags.push(['distance_m', data.distanceMeters.toString()])
  }
  if (data.elevationGainMeters !== undefined) {
    tags.push(['elevation_gain_m', data.elevationGainMeters.toString()])
  }
  if (data.elevationLossMeters !== undefined) {
    tags.push(['elevation_loss_m', data.elevationLossMeters.toString()])
  }
  if (data.avgPaceSecondsPerKm !== undefined) {
    tags.push(['avg_pace_s_per_km', data.avgPaceSecondsPerKm.toString()])
  }
  if (data.avgHeartRateBpm !== undefined) {
    tags.push(['avg_hr_bpm', data.avgHeartRateBpm.toString()])
  }
  if (data.calories !== undefined) {
    tags.push(['calories', data.calories.toString()])
  }
  if (data.source) {
    tags.push(['source', data.source])
  }

  // Add geohash if coordinates provided
  if (data.latitude !== undefined && data.longitude !== undefined) {
    const geohash = ngeohash.encode(data.latitude, data.longitude, 9)
    tags.push(['g', geohash])
  }

  // Add linked trail reference
  if (data.linkedTrail) {
    const trailRef = `${KINDS.TRAIL}:${data.linkedTrail.authorPubkey}:${data.linkedTrail.slug}`
    const aTag = ['a', trailRef]
    if (data.linkedTrail.relay) {
      aTag.push(data.linkedTrail.relay)
    }
    tags.push(aTag)
  }

  // Add track file URL
  if (data.trackUrl) {
    tags.push(['track', data.trackUrl])
  }

  // Add images
  if (data.images) {
    data.images.forEach(img => {
      const imageTag = ['image', img.url]
      if (img.blurhash) {
        imageTag.push(img.blurhash)
      }
      tags.push(imageTag)
    })
  }

  return {
    kind: KINDS.ACTIVITY,
    pubkey,
    created_at: now,
    tags,
    content: data.content || ''
  }
}

/**
 * Build a review event (kind 30532)
 */
export function buildReviewEvent(
  data: ReviewEventData,
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)
  
  // The d tag encodes the trail reference for replaceability
  const dTag = `review:${data.trailAuthorPubkey}:${data.trailSlug}`
  
  const tags: string[][] = [
    ['d', dTag],
    ['rating', data.rating.toString()]
  ]

  // Add trail reference
  const trailRef = `${KINDS.TRAIL}:${data.trailAuthorPubkey}:${data.trailSlug}`
  const aTag = ['a', trailRef]
  if (data.trailRelay) {
    aTag.push(data.trailRelay)
  }
  tags.push(aTag)

  // Add optional fields
  if (data.hikedOn) {
    tags.push(['hiked_on', data.hikedOn.toString()])
  }

  // Add conditions
  if (data.conditions) {
    data.conditions.forEach(condition => {
      tags.push(['conditions', condition])
    })
  }

  // Add images
  if (data.images) {
    data.images.forEach(img => {
      const imageTag = ['image', img.url]
      if (img.blurhash) {
        imageTag.push(img.blurhash)
      }
      tags.push(imageTag)
    })
  }

  return {
    kind: KINDS.REVIEW,
    pubkey,
    created_at: now,
    tags,
    content: data.content
  }
}

/**
 * Build a profile metadata event (kind 0)
 */
export function buildProfileEvent(
  data: ProfileEventData,
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  return {
    kind: KINDS.SET_METADATA,
    pubkey,
    created_at: now,
    tags: [],
    content: JSON.stringify(data)
  }
}

/**
 * Build a contact list event (kind 3) 
 */
export function buildContactListEvent(
  followedPubkeys: string[],
  pubkey: string,
  relayList?: Record<string, {read: boolean, write: boolean}>,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  const tags: string[][] = followedPubkeys.map(followedPubkey => ['p', followedPubkey])

  const content = relayList ? JSON.stringify(relayList) : ''

  return {
    kind: KINDS.CONTACT_LIST,
    pubkey,
    created_at: now,
    tags,
    content
  }
}

/**
 * Build a reaction event (kind 7)
 */
export function buildReactionEvent(
  targetEventId: string,
  targetAuthorPubkey: string,
  emoji: string,
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  return {
    kind: KINDS.REACTION,
    pubkey,
    created_at: now,
    tags: [
      ['e', targetEventId],
      ['p', targetAuthorPubkey]
    ],
    content: emoji
  }
}

/**
 * Build a text note/comment event (kind 1)
 */
export function buildCommentEvent(
  content: string,
  targetEventId: string,
  targetAuthorPubkey: string,
  pubkey: string,
  createdAt?: number,
  rootEventId?: string
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  const tags: string[][] = [
    ['e', targetEventId, '', 'reply'],
    ['p', targetAuthorPubkey]
  ]

  // Add root event reference for threading
  if (rootEventId && rootEventId !== targetEventId) {
    tags.unshift(['e', rootEventId, '', 'root'])
  }

  return {
    kind: KINDS.TEXT_NOTE,
    pubkey,
    created_at: now,
    tags,
    content
  }
}

/**
 * Build a repost event (kind 6) 
 */
export function buildRepostEvent(
  targetEventId: string,
  targetAuthorPubkey: string,
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  return {
    kind: KINDS.REPOST,
    pubkey,
    created_at: now,
    tags: [
      ['e', targetEventId],
      ['p', targetAuthorPubkey]
    ],
    content: ''
  }
}

/**
 * Build relay list metadata event (kind 10002)
 */
export function buildRelayListEvent(
  readRelays: string[],
  writeRelays: string[],
  pubkey: string,
  createdAt?: number
): Omit<Event, 'id' | 'sig'> {
  const now = createdAt || Math.floor(Date.now() / 1000)

  const tags: string[][] = []
  
  // Add read relays
  readRelays.forEach(relay => {
    tags.push(['r', relay])
  })
  
  // Add write relays
  writeRelays.forEach(relay => {
    tags.push(['r', relay, 'write'])
  })

  return {
    kind: KINDS.RELAY_LIST_METADATA,
    pubkey,
    created_at: now,
    tags,
    content: ''
  }
}