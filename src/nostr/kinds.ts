// Standard Nostr event kinds (NIP-01)
export const STANDARD_KINDS = {
  // Core
  SET_METADATA: 0,        // User profile metadata (kind-0)
  TEXT_NOTE: 1,           // Basic text note (kind-1)
  RECOMMEND_RELAY: 2,     // Relay recommendation
  CONTACT_LIST: 3,        // Following/contact list (kind-3)
  
  // Encrypted
  ENCRYPTED_DIRECT_MESSAGE: 4,  // Encrypted DM (kind-4)
  
  // Social
  EVENT_DELETION: 5,      // Event deletion request
  REPOST: 6,              // Repost/share (kind-6)
  REACTION: 7,            // Reaction/like (kind-7)
  
  // Other standard kinds
  BADGE_AWARD: 8,         // Badge award
  GROUP_CHAT_MESSAGE: 9,  // Group chat message
  
  // Zaps (Lightning tips)
  ZAP_RECEIPT: 9735,      // Zap receipt (kind-9735)
  
  // Relay lists
  RELAY_LIST_METADATA: 10002,  // Relay list (kind-10002)
} as const

// TrailStr custom event kinds (30000-39999 range for parameterized replaceable)
export const TRAILSTR_KINDS = {
  // Trail Definition (parameterized replaceable)
  TRAIL: 30530,
  
  // Activity/Workout (parameterized replaceable) 
  ACTIVITY: 30531,
  
  // Trail Review/Rating (parameterized replaceable)
  REVIEW: 30532,
} as const

// All kinds combined for easy access
export const KINDS = {
  ...STANDARD_KINDS,
  ...TRAILSTR_KINDS,
} as const

// Helper functions for working with kinds

/**
 * Check if a kind is a replaceable event (30000-39999 range)
 */
export function isReplaceableKind(kind: number): boolean {
  return kind >= 30000 && kind < 40000
}

/**
 * Check if a kind is a regular event (0-9999 range)
 */
export function isRegularKind(kind: number): boolean {
  return kind >= 0 && kind < 10000
}

/**
 * Check if a kind is ephemeral (20000-29999 range)
 */
export function isEphemeralKind(kind: number): boolean {
  return kind >= 20000 && kind < 30000
}

/**
 * Get the kind name for a given kind number
 */
export function getKindName(kind: number): string {
  const kindEntry = Object.entries(KINDS).find(([_, value]) => value === kind)
  return kindEntry ? kindEntry[0] : `UNKNOWN_KIND_${kind}`
}

/**
 * Type-safe way to check if a kind is a TrailStr custom kind
 */
export function isTrailStrKind(kind: number): kind is typeof TRAILSTR_KINDS[keyof typeof TRAILSTR_KINDS] {
  return Object.values(TRAILSTR_KINDS).includes(kind as any)
}

/**
 * Type-safe way to check if a kind is a standard Nostr kind
 */
export function isStandardKind(kind: number): kind is typeof STANDARD_KINDS[keyof typeof STANDARD_KINDS] {
  return Object.values(STANDARD_KINDS).includes(kind as any)
}

// Export individual kinds for convenience
export const {
  // Standard
  SET_METADATA,
  TEXT_NOTE, 
  CONTACT_LIST,
  ENCRYPTED_DIRECT_MESSAGE,
  REPOST,
  REACTION,
  ZAP_RECEIPT,
  RELAY_LIST_METADATA,
  
  // TrailStr
  TRAIL,
  ACTIVITY, 
  REVIEW,
} = KINDS