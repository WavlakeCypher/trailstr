import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'
import Feed from './pages/Feed'
import ActivityDetail from './pages/ActivityDetail'
import RecordActivity from './pages/RecordActivity'
import ImportActivities from './pages/ImportActivities'
import TrailExplorer from './pages/TrailExplorer'
import TrailDetail from './pages/TrailDetail'
import CreateTrail from './pages/CreateTrail'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import Settings from './pages/Settings'
import Login from './pages/Login'

function App() {
  return (
    <Router>
      <Shell>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/record" element={<RecordActivity />} />
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