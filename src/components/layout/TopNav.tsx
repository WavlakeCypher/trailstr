import { Link, useLocation } from 'react-router-dom'
import { NotificationBell } from '../notifications/NotificationBell'

export default function TopNav() {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-stone-900/95 backdrop-blur-xl border-b border-stone-800 z-50">
      <div className="max-w-4xl mx-auto px-4 w-full">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-white">
              TrailStr
            </span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link 
              to="/"
              className={`font-medium transition-all duration-200 relative ${
                isActive('/') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Feed
              {isActive('/') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500"></div>}
            </Link>
            <Link 
              to="/trails"
              className={`font-medium transition-all duration-200 relative ${
                isActive('/trails') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Explore
              {isActive('/trails') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500"></div>}
            </Link>
            <Link 
              to="/record"
              className={`font-medium transition-all duration-200 relative ${
                isActive('/record') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Record
              {isActive('/record') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500"></div>}
            </Link>
            <Link 
              to="/profile"
              className={`font-medium transition-all duration-200 relative ${
                isActive('/profile') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Profile
              {isActive('/profile') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500"></div>}
            </Link>
            
            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>
      </div>
    </nav>
  )
}