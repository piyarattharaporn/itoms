import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  deactivateCctvNvr,
  saveCctvNvrInventory,
  subscribeToCctvNvrInventory,
  type CctvNvrInventoryInput,
  type CctvNvrInventoryItem,
} from './cctvDailyCheckService'
import { t } from '../../lib/i18n'

const blank = (propertyId: string, propertyCode: string): CctvNvrInventoryInput => ({
  propertyId,
  propertyCode,
  name: '',
  location: '',
  cameraTotal: 1,
  targetRetentionDays: 0,
  active: true,
})

export function CctvNvrInventoryManager({
  propertyId,
  propertyCode,
  canManage,
  onItems,
}: {
  propertyId: string
  propertyCode: string
  canManage: boolean
  onItems: (items: CctvNvrInventoryItem[]) => void
}) {
  const { firebaseUser } = useAuth()
  const [items, setItems] = useState<CctvNvrInventoryItem[]>([])
  const [draft, setDraft] = useState<CctvNvrInventoryInput>(() => blank(propertyId, propertyCode))
  const [editingId, setEditingId] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setItems([])
    if (!propertyId) return
    return subscribeToCctvNvrInventory(
      propertyId,
      (next) => {
        setItems(next)
        onItems(next)
      },
      () => setError(t('โหลดทะเบียน NVR ไม่สำเร็จ ตรวจสอบสิทธิ์และ Firestore Index')),
    )
  }, [propertyId, onItems])

  function startNew() {
    setEditingId(undefined)
    setDraft(blank(propertyId, propertyCode))
    setError('')
    setOpen(true)
  }

  function startEdit(item: CctvNvrInventoryItem) {
    setEditingId(item.id)
    setDraft({
      propertyId: item.propertyId,
      propertyCode: item.propertyCode,
      name: item.name,
      location: item.location,
      cameraTotal: item.cameraTotal,
      targetRetentionDays: item.targetRetentionDays,
      active: item.active,
    })
    setError('')
    setOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser) {
      setError(t('กรุณาเข้าสู่ระบบใหม่'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveCctvNvrInventory({ ...draft, propertyId, propertyCode }, firebaseUser.uid, editingId)
      setOpen(false)
      setEditingId(undefined)
      setDraft(blank(propertyId, propertyCode))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึกทะเบียน NVR ไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: CctvNvrInventoryItem) {
    if (!item.active) {
      try {
        await saveCctvNvrInventory(
          {
            propertyId,
            propertyCode,
            name: item.name,
            location: item.location,
            cameraTotal: item.cameraTotal,
            targetRetentionDays: item.targetRetentionDays,
            active: true,
          },
          firebaseUser?.uid ?? '',
          item.id,
        )
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('เปลี่ยนสถานะ NVR ไม่สำเร็จ'))
      }
      return
    }
    try {
      await deactivateCctvNvr(item.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('เปลี่ยนสถานะ NVR ไม่สำเร็จ'))
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('ทะเบียน NVR')}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('ตั้งค่าจำนวนกล้องและเป้าหมายวันเก็บภาพครั้งเดียว ระบบจะใช้เป็นค่าเริ่มต้นในการตรวจประจำวัน')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('แสดงทะเบียน NVR สูงสุด 200 รายการต่อ Property ในโหมด Spark')}
          </p>
        </div>
        {canManage && (
          <button
            className="rounded-full border border-lotus-200 px-4 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50"
            onClick={startNew}
            type="button"
          >
            {t('+ เพิ่ม NVR')}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {t(error)}
        </p>
      )}
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              className={`rounded-xl border p-4 ${item.active ? 'border-slate-200 bg-slate-50/60' : 'border-slate-100 bg-slate-50 opacity-70'}`}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.location || t('ไม่ระบุ Location')}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                >
                  {item.active ? t('ใช้งาน') : t('ปิดใช้งาน')}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>
                  {t('กล้องทั้งหมด')} {item.cameraTotal}
                </span>
                <span>
                  {t('เป้าหมายย้อนหลัง')}{' '}
                  {item.targetRetentionDays ? `${item.targetRetentionDays} ${t('วัน')}` : t('ยังไม่กำหนด')}
                </span>
              </div>
              {canManage && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => startEdit(item)}
                    type="button"
                  >
                    {t('แก้ไข')}
                  </button>
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => void toggleActive(item)}
                    type="button"
                  >
                    {item.active ? t('หยุดใช้งาน') : t('เปิดใช้งาน')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {t('ยังไม่มี NVR ในทะเบียน เพิ่มรายการก่อนเริ่มตรวจประจำวัน')}
        </p>
      )}
      {open && (
        <form className="mt-4 rounded-xl border border-lotus-100 bg-lotus-50/30 p-4" onSubmit={submit}>
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t(editingId ? 'แก้ไข NVR' : 'เพิ่ม NVR เข้าทะเบียน')}</h4>
            <button
              className="rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              {t('ยกเลิก')}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              {t('ชื่อ / รหัส NVR')}
              <input
                className="form-input mt-1 w-full"
                maxLength={100}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('เช่น NVR-LOBBY-01')}
                required
                value={draft.name}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('Location / พื้นที่')}
              <input
                className="form-input mt-1 w-full"
                maxLength={160}
                onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                placeholder={t('เช่น Lobby / อาคาร A')}
                value={draft.location}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('จำนวนกล้องที่ติดตั้ง')}
              <input
                className="form-input mt-1 w-full"
                max="20000"
                min="1"
                onChange={(event) => setDraft((current) => ({ ...current, cameraTotal: Number(event.target.value) }))}
                required
                type="number"
                value={draft.cameraTotal}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('เป้าหมายวันเก็บภาพ')}
              <input
                className="form-input mt-1 w-full"
                max="3650"
                min="0"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, targetRetentionDays: Number(event.target.value) }))
                }
                required
                type="number"
                value={draft.targetRetentionDays}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">{t('ใส่ 0 หากยังไม่มีเป้าหมาย')}</span>
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              className="rounded-full bg-lotus-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? t('กำลังบันทึก…') : t('บันทึก')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
