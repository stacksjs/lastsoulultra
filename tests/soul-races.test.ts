import { describe, expect, test } from 'bun:test'
import { soulRaceCounts, soulRaceRegion, soulRaceRows, soulRaceTotal } from '../resources/functions/soul-races'

const weser = { slug: 'weserbergland-backyard-ultra', name: 'Weserbergland Backyard Ultra', host: 'Tus Lütmarsen / TuS Ovenhausen', country_code: 'DE', city: 'Höxter / Lütmarsen', lat: 51.78316, lng: 9.34146, date: '2026-11-07', status: 'past', qualifier_spots: 0, registration_url: 'https://my.raceresult.com/377115/', website_url: 'https://weserberglandbackyardultra.com/', summary: 'Running Loops since 2020.' }
const open = { slug: 'ridge-loop', name: 'Ridge Loop', host: 'Ridge Runners', country_code: 'US', city: 'Bend', lat: 44.05, lng: -121.31, date: '2027-05-01', status: 'open', qualifier_spots: 2, registration_url: 'https://example.com/enter?ref=1', website_url: 'javascript:alert(1)', summary: '' }
const undated = { slug: 'no-date', name: 'A Race', country_code: 'AU', city: 'Perth', status: 'announced', date: null }

describe('Soul Races as the published site lists them', () => {
  test('a past edition reads as lastsoulultra.com prints it', () => {
    const [row] = soulRaceRows([weser])
    expect(row.date).toBe('7 Nov 2026')
    expect(row.meta).toBe('Höxter / Lütmarsen · Germany · hosted by Tus Lütmarsen / TuS Ovenhausen')
    expect(row.statusLabel).toBe('Past edition')
    expect(row.website).toBe('https://weserberglandbackyardultra.com/')
    // A finished race has nothing to enter, whatever link it still carries.
    expect(row.enter).toBe('')
    expect(row.notOpen).toBe(false)
  })

  test('an open race links to the organiser with its source, and never prints an unsafe address', () => {
    const [row] = soulRaceRows([open])
    expect(row.enter).toBe('https://example.com/enter?ref=1&utm_source=lastsoulultra&utm_medium=soul-races&utm_campaign=ridge-loop')
    expect(row.spots).toBe('2 qualifier spots')
    expect(row.website).toBe('')
  })

  test('a race with no registration yet says so', () => {
    const [row] = soulRaceRows([undated])
    expect(row.date).toBe('Date to be announced')
    expect(row.notOpen).toBe(true)
  })

  test('dated races come first, undated next, past editions last', () => {
    expect(soulRaceRows([weser, undated, open]).map(row => row.slug)).toEqual(['ridge-loop', 'no-date', 'weserbergland-backyard-ultra'])
  })

  test('filters match the region, the status, qualifier spots and the country by name', () => {
    const races = [weser, open, undated]
    expect(soulRaceRegion(weser)).toBe('Europe')
    expect(soulRaceRows(races, { region: 'Oceania' }).map(row => row.slug)).toEqual(['no-date'])
    expect(soulRaceRows(races, { status: 'past' })).toHaveLength(1)
    expect(soulRaceRows(races, { qualifierOnly: true }).map(row => row.slug)).toEqual(['ridge-loop'])
    expect(soulRaceRows(races, { query: 'germany' }).map(row => row.slug)).toEqual(['weserbergland-backyard-ultra'])
  })

  test('a pin lands inside the map, in the right half of the world', () => {
    const [row] = soulRaceRows([weser])
    expect(row.x).toBeGreaterThan(500)
    expect(row.x).toBeLessThan(560)
    expect(row.y).toBeGreaterThan(120)
    expect(row.y).toBeLessThan(200)
  })

  test('the counts and the total read as the page prints them', () => {
    expect(soulRaceCounts([weser, open, undated])).toEqual({ races: 3, countries: 3, open: 1, qualifier: 1 })
    expect(soulRaceTotal(1)).toBe('1 race')
    expect(soulRaceTotal(0)).toBe('0 races')
  })
})
