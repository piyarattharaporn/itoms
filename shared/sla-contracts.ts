import type { Priority } from './ticket-contracts.js'

export type SlaPauseReason = 'Waiting for User' | 'Waiting for Vendor'
export type SlaLifecycleState = 'running' | 'paused' | 'met' | 'cancelled'
export type SlaResponseStatus = 'pending' | 'met' | 'breached' | 'cancelled'
export type SlaResolutionStatus = 'running' | 'paused' | 'met' | 'breached' | 'cancelled'

export interface SlaTarget {
  responseMinutes: number
  resolutionMinutes: number
}

export interface SlaPolicyConfig {
  id: string
  version: number
  calendar: '24x7'
  targets: Record<Priority, SlaTarget>
}

export const defaultSlaPolicyConfig: SlaPolicyConfig = {
  id: 'default',
  version: 1,
  calendar: '24x7',
  targets: {
    Critical: { responseMinutes: 30, resolutionMinutes: 4 * 60 },
    High: { responseMinutes: 60, resolutionMinutes: 8 * 60 },
    Medium: { responseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
    Low: { responseMinutes: 8 * 60, resolutionMinutes: 48 * 60 },
  },
}

const policyPriorities: Priority[] = ['Critical', 'High', 'Medium', 'Low']

export function parseSlaPolicyConfig(value: unknown): SlaPolicyConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.trim().length < 1 || record.id.trim().length > 80) return null
  if (typeof record.version !== 'number' || !Number.isInteger(record.version) || record.version < 1) return null
  if (record.calendar !== '24x7') return null
  if (!record.targets || typeof record.targets !== 'object' || Array.isArray(record.targets)) return null
  const rawTargets = record.targets as Record<string, unknown>
  const targets = {} as Record<Priority, SlaTarget>
  for (const priority of policyPriorities) {
    const target = rawTargets[priority]
    if (!target || typeof target !== 'object' || Array.isArray(target)) return null
    const values = target as Record<string, unknown>
    if (
      typeof values.responseMinutes !== 'number' ||
      !Number.isInteger(values.responseMinutes) ||
      values.responseMinutes < 1 ||
      values.responseMinutes > 525_600 ||
      typeof values.resolutionMinutes !== 'number' ||
      !Number.isInteger(values.resolutionMinutes) ||
      values.resolutionMinutes < 1 ||
      values.resolutionMinutes > 525_600
    )
      return null
    targets[priority] = { responseMinutes: values.responseMinutes, resolutionMinutes: values.resolutionMinutes }
  }
  return { id: record.id.trim(), version: record.version, calendar: '24x7', targets }
}

export interface SlaPolicy {
  id: string
  responseMinutes: number
  resolutionMinutes: number
  calendar: '24x7'
}

export const slaPolicies: Record<Priority, SlaPolicy> = {
  Critical: { id: 'default-critical-v1', responseMinutes: 30, resolutionMinutes: 4 * 60, calendar: '24x7' },
  High: { id: 'default-high-v1', responseMinutes: 60, resolutionMinutes: 8 * 60, calendar: '24x7' },
  Medium: { id: 'default-medium-v1', responseMinutes: 4 * 60, resolutionMinutes: 24 * 60, calendar: '24x7' },
  Low: { id: 'default-low-v1', responseMinutes: 8 * 60, resolutionMinutes: 48 * 60, calendar: '24x7' },
}

export function getSlaPolicy(priority: Priority): SlaPolicy {
  return slaPolicies[priority]
}

export function isSlaPauseStatus(status: string): status is SlaPauseReason {
  return status === 'Waiting for User' || status === 'Waiting for Vendor'
}
