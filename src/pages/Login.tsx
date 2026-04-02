import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'

type AuthMethod = 'nip07' | 'nsec' | 'generate' | 'stored'

export default function Login() {
  const navigate = useNavigate()
  const { 
    isAuthenticated,
    loginWithNip07, 
    loginWithNsec, 
    generateAndLogin,
    loadFromStorage,
    hasStoredNsec 
  } = useAuthStore()
  
  const searchParams = new URLSearchParams(window.location.search)
  const [activeMethod, setActiveMethod] = useState<AuthMethod>(searchParams.get('signup') ? 'generate' : 'nip07')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form states
  const [nsecInput, setNsecInput] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [saveNsec, setSaveNsec] = useState(false)
  const [storedPassphrase, setStoredPassphrase] = useState('')
  const [generatedKeys, setGeneratedKeys] = useState<{nsec: string, nsecHex: string} | null>(null)
  const [keysCopied, setKeysCopied] = useState(false)
  
  // Check for NIP-07 extension availability
  const [hasNip07, setHasNip07] = useState(false)
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])
  
  useEffect(() => {
    // Check if NIP-07 extension is available
    const checkNip07 = () => {
      setHasNip07(typeof (window as any)?.nostr?.getPublicKey === 'function')
    }
    
    checkNip07()
    // Check again after a delay in case extension loads late
    const timeout = setTimeout(checkNip07, 1000)
    
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    // If user has stored nsec, default to stored method
    if (hasStoredNsec()) {
      setActiveMethod('stored')
    } else if (hasNip07) {
      setActiveMethod('nip07')
    } else {
      setActiveMethod('nsec')
    }
  }, [hasNip07])

  const handleNip07Login = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      await loginWithNip07()
    } catch (err: any) {
      setError(err.message || 'Failed to login with NIP-07 extension')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNsecLogin = async () => {
    if (!nsecInput.trim()) {
      setError('Please enter your nsec private key')
      return
    }

    if (saveNsec && passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters long')
      return
    }

    if (saveNsec && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const passphraseToUse = saveNsec ? passphrase : undefined
      await loginWithNsec(nsecInput.trim(), passphraseToUse)
    } catch (err: any) {
      setError(err.message || 'Failed to login with private key')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateLogin = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const keys = await generateAndLogin()
      setGeneratedKeys(keys)
    } catch (err: any) {
      setError(err.message || 'Failed to generate new keypair')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStoredLogin = async () => {
    if (!storedPassphrase.trim()) {
      setError('Please enter your passphrase')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const success = await loadFromStorage(storedPassphrase)
      if (!success) {
        setError('Invalid passphrase or corrupted data')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decrypt stored private key')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setKeysCopied(true)
      setTimeout(() => setKeysCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const confirmKeysAndComplete = () => {
    if (!keysCopied) {
      setError('Please copy your private key before continuing. You will not see it again!')
      return
    }
    
    setGeneratedKeys(null)
    // Login is already complete, just navigate
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full mx-auto px-4">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <h1 className="text-4xl font-bold text-white">
              TrailStr
            </h1>
          </div>
          <p className="text-stone-400 text-lg">
            Your adventures on the Nostr protocol
          </p>
        </header>

        {error && (
          <div className="mb-6 bg-stone-800/50 border border-red-600/50 rounded-2xl p-6" role="alert">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {generatedKeys ? (
          // Show generated keys for copying
          <div className="space-y-6">
            <div className="bg-stone-800/50 border border-amber-600/50 rounded-2xl p-6">
              <h3 className="text-xs font-semibold tracking-wider text-amber-400 uppercase mb-3">
                ⚠️ Important: Save Your Private Key
              </h3>
              <p className="text-stone-400 text-sm mb-4">
                This is your private key (nsec). Copy it and store it safely. You will NOT see it again!
              </p>
              
              <div className="bg-stone-800 border border-stone-600 rounded-xl p-4 font-mono text-xs break-all text-white mb-4">
                {generatedKeys.nsec}
              </div>
              
              <button
                onClick={() => copyToClipboard(generatedKeys.nsec)}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-xl h-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
              >
                {keysCopied ? '✓ Copied!' : 'Copy Private Key'}
              </button>
            </div>

            <button
              onClick={confirmKeysAndComplete}
              disabled={!keysCopied}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:bg-stone-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl h-12 transition-colors"
            >
              I've Saved My Keys - Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Method Selection - Cards Layout */}
            <div className="space-y-4">
              <h2 id="login-method-heading" className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                Choose Login Method
              </h2>
              
              <div className="grid gap-4" role="radiogroup" aria-labelledby="login-method-heading">
                {hasStoredNsec() && (
                  <button
                    onClick={() => setActiveMethod('stored')}
                    className={`bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-left transition-all ${
                      activeMethod === 'stored'
                        ? 'ring-2 ring-emerald-500 border-emerald-500/50'
                        : 'hover:bg-stone-800/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m0 0a2 2 0 01-2 2m2-2V9a2 2 0 00-2-2m2 2a2 2 0 002-2M9 5a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Stored Key</h3>
                        <p className="text-sm text-stone-400">Unlock your saved account</p>
                      </div>
                    </div>
                  </button>
                )}
                
                {hasNip07 && (
                  <button
                    onClick={() => setActiveMethod('nip07')}
                    className={`bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-left transition-all ${
                      activeMethod === 'nip07'
                        ? 'ring-2 ring-emerald-500 border-emerald-500/50'
                        : 'hover:bg-stone-800/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Browser Extension</h3>
                        <p className="text-sm text-stone-400">Most secure option</p>
                      </div>
                    </div>
                  </button>
                )}
                
                <button
                  onClick={() => setActiveMethod('nsec')}
                  className={`bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-left transition-all ${
                    activeMethod === 'nsec'
                      ? 'ring-2 ring-emerald-500 border-emerald-500/50'
                      : 'hover:bg-stone-800/70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m0 0a2 2 0 01-2 2m2-2V9a2 2 0 00-2-2m2 2a2 2 0 002-2M9 5a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Private Key</h3>
                      <p className="text-sm text-stone-400">Enter your nsec directly</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveMethod('generate')}
                  className={`bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-left transition-all ${
                    activeMethod === 'generate'
                      ? 'ring-2 ring-emerald-500 border-emerald-500/50'
                      : 'hover:bg-stone-800/70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">New Account</h3>
                      <p className="text-sm text-stone-400">Generate fresh keys</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Stored Key Method */}
            {activeMethod === 'stored' && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">
                    Passphrase
                  </label>
                  <input
                    type="password"
                    value={storedPassphrase}
                    onChange={(e) => setStoredPassphrase(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 h-12 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-stone-500"
                    placeholder="Enter passphrase to unlock"
                  />
                </div>
                
                <button
                  onClick={handleStoredLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:bg-stone-600 text-white font-semibold rounded-xl h-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
                >
                  {isLoading ? 'Unlocking...' : 'Unlock Account'}
                </button>
              </div>
            )}

            {/* NIP-07 Extension Method */}
            {activeMethod === 'nip07' && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 space-y-4">
                {hasNip07 ? (
                  <>
                    <div className="bg-emerald-600/10 border border-emerald-600/30 rounded-xl p-4">
                      <p className="text-emerald-400 text-sm">
                        ✓ Nostr extension detected. This is the recommended and most secure login method.
                      </p>
                    </div>
                    
                    <button
                      onClick={handleNip07Login}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:bg-stone-600 text-white font-semibold rounded-xl h-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
                    >
                      {isLoading ? 'Connecting...' : 'Connect with Extension'}
                    </button>
                  </>
                ) : (
                  <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-4">
                    <p className="text-amber-400 text-sm">
                      No Nostr extension found. Install a browser extension like nos2x or Alby for secure login.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Private Key Method */}
            {activeMethod === 'nsec' && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 space-y-6">
                <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4">
                  <h3 className="text-xs font-semibold tracking-wider text-red-400 uppercase mb-2">⚠️ Security Warning</h3>
                  <p className="text-stone-400 text-sm">
                    Entering your private key directly is less secure than using a browser extension.
                    Only do this if you trust this device.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">
                    Private Key (nsec)
                  </label>
                  <textarea
                    value={nsecInput}
                    onChange={(e) => setNsecInput(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-stone-500 font-mono text-sm"
                    rows={3}
                    placeholder="nsec1..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="save-nsec"
                      checked={saveNsec}
                      onChange={(e) => setSaveNsec(e.target.checked)}
                      className="mr-3 w-4 h-4 text-emerald-600 bg-stone-700 border-stone-600 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="save-nsec" className="text-sm text-stone-400">
                      Save encrypted copy (recommended)
                    </label>
                  </div>

                  {saveNsec && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">
                          Encryption Passphrase (min 8 chars)
                        </label>
                        <input
                          type="password"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 h-12 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-stone-500"
                          placeholder="Strong passphrase"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">
                          Confirm Passphrase
                        </label>
                        <input
                          type="password"
                          value={confirmPassphrase}
                          onChange={(e) => setConfirmPassphrase(e.target.value)}
                          className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 h-12 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-stone-500"
                          placeholder="Confirm passphrase"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNsecLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:bg-stone-600 text-white font-semibold rounded-xl h-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            )}

            {/* Generate New Account Method */}
            {activeMethod === 'generate' && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 space-y-4">
                <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
                  <h3 className="text-xs font-semibold tracking-wider text-blue-400 uppercase mb-2">Create New Account</h3>
                  <p className="text-stone-400 text-sm">
                    Generate a new Nostr keypair. You'll need to copy and securely store your private key.
                  </p>
                </div>

                <button
                  onClick={handleGenerateLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:bg-stone-600 text-white font-semibold rounded-xl h-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
                >
                  {isLoading ? 'Generating...' : 'Generate New Account'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}