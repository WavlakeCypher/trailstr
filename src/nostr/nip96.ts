import { type Event, verifyEvent } from 'nostr-tools'

export interface NIP96UploadOptions {
  file: File | Blob
  fileName?: string
  contentType?: string
  alt?: string
  caption?: string
  expiration?: number
}

export interface NIP96UploadResult {
  url: string
  nip94_event?: Event
  processing_url?: string
  message?: string
}

export interface NIP96UploadError {
  status: 'error'
  message: string
  reason?: string
}

/**
 * Upload media file to nostr.build using NIP-96 specification
 * https://github.com/nostr-protocol/nips/blob/master/96.md
 */
export class NIP96Uploader {
  private endpoint: string
  private signer: (event: Omit<Event, 'id' | 'sig'>) => Promise<Event>

  constructor(
    endpoint: string = 'https://nostr.build/api/v2/upload/files',
    signer: (event: Omit<Event, 'id' | 'sig'>) => Promise<Event>
  ) {
    this.endpoint = endpoint
    this.signer = signer
  }

  /**
   * Create NIP-96 auth event for upload authorization
   */
  private async createAuthEvent(
    method: string = 'POST',
    url: string,
    payload?: string
  ): Promise<Event> {
    const unsignedEvent = {
      kind: 27235, // NIP-98 HTTP Auth
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', url],
        ['method', method]
      ],
      content: '',
      pubkey: '' // Will be set by signer
    }

    if (payload) {
      const encoder = new TextEncoder()
      const data = encoder.encode(payload)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      unsignedEvent.tags.push(['payload', hashHex])
    }

    return await this.signer(unsignedEvent)
  }

  /**
   * Upload file to NIP-96 compatible server
   */
  async uploadFile(options: NIP96UploadOptions): Promise<NIP96UploadResult> {
    try {
      // Create auth event
      const authEvent = await this.createAuthEvent('POST', this.endpoint)
      
      if (!verifyEvent(authEvent)) {
        throw new Error('Invalid auth event signature')
      }

      // Prepare form data
      const formData = new FormData()
      
      // Add the file
      const fileName = options.fileName || (options.file instanceof File ? options.file.name : 'upload')
      formData.append('file[]', options.file, fileName)
      
      // Add optional metadata
      if (options.alt) {
        formData.append('alt', options.alt)
      }
      
      if (options.caption) {
        formData.append('caption', options.caption)
      }
      
      if (options.contentType) {
        formData.append('content_type', options.contentType)
      }
      
      if (options.expiration) {
        formData.append('expiration', options.expiration.toString())
      }

      // Make the upload request
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Nostr ${btoa(JSON.stringify(authEvent))}`
        },
        body: formData
      })

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `Upload failed with status ${response.status}`
        try {
          const errorData = await response.json() as NIP96UploadError
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = await response.text() || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json() as NIP96UploadResult

      if (!result.url) {
        throw new Error('Server response missing URL field')
      }

      return result

    } catch (error) {
      console.error('NIP-96 upload failed:', error)
      throw error instanceof Error ? error : new Error('Unknown upload error')
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(files: NIP96UploadOptions[]): Promise<NIP96UploadResult[]> {
    const results: NIP96UploadResult[] = []
    
    for (const fileOptions of files) {
      try {
        const result = await this.uploadFile(fileOptions)
        results.push(result)
      } catch (error) {
        console.error('Failed to upload file:', fileOptions.fileName || 'unknown', error)
        // Continue with other files even if one fails
        throw error
      }
    }
    
    return results
  }

  /**
   * Get server info (NIP-96 discovery)
   */
  async getServerInfo(): Promise<any> {
    try {
      const infoUrl = new URL(this.endpoint)
      infoUrl.pathname = '/.well-known/nostr/nip96.json'
      
      const response = await fetch(infoUrl.toString())
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server info: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Failed to get server info:', error)
      throw error
    }
  }
}

/**
 * Convenience function to upload a single file using default nostr.build endpoint
 */
export async function uploadToNostrBuild(
  file: File | Blob,
  signer: (event: Omit<Event, 'id' | 'sig'>) => Promise<Event>,
  options?: Partial<NIP96UploadOptions>
): Promise<string> {
  const uploader = new NIP96Uploader('https://nostr.build/api/v2/upload/files', signer)
  
  const uploadOptions: NIP96UploadOptions = {
    file,
    fileName: file instanceof File ? file.name : undefined,
    contentType: file.type,
    ...options
  }
  
  const result = await uploader.uploadFile(uploadOptions)
  return result.url
}

/**
 * Convenience function to upload multiple files
 */
export async function uploadMultipleToNostrBuild(
  files: (File | Blob)[],
  signer: (event: Omit<Event, 'id' | 'sig'>) => Promise<Event>,
  options?: Partial<Omit<NIP96UploadOptions, 'file'>>
): Promise<string[]> {
  const uploader = new NIP96Uploader('https://nostr.build/api/v2/upload/files', signer)
  
  const uploadOptions = files.map(file => ({
    file,
    fileName: file instanceof File ? file.name : undefined,
    contentType: file.type,
    ...options
  }))
  
  const results = await uploader.uploadFiles(uploadOptions)
  return results.map(result => result.url)
}