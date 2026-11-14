/**
 * Demo storefront for the LSU installation: six training plans shown under
 * Pawel's own coach profile, so the store reads like a real ultra coach's
 * shelf and he has drafts he can edit, keep or delete.
 *
 * Every one says what it is: a demo draft, not written or reviewed by him, and
 * not medical advice. They are plans rather than courses or video series
 * because those need real videos, which only he can record.
 */

/** The installation admin the drafts are shown under (enterprise/deployment.json). */
export const CATALOG_COACH_EMAIL = 'pawel@hq.training'
export const CATALOG_COACH_NAME = 'Pawel Dregan'
export const CATALOG_NOTE = `Demo draft by ${CATALOG_COACH_NAME}, not yet reviewed by him. Sample training content, not medical advice.`

/** Keep a catalog storefront free of the older complimentary demo packages. */
export function reviewStorefrontOffers<T extends { product_id: number }>(existing: T[] | null, demos: T[], catalogConfigured: boolean): T[] {
  const demoIds = new Set(demos.map(offer => Number(offer.product_id)))
  const authored = (existing || []).filter(offer => !demoIds.has(Number(offer.product_id)))
  // A first installation still needs an offer until InstallationCatalogSeeder runs.
  return catalogConfigured && authored.length ? authored : [...demos, ...authored]
}

type Zone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'
interface Step { name: string, duration_minutes: number, zone: Zone, intensity: string, notes: string }
interface Exercise { title: string, notes: string, sets: Array<Record<string, number>> }
interface Workout {
  day: number
  title: string
  sport: 'Run' | 'Strength'
  description: string
  duration_minutes: number
  distance_km: number
  tss: number
  steps: Step[]
  strength?: { blocks: Array<{ kind: string, title: string, exercises: Exercise[] }> }
}
interface Week { week: number, focus: string, planned_hours: number, workouts: Workout[] }
export interface CatalogPlan { summary: string, phases: Array<{ name: string, start_week: number, end_week: number, focus: string }>, weeks: Week[] }
export interface CatalogItem { slug: string, name: string, blurb: string, price_cents: number, sport: 'Run' | 'Strength' | 'Multisport', sports: string[], tax_code?: string, plan: () => CatalogPlan }

const step = (name: string, duration_minutes: number, zone: Zone, intensity: string, notes = ''): Step => ({ name, duration_minutes, zone, intensity, notes })
/** Easy running pace is about 6:30 per km for the plans' distances. */
const kmFor = (minutes: number, pace = 6.5) => Math.round(minutes / pace * 10) / 10

function easy(day: number, minutes: number, title = 'Easy run', notes = 'Conversational effort. Walk any hill that pushes you out of zone 2.'): Workout {
  return { day, title, sport: 'Run', description: notes, duration_minutes: minutes, distance_km: kmFor(minutes), tss: Math.round(minutes * 0.7), steps: [step('Warm up', 5, 'Z1', 'Easy'), step(title, minutes - 10, 'Z2', 'Easy', notes), step('Cool down', 5, 'Z1', 'Easy')] }
}

function long(day: number, km: number, title: string, notes: string, pace = 7.2): Workout {
  const minutes = Math.round(km * pace)
  return { day, title, sport: 'Run', description: notes, duration_minutes: minutes, distance_km: km, tss: Math.round(minutes * 0.75), steps: [step('Settle in', 10, 'Z1', 'Easy'), step(title, minutes - 15, 'Z2', 'Steady', notes), step('Walk it out', 5, 'Z1', 'Easy')] }
}

function repeats(day: number, title: string, reps: number, work: number, rest: number, zone: Zone, notes: string): Workout {
  const minutes = 15 + reps * (work + rest) + 10
  return { day, title, sport: 'Run', description: notes, duration_minutes: minutes, distance_km: kmFor(minutes, 6), tss: Math.round(minutes * 1.05), steps: [step('Warm up', 15, 'Z1', 'Easy', 'Include 4 relaxed strides.'), ...Array.from({ length: reps }, (_, index) => [step(`Rep ${index + 1}`, work, zone, 'Hard', notes), step('Recover', rest, 'Z1', 'Easy', 'Jog or walk back down.')]).flat(), step('Cool down', 10, 'Z1', 'Easy')] }
}

function exercise(title: string, set: Record<string, number>, count: number, notes: string): Exercise {
  return { title, notes, sets: Array.from({ length: count }, () => ({ ...set })) }
}

