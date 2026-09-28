import { t } from '../../lib/i18n';
import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'

export function SignInForm() {
  const { signIn, signInWithGoogle, error, firebaseReady } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setFormError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-7 flex items-center gap-3">
          <div aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-lotus-600 text-white"><svg className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="13" rx="2" width="19" x="2.5" y="3" /><path d="M8 21h8M12 16v5M6 7h12" /></svg></div>
          <div>
            <h1 className="font-semibold tracking-tight">{t("IT Outsource Managed System (ITOMS)")}</h1>
            <p className="text-sm text-slate-500">{t("เข้าสู่ระบบสำหรับทีมงาน")}</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">{t("อีเมล")}</label>
            <input
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">{t("รหัสผ่าน")}</label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {(formError || error) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError || error}</p>}

          {!firebaseReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              {t("ยังไม่ได้ตั้งค่า Firebase สำหรับสภาพแวดล้อมนี้ กรุณาตรวจสอบ Environment configuration")}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-lotus-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-lotus-700 focus:outline-none focus:ring-2 focus:ring-lotus-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!firebaseReady || submitting}
            type="submit"
          >
            {submitting ? t("กำลังเข้าสู่ระบบ…") : t("เข้าสู่ระบบ")}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">{t('หรือ')}</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lotus-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!firebaseReady || submitting}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.77 7.18l7.73 6C44.4 37.92 46.98 31.84 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" transform="translate(0 0)" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          {submitting ? t('กำลังเข้าสู่ระบบ…') : t('เข้าสู่ระบบด้วย Google')}
        </button>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          {t("บัญชีต้องได้รับการสร้างและกำหนดสิทธิ์โดยผู้ดูแลระบบ ไม่สามารถสมัครสมาชิกจากหน้านี้ได้")}
        </p>
      </section>
    </main>
  )
}
