import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeState {
  theme: Theme
  actualTheme: 'light' | 'dark' // The actual resolved theme
  
  // Actions
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Detect system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Apply theme to document
const applyTheme = (theme: 'light' | 'dark') => {
  const root = window.document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Resolve actual theme based on preference
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      // Listen for system theme changes
      if (typeof window !== 'undefined') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
          const { theme } = get()
          if (theme === 'system') {
            const newActualTheme = getSystemTheme()
            applyTheme(newActualTheme)
            set({ actualTheme: newActualTheme })
          }
        }
        
        mediaQuery.addEventListener('change', handleChange)
      }

      return {
        theme: 'system',
        actualTheme: getSystemTheme(),

        setTheme: (theme: Theme) => {
          const actualTheme = resolveTheme(theme)
          applyTheme(actualTheme)
          set({ theme, actualTheme })
        },

        toggleTheme: () => {
          const { actualTheme } = get()
          const newTheme = actualTheme === 'light' ? 'dark' : 'light'
          applyTheme(newTheme)
          set({ theme: newTheme, actualTheme: newTheme })
        }
      }
    },
    {
      name: 'trailstr-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme on app load
          const actualTheme = resolveTheme(state.theme)
          applyTheme(actualTheme)
          state.actualTheme = actualTheme
        }
      }
    }
  )
)