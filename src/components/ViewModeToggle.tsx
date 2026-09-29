import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'

export type DataViewMode = 'cards' | 'table'

export function useDataViewMode(storageKey: string, fallback: DataViewMode = 'cards') {
  const [mode, setMode] = useState<DataViewMode>(() => {
    if (typeof window === 'undefined') return fallback
    const stored = window.localStorage.getItem(storageKey)
    return stored === 'table' || stored === 'cards' ? stored : fallback
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, mode)
  }, [mode, storageKey])

  return [mode, setMode] as const
}

export function ViewModeToggle({ mode, onChange, label = 'รูปแบบการแสดงผล' }: { mode: DataViewMode; onChange: (mode: DataViewMode) => void; label?: string }) {
  return (
    <div aria-label={t(label)} className="flex min-h-11 items-center rounded-xl border border-line bg-white p-1" role="group">
      <button
        aria-pressed={mode === 'cards'}
        className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${mode === 'cards' ? 'bg-lotus-50 text-lotus-800 shadow-sm' : 'text-muted hover:bg-canvas'}`}
        onClick={() => onChange('cards')}
        type="button"
      >
        {t('การ์ด')}
      </button>
      <button
        aria-pressed={mode === 'table'}
        className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${mode === 'table' ? 'bg-lotus-50 text-lotus-800 shadow-sm' : 'text-muted hover:bg-canvas'}`}
        onClick={() => onChange('table')}
        type="button"
      >
        {t('ตาราง')}
      </button>
    </div>
  )
}
