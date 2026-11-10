/**
 * Soul Races as lastsoulultra.com lists them.
 *
 * The race service answers with raw rows; this turns each one into exactly
 * what a card and a map pin print, so the template binds text and nothing
 * else. It is a pure module on purpose: the wording, the order and the map
 * projection are the parts that have to agree with the published site, and
 * they can be tested without a browser.
 */

export interface SoulRace {
  slug: string
  name: string
  host?: string
  country_code?: string
  city?: string
  lat?: number
  lng?: number
  date?: string | null
  status?: string
  qualifier_spots?: number
  registration_url?: string | null
  website_url?: string | null
  summary?: string
}

export interface SoulRaceFilters {
  region?: string
  status?: string
  qualifierOnly?: boolean
  query?: string
}

export interface SoulRaceRow {
  slug: string
  name: string
  date: string
  meta: string
  summary: string
  status: string
  statusLabel: string
  past: boolean
  /** "2 qualifier spots", or an empty string when the race carries none. */
  spots: string
  website: string
  /** The organiser's registration page, tagged so they can see where it came from. */
  enter: string
  /** Shown instead of the button when a race that is not over has no registration yet. */
  notOpen: boolean
  /** Position in the map overlay's 1000-wide viewBox. */
  x: number
  y: number
  pin: string
  label: string
}

const REGIONS: Record<string, string> = {
  'Europe': 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA VA XK',
  'North America': 'AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA PR SV TT US VC',
  'South America': 'AR BO BR CL CO EC GY PE PY SR UY VE',
  'Africa': 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
  'Asia': 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA RU SA SG SY TH TJ TL TM TR TW UZ VN YE',
  'Oceania': 'AU FJ NC NZ PF PG SB TO VU WS',
}
const REGION_OF = new Map(Object.entries(REGIONS).flatMap(([region, codes]) => codes.split(' ').map(code => [code, region] as const)))

const STATUSES: Record<string, string> = { open: 'Entry open', waitlist: 'Waitlist', full: 'Sold out', announced: 'Announced', past: 'Past edition' }

/** The continent a race is filed under, from its country code. */
export function soulRaceRegion(race: SoulRace): string {
  return REGION_OF.get(String(race.country_code || '').toUpperCase()) || ''
}

/** "Germany" for "DE"; the code itself where the runtime has no name for it. */
export function countryName(code: string | undefined): string {
  const value = String(code || '').toUpperCase()
  if (!value) return ''
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) || value }
  catch { return value }
}

/** "7 Nov 2026". Noon UTC, so no visitor's timezone moves a race to the day before. */
export function soulRaceDate(date: string | null | undefined): string {
  if (!date) return 'Date to be announced'
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 'Date to be announced'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed)
}

/** Only an http(s) address is ever printed as a link. */
function safeUrl(value: string | null | undefined): string {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  }
  catch { return '' }
}

function entryUrl(race: SoulRace): string {
  const safe = safeUrl(race.registration_url)
  if (!safe) return ''
  const url = new URL(safe)
  url.searchParams.set('utm_source', 'lastsoulultra')
  url.searchParams.set('utm_medium', 'soul-races')
  url.searchParams.set('utm_campaign', race.slug)
  return url.href
}

/* The map is the land mask's own projection (a compressed Mercator between
   82 N and 56 S), so a pin lands on the dot it belongs to. */
const project = (lng: number, lat: number): [number, number] => [642.5 + 3.746 * lng, 493.1 - 294.1 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * (Math.PI / 180)))]
const [LEFT, TOP] = project(-180, 82)
const [RIGHT, BOTTOM] = project(180, -56)
const MAP_HEIGHT = 1000 / ((RIGHT - LEFT) / (BOTTOM - TOP))

function pin(race: SoulRace): [number, number] {
  const [x, y] = project(Number(race.lng) || 0, Number(race.lat) || 0)
  return [(x - LEFT) / (RIGHT - LEFT) * 1000, (y - TOP) / (BOTTOM - TOP) * MAP_HEIGHT]
}

function matches(race: SoulRace, filters: SoulRaceFilters): boolean {
  if (filters.region && soulRaceRegion(race) !== filters.region) return false
  if (filters.status && race.status !== filters.status) return false
  if (filters.qualifierOnly && !(Number(race.qualifier_spots) > 0)) return false
  const query = String(filters.query || '').trim().toLowerCase()
  return !query || [race.name, race.city, countryName(race.country_code), race.host].join(' ').toLowerCase().includes(query)
}

/* Dated races first and soonest first, undated ones next, past editions last
   with the most recent on top. */
function order(a: SoulRace, b: SoulRace): number {
  const rank = (race: SoulRace) => race.status === 'past' ? 2 : race.date ? 0 : 1
  return rank(a) - rank(b)
    || (a.status === 'past' ? String(b.date).localeCompare(String(a.date)) : String(a.date).localeCompare(String(b.date)))
    || a.name.localeCompare(b.name)
}

/** The cards and pins for the races that pass the filters, in listing order. */
export function soulRaceRows(races: SoulRace[], filters: SoulRaceFilters = {}): SoulRaceRow[] {
  return races.filter(race => race && race.slug && matches(race, filters)).sort(order).map((race) => {
    const past = race.status === 'past'
    const spots = Number(race.qualifier_spots) || 0
    const date = soulRaceDate(race.date)
    const place = [race.city, countryName(race.country_code)].filter(Boolean).join(' · ')
    const enter = past ? '' : entryUrl(race)
    const [x, y] = pin(race)
    const status = String(race.status || 'announced')
    return {
      slug: race.slug,
      name: race.name,
      date,
      meta: [place, race.host ? `hosted by ${race.host}` : ''].filter(Boolean).join(' · '),
      summary: String(race.summary || ''),
      status,
      statusLabel: STATUSES[status] || status,
      past,
      spots: spots > 0 ? `${spots} qualifier ${spots === 1 ? 'spot' : 'spots'}` : '',
      website: safeUrl(race.website_url),
      enter,
      notOpen: !past && !enter,
      x,
      y,
      pin: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
      label: [race.name, race.city, date].filter(Boolean).join(', '),
    }
  })
}

/** The four numbers under the page heading. */
export function soulRaceCounts(races: SoulRace[]): { races: number, countries: number, open: number, qualifier: number } {
  return {
    races: races.length,
    countries: new Set(races.map(race => String(race.country_code || '').toUpperCase()).filter(Boolean)).size,
    open: races.filter(race => race.status === 'open').length,
    qualifier: races.filter(race => Number(race.qualifier_spots) > 0).length,
  }
}

/** "1 race", "3 races". */
export function soulRaceTotal(count: number): string {
  return `${count} ${count === 1 ? 'race' : 'races'}`
}
