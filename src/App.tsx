import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'
import Feed from './pages/Feed'
import ActivityDetail from './pages/ActivityDetail'
import RecordActivity from './pages/RecordActivity'
import LiveRecord from './pages/LiveRecord'
import ImportActivities from './pages/ImportActivities'
import TrailExplorer from './pages/TrailExplorer'
import TrailDetail from './pages/TrailDetail'
import CreateTrail from './pages/CreateTrail'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { cacheHelpers } from './stores/cacheStore'
import { useThemeStore } from './stores/themeStore'

function App() {
  // Initialize theme on app startup
  const { actualTheme } = useThemeStore()
  
  useEffect(() => {
    // Apply theme immediately
    const root = window.document.documentElement
    if (actualTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [actualTheme])

  useEffect(() => {
    // Schedule cache cleanup for maintenance
    const cleanupInterval = cacheHelpers.scheduleCleanup()
    
    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  return (
    <Router>
      <Shell>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/record" element={<RecordActivity />} />
          <Route path="/record/live" element={<LiveRecord />} />
          <Route path="/import" element={<ImportActivities />} />
          <Route path="/trails" element={<TrailExplorer />} />
          <Route path="/trail/:id" element={<TrailDetail />} />
          <Route path="/trail/create" element={<CreateTrail />} />
          <Route path="/profile/:npub?" element={<Profile />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Shell>
    </Router>
  )
}

export default App