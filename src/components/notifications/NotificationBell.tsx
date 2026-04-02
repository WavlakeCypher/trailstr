import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, BellRing, Heart, MessageCircle, UserPlus, Zap } from 'lucide-react'
import { useNotificationStore } from '../../stores/notificationStore'
import { useAuthStore } from '../../stores/authStore'
import Avatar from '../common/Avatar'

interface NotificationItemProps {
  notification: {
    id: string
    type: 'reaction' | 'comment' | 'follow' | 'zap' | 'mention'
    fromPubkey: string
    fromProfile?: {
      name?: string
      displayName?: string
      picture?: string
    }
    targetEventId: string
    content: string
    amount?: number
    createdAt: number
    isRead: boolean
  }
  onClick?: () => void
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { markAsRead } = useNotificationStore()

  const getIcon = () => {
    switch (notification.type) {
      case 'reaction':
        return <Heart className="text-red-500" size={16} aria-hidden="true" />
      case 'comment':
      case 'mention':
        return <MessageCircle className="text-blue-500" size={16} aria-hidden="true" />
      case 'follow':
        return <UserPlus className="text-green-500" size={16} aria-hidden="true" />
      case 'zap':
        return <Zap className="text-yellow-500" size={16} aria-hidden="true" />
      default:
        return <Bell className="text-gray-500" size={16} aria-hidden="true" />
    }
  }

  const getMessage = () => {
    const name = notification.fromProfile?.displayName || 
                 notification.fromProfile?.name || 
                 'Someone'
    
    switch (notification.type) {
      case 'reaction':
        return `${name} reacted to your post`
      case 'comment':
        return `${name} commented on your post`
      case 'mention':
        return `${name} mentioned you`
      case 'follow':
        return `${name} started following you`
      case 'zap':
        const sats = notification.amount || 0
        return `${name} zapped you ${sats} sats`
      default:
        return notification.content
    }
  }

  const formatTime = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000)
    const diff = now - timestamp
    
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    onClick?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      className={`flex items-start space-x-3 p-3 hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
        !notification.isRead ? 'bg-forest-50 dark:bg-forest-900/20 border-l-2 border-l-forest-500' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${getMessage()}, ${formatTime(notification.createdAt)}${!notification.isRead ? ', unread' : ''}`}
    >
      <Avatar
        src={notification.fromProfile?.picture}
        alt={notification.fromProfile?.displayName || notification.fromProfile?.name}
        fallback={notification.fromProfile?.displayName || notification.fromProfile?.name}
        size="sm"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          {getIcon()}
          <p className="text-sm text-stone-900 dark:text-stone-100 truncate">
            {getMessage()}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {formatTime(notification.createdAt)}
          </span>
          
          {!notification.isRead && (
            <div className="w-2 h-2 bg-forest-500 rounded-full" aria-hidden="true"></div>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const { isAuthenticated, pubkey } = useAuthStore()
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    fetchNotifications, 
    subscribe, 
    unsubscribe,
    markAllAsRead 
  } = useNotificationStore()
  
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleKeyDown])

  // Subscribe to notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && pubkey) {
      fetchNotifications(pubkey)
      subscribe(pubkey)
      
      return () => {
        unsubscribe()
      }
    }
  }, [isAuthenticated, pubkey])

  // Periodic refresh
  useEffect(() => {
    if (!isAuthenticated || !pubkey) return
    
    const interval = setInterval(() => {
      fetchNotifications(pubkey)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [isAuthenticated, pubkey])

  if (!isAuthenticated) {
    return null
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {unreadCount > 0 ? (
          <BellRing className="text-forest-600" size={20} aria-hidden="true" />
        ) : (
          <Bell size={20} aria-hidden="true" />
        )}
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium min-w-[18px] h-[18px] rounded-full flex items-center justify-center" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-800 rounded-lg shadow-xl border border-stone-200 dark:border-stone-700 z-50 max-h-96 overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-700">
            <h3 className="font-medium text-stone-900 dark:text-stone-100">Notifications</h3>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-forest-600 hover:text-forest-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto" role="list" aria-live="polite">
            {isLoading ? (
              <div className="flex items-center justify-center p-8" role="status">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-forest-500" aria-hidden="true"></div>
                <span className="sr-only">Loading notifications</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center p-8 text-stone-500 dark:text-stone-400">
                <Bell className="mx-auto mb-3 text-stone-400 dark:text-stone-600" size={32} aria-hidden="true" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                  You'll see notifications here when others interact with your content
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {notifications.slice(0, 20).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => {
                      console.log('Navigate to:', notification.targetEventId)
                      setIsOpen(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-stone-100 dark:border-stone-700 p-3">
              <button className="w-full text-center text-sm text-forest-600 hover:text-forest-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 py-1">
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
