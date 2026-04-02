import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nostrClient } from '../nostr/client'
import { KINDS } from '../nostr/kinds'
import { useAuthStore } from './authStore'

export interface RelayInfo {
  url: string
  read: boolean
  write: boolean
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  lastConnected?: number
  error?: string
}

export interface RelayState {
  // Relay list
  relays: Record<string, RelayInfo>
  
  // Default relays
  defaultReadRelays: string[]
  defaultWriteRelays: string[]
  
  // Loading state
  isLoading: boolean
  lastUpdated?: number
  
  // Actions
  addRelay: (url: string, read?: boolean, write?: boolean) => Promise<void>
  removeRelay: (url: string) => Promise<void>
  updateRelayPrefs: (url: string, read: boolean, write: boolean) => Promise<void>
  fetchRelayList: () => Promise<void>
  publishRelayList: () => Promise<void>
  checkRelayStatus: () => Promise<void>
  resetToDefaults: () => Promise<void>
  updateClientConfig: () => void
  
  // Getters
  getReadRelays: () => string[]
  getWriteRelays: () => string[]
  getConnectedRelays: () => string[]
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band', 
  'wss://relay.primal.net'
]

export const useRelayStore = create<RelayState>()(
  persist(
    (set, get) => ({
      // Initial state
      relays: DEFAULT_RELAYS.reduce((acc, url) => ({
        ...acc,
        [url]: {
          url,
          read: true,
          write: true,
          status: 'disconnected' as const
        }
      }), {}),
      
      defaultReadRelays: DEFAULT_RELAYS,
      defaultWriteRelays: DEFAULT_RELAYS,
      isLoading: false,

      // Add a new relay
      addRelay: async (url: string, read = true, write = true) => {
        // Normalize URL
        const normalizedUrl = url.trim().toLowerCase()
        if (!normalizedUrl.startsWith('wss://') && !normalizedUrl.startsWith('ws://')) {
          throw new Error('Relay URL must start with wss:// or ws://')
        }

        const newRelay: RelayInfo = {
          url: normalizedUrl,
          read,
          write,
          status: 'disconnected'
        }

        set(state => ({
          relays: {
            ...state.relays,
            [normalizedUrl]: newRelay
          }
        }))

        // Update nostr client configuration
        get().updateClientConfig()

        // Publish updated relay list
        await get().publishRelayList()
      },

      // Remove a relay
      removeRelay: async (url: string) => {
        set(state => {
          const newRelays = { ...state.relays }
          delete newRelays[url]
          return { relays: newRelays }
        })

        // Update nostr client configuration
        get().updateClientConfig()

        // Publish updated relay list
        await get().publishRelayList()
      },

      // Update relay read/write preferences
      updateRelayPrefs: async (url: string, read: boolean, write: boolean) => {
        set(state => ({
          relays: {
            ...state.relays,
            [url]: {
              ...state.relays[url],
              read,
              write
            }
          }
        }))

        // Update nostr client configuration
        get().updateClientConfig()

        // Publish updated relay list
        await get().publishRelayList()
      },

      // Fetch relay list from Nostr (kind 10002)
      fetchRelayList: async () => {
        const authStore = useAuthStore.getState()
        if (!authStore.pubkey) return

        set({ isLoading: true })

        try {
          const events = await nostrClient.query([
            {
              kinds: [KINDS.RELAY_LIST_METADATA],
              authors: [authStore.pubkey],
              limit: 1
            }
          ])

          if (events.length > 0) {
            const relayEvent = events[0]
            const relays: Record<string, RelayInfo> = {}

            // Parse relay tags
            for (const tag of relayEvent.tags) {
              if (tag[0] === 'r') {
                const url = tag[1]
                const marker = tag[2] // 'read', 'write', or undefined (both)
                
                if (!relays[url]) {
                  relays[url] = {
                    url,
                    read: false,
                    write: false,
                    status: 'disconnected'
                  }
                }

                if (!marker || marker === 'read') {
                  relays[url].read = true
                }
                if (!marker || marker === 'write') {
                  relays[url].write = true
                }
              }
            }

            // If no relays found, use defaults
            if (Object.keys(relays).length === 0) {
              DEFAULT_RELAYS.forEach(url => {
                relays[url] = {
                  url,
                  read: true,
                  write: true,
                  status: 'disconnected'
                }
              })
            }

            set({ 
              relays,
              lastUpdated: Date.now()
            })

            // Update client configuration
            get().updateClientConfig()
          }
        } catch (error) {
          console.error('Failed to fetch relay list:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      // Publish relay list to Nostr
      publishRelayList: async () => {
        const authStore = useAuthStore.getState()
        const signer = authStore.getSigner()
        
        if (!authStore.pubkey || !signer) {
          return // Not authenticated
        }

        try {
          const { relays } = get()
          const readRelays = Object.values(relays)
            .filter(r => r.read)
            .map(r => r.url)
          const writeRelays = Object.values(relays)
            .filter(r => r.write)
            .map(r => r.url)

          const { buildRelayListEvent } = await import('../nostr/events')
          const unsignedEvent = buildRelayListEvent(readRelays, writeRelays, authStore.pubkey)
          const signedEvent = await signer.signEvent(unsignedEvent)

          await nostrClient.publish(signedEvent)

          set({ lastUpdated: Date.now() })
        } catch (error) {
          console.error('Failed to publish relay list:', error)
          throw error
        }
      },

      // Check status of all relays
      checkRelayStatus: async () => {
        try {
          const status = await nostrClient.checkRelayStatus()
          
          set(state => {
            const updatedRelays = { ...state.relays }
            
            Object.keys(updatedRelays).forEach(url => {
              const isConnected = status[url]
              updatedRelays[url] = {
                ...updatedRelays[url],
                status: isConnected ? 'connected' : 'disconnected',
                lastConnected: isConnected ? Date.now() : updatedRelays[url].lastConnected,
                error: isConnected ? undefined : 'Connection failed'
              }
            })
            
            return { relays: updatedRelays }
          })
        } catch (error) {
          console.error('Failed to check relay status:', error)
        }
      },

      // Reset to default relays
      resetToDefaults: async () => {
        const defaultRelays = DEFAULT_RELAYS.reduce((acc, url) => ({
          ...acc,
          [url]: {
            url,
            read: true,
            write: true,
            status: 'disconnected' as const
          }
        }), {})

        set({ relays: defaultRelays })

        // Update client and publish
        get().updateClientConfig()
        await get().publishRelayList()
      },

      // Helper: Update nostr client configuration (internal method)
      updateClientConfig: () => {
        const { relays } = get()
        const readRelays = Object.values(relays)
          .filter(r => r.read)
          .map(r => r.url)
        const writeRelays = Object.values(relays)
          .filter(r => r.write)
          .map(r => r.url)

        nostrClient.updateRelays({ readRelays, writeRelays })
      },

      // Get read-enabled relays
      getReadRelays: () => {
        const { relays } = get()
        return Object.values(relays)
          .filter(r => r.read)
          .map(r => r.url)
      },

      // Get write-enabled relays
      getWriteRelays: () => {
        const { relays } = get()
        return Object.values(relays)
          .filter(r => r.write)
          .map(r => r.url)
      },

      // Get connected relays
      getConnectedRelays: () => {
        const { relays } = get()
        return Object.values(relays)
          .filter(r => r.status === 'connected')
          .map(r => r.url)
      }
    }),
    {
      name: 'trailstr-relays',
      // Persist relay configuration
      partialize: (state) => ({
        relays: state.relays,
        lastUpdated: state.lastUpdated
      })
    }
  )
)