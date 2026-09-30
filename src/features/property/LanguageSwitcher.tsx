import { useEffect, useState } from 'react'
import { getLanguage, setLanguage, tKey, type Language } from '../../lib/i18n'
import { sortByLabel } from '../../lib/sortOptions'

export function LanguageSwitcher() {
  const [language, setCurrentLanguage] = useState<Language>(getLanguage)

  useEffect(() => {
    const onChange = (event: Event) => setCurrentLanguage((event as CustomEvent<Language>).detail)
    window.addEventListener('lotus-language-change', onChange)
    return () => window.removeEventListener('lotus-language-change', onChange)
  }, [])

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-slate-500">{tKey('common.language')}</span>
      <select
        aria-label={tKey('common.language')}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
        onChange={(event) => setLanguage(event.target.value as Language)}
        value={language}
      >
        {sortByLabel(
          [
            { value: 'th', label: tKey('common.thai') },
            { value: 'en', label: tKey('common.english') },
          ],
          (item) => item.label,
        ).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
