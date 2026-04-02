import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Moon, 
  Sun, 
  Monitor, 
  User, 
  Database, 
  Trash2, 
  Download,
  Key,
  ArrowLeft
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore, type Theme } from '../stores/themeStore'
import { useCacheStore } from '../stores/cacheStore'

export default function Settings() {
  const navigate = useNavigate()
  const { logout, pubkey, profile } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { clearCache, getCacheStats } = useCacheStore()
  
  const [cacheStats, setCacheStats] = React.useState({
    eventCount: 0,
    profileCount: 0,
    oldestEvent: null as number | null,
    newestEvent: null as number | null
  })
  const [showClearConfirm, setShowClearConfirm] = React.useState(false)

  // Load cache stats
  React.useEffect(() => {
    getCacheStats().then(setCacheStats)
  }, [getCacheStats])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
  }

  const handleClearCache = async () => {
    await clearCache()
    setCacheStats({
      eventCount: 0,
      profileCount: 0,
      oldestEvent: null,
      newestEvent: null
    })
    setShowClearConfirm(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const formatCacheDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={20} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={20} /> },
    { value: 'system', label: 'System', icon: <Monitor size={20} /> }
  ]

  return (
    <div className="min-h-screen bg-stone-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur-xl border-b border-stone-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Theme Settings */}
        <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <h2 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-6">
            Appearance
          </h2>
          
          <div className="space-y-4">
            <label className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-4">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex flex-col items-center space-y-2 p-4 rounded-xl border-2 min-h-12 transition-all ${
                    theme === option.value
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-stone-600 hover:border-stone-500 text-stone-400 hover:text-stone-300'
                  }`}
                >
                  {option.icon}
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <h2 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-6">
            Account
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">
                  {profile?.display_name || profile?.name || 'Anonymous'}
                </p>
                <p className="text-sm text-stone-500 font-mono">
                  {pubkey?.slice(0, 16)}...
                </p>
              </div>
              <button
                onClick={() => navigate('/profile/edit')}
                className="flex items-center space-x-2 border border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              >
                <User size={16} />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data & Storage */}
        <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <h2 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-6">
            Data & Storage
          </h2>
          
          <div className="space-y-6">
            {/* Cache Stats */}
            <div className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Database size={16} className="text-white" />
                </div>
                <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                  Offline Cache
                </span>
              </div>
              <div className="text-sm text-stone-400 space-y-1 mb-4">
                <p>{cacheStats.eventCount} cached events</p>
                <p>{cacheStats.profileCount} cached profiles</p>
                {cacheStats.oldestEvent && (
                  <p>Cache range: {formatCacheDate(cacheStats.oldestEvent)} - {formatCacheDate(cacheStats.newestEvent)}</p>
                )}
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center space-x-2 border border-red-600/50 text-red-400 hover:bg-red-600/10 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              >
                <Trash2 size={16} />
                <span>Clear Cache</span>
              </button>
            </div>

            {/* Import/Export (Future) */}
            <div className="flex items-center justify-between opacity-50">
              <div>
                <p className="font-medium text-stone-400">Export Data</p>
                <p className="text-sm text-stone-500">Download your activities</p>
              </div>
              <button
                disabled
                className="flex items-center space-x-2 border border-stone-600 text-stone-500 rounded-xl px-3 py-2 text-sm font-medium cursor-not-allowed"
              >
                <Download size={16} />
                <span>Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <h2 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-6">
            Security & Privacy
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between opacity-50">
              <div>
                <p className="font-medium text-stone-400">Backup Keys</p>
                <p className="text-sm text-stone-500">Export encrypted keys</p>
              </div>
              <button
                disabled
                className="flex items-center space-x-2 border border-stone-600 text-stone-500 rounded-xl px-3 py-2 text-sm font-medium cursor-not-allowed"
              >
                <Key size={16} />
                <span>Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl h-12 transition-colors"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Clear Cache Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-stone-800/90 backdrop-blur-xl border border-stone-700/50 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Clear Cache?
            </h3>
            <p className="text-sm text-stone-400 mb-6">
              This will remove all cached activities and profiles. You'll need to reload them from relays.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 border border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl h-12 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCache}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl h-12 transition-colors"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}