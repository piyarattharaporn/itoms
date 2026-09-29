import { beforeEach, describe, expect, it } from 'vitest'
import { catalog, getLanguage, setLanguage, t, tKey } from '../../src/lib/i18n'

describe('i18n catalog', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setLanguage('th')
  })

  it('keeps the Thai and English catalogs in sync', () => {
    expect(Object.keys(catalog.th).sort()).toEqual(Object.keys(catalog.en).sort())
  })

  it('translates stable keys and interpolates parameters', () => {
    expect(tKey('common.save')).toBe('บันทึก')
    expect(tKey('common.daysLeft', { days: 3 })).toBe('เหลือ 3 วัน')

    setLanguage('en')

    expect(getLanguage()).toBe('en')
    expect(tKey('common.save')).toBe('Save')
    expect(tKey('common.daysLeft', { days: 3 })).toBe('3 days left')
  })

  it('keeps legacy text calls working during the migration', () => {
    expect(t('บันทึก')).toBe('บันทึก')

    setLanguage('en')

    expect(t('บันทึก')).toBe('Save')
    expect(t('เกิน SLA')).toBe('SLA breached')
  })
})
