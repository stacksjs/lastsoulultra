import { describe, expect, it } from 'bun:test'
import { confirmEntryPayment, entryFee } from '../resources/functions/entry-confirm'

describe('race entry fees', () => {
  it('preserves fractional prices and the currency minor unit', () => {
    expect(entryFee({ currency: 'EUR', amount: 15075 })).toBe('€150.75')
    expect(entryFee({ currency: 'EUR', amount: 15000 })).toBe('€150')
    expect(entryFee({ currency: 'JPY', amount: 150 })).toBe('JP¥150')
    expect(entryFee({ currency: 'KWD', amount: 150125 })).toBe('KWD\u00a0150.125')
    for (const amount of [NaN, Infinity, -100, 1.5]) expect(entryFee({ currency: 'EUR', amount })).toBe('')
  })
})


it('payment return waits for server proof and exposes failure and unavailable states', async () => {
  const statuses = ['pending', 'paid']
  expect(await confirmEntryPayment({ refresh: async () => statuses.shift()!, delay: async () => {} })).toMatchObject({ status: 'paid' })
  expect(await confirmEntryPayment({ refresh: async () => 'failed' })).toMatchObject({ status: 'failed' })
  const unavailable = await confirmEntryPayment({ refresh: async () => { throw new Error('offline') } })
  expect(unavailable.status).toBe('unavailable')
  expect(unavailable.message).toContain('before trying to pay again')
  expect(await confirmEntryPayment({ refresh: async () => 'pending', attempts: 1 })).toMatchObject({ status: 'pending' })
})

it('switching accounts abandons the old payment confirmation', async () => {
  let current = true
  const outcome = await confirmEntryPayment({
    isCurrent: () => current,
    refresh: async () => { current = false; return 'paid' },
  })
  expect(outcome).toEqual({ status: 'abandoned', message: '' })
})
