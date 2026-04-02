import { type Event, getPublicKey, finalizeEvent, generateSecretKey, nip19 } from 'nostr-tools'

export type SignerType = 'nip07' | 'nsec' | 'none'

export interface SignerInterface {
  type: SignerType
  getPublicKey(): Promise<string>
  signEvent(event: Omit<Event, 'id' | 'sig'>): Promise<Event>
  isAvailable(): Promise<boolean>
}

// AES-256-GCM encryption utilities for nsec storage
class EncryptedStorage {
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  static async encrypt(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBytes = encoder.encode(data)
    
    // Generate random salt and IV
    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    
    const key = await this.deriveKey(password, salt)
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBytes
    )
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(new Uint8Array(encrypted), salt.length + iv.length)
    
    // Return as base64 string
    return btoa(String.fromCharCode(...combined))
  }

  static async decrypt(encryptedData: string, password: string): Promise<string> {
    try {
      // Decode from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      )
      
      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, 16)
      const iv = combined.slice(16, 28)
      const encrypted = combined.slice(28)
      
      const key = await this.deriveKey(password, salt)
      
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      )
      
      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      throw new Error('Failed to decrypt data. Invalid password or corrupted data.')
    }
  }
}

// NIP-07 Browser Extension Signer
export class Nip07Signer implements SignerInterface {
  type: SignerType = 'nip07'

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 
           typeof (window as any).nostr !== 'undefined' &&
           typeof (window as any).nostr.getPublicKey === 'function' &&
           typeof (window as any).nostr.signEvent === 'function'
  }

  async getPublicKey(): Promise<string> {
    if (!await this.isAvailable()) {
      throw new Error('NIP-07 extension not available')
    }

    try {
      return await (window as any).nostr.getPublicKey()
    } catch (error) {
      throw new Error(`Failed to get public key from NIP-07 extension: ${error}`)
    }
  }

  async signEvent(event: Omit<Event, 'id' | 'sig'>): Promise<Event> {
    if (!await this.isAvailable()) {
      throw new Error('NIP-07 extension not available')
    }

    try {
      return await (window as any).nostr.signEvent(event)
    } catch (error) {
      throw new Error(`Failed to sign event with NIP-07 extension: ${error}`)
    }
  }
}

// Direct nsec Signer with encrypted storage
export class NsecSigner implements SignerInterface {
  type: SignerType = 'nsec'
  private nsec: string | null = null
  private pubkey: string | null = null

  constructor(nsec?: string) {
    if (nsec) {
      this.setNsec(nsec)
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.nsec !== null
  }

  setNsec(nsec: string): void {
    // Remove nsec prefix if present
    const cleanNsec = nsec.startsWith('nsec') ? nsec : nsec
    this.nsec = cleanNsec
    
    try {
      // Derive public key to validate the nsec
      let nsecBytes: Uint8Array
      if (nsec.startsWith('nsec')) {
        nsecBytes = nip19.decode(nsec).data as Uint8Array
      } else {
        // Convert hex to Uint8Array
        nsecBytes = new Uint8Array(nsec.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      }
      
      this.pubkey = getPublicKey(nsecBytes)
    } catch (error) {
      this.nsec = null
      this.pubkey = null
      throw new Error('Invalid nsec provided')
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.pubkey) {
      throw new Error('No nsec configured')
    }
    return this.pubkey
  }

  async signEvent(event: Omit<Event, 'id' | 'sig'>): Promise<Event> {
    if (!this.nsec) {
      throw new Error('No nsec configured')
    }

    try {
      let nsecBytes: Uint8Array
      if (this.nsec.startsWith('nsec')) {
        const { nip19 } = await import('nostr-tools')
        nsecBytes = nip19.decode(this.nsec).data as Uint8Array
      } else {
        // Convert hex to Uint8Array
        nsecBytes = new Uint8Array(this.nsec.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      }
      
      return finalizeEvent(event, nsecBytes)
    } catch (error) {
      throw new Error(`Failed to sign event: ${error}`)
    }
  }

  // Encrypt and store nsec in localStorage
  async storeEncrypted(passphrase: string): Promise<void> {
    if (!this.nsec) {
      throw new Error('No nsec to store')
    }

    try {
      const encrypted = await EncryptedStorage.encrypt(this.nsec, passphrase)
      localStorage.setItem('trailstr_encrypted_nsec', encrypted)
    } catch (error) {
      throw new Error(`Failed to encrypt and store nsec: ${error}`)
    }
  }

  // Load and decrypt nsec from localStorage
  async loadFromStorage(passphrase: string): Promise<boolean> {
    const encrypted = localStorage.getItem('trailstr_encrypted_nsec')
    if (!encrypted) {
      return false
    }

    try {
      const decrypted = await EncryptedStorage.decrypt(encrypted, passphrase)
      this.setNsec(decrypted)
      return true
    } catch (error) {
      throw new Error(`Failed to decrypt stored nsec: ${error}`)
    }
  }

  // Clear stored nsec
  clearStorage(): void {
    localStorage.removeItem('trailstr_encrypted_nsec')
  }

  // Check if encrypted nsec exists in storage
  hasStoredNsec(): boolean {
    return localStorage.getItem('trailstr_encrypted_nsec') !== null
  }

  // Clear in-memory nsec (logout)
  clear(): void {
    this.nsec = null
    this.pubkey = null
  }
}

// Generate a new keypair
export async function generateNewKeypair(): Promise<{ nsec: string; pubkey: string; nsecHex: string }> {
  const nsecBytes = generateSecretKey()
  const nsecHex = Array.from(nsecBytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const pubkey = getPublicKey(nsecBytes)
  
  // Import nip19 for encoding
  const { nip19 } = await import('nostr-tools')
  const nsec = nip19.nsecEncode(nsecBytes)
  
  return { nsec, pubkey, nsecHex }
}

// Signer factory to create the appropriate signer
export class SignerManager {
  private currentSigner: SignerInterface | null = null

  async createNip07Signer(): Promise<Nip07Signer> {
    const signer = new Nip07Signer()
    if (!await signer.isAvailable()) {
      throw new Error('NIP-07 extension not available')
    }
    this.currentSigner = signer
    return signer
  }

  createNsecSigner(nsec?: string): NsecSigner {
    const signer = new NsecSigner(nsec)
    this.currentSigner = signer
    return signer
  }

  getCurrentSigner(): SignerInterface | null {
    return this.currentSigner
  }

  clearSigner(): void {
    if (this.currentSigner?.type === 'nsec') {
      (this.currentSigner as NsecSigner).clear()
    }
    this.currentSigner = null
  }
}

// Export singleton instance
export const signerManager = new SignerManager()