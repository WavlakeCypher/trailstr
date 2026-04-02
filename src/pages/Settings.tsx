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
    <div className="min-h-screen bg-white dark:bg-stone-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Theme Settings */}
        <div className="bg-white dark:bg-stone-800 rounded-lg p-6 border border-stone-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Appearance
          </h2>
          
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex flex-col items-center space-y-2 p-3 rounded-lg border-2 transition-all ${
                    theme === option.value
                      ? 'border-forest-500 bg-forest-50 dark:bg-forest-900/20 text-forest-600 dark:text-forest-400'
                      : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-600 dark:text-stone-400'
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
        <div className="bg-white dark:bg-stone-800 rounded-lg p-6 border border-stone-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Account
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  {profile?.display_name || profile?.name || 'Anonymous'}
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400 font-mono">
                  {pubkey?.slice(0, 16)}...
                </p>
              </div>
              <button
                onClick={() => navigate('/profile/edit')}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200 transition-colors"
              >
                <User size={16} />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data & Storage */}
        <div className="bg-white dark:bg-stone-800 rounded-lg p-6 border border-stone-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Data & Storage
          </h2>
          
          <div className="space-y-4">
            {/* Cache Stats */}
            <div className="p-4 bg-stone-50 dark:bg-stone-700 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database size={16} className="text-stone-600 dark:text-stone-400" />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  Offline Cache
                </span>
              </div>
              <div className="text-sm text-stone-600 dark:text-stone-400 space-y-1">
                <p>{cacheStats.eventCount} cached events</p>
                <p>{cacheStats.profileCount} cached profiles</p>
                {cacheStats.oldestEvent && (
                  <p>Cache range: {formatCacheDate(cacheStats.oldestEvent)} - {formatCacheDate(cacheStats.newestEvent)}</p>
                )}
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center space-x-2 mt-3 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
              >
                <Trash2 size={16} />
                <span>Clear Cache</span>
              </button>
            </div>

            {/* Import/Export (Future) */}
            <div className="flex items-center justify-between opacity-50">
              <div>
                <p className="font-medium text-stone-700 dark:text-stone-300">Export Data</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Download your activities</p>
              </div>
              <button
                disabled
                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-stone-400 cursor-not-allowed"
              >
                <Download size={16} />
                <span>Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white dark:bg-stone-800 rounded-lg p-6 border border-stone-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Security & Privacy
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between opacity-50">
              <div>
                <p className="font-medium text-stone-700 dark:text-stone-300">Backup Keys</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Export encrypted keys</p>
              </div>
              <button
                disabled
                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-stone-400 cursor-not-allowed"
              >
                <Key size={16} />
                <span>Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-white dark:bg-stone-800 rounded-lg p-6 border border-stone-200 dark:border-stone-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Clear Cache Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-stone-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              Clear Cache?
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
              This will remove all cached activities and profiles. You'll need to reload them from relays.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCache}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
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