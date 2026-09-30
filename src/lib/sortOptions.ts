import { getLocale } from './i18n'

/**
 * Return a locale-aware copy for use in data-backed dropdowns.
 * The source array is never mutated, and labels are sorted using the active UI language.
 */
export function sortByLabel<T>(items: readonly T[], getLabel: (item: T) => string = String): T[] {
  return [...items].sort((left, right) =>
    getLabel(left).localeCompare(getLabel(right), getLocale(), {
      ignorePunctuation: true,
      numeric: true,
      sensitivity: 'base',
    }),
  )
}
