import { Link, useLocation } from 'react-router-dom'
import { NotificationBell } from '../notifications/NotificationBell'

export default function TopNav() {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-forest-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-forest-800 dark:text-forest-200">
              TrailStr
            </span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link 
              to="/"
              className={`font-medium transition-colors ${
                isActive('/') 
                  ? 'text-forest-600 dark:text-forest-400' 
                  : 'text-stone-600 dark:text-stone-400 hover:text-forest-600 dark:hover:text-forest-400'
              }`}
            >
              Feed
            </Link>
            <Link 
              to="/trails"
              className={`font-medium transition-colors ${
                isActive('/trails') 
                  ? 'text-forest-600 dark:text-forest-400' 
                  : 'text-stone-600 dark:text-stone-400 hover:text-forest-600 dark:hover:text-forest-400'
              }`}
            >
              Explore
            </Link>
            <Link 
              to="/record"
              className={`font-medium transition-colors ${
                isActive('/record') 
                  ? 'text-forest-600 dark:text-forest-400' 
                  : 'text-stone-600 dark:text-stone-400 hover:text-forest-600 dark:hover:text-forest-400'
              }`}
            >
              Record
            </Link>
            <Link 
              to="/profile"
              className={`font-medium transition-colors ${
                isActive('/profile') 
                  ? 'text-forest-600 dark:text-forest-400' 
                  : 'text-stone-600 dark:text-stone-400 hover:text-forest-600 dark:hover:text-forest-400'
              }`}
            >
              Profile
            </Link>
            
            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>
      </div>
    </nav>
  )
}