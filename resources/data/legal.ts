/**
 * The legal pages, verbatim.
 *
 * German, and left in German: these are the organiser's binding wording and a
 * redesign restyles a policy, it does not translate or rewrite one. A
 * translation would read as authoritative while carrying none of the legal
 * weight, which is worse than asking a reader to translate it themselves.
 *
 * Each page is a list of blocks so the template can set headings and
 * paragraphs properly instead of dumping vendor HTML into the page.
 */

export interface LegalBlock {
  kind: 'heading' | 'text'
  value: string
}

export interface LegalPage {
  slug: string
  title: string
  /** English one-liner, so the nav and the page header stay readable. */
  blurb: string
  /** The language the body is actually in, for the `lang` attribute. */
  lang: 'de' | 'en'
  blocks: LegalBlock[]
}

export const legalPages: LegalPage[] = [
  {
    slug: 'imprint',
    title: 'imprint',
    blurb: 'Who runs the race, and where they are registered.',
    lang: 'en',
    blocks: [
      { kind: 'heading', value: 'Legal Notice' },
      { kind: 'text', value: 'Last Soul GmbH\nEhrenfeldstr. 14\n44789 Bochum\nGermany' },
      { kind: 'heading', value: 'Represented by the Managing Director' },
      { kind: 'text', value: 'Kim Gottwald' },
      { kind: 'heading', value: 'Contact' },
      { kind: 'text', value: 'Email: mail@lastsoulultra.com' },
      { kind: 'heading', value: 'Commercial Register' },
      { kind: 'text', value: 'Registered with the Commercial Register of the Local Court (Amtsgericht) Bochum\nCommercial Register Number: HRB 23048' },
      { kind: 'heading', value: 'Tax Number' },
      { kind: 'text', value: '1130 413 50751' },
    ],
  },
  {
    slug: 'privacy',
    title: 'privacy policy',
    blurb: 'Datenschutzerklärung. Stand: Januar 2026.',
    lang: 'de',
    blocks: [
      { kind: 'heading', value: '1. Verantwortlicher' },
      { kind: 'text', value: 'Last Soul GmbH\nDeutschland\nE-Mail: mail@lastsoulultra.com\nGeschäftsführer: Kim Gottwald' },
      { kind: 'heading', value: '2. Allgemeine Hinweise' },
      { kind: 'text', value: 'Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Wir verarbeiten Ihre Daten ausschließlich im Rahmen der geltenden Datenschutzgesetze, insbesondere der DSGVO und des BDSG.' },
      { kind: 'heading', value: '3. Hosting' },
      { kind: 'text', value: 'Unsere Website wird bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland, auf Servern in Deutschland gehostet. Hetzner verarbeitet personenbezogene Daten ausschließlich in unserem Auftrag im Rahmen einer Auftragsverarbeitung gemäß Art. 28 DSGVO.' },
      { kind: 'heading', value: '4. Server-Logfiles' },
      { kind: 'text', value: 'Beim Besuch unserer Website werden automatisch Daten wie IP-Adresse, Browsertyp, Betriebssystem, Referrer-URL sowie Datum und Uhrzeit des Zugriffs verarbeitet. Die Verarbeitung erfolgt zur Sicherstellung des technischen Betriebs und der Sicherheit auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.' },
      { kind: 'heading', value: '5. Cookies und Analyse' },
      { kind: 'text', value: 'Diese Website nutzt keine Analyse-, Tracking- oder Werbedienste. Gesetzt wird ausschließlich ein technisch notwendiges Cookie (X-CSRF-Token) zum Schutz von Formularen vor Cross-Site-Request-Forgery; es läuft nach zwei Stunden ab und dient keiner Analyse. Da keine einwilligungspflichtigen Cookies zum Einsatz kommen, ist kein Cookie-Banner erforderlich. Schriften und Bilder werden von unserem eigenen Server ausgeliefert, sodass beim Aufruf der Seiten keine Inhalte Dritter nachgeladen werden und Ihre IP-Adresse nicht an Dritte übertragen wird.' },
      { kind: 'heading', value: '6. Newsletter' },
      { kind: 'text', value: 'Wenn Sie unseren Newsletter abonnieren, speichern wir Ihre E-Mail-Adresse sowie den Zeitpunkt und die Herkunft der Anmeldung. Die Anmeldung erfolgt im Double-Opt-in-Verfahren: Sie erhalten zunächst eine E-Mail mit einem Bestätigungslink, und erst mit dessen Aufruf wird die Anmeldung wirksam. Bis dahin wird die Adresse nicht für den Versand verwendet. Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Sie können diese jederzeit widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an uns.' },
      { kind: 'heading', value: '7. Event-Anmeldung' },
      { kind: 'text', value: 'Bei der Anmeldung zu unseren Events verarbeiten wir die von Ihnen angegebenen Daten zur Organisation und Durchführung der Veranstaltung.' },
      { kind: 'heading', value: '8. Ihre Rechte' },
      { kind: 'text', value: 'Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten.' },
      { kind: 'heading', value: '9. Beschwerderecht' },
      { kind: 'text', value: 'Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.' },
      { kind: 'heading', value: '10. Stand der Datenschutzerklärung' },
      { kind: 'text', value: 'Stand: Januar 2026' },
    ],
  },
  {
    slug: 'terms',
    title: 'terms & conditions',
    blurb: 'Haftungsausschluss. Must be signed before the start.',
    lang: 'de',
    blocks: [
      { kind: 'heading', value: 'Disclaimer' },
      { kind: 'text', value: 'RAD RACE GmbH, Fischmarkt 9, 22767 Hamburg im Auftrag des Veranstalters Last Soul GmbH, Alte Jakobsstraße 85-86, 10179 Berlin' },
      { kind: 'text', value: 'Mit dem Betreten des Veranstaltungsgeländes und der Teilnahme an der Veranstaltung LAST SOUL ULTRA erkennen alle Teilnehmer und Besucher den folgenden Haftungsausschluss:' },
      { kind: 'text', value: 'Die Veranstaltung Last Soul Ultra findet auf öffentlichen Flächen statt, darunter Straßen und Wege, die für den übrigen Verkehr zugänglich sind. Alle Teilnehmer sind verpflichtet, sich strikt an die geltenden Straßenverkehrsregeln (StVO oder gleichwertige lokale Vorschriften) zu halten. Dazu gehören unter anderem die Beachtung von Verkehrszeichen, Ampeln und Vorfahrtsregeln sowie das Treffen geeigneter Vorsichtsmaßnahmen zur Gewährleistung der eigenen Sicherheit und der Sicherheit anderer. Die Teilnehmer werden hiermit darauf hingewiesen, dass die Nichtbeachtung dieser Vorschriften das Risiko schwerer Verletzungen oder tödlicher Unfälle erheblich erhöht.' },
      { kind: 'text', value: 'Die Streckenabschnitte wurden größtenteils von den Veranstaltern auf sicherheitsrelevante Aspekte geprüft jedoch nicht zu 100% von daher bleibt die Verantwortung für die eigene Sicherheit beim Teilnehmer. Dieser Verpflichtet sich, die eigene Geschwindigkeit an die Beschaffenheiten der Strecke anzupassen so dass auch auf Hindernisse reagiert werden kann. In Anbetracht des Vorstehenden nimmt jeder Teilnehmer auf eigenes Risiko an der Veranstaltung teil.' },
      { kind: 'text', value: 'Der Veranstalter (Last Soul GmbH) haftet nicht für einfache Fahrlässigkeit. Dies gilt sowohl für eigene Handlungen als auch für Handlungen seiner Vertreter oder Erfüllungsgehilfen. Das Vorstehende gilt nicht bei Verletzung von Leben, Körper oder Gesundheit - in diesen Fällen gelten die allgemeinen gesetzlichen Bestimmungen.' },
      { kind: 'text', value: 'Mit meiner Anmeldung erklärt jeder Teilnehmer, dass er für die Teilnahme an dieser Veranstaltung ausreichend trainiert hat, körperlich fit ist und sein Gesundheitszustand ärztlich bestätigt wurde. Jeder Teilnehmer erklärt außerdem, dass seine Fähigkeiten es ihm ermöglichen, an einer anspruchsvollen und sehr extremen Ultra-Laufveranstaltung wie dem Last Soul Ultra teilzunehmen. Sollte er während der Veranstaltung feststellen, dass sich sein körperlicher Zustand verschlechtert, versichert er, dass der Veranstalter darüber informiert wird, damit die Last Soul GmbH geeignete Maßnahmen ergreifen kann.' },
      { kind: 'text', value: 'Jeder Teilnehmer verpflichtet sich, die vom Veranstalter festgelegten Regeln und Vorschriften einzuhalten (die Regeln und Vorschriften werden vorab veröffentlicht und am Veranstaltungsort erneut im Athlete Briefing mitgeteilt). Jeder ist sich bewusst, dass man disqualifiziert wird, wenn die offizielle Teilnehmernummer in irgendeiner Weise verändert wird oder sich den Regeln widersetzt wird, insbesondere wenn man den Werbeaufdruck unsichtbar oder unkenntlich mache. Darüber hinaus ist es verboten, Tiere zum Veranstaltungsort mitzubringen.' },
      { kind: 'text', value: 'Die RAD RACE GmbH und Last Soul GmbH engagiert sich in allen Bereichen ihrer Geschäftstätigkeit aktiv für den Umweltschutz. Der Veranstalter erwartet auch von den Teilnehmern und allen Beteiligten, dass sie die Umwelt respektieren. Die strikte Einhaltung aller umweltrechtlichen Vorschriften ist eine Grundvoraussetzung. Dies gilt insbesondere für die Vorschriften zur Abfallentsorgung, zum Boden- und Gewässerschutz sowie zur Vermeidung von Umweltverschmutzung. Ich bin mir bewusst, dass sich der Veranstalter das Recht vorbehält, Teilnehmer wegen Verstoßes gegen eine der oben genannten Verpflichtungen von der Veranstaltung auszuschließen. Die allgemeine Anmeldung sowie die Abbuchung von Kreditkarten werden vom Veranstalter (Last Soul GmbH) durchgeführt.' },
      { kind: 'text', value: 'Mit der Anmeldung erklärt sich jeder Teilnehmer damit einverstanden, dass die von ihm im Zusammenhang mit seiner Teilnahme am Last Soul Ultra angefertigten Fotos, Filmaufnahmen und Interviews ohne Anspruch auf Vergütung meinerseits in Radio, Fernsehen, Internet, Werbung, Büchern, fotomechanischen Kopien, Filmen, Videokassetten, DVDs usw. verwendet, verbreitet und veröffentlicht werden dürfen und sein Name in der Ergebnisliste auf der Veranstalterwebsite und Partnerwebsite (im Rahmen der Medienberichterstattung über die Veranstaltung) veröffentlicht werden darf.' },
      { kind: 'text', value: 'Vor Ort dürfen keine kommerziellen Aufnahmen gemacht und verbreitet werden. Zudem dürfen keine dritten Events mit dem Content des Last Soul Ultra beworben werden. Eine redaktionelle Berichterstattung in den sozialen Medien ist ausdrücklich erwünscht. Bei Fragen meldet euch gerne an mail@lastsoulultra.com' },
      { kind: 'text', value: 'Die Teilnehmer versichern, dass ihr Geburtsdatum sowie alle anderen von ihm angegebenen Daten korrekt sind. Die Teilnahme an der Veranstaltung ist nur möglich, wenn die Teilnehmer zum Zeitpunkt der Anmeldung volljährig (18 Jahre) sind.' },
      { kind: 'text', value: 'Der vorliegende Haftungsausschluss muss vor Beginn der Veranstaltung unterschrieben eingereicht werden. Wenn ein Teilnehmer für die Angabe eines falschen Geburtsdatums verantwortlich ist, behält sich der Veranstalter das Recht vor, eine Disqualifikation zu verhängen.' },
    ],
  },
]

export function legalBySlug(slug: string): LegalPage | undefined {
  return legalPages.find(page => page.slug === slug)
}
