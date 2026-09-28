import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SlidingWindowRateLimiter } from './rate-limit.js'

describe('SlidingWindowRateLimiter', () => {
  it('bounds bursts and permits requests after the window expires', () => {
    let now = 1_000
    const limiter = new SlidingWindowRateLimiter(2, 1_000, () => now)
    assert.equal(limiter.allow('actor:route'), true)
    assert.equal(limiter.allow('actor:route'), true)
    assert.equal(limiter.allow('actor:route'), false)
    now = 2_001
    assert.equal(limiter.allow('actor:route'), true)
  })

  it('keeps independent keys isolated', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1_000, () => 1_000)
    assert.equal(limiter.allow('one'), true)
    assert.equal(limiter.allow('one'), false)
    assert.equal(limiter.allow('two'), true)
  })
})