/** Two alternating sessions that build from control to load. */
function strength(day: number, second: boolean, week: number): Workout {
  const sets = week <= 2 ? 2 : 3
  const reps = week <= 2 ? 8 : week <= 4 ? 10 : 12
  const blocks = second
    ? [
        { kind: 'warmup', title: 'Movement preparation', exercises: [exercise('High Knees', { seconds: 30 }, 2, 'Light and quick.')] },
        { kind: 'circuit', title: 'Downhill durability', exercises: [exercise('Step Down (eccentric)', { reps_per_side: reps }, sets, 'Lower for a slow three count: this is what quads need for long descents.'), exercise('Heel Taps', { reps }, sets, 'Keep the pelvis level.'), exercise('Y-T-W Raise', { reps }, sets, 'Posture for the last hours of a race.')] },
        { kind: 'single', title: 'Finish and recover', exercises: [exercise('Foam Roll Quads', { seconds: 60 }, 1, 'Slow passes, no pain.')] },
      ]
    : [
        { kind: 'warmup', title: 'Movement preparation', exercises: [exercise('A-Skip', { seconds: 30 }, 2, 'Tall posture, quiet feet.')] },
        { kind: 'circuit', title: 'Single-leg strength', exercises: [exercise('Kettlebell Goblet Reverse Lunge', { reps_per_side: reps }, sets, 'Choose a load you could lift for three more reps.'), exercise('Glute Bridge March', { reps_per_side: reps }, sets, 'Hips stay high and still.'), exercise('Arnold Press', { reps }, sets, 'For poles and a strong upper body late in a race.')] },
        { kind: 'single', title: 'Finish and recover', exercises: [exercise('Couch Stretch', { seconds: 45 }, 2, 'Each side.')] },
      ]
  return { day, title: second ? 'Strength B: downhill durability' : 'Strength A: single-leg strength', sport: 'Strength', description: 'Strength for ultrarunning: control first, then load. Stop any exercise that causes pain.', duration_minutes: 35, distance_km: 0, tss: 20, steps: [], strength: { blocks } }
}

function week(number: number, focus: string, workouts: Workout[]): Week {
  const sorted = workouts.sort((a, b) => a.day - b.day)
  return { week: number, focus, planned_hours: Math.round(sorted.reduce((total, workout) => total + workout.duration_minutes, 0) / 6) / 10, workouts: sorted }
}

/** 16 weeks to a first 50K: long run 14 to 32 km, a lighter week every fourth, a two-week taper. */
function firstUltra(): CatalogPlan {
  const longs = [14, 16, 18, 14, 20, 22, 24, 18, 26, 28, 30, 22, 32, 26, 18]
  const weeks = longs.map((km, index) => {
    const number = index + 1
    const light = number % 4 === 0 || number >= 14
    const focus = number <= 4 ? 'Base' : number <= 8 ? 'Build' : number <= 13 ? 'Specific' : 'Taper'
    return week(number, focus, [
      easy(2, light ? 40 : 50),
      number <= 4 ? easy(4, 45, 'Easy run with strides', 'Finish with 6 x 20 seconds relaxed and fast.') : repeats(4, light ? 'Short hill repeats' : 'Hill repeats', light ? 5 : 6 + Math.min(4, Math.floor(number / 3)), 2, 2, 'Z4', 'Strong uphill, relaxed form. Walk down.'),
      easy(5, light ? 30 : 40, 'Recovery run', 'Very easy. Skip it if your legs are heavy.'),
      long(6, km, light ? 'Long run (lighter week)' : 'Long run', number >= 9 ? 'Practise race fuelling: eat every 30 to 40 minutes from the start.' : 'Time on feet. Walk the climbs early so you can run the end.'),
      easy(7, light ? 30 : 45, 'Easy trail run or hike', 'On tired legs, as easy as you like.'),
    ])
  })
  weeks.push(week(16, 'Race week', [
    easy(2, 35, 'Easy run with strides', 'Four relaxed strides to stay sharp.'),
    easy(4, 25, 'Shakeout', 'Short and easy. Check your race kit.'),
    long(6, 50, 'Race day: 50K', 'Start slower than feels right. Eat early, drink to thirst, walk the climbs.', 8.4),
  ]))
  return { summary: 'A first 50K in 16 weeks for runners who can already run 10 km comfortably. Four to five runs a week, one quality session, and a long run that grows to 32 km.', phases: [{ name: 'Base', start_week: 1, end_week: 4, focus: 'Routine and easy volume' }, { name: 'Build', start_week: 5, end_week: 8, focus: 'Hills and longer long runs' }, { name: 'Specific', start_week: 9, end_week: 13, focus: 'Race fuelling and terrain' }, { name: 'Taper', start_week: 14, end_week: 16, focus: 'Fresh legs for race day' }], weeks }
}

