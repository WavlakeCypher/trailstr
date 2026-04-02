import { useMemo } from 'react'
import { NostrClient } from '../nostr/client'
import { useRelayStore } from '../stores/relayStore'

export function useNostrClient() {
  const { getReadRelays, getWriteRelays } = useRelayStore()

  const client = useMemo(() => {
    const readRelays = getReadRelays()
    const writeRelays = getWriteRelays()

    if (readRelays.length === 0 && writeRelays.length === 0) {
      return null // No relays configured
    }

    return new NostrClient({
      readRelays: readRelays.length > 0 ? readRelays : writeRelays,
      writeRelays: writeRelays.length > 0 ? writeRelays : readRelays
    })
  }, [getReadRelays, getWriteRelays])

  return client
}