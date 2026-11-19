// Øktarkiv: fast treningsplan. Endres ved å si fra, så oppdateres denne filen.
// Struktur:
//   id, navn, type (Styrke, Kondisjon, Belastning, Bevegelighet), om: [tekst]
//   deler: [{ tittel, linjer: [tekst | {t, info}], blokker: [{ id, ovelser: [{navn, sett, info}], runder, pause }] }]
//   pause = sekunder etter hver runde (0 = ingen pausetimer)

const blokk = (id, ovelser, runder, pause) => ({ id, ovelser, runder, pause });
const o = (navn, sett, info) => ({ navn, sett, info });

const OM_STYRKE = [
  'Vekten er riktig når du har 2–3 repetisjoner igjen i reserve. Siden vektene er lette, kommer belastningen fra flere repetisjoner, langsomt tempo (3 sekunder ned) og øvelser på ett bein eller én arm.',
  'Hver blokk har to øvelser. Gjør ett sett av hver, ta pause, og gjenta til du har 3 runder.',
  'Progresjon, endre én ting om gangen: 1. flere repetisjoner, opp til ca. 15. 2. saktere tempo, 4 s ned og 1 s pause i bunnen. 3. ett bein eller én arm. 4. kortere pauser, ned mot 45 s. 5. tykkere strikk. Bytt et par øvelser etter 4–6 uker.'
];

