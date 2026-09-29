import { getLocale, t } from '../lib/i18n'

function formatLastUpdated(value: Date | null) {
  if (!value) return t('ยังไม่ได้โหลด')
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(value)
}

export function DataFreshnessBar({
  lastUpdated,
  loading,
  onRefresh,
}: {
  lastUpdated: Date | null
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
      <span>
        {t('อัปเดตล่าสุด')}: {formatLastUpdated(lastUpdated)}
      </span>
      <button
        aria-label={t('รีเฟรชข้อมูล')}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-lotus-700 hover:bg-lotus-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
        onClick={onRefresh}
        type="button"
      >
        {loading ? t('กำลังโหลด…') : t('รีเฟรชข้อมูล')}
      </button>
    </div>
  )
}
