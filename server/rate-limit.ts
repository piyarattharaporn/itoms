type Clock = () => number

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
    private readonly clock: Clock = () => Date.now(),
  ) {}

  allow(key: string) {
    const cutoff = this.clock() - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff)
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(this.clock())
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) {
      for (const [entryKey, timestamps] of this.hits) {
        if (timestamps.every((timestamp) => timestamp <= cutoff)) this.hits.delete(entryKey)
      }
    }
    return true
  }

  clear() {
    this.hits.clear()
  }
}
