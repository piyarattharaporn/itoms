import type { Priority } from './ticket-contracts.js'

export type SlaPauseReason = 'Waiting for User' | 'Waiting for Vendor'
export type SlaLifecycleState = 'running' | 'paused' | 'met' | 'cancelled'

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