export const OKTARKIV = [
  {
    id: 'hele-kroppen',
    navn: 'Hele kroppen',
    type: 'Styrke',
    om: OM_STYRKE,
    deler: [
      { tittel: 'Oppvarming · 8 min', linjer: ['3 min hoppetau eller jumping jacks', 'Band pull-aparts, kettlebell-halo og utfall med armløft'] },
      {
        tittel: 'Blokker', blokker: [
          blokk('A', [
            o('Goblet-knebøy (3 s ned)', '3 × 10–12', 'Hold en manual eller kettlebell mot brystet. Senk deg i 3 sekunder med rak rygg, og la kneet peke samme vei som foten. Reis deg kontrollert.'),
            o('Ettarms roing, hånd på stol', '3 × 10 per side', 'Stå i skrittstilling med den ene hånden på en stol og rett rygg. Trekk manualen mot hoften med albuen inntil kroppen, og senk kontrollert. Ta alle repetisjonene på én side, så bytt.')
          ], 3, 75),
          blokk('B', [
            o('Rumensk markløft med manualer', '3 × 10–12', 'Stå med lett bøyde knær og manualer foran lårene. Skyv hoften bakover og senk manualene langs beina med rett rygg. Reis deg ved å skyve hoften fram.'),
            o('Gulvpress med manualer', '3 × 10–12', 'Ligg på ryggen med bøyde knær og føttene i gulvet. Press manualene rett opp fra brystet, og senk til albuene så vidt berører gulvet.')
          ], 3, 75),
          blokk('C', [
            o('Bulgarsk splittknebøy', '3 × 8 per bein', 'Bakre fot hviler på en stol bak deg. Senk deg rett ned på forreste bein, og la kneet peke samme vei som foten. Reis deg kontrollert. Ta alle repetisjonene på ett bein, så bytt.'),
            o('Kettlebell-sving', '3 × 15', 'Stå skulderbredde. Skyv hoften bakover og sving kettlebellen opp til brysthøyde med kraft fra hoften, ikke armene. La den falle tilbake og gjenta.')
          ], 3, 75),
          blokk('D', [
            o('Suitcase-marsj på stedet', '3 × 30 s per side', 'Hold en tung kettlebell eller manual i én hånd og marsjer på stedet med høye kneløft. Hold overkroppen rak og ikke len mot vekten.'),
            o('Plankedrag med kettlebell', '3 × 8 per side', 'Stå i planke på hendene med en kettlebell ved siden av den ene hånden. Dra den under kroppen til den andre siden uten å rotere hoften. Bytt side.')
          ], 3, 60)
        ]
      },
      { tittel: 'Avslutning · 5 min', linjer: ['Tøyning av hofter, lår og bryst'] }
    ]
  },
  {
    id: 'kjerne-overkropp',
    navn: 'Kjerne og overkropp',
    type: 'Styrke',
    om: OM_STYRKE,
    deler: [
      { tittel: 'Oppvarming · 8 min', linjer: ['3 min jumping jacks', 'Band pull-aparts, dislocates med strikk, kettlebell-halo og stående cat-cow'] },
      {
        tittel: 'Blokker', blokker: [
          blokk('A', [
            o('Ettarms roing', '3 × 10–12 per side', 'Støtt den ene hånden på en stol med rett rygg. Trekk manualen mot hoften med albuen inntil kroppen, og senk kontrollert. Ta alle repetisjonene på én side, så bytt.'),
            o('Stående skulderpress', '3 × 8–10', 'Stå stødig med manualer ved skuldrene. Press opp til strake armer uten å svaie i korsryggen, og senk kontrollert.')
          ], 3, 75),
          blokk('B', [
            o('Pullover med manual', '3 × 10–12', 'Ligg på ryggen med én manual i begge hender over brystet. Senk armene bak hodet med lett bøyde albuer, og trekk tilbake til start.'),
            o('Push-ups', '3 × maks minus 2', 'Hendene under skuldrene og kroppen i rett linje. Senk brystet mot gulvet og press opp. Lettere variant: hendene på benk. Stopp to repetisjoner før du ikke orker mer.')
          ], 3, 75),
          blokk('C', [
            o('Omvendt flyes, foroverbøyd', '3 × 12–15', 'Bøy deg forover med rett rygg og manualer hengende. Løft armene ut til siden med lett bøyde albuer, og klem skulderbladene sammen.'),
            o('Hammercurl', '3 × 10–12', 'Stå med manualer langs siden og håndflatene mot hverandre. Bøy albuene og løft vekten uten å svinge kroppen.')
          ], 3, 60),
          blokk('Kjerne', [
            o('Planke', '40 s', 'Underarmene i gulvet og kroppen i rett linje fra hode til hæl. Stram mage og sete.'),
            o('Sideplanke', '30 s per side', 'Støtt deg på underarmen med kroppen i rett linje. Hold hoften løftet.'),
            o('Dead bug', '8 per side', 'Ligg på ryggen med armene opp og knærne over hoftene. Senk motsatt arm og bein mot gulvet mens korsryggen holdes mot underlaget.'),
            o('Superman', '10, hold 2 s på toppen', 'Ligg på magen. Løft armer og bein samtidig, og hold 2 sekunder på toppen.')
          ], 3, 60)
        ]
      },
      { tittel: 'Avslutning · 5 min', linjer: ['Tøyning av rygg, bryst og skuldre'] }
    ]
  },
  {
    id: 'i3',
    navn: 'I3 4x8 min',
    type: 'Kondisjon',
    om: ['Tirsdag. Intensitet I3 er ca. 82–87 % av makspuls.'],
    deler: [
      {
        tittel: 'Utendørs', linjer: [
          'Oppvarming 12 min: rolig jogg, 3 stigningsløp',
          'Hoveddel 38 min: 4 × 8 min løp i I3, 2 min rolig jogg som pause',
          'Nedjogg 8 min: rolig jogg'
        ]
      },
      {
        tittel: 'Innendørs', linjer: ['Oppvarming 10 min'], blokker: [
          blokk('Drag', [
            o('Jogg på stedet med høye kneløft', '1 min × 2'),
            o('Step-ups', '1 min × 2'),
            o('Jumping jacks', '1 min × 2'),
            o('Sidesteg med armløft', '1 min × 2')
          ], 4, 120)
        ]
      }
    ]
  },
  {
    id: 'i2',
    navn: 'I2 rolig jogg',
    type: 'Kondisjon',
    om: ['Onsdag. Intensitet I2 er ca. 72–82 % av makspuls.'],
    deler: [
      {
        tittel: 'Utendørs', linjer: [
          'Oppvarming 7 min: rask gange som går over i rolig jogg',
          'Hoveddel 45 min: sammenhengende jogg i I2, gå raskt i motbakker',
          'Nedtrapping 6 min: rolig gange'
        ]
      },
      {
        tittel: 'Innendørs', blokker: [
          blokk('Runde', [
            o('Jogg på stedet', '3 min'),
            o('Step-ups', '3 min'),
            o('Marsj med høye kneløft', '3 min'),
            o('Sidesteg med armløft', '3 min'),
            o('Skyggeboksing', '3 min')
          ], 3, 0)
        ]
      }
    ]
  },
  {
    id: 'i4',
    navn: 'I4 4 x 4 min',
    type: 'Kondisjon',
    om: ['Fredag, utendørs. Intensitet I4 er ca. 87–92 % av makspuls. Siste drag skal være like raskt som det første. Når 4 × 4 min føles kontrollert, kan du øke til 5 × 4 min.'],
    deler: [
      { tittel: 'Oppvarming · 15 min', linjer: ['Rolig jogg, løpsdrills og 3 stigningsløp'] },
      { tittel: 'Hoveddel', blokker: [blokk('Drag', [o('4 min i I4', '3 min rolig jogg som pause')], 4, 180)] },
      { tittel: 'Nedjogg · 10 min', linjer: ['Rolig jogg'] }
    ]
  },
  {
    id: 'belastning',
    navn: 'Belastningstrening',
    type: 'Belastning',
    om: [
      'Juster motstanden: bredere beinstilling på strikken gjør det tyngre. Føttene tettere sammen, eller bare én fot på strikken, gjør det lettere.',
      'Oppsett: 3–4 runder med 45 s arbeid og 15 s pause per øvelse. Ta 2 min pause mellom rundene.',
      'Statisk bevegelighet (30 min) kommer etter belastningstreningen.'
    ],
    deler: [
      {
        tittel: 'Sirkel', blokker: [
          blokk('Sirkel', [
            o('Sidehev + fronthev, vekselvis', '45 s', 'Gir utholdenhet i skuldrene. Hold nakken avslappet.'),
            o('Simulert statisk geværhold', '45 s', 'Stå i skytestilling med strikken under føttene og hold armene låst. Pust rolig gjennom nesen.'),
            o('Pallof press', '45 s', 'Press strikken rett ut fra brystet og hold. Motstå at strikken drar deg til siden.'),
            o('Knebøy med stopp', '45 s', 'Stå på strikken med endene ved skuldrene, og hold 2–3 s i bunnen.'),
            o('Planke med pustefokus', '45 s', 'Planke på tærne med dype, rolige åndedrag.')
          ], 3, 120)
        ]
      }
    ]
  },
  {
    id: 'bevegelighet',
    navn: 'Statisk bevegelighet',
    type: 'Bevegelighet',
    om: ['Hold hvert strekk uten å vippe. Ingen vridning i kneet. Økten tar ca. 30 min og kommer etter belastningstreningen.'],
    deler: [
      {
        tittel: 'Hofter og bein', linjer: [
          'Baksida lår med strikk (liggende) · 75 s per side',
          'Hoftebøyer, stående · 75 s per side',
          'Forside lår, sideliggende · 75 s per side',
          'Sete, liggende figur-4 · 75 s per side',
          'Legg mot vegg, med strakt og bøyd kne · 60 s per variant og side'
        ]
      },
      {
        tittel: 'Rygg og skuldre', linjer: [
          'Ryggstrekk mot stol · 2 × 60 s',
          'Sittende rotasjon på stol · 60 s per side',
          'Brystmuskel mot vegg · 60 s per side',
          'Bakre skulder · 45 s per side',
          'Lats og triceps · 45 s per side',
          'Nakke · 45 s per side'
        ]
      },
      { tittel: 'Avslutning', linjer: ['Pust liggende i ca. 3 min: inn 4 s, hold 2 s, ut 6 s'] }
    ]
  }
];
