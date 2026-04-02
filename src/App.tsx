import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'
import { cacheHelpers } from './stores/cacheStore'
import { useThemeStore } from './stores/themeStore'
import Skeleton from './components/common/Skeleton'

// Lazy-loaded route pages
const Feed = lazy(() => import('./pages/Feed'))
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'))
const RecordActivity = lazy(() => import('./pages/RecordActivity'))
const LiveRecord = lazy(() => import('./pages/LiveRecord'))
const ImportActivities = lazy(() => import('./pages/ImportActivities'))
const TrailExplorer = lazy(() => import('./pages/TrailExplorer'))
const TrailDetail = lazy(() => import('./pages/TrailDetail'))
const CreateTrail = lazy(() => import('./pages/CreateTrail'))
const Profile = lazy(() => import('./pages/Profile'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-900 flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

function App() {
  const { actualTheme } = useThemeStore()
  
  useEffect(() => {
    const root = window.document.documentElement
    if (actualTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [actualTheme])

  useEffect(() => {
    const cleanupInterval = cacheHelpers.scheduleCleanup()
    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  return (
    <Router>
      <Shell>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </Shell>
    </Router>
  )
}

export default App
