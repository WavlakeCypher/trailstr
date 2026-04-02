import { type ReactNode } from 'react'
import TopNav from './TopNav'
import BottomNav from './BottomNav'

interface ShellProps {
  children: ReactNode
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-stone-900">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-emerald-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Desktop Top Navigation */}
      <TopNav />
      
      {/* Main Content */}
      <main id="main-content" className="pb-16 md:pb-4 pt-0 md:pt-16" role="main">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  )
}