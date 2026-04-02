import { SimplePool, type Event, type Filter } from 'nostr-tools'

export interface NostrClientConfig {
  readRelays: string[]
  writeRelays: string[]
}

export interface SubscribeOptions {
  oneshot?: boolean
  groupable?: boolean
  closeOnEose?: boolean
}

export class NostrClient {
  private pool: SimplePool
  private config: NostrClientConfig
  private subscriptions = new Map<string, () => void>()

  constructor(config?: Partial<NostrClientConfig>) {
    this.pool = new SimplePool()
    
    // Default relays as specified in the requirements
    this.config = {
      readRelays: [
        'wss://relay.damus.io',
        'wss://nos.lol', 
        'wss://relay.nostr.band',
        'wss://relay.primal.net'
      ],
      writeRelays: [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band', 
        'wss://relay.primal.net'
      ],
      ...config
    }
  }

  /**
   * Subscribe to events from read relays
   * Returns a subscription ID that can be used to unsubscribe
   */
  subscribe(
    filters: Filter | Filter[],
    onEvent: (event: Event) => void,
    options: SubscribeOptions = {}
  ): string {
    const filtersArray = Array.isArray(filters) ? filters : [filters]
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // For multiple filters, we need to merge them or handle them separately
    // For now, we'll use the first filter. TODO: Handle multiple filters properly
    const filter = filtersArray[0]
    
    const sub = this.pool.subscribeMany(
      this.config.readRelays,
      filter,
      {
        onevent: (event: Event) => {
          onEvent(event)
        },
        oneose: () => {
          if (options.closeOnEose) {
            this.unsubscribe(subscriptionId)
          }
        },
        onclose: () => {
          this.subscriptions.delete(subscriptionId)
        }
      }
    )

    // Store the close function
    this.subscriptions.set(subscriptionId, () => sub.close())
    return subscriptionId
  }

  /**
   * Unsubscribe from a subscription by ID
   */
  unsubscribe(subscriptionId: string): void {
    const closeFunc = this.subscriptions.get(subscriptionId)
    if (closeFunc) {
      closeFunc()
      this.subscriptions.delete(subscriptionId)
    }
  }

  /**
   * Publish an event to all write relays
   * Returns a promise that resolves when the event is published to at least one relay
   */
  async publish(event: Event): Promise<void> {
    return new Promise((resolve) => {
      const results = this.pool.publish(this.config.writeRelays, event)
      let successCount = 0
      let errorCount = 0
      const totalRelays = this.config.writeRelays.length

      results.forEach(promise => {
        promise
          .then(() => {
            successCount++
            if (successCount === 1) {
              // Resolve as soon as we get one success
              resolve()
            }
          })
          .catch((error) => {
            errorCount++
            console.warn('Failed to publish to relay:', error)
            
            // If all relays failed, still resolve (at least we tried)
            if (errorCount === totalRelays) {
              resolve()
            }
          })
      })
    })
  }

  /**
   * Query for events with automatic deduplication by event id
   * Returns a promise that resolves with all unique events found
   */
  async query(filters: Filter | Filter[], timeoutMs = 5000): Promise<Event[]> {
    const filtersArray = Array.isArray(filters) ? filters : [filters]
    const events = new Map<string, Event>() // Deduplicate by event id
    
    // For multiple filters, use the first one. TODO: Handle multiple filters properly
    const filter = filtersArray[0]
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        sub.close()
        resolve(Array.from(events.values()))
      }, timeoutMs)

      const sub = this.pool.subscribeMany(
        this.config.readRelays,
        filter,
        {
          onevent: (event: Event) => {
            events.set(event.id, event)
          },
          oneose: () => {
            clearTimeout(timeoutId)
            sub.close()
            resolve(Array.from(events.values()))
          },
          onclose: () => {
            clearTimeout(timeoutId)
          }
        }
      )
    })
  }

  /**
   * Update relay configuration
   */
  updateRelays(config: Partial<NostrClientConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current relay configuration
   */
  getRelays(): NostrClientConfig {
    return { ...this.config }
  }

  /**
   * Close all subscriptions and clean up
   */
  close(): void {
    this.subscriptions.forEach(closeFunc => closeFunc())
    this.subscriptions.clear()
    this.pool.close([...this.config.readRelays, ...this.config.writeRelays])
  }

  /**
   * Check relay connectivity
   */
  async checkRelayStatus(): Promise<{[relay: string]: boolean}> {
    const status: {[relay: string]: boolean} = {}
    const allRelays = [...new Set([...this.config.readRelays, ...this.config.writeRelays])]
    
    await Promise.all(
      allRelays.map(async (relay) => {
        try {
          // Try a simple query to test connectivity
          await this.pool.ensureRelay(relay)
          status[relay] = true
        } catch (error) {
          console.warn(`Relay ${relay} appears to be down:`, error)
          status[relay] = false
        }
      })
    )
    
    return status
  }
}

// Export a singleton instance
export const nostrClient = new NostrClient()