/** Eight weeks of climbing: hill repeats, power hiking and a long mountain day that grows. */
function vertBlock(): CatalogPlan {
  const climb = [800, 1000, 1200, 900, 1400, 1600, 1800, 1000]
  const weeks = climb.map((metres, index) => {
    const number = index + 1
    const light = number === 4 || number === 8
    return week(number, light ? 'Absorb' : 'Climb', [
      repeats(2, 'Uphill repeats', light ? 5 : 6 + Math.floor(number / 2), 3, 3, 'Z4', 'Steep enough to make running hard. Run tall; hike if form breaks.'),
      strength(3, false, number),
      easy(4, light ? 40 : 55, 'Power hike intervals', 'On a long climb: alternate 5 minutes of hard hiking with 5 minutes of running.'),
      long(6, Math.round(metres / 70), 'Long mountain day', `About ${metres} m of climbing. Practise poles and steady descending.`, 9),
      easy(7, light ? 35 : 50, 'Easy recovery run', 'Flat and easy.'),
    ])
  })
  return { summary: 'An eight-week climbing block for mountain ultras: steep repeats, power hiking and a long mountain day building to about 1800 m of climbing, with strength for the descents.', phases: [{ name: 'Climb', start_week: 1, end_week: 3, focus: 'Steep repeats and hiking' }, { name: 'Absorb', start_week: 4, end_week: 4, focus: 'Lighter week' }, { name: 'Climb', start_week: 5, end_week: 7, focus: 'Bigger mountain days' }, { name: 'Absorb', start_week: 8, end_week: 8, focus: 'Lighter week before racing or the next block' }], weeks }
}

/** Six weeks of weekend doubles: tired-legs running without one huge long run. */
function backToBack(): CatalogPlan {
  const saturday = [20, 24, 28, 22, 30, 20]
  const sunday = [12, 14, 16, 12, 18, 10]
  const weeks = saturday.map((km, index) => {
    const number = index + 1
    const light = number === 4 || number === 6
    return week(number, light ? 'Lighter weekend' : 'Back-to-back', [
      easy(2, 45),
      repeats(4, 'Steady tempo blocks', light ? 2 : 3, 10, 3, 'Z3', 'Comfortably hard: you can speak in short sentences.'),
      long(6, km, 'Saturday long run', 'Fuel the whole way. This run sets up tomorrow.'),
      long(7, sunday[index]!, 'Sunday run on tired legs', 'Start very easy. The point is running well when tired, not speed.'),
    ])
  })
  return { summary: 'Six weeks of back-to-back weekend runs that teach your legs to run tired, for runners already comfortable with a 20 km long run.', phases: [{ name: 'Back-to-back', start_week: 1, end_week: 6, focus: 'Saturday long, Sunday medium on tired legs' }], weeks }
}

/** Twelve sessions over six weeks: two a week alongside your running. */
function strengthBlock(): CatalogPlan {
  const weeks = Array.from({ length: 6 }, (_, index) => week(index + 1, index < 2 ? 'Control' : index < 4 ? 'Strength' : 'Load', [strength(1, false, index + 1), strength(4, true, index + 1)]))
  return { summary: 'Twelve strength sessions over six weeks for ultra runners: single-leg strength, slow eccentric work for descents and posture for the late miles. Two sessions a week, about 35 minutes each, next to your usual running.', phases: [{ name: 'Control', start_week: 1, end_week: 2, focus: 'Learn the movements' }, { name: 'Strength', start_week: 3, end_week: 4, focus: 'More sets' }, { name: 'Load', start_week: 5, end_week: 6, focus: 'Heavier, still controlled' }], weeks }
}

