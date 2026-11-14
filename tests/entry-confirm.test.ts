import { describe, expect, it } from 'bun:test'
import { entryFee } from '../resources/functions/entry-confirm'

describe('race entry fees', () => {
  it('preserves fractional prices and the currency minor unit', () => {
    expect(entryFee({ currency: 'EUR', amount: 15075 })).toBe('€150.75')
    expect(entryFee({ currency: 'EUR', amount: 15000 })).toBe('€150')
    expect(entryFee({ currency: 'JPY', amount: 150 })).toBe('JP¥150')
    expect(entryFee({ currency: 'KWD', amount: 150125 })).toBe('KWD\u00a0150.125')
    for (const amount of [NaN, Infinity, -100, 1.5]) expect(entryFee({ currency: 'EUR', amount })).toBe('')
  })
})
