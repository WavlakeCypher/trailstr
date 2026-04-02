import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type SignerInterface, type SignerType, NsecSigner, signerManager } from '../nostr/signer'
import { nostrClient } from '../nostr/client'
import { KINDS } from '../nostr/kinds'
import { useCacheStore } from './cacheStore'

export interface UserProfile {
  name?: string
  display_name?: string
  about?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string // Lightning address
  [key: string]: any
}

export interface AuthState {
  // Authentication state
  isAuthenticated: boolean
  pubkey: string | null
  signerType: SignerType | null
  
  // Profile data
  profile: UserProfile | null
  isLoadingProfile: boolean
  
  // Auth actions
  loginWithNip07: () => Promise<void>
  loginWithNsec: (nsec: string, passphrase?: string) => Promise<void>
  generateAndLogin: () => Promise<{ nsec: string; nsecHex: string }>
  loadFromStorage: (passphrase: string) => Promise<boolean>
  logout: () => void
  
  // Profile actions
  fetchProfile: () => Promise<void>
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>
  
  // Utility
  getSigner: () => SignerInterface | null
  hasStoredNsec: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      pubkey: null,
      signerType: null,
      profile: null,
      isLoadingProfile: false,

      // Login with NIP-07 browser extension
      loginWithNip07: async () => {
        try {
          const signer = await signerManager.createNip07Signer()
          const pubkey = await signer.getPublicKey()
          
          set({
            isAuthenticated: true,
            pubkey,
            signerType: 'nip07'
          })
          
          // Fetch profile after login
          await get().fetchProfile()
        } catch (error) {
          console.error('Failed to login with NIP-07:', error)
          throw error
        }
      },

      // Login with nsec (private key)
      loginWithNsec: async (nsec: string, passphrase?: string) => {
        try {
          const signer = signerManager.createNsecSigner(nsec)
          const pubkey = await signer.getPublicKey()
          
          // Store encrypted if passphrase provided
          if (passphrase) {
            await signer.storeEncrypted(passphrase)
          }
          
          set({
            isAuthenticated: true,
            pubkey,
            signerType: 'nsec'
          })
          
          // Fetch profile after login
          await get().fetchProfile()
        } catch (error) {
          console.error('Failed to login with nsec:', error)
          throw error
        }
      },

      // Generate new keypair and login
      generateAndLogin: async () => {
        try {
          // Import the generate function dynamically since it's not in our signer
          const { generateSecretKey, getPublicKey } = await import('nostr-tools')
          const { nip19 } = await import('nostr-tools')
          
          const nsecBytes = generateSecretKey()
          const pubkey = getPublicKey(nsecBytes)
          const nsec = nip19.nsecEncode(nsecBytes)
          const nsecHex = Array.from(nsecBytes, byte => byte.toString(16).padStart(2, '0')).join('')
          
          signerManager.createNsecSigner(nsec)
          
          set({
            isAuthenticated: true,
            pubkey,
            signerType: 'nsec'
          })
          
          return { nsec, nsecHex }
        } catch (error) {
          console.error('Failed to generate and login:', error)
          throw error
        }
      },

      // Load nsec from encrypted storage
      loadFromStorage: async (passphrase: string) => {
        try {
          const signer = new NsecSigner()
          const success = await signer.loadFromStorage(passphrase)
          
          if (success) {
            const pubkey = await signer.getPublicKey()
            signerManager.createNsecSigner() // Update manager reference
            
            set({
              isAuthenticated: true,
              pubkey,
              signerType: 'nsec'
            })
            
            // Fetch profile after login
            await get().fetchProfile()
            
            return true
          }
          
          return false
        } catch (error) {
          console.error('Failed to load from storage:', error)
          throw error
        }
      },

      // Logout
      logout: () => {
        signerManager.clearSigner()
        
        set({
          isAuthenticated: false,
          pubkey: null,
          signerType: null,
          profile: null,
          isLoadingProfile: false
        })
      },

      // Fetch user profile from relays
      fetchProfile: async () => {
        const { pubkey } = get()
        if (!pubkey) return

        set({ isLoadingProfile: true })
        
        try {
          // First try to get cached profile
          const { getCachedProfile, cacheProfile, cacheEvent } = useCacheStore.getState()
          const cachedProfile = await getCachedProfile(pubkey)
          
          if (cachedProfile) {
            set({ profile: cachedProfile })
          }

          // Then fetch from relays to ensure fresh data
          const events = await nostrClient.query([
            {
              kinds: [KINDS.SET_METADATA],
              authors: [pubkey],
              limit: 1
            }
          ])
          
          if (events.length > 0) {
            const profileEvent = events[0]
            const profile = JSON.parse(profileEvent.content)
            
            // Cache the profile and event
            await cacheProfile(pubkey, profile)
            await cacheEvent(profileEvent)
            
            set({ profile })
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error)
        } finally {
          set({ isLoadingProfile: false })
        }
      },

      // Update user profile
      updateProfile: async (profileUpdate: Partial<UserProfile>) => {
        const { pubkey } = get()
        const signer = signerManager.getCurrentSigner()
        
        if (!pubkey || !signer) {
          throw new Error('Not authenticated')
        }
        
        try {
          // Merge with existing profile
          const currentProfile = get().profile || {}
          const newProfile = { ...currentProfile, ...profileUpdate }
          
          // Build and sign profile event
          const { buildProfileEvent } = await import('../nostr/events')
          const unsignedEvent = buildProfileEvent(newProfile, pubkey)
          const signedEvent = await signer.signEvent(unsignedEvent)
          
          // Publish to relays
          await nostrClient.publish(signedEvent)
          
          // Update local state
          set({ profile: newProfile })
        } catch (error) {
          console.error('Failed to update profile:', error)
          throw error
        }
      },

      // Get current signer
      getSigner: () => {
        return signerManager.getCurrentSigner()
      },

      // Check if there's a stored encrypted nsec
      hasStoredNsec: () => {
        const signer = new NsecSigner()
        return signer.hasStoredNsec()
      }
    }),
    {
      name: 'trailstr-auth',
      // Only persist authentication state, not the full signer
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        pubkey: state.pubkey,
        signerType: state.signerType,
        profile: state.profile
      })
    }
  )
)