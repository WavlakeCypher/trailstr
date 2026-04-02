import { Link, useLocation } from 'react-router-dom'
import { NotificationBell } from '../notifications/NotificationBell'

export default function TopNav() {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-stone-900/95 backdrop-blur-xl border-b border-stone-800 z-50" aria-label="Main navigation">
      <div className="max-w-4xl mx-auto px-4 w-full">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3" aria-label="TrailStr home">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-white">
              TrailStr
            </span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8" role="menubar">
            <Link 
              to="/"
              className={`font-medium transition-all duration-200 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded px-1 ${
                isActive('/') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              Feed
              {isActive('/') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500" aria-hidden="true"></div>}
            </Link>
            <Link 
              to="/trails"
              className={`font-medium transition-all duration-200 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded px-1 ${
                isActive('/trails') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
              aria-current={isActive('/trails') ? 'page' : undefined}
            >
              Explore
              {isActive('/trails') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500" aria-hidden="true"></div>}
            </Link>
            <Link 
              to="/record"
              className={`font-medium transition-all duration-200 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded px-1 ${
                isActive('/record') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
              aria-current={isActive('/record') ? 'page' : undefined}
            >
              Record
              {isActive('/record') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500" aria-hidden="true"></div>}
            </Link>
            <Link 
              to="/profile"
              className={`font-medium transition-all duration-200 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded px-1 ${
                isActive('/profile') 
                  ? 'text-emerald-400' 
                  : 'text-stone-400 hover:text-white'
              }`}
              aria-current={isActive('/profile') ? 'page' : undefined}
            >
              Profile
              {isActive('/profile') && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-emerald-500" aria-hidden="true"></div>}
            </Link>
            
            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>
      </div>
    </nav>
  )
}
