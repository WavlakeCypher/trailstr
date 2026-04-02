import { useState, useEffect } from 'react'
import { Zap, ExternalLink, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { nostrClient } from '../../nostr/client'
import { KINDS } from '../../nostr/kinds'

interface ZapButtonProps {
  eventId: string
  authorPubkey: string
  className?: string
}

interface LightningAddress {
  callback: string
  minSendable: number
  maxSendable: number
  metadata: string
  tag: string
}

const ZAP_AMOUNTS = [21, 100, 500, 1000, 5000] // sats

export function ZapButton({ eventId, authorPubkey, className = '' }: ZapButtonProps) {
  const { pubkey, getSigner } = useAuthStore()
  const [authorProfile, setAuthorProfile] = useState<any>(null)
  const [showZapModal, setShowZapModal] = useState(false)
  const [zapAmount, setZapAmount] = useState(100)
  const [zapComment, setZapComment] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isZapping, setIsZapping] = useState(false)
  const [zapInvoice, setZapInvoice] = useState<string | null>(null)

  // Load author profile to check for lightning address
  useEffect(() => {
    loadAuthorProfile()
  }, [authorPubkey])

  const loadAuthorProfile = async () => {
    try {
      setIsLoadingProfile(true)
      
      const profileEvents = await nostrClient.query([
        {
          kinds: [KINDS.SET_METADATA],
          authors: [authorPubkey],
          limit: 1
        }
      ])

      if (profileEvents.length > 0) {
        const profile = JSON.parse(profileEvents[0].content)
        setAuthorProfile(profile)
      }
    } catch (error) {
      console.error('Failed to load author profile:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // Check if author has lightning address (lud16)
  const hasLightningAddress = () => {
    return authorProfile?.lud16 && authorProfile.lud16.includes('@')
  }

  const handleZapClick = () => {
    if (!pubkey) {
      // TODO: Show login prompt
      return
    }

    if (!hasLightningAddress()) {
      return
    }

    setShowZapModal(true)
  }

  const initiateZap = async () => {
    if (!hasLightningAddress() || !pubkey) return

    try {
      setIsZapping(true)
      
      // Parse lightning address (user@domain.com)
      const [username, domain] = authorProfile.lud16.split('@')
      
      // Fetch LNURL-pay endpoint
      const lnurlResponse = await fetch(`https://${domain}/.well-known/lnurlp/${username}`)
      if (!lnurlResponse.ok) {
        throw new Error('Failed to fetch LNURL endpoint')
      }

      const lnurlData: LightningAddress = await lnurlResponse.json()
      
      // Check amount limits
      const amountMsat = zapAmount * 1000
      if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
        throw new Error(`Amount must be between ${lnurlData.minSendable / 1000} and ${lnurlData.maxSendable / 1000} sats`)
      }

      // Create zap request (NIP-57)
      const zapRequest = await createZapRequest({
        amount: amountMsat,
        comment: zapComment,
        eventId: eventId,
        authorPubkey: authorPubkey
      })

      // Request invoice
      const invoiceParams = new URLSearchParams({
        amount: amountMsat.toString(),
        nostr: zapRequest
      })

      if (zapComment) {
        invoiceParams.append('comment', zapComment)
      }

      const invoiceResponse = await fetch(`${lnurlData.callback}?${invoiceParams}`)
      if (!invoiceResponse.ok) {
        throw new Error('Failed to get lightning invoice')
      }

      const invoiceData = await invoiceResponse.json()
      
      if (invoiceData.status === 'ERROR') {
        throw new Error(invoiceData.reason || 'Failed to create invoice')
      }

      setZapInvoice(invoiceData.pr)
    } catch (error) {
      console.error('Failed to initiate zap:', error)
      // TODO: Show error toast
    } finally {
      setIsZapping(false)
    }
  }

  const createZapRequest = async ({ amount, comment, eventId, authorPubkey }: {
    amount: number
    comment: string
    eventId: string
    authorPubkey: string
  }) => {
    const signer = getSigner()
    if (!signer || !pubkey) {
      throw new Error('Not authenticated')
    }

    // Create zap request event (kind 9734)
    const zapRequestEvent = {
      kind: 9734,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: comment,
      tags: [
        ['e', eventId],
        ['p', authorPubkey],
        ['amount', amount.toString()],
        ['relays', ...nostrClient.getRelays().writeRelays]
      ]
    }

    const signedZapRequest = await signer.signEvent(zapRequestEvent)
    return JSON.stringify(signedZapRequest)
  }

  const copyInvoice = () => {
    if (zapInvoice) {
      navigator.clipboard.writeText(zapInvoice)
      // TODO: Show copied toast
    }
  }

  if (isLoadingProfile) {
    return (
      <button
        disabled
        className={`flex items-center gap-1 text-stone-400 ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">⚡</span>
      </button>
    )
  }

  if (!hasLightningAddress()) {
    return null
  }

  return (
    <>
      <button
        onClick={handleZapClick}
        className={`
          flex items-center gap-1 px-2 py-1 rounded-xl text-sm transition-colors
          hover:bg-amber-500/10 text-amber-400 hover:text-amber-300
          ${className}
        `}
        title="Send sats via Lightning"
      >
        <Zap className="h-4 w-4" />
        <span>Zap</span>
      </button>

      {/* Zap Modal */}
      {showZapModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Send zap">
          <div className="bg-stone-800/95 backdrop-blur-xl border border-stone-700/50 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  ⚡ Send Zap
                </h3>
                <button
                  onClick={() => {
                    setShowZapModal(false)
                    setZapInvoice(null)
                  }}
                  className="text-stone-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                  aria-label="Close zap dialog"
                >
                  ✕
                </button>
              </div>

              {!zapInvoice ? (
                <>
                  {/* Amount Selection */}
                  <div>
                    <label id="zap-amount-label" className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-2">
                      Amount (sats)
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {ZAP_AMOUNTS.map(amount => (
                        <button
                          key={amount}
                          onClick={() => setZapAmount(amount)}
                          className={`
                            px-3 py-2 rounded-xl text-sm font-medium transition-colors
                            ${zapAmount === amount
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                              : 'bg-stone-800 border border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-stone-500'
                            }
                          `}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={zapAmount}
                      onChange={(e) => setZapAmount(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 h-12 border border-stone-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-800 text-white placeholder-stone-400"
                      placeholder="Custom amount"
                      min="1"
                    />
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-2">
                      Comment (optional)
                    </label>
                    <textarea
                      value={zapComment}
                      onChange={(e) => setZapComment(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-800 text-white placeholder-stone-400 resize-none"
                      placeholder="Say something nice..."
                      rows={3}
                      maxLength={280}
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={initiateZap}
                    disabled={isZapping || zapAmount < 1}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 h-12 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isZapping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Send {zapAmount} sats
                  </button>
                </>
              ) : (
                <>
                  {/* Lightning Invoice */}
                  <div className="space-y-4">
                    <p className="text-center text-stone-300">
                      Lightning Invoice Created
                    </p>
                    
                    <div className="p-3 bg-stone-800/50 border border-stone-700/50 rounded-xl">
                      <p className="text-xs text-stone-400 mb-2 break-all">
                        {zapInvoice}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={copyInvoice}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 h-12 border border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl font-medium transition-colors"
                      >
                        Copy Invoice
                      </button>
                      <a
                        href={`lightning:${zapInvoice}`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 h-12 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-medium transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Wallet
                      </a>
                    </div>

                    <p className="text-xs text-stone-500 text-center">
                      Scan the QR code or copy the invoice to your Lightning wallet
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}