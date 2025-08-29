'use client'

import { useEffect, useState } from 'react'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'mdpva:theme'

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'system' ? prefersDark : mode === 'dark'
  root.classList.toggle('dark', isDark)
}

export default function ThemeSwitcher({ className = '', variant = 'labeled' }: { className?: string; variant?: 'labeled' | 'minimal' }) {
  // Initialize from localStorage synchronously to avoid clobbering user preference on mount
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    return saved ?? 'system'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    applyTheme(mode)
    localStorage.setItem(STORAGE_KEY, mode)

    // Sync with system when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (mode === 'system') applyTheme('system') }
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [mode])

  const compact = variant === 'minimal'
  const sizePad = compact ? 'px-2.5 py-1.5' : 'px-2 py-1'
  const labelClass = compact ? 'sr-only' : 'hidden md:inline'
  const btnBase = `inline-flex items-center gap-1 ${sizePad} ${compact ? 'rounded-full' : 'rounded-md'} text-sm border transition-colors`
  const inactive = 'text-gray-600 border-gray-300 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
  const active = 'text-primary-700 border-primary-600 bg-primary-50 dark:text-primary-200 dark:border-primary-400/60 dark:bg-primary-900/30'

  return (
    <div className={`flex items-center gap-2 ${className}`} aria-label="Theme switcher">
      <button
        type="button"
        className={`${btnBase} ${mode === 'light' ? active : inactive}`}
        onClick={() => setMode('light')}
        title="Light"
        aria-pressed={mode === 'light'}
      >
        <SunIcon className="w-4 h-4" />
        <span className={labelClass}>Light</span>
      </button>
      <button
        type="button"
        className={`${btnBase} ${mode === 'system' ? active : inactive}`}
        onClick={() => setMode('system')}
        title="System"
        aria-pressed={mode === 'system'}
      >
        <ComputerDesktopIcon className="w-4 h-4" />
        <span className={labelClass}>System</span>
      </button>
      <button
        type="button"
        className={`${btnBase} ${mode === 'dark' ? active : inactive}`}
        onClick={() => setMode('dark')}
        title="Dark"
        aria-pressed={mode === 'dark'}
      >
        <MoonIcon className="w-4 h-4" />
        <span className={labelClass}>Dark</span>
      </button>
    </div>
  )
}
