import { t } from '../../lib/i18n';
import { useEffect, useState } from 'react'
import { getLanguage, setLanguage, type Language } from '../../lib/i18n'

export function LanguageSwitcher() {
  const [language, setCurrentLanguage] = useState<Language>(getLanguage)

  useEffect(() => {
    const onChange = (event: Event) => setCurrentLanguage((event as CustomEvent<Language>).detail)
    window.addEventListener('lotus-language-change', onChange)
    return () => window.removeEventListener('lotus-language-change', onChange)
  }, [])

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-slate-500">{language === 'th' ? t("ภาษา") : 'Language'}</span>
      <select
        aria-label={language === 'th' ? t("ภาษา") : 'Language'}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
        onChange={(event) => setLanguage(event.target.value as Language)}
        value={language}
      >
        <option value="th">{t("ไทย")}</option>
        <option value="en">{t("English")}</option>
      </select>
    </label>
  )
}
