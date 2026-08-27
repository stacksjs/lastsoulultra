/**
 * The FAQ, in the organiser's own words.
 *
 * Grouped the way lastsoulultra.com groups it - the race, the athlete's crew,
 * spectators - because the answers genuinely address different people. A
 * prospective entrant and somebody hoping to come and watch want different
 * halves of this page, and a single ungrouped list makes both of them read all
 * of it.
 */

export interface Question {
  q: string
  /** Paragraphs, so a long answer keeps its breaks. */
  a: string[]
}

export interface FaqGroup {
  slug: string
  title: string
  blurb: string
  questions: Question[]
}

export const faq: FaqGroup[] = [
  {
    slug: 'the-race',
    title: 'the race',
    blurb: 'Format, timings and what is provided on site.',
    questions: [
      {
        q: 'How does the Last Soul Ultra work?',
        a: [
          'The Last Soul Ultra follows the backyard ultra format. Every hour, all runners start together on a 6.7 km loop. Anyone who does not finish the loop in time and return to the starting corral before the next hour is eliminated.',
          'The race continues until only one runner remains. That athlete must then complete one final solo loop to be officially declared the winner.',
        ],
      },
      {
        q: 'When does the race start?',
        a: ['It kicks off Friday, 14 August 2026.'],
      },
      {
        q: 'Is there a time limit or a maximum race duration?',
        a: [
          'No. There is no set end time. The race goes on until only one person is able to complete a loop.',
          'This unpredictability is exactly what makes the format so unique and challenging.',
        ],
      },
      {
        q: 'Is there electricity, water or food?',
        a: [
          'There is no electrical hookup. Water is provided in containers for each athlete.',
          'Full catering is not provided: every participant must manage their own nutrition.',
          'There is an aid station at the base camp stocked throughout the event, but it is intended only as a supplement and does not replace self-sufficiency.',
        ],
      },
      {
        q: 'How is the base camp organised?',
        a: [
          'Each participant is allocated a 3x3 metre space at the base camp, marked in advance and assigned on a first come, first served basis.',
          'As runners drop out during the race, remaining camps may be moved closer to the starting line.',
        ],
      },
      {
        q: 'What mandatory gear is required?',
        a: ['Each participant must wear a working headlamp when running in twilight or darkness. Participation without this mandatory gear is not allowed.'],
      },
      {
        q: 'What are the participation requirements?',
        a: ['Before the start, every athlete must sign a waiver. This document, including all terms and conditions, will be made available ahead of time.'],
      },
      {
        q: 'Who is participating?',
        a: ['The starting field consists of international ultrarunners, athletes, well-known sports personalities, content creators and selected lottery participants.'],
      },
      {
        q: 'Why is the location kept secret?',
        a: ['The exact location is not disclosed in order to guarantee the safety and smooth running of the event.'],
      },
    ],
  },
  {
    slug: 'crew',
    title: 'athlete crew',
    blurb: 'What a crew may do, and the two things that end an athlete’s race.',
    questions: [
      {
        q: 'How much support can an athlete receive?',
        a: [
          'In the base camp, crew members can fully assist their athlete: with setup, nutrition, and preparation for the next loop.',
          'Once the athlete enters the course, any kind of support is strictly prohibited. Even handing over food or gear during a loop will result in the runner’s immediate disqualification.',
        ],
      },
      {
        q: 'Can crew members enter the track?',
        a: ['No. Crew members are not allowed on the track. If this rule is broken, the corresponding athlete will be automatically disqualified.'],
      },
      {
        q: 'How many crew members are allowed?',
        a: ['Each runner may have up to three crew members. Having a crew is optional, not mandatory.'],
      },
    ],
  },
  {
    slug: 'watching',
    title: 'following the race',
    blurb: 'The race is closed to the public and open on every screen.',
    questions: [
      {
        q: 'Can people watch the event in person?',
        a: ['No, on-site spectators are not allowed. This ensures safety and smooth operations during the race.'],
      },
      {
        q: 'Will the race be streamed live?',
        a: [
          'Yes. There will be a 24/7 livestream broadcasting the race from start to finish.',
          'Updates, stories, and behind-the-scenes content will be shared regularly on Instagram.',
        ],
      },
      {
        q: 'Where can I follow the race?',
        a: [
          'All highlights, updates and important information are shared on the official Instagram channel @lastsoulultra, as well as on the channels of Kim Gottwald and rappid.',
          'The race is streamed live on YouTube, with selected highlights and additional content available after the event.',
        ],
      },
    ],
  },
]

export function groupBySlug(slug: string): FaqGroup | undefined {
  return faq.find(group => group.slug === slug)
}

export function questionCount(): number {
  return faq.reduce((total, group) => total + group.questions.length, 0)
}