/** Twenty-four weeks to 100K or 100 miles: base, build, specific with weekend doubles, taper. */
function hundredBuild(): CatalogPlan {
  const weeks: Week[] = []
  for (let number = 1; number <= 23; number++) {
    const light = number % 4 === 0 || number >= 22
    const phase = number <= 8 ? 'Base' : number <= 16 ? 'Build' : number <= 21 ? 'Specific' : 'Taper'
    const longKm = light ? 20 : Math.min(45, 18 + number * 1.5)
    const workouts = [
      easy(2, light ? 45 : 60),
      phase === 'Base' ? strength(3, number % 2 === 0, Math.min(6, Math.ceil(number / 2))) : repeats(3, 'Uphill repeats', light ? 5 : 8, 3, 3, 'Z4', 'Strong climbing, relaxed descending.'),
      easy(4, light ? 40 : 55, 'Steady run', 'Upper zone 2. Practise eating on the move.'),
      long(6, Math.round(longKm), 'Long run', phase === 'Specific' ? 'Race kit, race food, race terrain if you can.' : 'Time on feet. Walk early climbs.'),
    ]
    if (phase === 'Specific' && !light) workouts.push(long(7, Math.round(longKm * 0.55), 'Back-to-back run', 'On tired legs, slow and steady.'))
    else workouts.push(easy(7, light ? 30 : 45, 'Easy run or hike', 'Very easy.'))
    weeks.push(week(number, phase, workouts))
  }
  weeks.push(week(24, 'Race week', [easy(2, 35, 'Easy run with strides'), easy(4, 25, 'Shakeout', 'Kit check, drop bags, crew plan.'), long(6, 100, 'Race day: 100K or 100 miles', 'Planned here as 12 hours for 100 km; a 100-mile race runs longer. Your pace on day one is the pace you can keep at night. Eat from the first hour.', 7.2)]))
  return { summary: 'A 24-week build to 100 km or 100 miles for runners who have finished a 50K: a long base, climbing in the build, weekend doubles in the specific block and a three-week taper.', phases: [{ name: 'Base', start_week: 1, end_week: 8, focus: 'Volume and strength' }, { name: 'Build', start_week: 9, end_week: 16, focus: 'Climbing and longer runs' }, { name: 'Specific', start_week: 17, end_week: 21, focus: 'Back-to-backs, race fuelling and kit' }, { name: 'Taper', start_week: 22, end_week: 24, focus: 'Arrive fresh' }], weeks }
}

/** Two weeks into any ultra: a taper with a fuelling rehearsal, then race week. */
function raceWeek(): CatalogPlan {
  return { summary: 'The last two weeks before an ultra: a lighter week with a full fuelling rehearsal, then race week with short shakeouts, carbohydrate loading and a race-day plan.', phases: [{ name: 'Taper', start_week: 1, end_week: 2, focus: 'Fresh legs and a practised fuelling plan' }], weeks: [
    week(1, 'Taper', [
      easy(2, 45, 'Easy run with strides', 'Four strides at the end.'),
      repeats(4, 'Race-pace reminder', 3, 8, 3, 'Z3', 'At the effort you plan to race. Smooth, not hard.'),
      long(6, 18, 'Fuelling rehearsal', 'Eat and drink exactly what you will on race day, on the same schedule: about 60 to 90 g of carbohydrate an hour.'),
      easy(7, 35, 'Easy run', 'Very easy.'),
    ]),
    week(2, 'Race week', [
      easy(2, 30, 'Shakeout with strides', 'Start carbohydrate loading from today: more rice, bread, pasta and potatoes, less fibre.'),
      easy(4, 20, 'Short shakeout', 'Lay out race kit and food. Sleep is the best preparation now.'),
      long(6, 50, 'Race day', 'Eat in the first 30 minutes, then every 30 to 40. Drink to thirst. Slow down early so you can keep moving late.', 8.4),
    ]),
  ] }
}

export const CATALOG: CatalogItem[] = [
  { slug: 'lsu-pawel-first-ultra-50k', name: 'First Ultra: 50K in 16 weeks', blurb: 'Your first 50K, from 10 km running to the finish line.', price_cents: 7900, sport: 'Run', sports: ['Run'], plan: firstUltra },
  { slug: 'lsu-pawel-mountain-vert-block', name: 'Mountain Ultra Vert Block', blurb: 'Eight weeks of climbing for mountain ultras.', price_cents: 4900, sport: 'Multisport', sports: ['Run', 'Strength'], plan: vertBlock },
  { slug: 'lsu-pawel-back-to-back-weekends', name: 'Back-to-Back Long Run Weekends', blurb: 'Six weeks of weekend doubles: learn to run on tired legs.', price_cents: 3900, sport: 'Run', sports: ['Run'], plan: backToBack },
  { slug: 'lsu-pawel-strength-for-ultrarunners', name: 'Strength for Ultra Runners', tax_code: 'txcd_10103000', blurb: 'Twelve strength sessions for climbs, descents and the late miles.', price_cents: 2900, sport: 'Strength', sports: ['Strength'], plan: strengthBlock },
  { slug: 'lsu-pawel-100k-100-mile-build', name: '100K / 100 Mile Build', blurb: 'Twenty-four weeks from 50K finisher to 100 km or 100 miles.', price_cents: 12900, sport: 'Multisport', sports: ['Run', 'Strength'], plan: hundredBuild },
  { slug: 'lsu-pawel-race-week-fuelling', name: 'Race Week and Fuelling', blurb: 'The last two weeks before any ultra, and how to eat for it.', price_cents: 0, sport: 'Run', sports: ['Run'], plan: raceWeek },
]

/** What the store shows: the blurb, the plan's own summary, and the note that says what this is. */
export function catalogDescription(item: CatalogItem): string {
  return `${item.blurb} ${item.plan().summary}\n\n${CATALOG_NOTE}`
}
