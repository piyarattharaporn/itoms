import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { createSlaFields, transitionSla } from './sla.js'

const start = Timestamp.fromMillis(Date.parse('2026-09-28T00:00:00.000Z'))

describe('SLA policy and lifecycle', () => {
  it('uses a valid Property policy override and snapshots its identity', () => {
    const fields = createSlaFields('High', start, {
      slaPolicy: {
        id: 'property-standard',
        version: 2,
        calendar: '24x7',
        targets: {
          Critical: { responseMinutes: 30, resolutionMinutes: 240 },
          High: { responseMinutes: 15, resolutionMinutes: 90 },
          Medium: { responseMinutes: 240, resolutionMinutes: 1440 },
          Low: { responseMinutes: 480, resolutionMinutes: 2880 },
        },
      },
    })

    assert.equal(fields.slaPolicyId, 'property-standard')
    assert.equal(fields.slaPolicyVersion, 'property-standard-v2-high')
    assert.equal(fields.slaResponseTargetMinutes, 15)
    assert.equal(fields.slaResolutionTargetMinutes, 90)
    assert.equal(fields.slaResponseStatus, 'pending')
    assert.equal(fields.slaResolutionStatus, 'running')
  })

  it('pauses only Resolution SLA and preserves the Response deadline', () => {
    const created = createSlaFields('Medium', start)
    const acknowledged = transitionSla(
      { priority: 'Medium', ...created },
      'In Progress',
      Timestamp.fromMillis(start.toMillis() + 5 * 60_000),
    )
    const pausedAt = Timestamp.fromMillis(start.toMillis() + 10 * 60_000)
    const paused = transitionSla(
      { priority: 'Medium', status: 'In Progress', ...acknowledged },
      'Waiting for User',
      pausedAt,
    )
    const resumedAt = Timestamp.fromMillis(start.toMillis() + 70 * 60_000)
    const resumed = transitionSla(
      { priority: 'Medium', status: 'Waiting for User', ...paused },
      'In Progress',
      resumedAt,
    )

    assert.equal(paused.slaResponseStatus, 'met')
    assert.equal(paused.slaResolutionStatus, 'paused')
    assert.equal(paused.slaResponseDueAt.toMillis(), created.slaResponseDueAt.toMillis())
    assert.equal(paused.slaResolutionDueAt.toMillis(), created.slaResolutionDueAt.toMillis())
    assert.equal(resumed.slaResponseDueAt.toMillis(), created.slaResponseDueAt.toMillis())
    assert.equal(resumed.slaResolutionDueAt.toMillis(), created.slaResolutionDueAt.toMillis() + 60 * 60_000)
    assert.equal(resumed.slaPausedMinutes, 60)
    assert.equal(resumed.slaResolutionStatus, 'running')
  })

  it('records response and resolution breaches independently', () => {
    const created = createSlaFields('Critical', start)
    const acknowledged = transitionSla(
      { priority: 'Critical', ...created },
      'In Progress',
      Timestamp.fromMillis(start.toMillis() + 31 * 60_000),
    )
    const completed = transitionSla(
      { priority: 'Critical', status: 'In Progress', ...acknowledged },
      'Completed',
      Timestamp.fromMillis(start.toMillis() + 4 * 60 * 60_000 + 1 * 60_000),
    )

    assert.equal(acknowledged.slaResponseStatus, 'breached')
    assert.equal(acknowledged.slaResolutionStatus, 'running')
    assert.equal(completed.slaResponseStatus, 'breached')
    assert.equal(completed.slaResolutionStatus, 'breached')
    assert.equal(completed.slaResponseBreached, true)
    assert.equal(completed.slaResolutionBreached, true)
  })
})
