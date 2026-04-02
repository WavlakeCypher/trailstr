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
  
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('nip07')
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">
            Welcome to TrailStr
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Your adventures on the Nostr protocol
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {generatedKeys ? (
          // Show generated keys for copying
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-400 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
                ⚠️ Important: Save Your Private Key
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-3">
                This is your private key (nsec). Copy it and store it safely. You will NOT see it again!
              </p>
              
              <div className="bg-white dark:bg-slate-700 border rounded p-3 font-mono text-xs break-all">
                {generatedKeys.nsec}
              </div>
              
              <button
                onClick={() => copyToClipboard(generatedKeys.nsec)}
                className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {keysCopied ? '✓ Copied!' : 'Copy Private Key'}
              </button>
            </div>

            <button
              onClick={confirmKeysAndComplete}
              disabled={!keysCopied}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              I've Saved My Keys - Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Method Selection Tabs */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              {hasStoredNsec() && (
                <button
                  onClick={() => setActiveMethod('stored')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeMethod === 'stored'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Stored Key
                </button>
              )}
              
              {hasNip07 && (
                <button
                  onClick={() => setActiveMethod('nip07')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeMethod === 'nip07'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Extension
                </button>
              )}
              
              <button
                onClick={() => setActiveMethod('nsec')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeMethod === 'nsec'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Private Key
              </button>
              
              <button
                onClick={() => setActiveMethod('generate')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeMethod === 'generate'
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                New Account
              </button>
            </div>

            {/* Stored Key Method */}
            {activeMethod === 'stored' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Enter your passphrase
                  </label>
                  <input
                    type="password"
                    value={storedPassphrase}
                    onChange={(e) => setStoredPassphrase(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    placeholder="Enter passphrase to unlock"
                  />
                </div>
                
                <button
                  onClick={handleStoredLogin}
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Unlocking...' : 'Unlock Account'}
                </button>
              </div>
            )}

            {/* NIP-07 Extension Method */}
            {activeMethod === 'nip07' && (
              <div className="space-y-4">
                {hasNip07 ? (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-400 rounded-lg p-4">
                      <p className="text-emerald-800 dark:text-emerald-300 text-sm">
                        ✓ Nostr extension detected. This is the recommended and most secure login method.
                      </p>
                    </div>
                    
                    <button
                      onClick={handleNip07Login}
                      disabled={isLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      {isLoading ? 'Connecting...' : 'Connect with Extension'}
                    </button>
                  </>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-900/50 border border-amber-400 rounded-lg p-4">
                    <p className="text-amber-800 dark:text-amber-300 text-sm">
                      No Nostr extension found. Install a browser extension like nos2x or Alby for secure login.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Private Key Method */}
            {activeMethod === 'nsec' && (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/50 border border-red-400 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 dark:text-red-400 mb-1">⚠️ Security Warning</h3>
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    Entering your private key directly is less secure than using a browser extension.
                    Only do this if you trust this device.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Private Key (nsec)
                  </label>
                  <textarea
                    value={nsecInput}
                    onChange={(e) => setNsecInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm"
                    rows={3}
                    placeholder="nsec1..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="save-nsec"
                      checked={saveNsec}
                      onChange={(e) => setSaveNsec(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="save-nsec" className="text-sm text-slate-700 dark:text-slate-300">
                      Save encrypted copy (recommended)
                    </label>
                  </div>

                  {saveNsec && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Encryption Passphrase (min 8 chars)
                        </label>
                        <input
                          type="password"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          placeholder="Strong passphrase"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Confirm Passphrase
                        </label>
                        <input
                          type="password"
                          value={confirmPassphrase}
                          onChange={(e) => setConfirmPassphrase(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          placeholder="Confirm passphrase"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleNsecLogin}
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            )}

            {/* Generate New Account Method */}
            {activeMethod === 'generate' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-400 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-1">Create New Account</h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    Generate a new Nostr keypair. You'll need to copy and securely store your private key.
                  </p>
                </div>

                <button
                  onClick={handleGenerateLogin}
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
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