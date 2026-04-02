import { useState, useEffect } from 'react'
import { Zap, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { nostrClient } from '../../nostr/client'
import { KINDS } from '../../nostr/kinds'

interface ZapButtonProps {
  eventId: string
  authorPubkey: string
  className?: string
}

const PRESET_AMOUNTS = [21, 100, 500, 1000, 5000]

function formatSats(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`
  return amount.toString()
}

export function ZapButton({ eventId, authorPubkey, className = '' }: ZapButtonProps) {
  const { pubkey, getSigner } = useAuthStore()
  const [totalZapped, setTotalZapped] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')
  const [comment, setComment] = useState('')
  const [isZapping, setIsZapping] = useState(false)
  const [lightningAddress, setLightningAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadZapReceipts()
    loadLightningAddress()
  }, [eventId, authorPubkey])

  const loadZapReceipts = async () => {
    try {
      const zapReceipts = await nostrClient.query([
        { kinds: [KINDS.ZAP_RECEIPT], '#e': [eventId], limit: 100 }
      ])

      let total = 0
      for (const receipt of zapReceipts) {
        // Extract amount from bolt11 tag
        const bolt11Tag = receipt.tags.find(t => t[0] === 'bolt11')
        if (bolt11Tag?.[1]) {
          const amount = parseBolt11Amount(bolt11Tag[1])
          if (amount) total += amount
        }
      }

      setTotalZapped(total)
    } catch (error) {
      console.error('Failed to load zap receipts:', error)
    }
  }

  const loadLightningAddress = async () => {
    try {
      const profileEvents = await nostrClient.query([
        { kinds: [KINDS.SET_METADATA], authors: [authorPubkey], limit: 1 }
      ])

      if (profileEvents.length > 0) {
        const latest = profileEvents.sort((a, b) => b.created_at - a.created_at)[0]
        try {
          const meta = JSON.parse(latest.content)
          setLightningAddress(meta.lud16 || meta.lud06 || null)
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Failed to load lightning address:', error)
    }
  }

  const parseBolt11Amount = (bolt11: string): number | null => {
    // Simple bolt11 amount parser — looks for amount in the invoice
    const lower = bolt11.toLowerCase()
    const match = lower.match(/lnbc(\d+)([munp]?)/)
    if (!match) return null

    const num = parseInt(match[1], 10)
    const multiplier = match[2]

    // Convert to sats
    switch (multiplier) {
      case 'm': return num * 100000 // milli-BTC to sats
      case 'u': return num * 100    // micro-BTC to sats  
      case 'n': return Math.floor(num / 10) // nano-BTC to sats
      case 'p': return Math.floor(num / 10000) // pico-BTC to sats
      case '': return num * 100000000 // BTC to sats
      default: return null
    }
  }

  const handleZap = async () => {
    if (!lightningAddress || !pubkey) return

    const signer = getSigner()
    if (!signer) return

    setIsZapping(true)
    setError(null)

    try {
      const amount = customAmount ? parseInt(customAmount, 10) : selectedAmount
      if (!amount || amount <= 0) {
        setError('Invalid amount')
        return
      }

      const amountMsats = amount * 1000

      // Step 1: Resolve lightning address to LNURL callback
      const [name, domain] = lightningAddress.split('@')
      if (!name || !domain) {
        setError('Invalid lightning address')
        return
      }

      const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${name}`)
      if (!lnurlRes.ok) {
        setError('Failed to resolve lightning address')
        return
      }

      const lnurlData = await lnurlRes.json()

      if (!lnurlData.callback) {
        setError('Lightning address does not support payments')
        return
      }

      // Check if zaps are supported (allowsNostr + nostrPubkey)
      const supportsZaps = lnurlData.allowsNostr && lnurlData.nostrPubkey

      // Step 2: Build zap request event (kind 9734) if supported
      let zapRequestParam = ''
      if (supportsZaps) {
        const zapRequest = {
          kind: 9734,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['e', eventId],
            ['p', authorPubkey],
            ['amount', amountMsats.toString()],
            ['relays', ...nostrClient.getRelays().readRelays]
          ],
          content: comment
        } as const

        const signedZapRequest = await signer.signEvent(zapRequest as any)
        zapRequestParam = `&nostr=${encodeURIComponent(JSON.stringify(signedZapRequest))}`
      }

      // Step 3: Get invoice from callback
      const separator = lnurlData.callback.includes('?') ? '&' : '?'
      const invoiceUrl = `${lnurlData.callback}${separator}amount=${amountMsats}${zapRequestParam}&comment=${encodeURIComponent(comment)}`
      
      const invoiceRes = await fetch(invoiceUrl)
      if (!invoiceRes.ok) {
        setError('Failed to get invoice')
        return
      }

      const invoiceData = await invoiceRes.json()
      if (!invoiceData.pr) {
        setError('No invoice received')
        return
      }

      // Step 4: Open wallet to pay (WebLN or fallback to lightning: URI)
      if (typeof window !== 'undefined' && (window as any).webln) {
        try {
          await (window as any).webln.enable()
          await (window as any).webln.sendPayment(invoiceData.pr)
          
          // Success — optimistic update
          setTotalZapped(prev => prev + amount)
          setZapCount(prev => prev + 1)
          setShowModal(false)
          setComment('')
          setCustomAmount('')
          return
        } catch {
          // WebLN failed, fall through to URI
        }
      }

      // Fallback: open lightning: URI
      window.open(`lightning:${invoiceData.pr}`, '_blank')
      setShowModal(false)
      setComment('')
      setCustomAmount('')
    } catch (error) {
      console.error('Zap failed:', error)
      setError('Zap failed. Please try again.')
    } finally {
      setIsZapping(false)
    }
  }

  return (
    <>
      <button
        onClick={() => pubkey && lightningAddress ? setShowModal(true) : undefined}
        disabled={!lightningAddress}
        className={`
          flex items-center space-x-1.5 text-stone-600 dark:text-stone-400
          ${lightningAddress
            ? 'hover:text-yellow-600 dark:hover:text-yellow-400 cursor-pointer'
            : 'opacity-50 cursor-not-allowed'
          }
          transition-colors
          ${className}
        `}
        title={lightningAddress ? 'Send a zap' : 'No lightning address available'}
      >
        <Zap size={18} className={totalZapped > 0 ? 'text-yellow-500 fill-yellow-500' : ''} />
        <span>{totalZapped > 0 ? formatSats(totalZapped) : 'Zap'}</span>
      </button>

      {/* Zap Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-stone-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Zap size={20} className="text-yellow-500" />
                Send Zap
              </h3>
              <button
                onClick={() => { setShowModal(false); setError(null) }}
                className="text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Amount presets */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  onClick={() => { setSelectedAmount(amount); setCustomAmount('') }}
                  className={`
                    py-2 rounded-lg text-sm font-medium transition-colors
                    ${selectedAmount === amount && !customAmount
                      ? 'bg-yellow-500 text-white'
                      : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
                    }
                  `}
                >
                  {formatSats(amount)}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom amount (sats)"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-3"
            />

            {/* Comment */}
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"
            />

            {error && (
              <p className="text-red-500 text-sm mb-3">{error}</p>
            )}

            <button
              onClick={handleZap}
              disabled={isZapping}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-white font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isZapping ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Zap size={18} />
              )}
              Zap {formatSats(customAmount ? parseInt(customAmount) || 0 : selectedAmount)} sats
            </button>
          </div>
        </div>
      )}
    </>
  )
}
