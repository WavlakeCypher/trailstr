import { ReactNode } from 'react'
import TopNav from './TopNav'
import BottomNav from './BottomNav'

interface ShellProps {
  children: ReactNode
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      {/* Desktop Top Navigation */}
      <TopNav />
      
      {/* Main Content */}
      <main className="pb-16 md:pb-4 pt-0 md:pt-16">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  )
}