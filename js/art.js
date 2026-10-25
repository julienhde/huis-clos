// Habillage du plan : sols par type de pièce et dessins d'objets vus de dessus.
// Tout est en SVG/CSS inline (aucune image externe), coloré par les variables du thème.

/** Sol d'une pièce : `room.floor` s'il est donné, sinon déduit du nom. */
const FLOOR_RULES = [
  [/jacuzzi|piscine|bassin|fontaine|étang/i, 'water'],
  [/jardin|parc|pelouse|potager/i, 'grass'],
  [/terrasse|écurie|grange|ponton|véranda/i, 'deck'],
  [/salle à manger|réfectoire/i, 'diamond'],
  [/couloir|activités|hall|gym/i, 'checker'],
  [/cuisine|bains|toilettes|entrée|accueil|ascenseur|buanderie/i, 'tiles'],
  [/gradins|loge|cinéma|théâtre/i, 'carpet'],
  [/démolition|chantier|garage|cave|entrepôt/i, 'concrete'],
  [/piste|scène/i, 'stage'],
];
export function floorFor(room) {
  if (room.floor) return room.floor;
  return FLOOR_RULES.find(([re]) => re.test(room.name))?.[1] ?? 'wood';
}

/** Objets qui s'étendent sur plusieurs cases et se dessinent en CSS. */
export const SHAPES = { table: 'table', lit: 'bed', tapis: 'rug' };

// ----- Manoir (thème par défaut : sert aussi de repli pour les autres thèmes)
const MANOIR = {
  fauteuil: `
    <rect class="o-fab-d o-ol" x="14" y="12" width="72" height="30" rx="13"/>
    <rect class="o-fab-d o-ol" x="10" y="30" width="21" height="58" rx="10"/>
    <rect class="o-fab-d o-ol" x="69" y="30" width="21" height="58" rx="10"/>
    <rect class="o-fab o-ol" x="27" y="38" width="46" height="48" rx="8"/>
    <path class="o-fab-l" d="M33 46 h34" stroke-width="3" stroke-linecap="round"/>`,
  plante: `
    <circle class="o-pot o-ol" cx="50" cy="58" r="25"/>
    <circle class="o-soil" cx="50" cy="58" r="18"/>
    <g class="o-leaf o-ol">
      <path d="M50 58 C38 40 30 26 22 14 C34 20 46 34 50 58Z"/>
      <path d="M50 58 C62 40 70 26 80 16 C68 22 54 34 50 58Z"/>
      <path d="M50 58 C46 38 46 20 50 6 C54 20 54 38 50 58Z"/>
      <path d="M50 58 C34 52 20 50 8 52 C20 42 36 44 50 58Z"/>
      <path d="M50 58 C66 52 80 50 92 54 C80 42 64 44 50 58Z"/>
    </g>
    <g class="o-leaf-d o-ol">
      <path d="M50 58 C42 46 36 36 32 26 C42 32 48 42 50 58Z"/>
      <path d="M50 58 C58 46 64 38 70 30 C60 34 52 44 50 58Z"/>
    </g>`,
  tv: `
    <rect class="o-metal o-ol" x="24" y="76" width="52" height="12" rx="3"/>
    <rect class="o-metal o-ol" x="10" y="14" width="80" height="62" rx="8"/>
    <rect class="o-screen" x="18" y="22" width="64" height="46" rx="4"/>
    <path class="o-note" d="M46 34 v18 a6 5 0 1 1 -4 -4.6 V30 l16 -4 v18 a6 5 0 1 1 -4 -4.6 V31.5 Z"/>`,
  etagere: `
    <rect class="o-wood-d o-ol" x="10" y="8" width="80" height="84" rx="3"/>
    <rect class="o-shelf" x="16" y="14" width="68" height="20"/>
    <rect class="o-shelf" x="16" y="40" width="68" height="20"/>
    <rect class="o-shelf" x="16" y="66" width="68" height="20"/>
    <rect class="o-book1" x="18" y="16" width="7" height="18"/><rect class="o-book2" x="26" y="18" width="6" height="16"/>
    <rect class="o-book3" x="33" y="16" width="8" height="18"/><rect class="o-book1" x="56" y="20" width="6" height="14" transform="rotate(-18 59 27)"/>
    <rect class="o-book2" x="50" y="42" width="7" height="18"/><rect class="o-book3" x="58" y="44" width="6" height="16"/>
    <rect class="o-book1" x="65" y="42" width="8" height="18"/><rect class="o-book3" x="20" y="68" width="8" height="18"/>
    <rect class="o-book2" x="29" y="70" width="6" height="16"/><rect class="o-book1" x="36" y="68" width="7" height="18"/>
    <rect class="o-book2" x="44" y="69" width="7" height="17"/>`,
  carton: `
    <rect class="o-card o-ol" x="12" y="14" width="76" height="72" rx="3"/>
    <rect class="o-card-d" x="45" y="14" width="10" height="72"/>
    <path class="o-ol" d="M12 50 h33 M55 50 h33" fill="none"/>`,
  rocher: `
    <path class="o-rock o-ol" d="M16 70 Q10 44 32 28 Q52 14 74 26 Q92 40 86 62 Q80 84 52 86 Q26 88 16 70Z"/>
    <path class="o-rock-l" d="M34 36 Q48 26 62 30 Q50 34 40 44Z"/>`,
  gravats: `
    <path class="o-rock o-ol" d="M10 76 Q10 58 28 56 Q44 54 46 72 Q44 88 26 88 Q12 88 10 76Z"/>
    <path class="o-rock-d o-ol" d="M50 68 Q52 48 72 50 Q90 54 88 72 Q84 88 66 88 Q50 86 50 68Z"/>
    <path class="o-rock o-ol" d="M28 44 Q32 26 50 28 Q64 32 60 48 Q52 58 38 56 Q28 54 28 44Z"/>
    <rect class="o-wood o-ol" x="14" y="42" width="74" height="11" rx="2" transform="rotate(-30 50 48)"/>
    <rect class="o-wood o-ol" x="22" y="56" width="62" height="10" rx="2" transform="rotate(24 52 60)"/>`,
  tonneau: `
    <circle class="o-wood o-ol" cx="50" cy="50" r="38"/>
    <circle class="o-hoop" cx="50" cy="50" r="33" fill="none" stroke-width="5"/>
    <circle class="o-wood-l o-ol" cx="50" cy="50" r="22"/>
    <path class="o-ol" d="M36 34 L64 66 M30 50 h40 M38 68 L62 32" fill="none" stroke-width="1.5"/>`,
  ratelier: `
    <path class="o-metal o-ol" d="M26 64 V20 l4 -8 4 8 V64Z"/>
    <path class="o-metal o-ol" d="M48 64 V24 l4 -10 4 10 V64Z"/>
    <rect class="o-wood-d o-ol" x="68" y="18" width="6" height="48" rx="2"/>
    <path class="o-metal o-ol" d="M74 22 Q90 22 92 36 Q82 34 74 38Z"/>
    <path class="o-metal o-ol" d="M68 22 Q54 24 54 36 Q62 34 68 38Z"/>
    <rect class="o-wood o-ol" x="10" y="58" width="80" height="12" rx="3"/>
    <rect class="o-wood-d o-ol" x="14" y="70" width="8" height="18" rx="2"/>
    <rect class="o-wood-d o-ol" x="78" y="70" width="8" height="18" rx="2"/>`,
};

// ----- Château fort
const CHATEAU = {
  fauteuil: `
    <path class="o-gold o-ol" d="M14 12 L22 2 L30 12 Z M42 12 L50 0 L58 12 Z M70 12 L78 2 L86 12 Z"/>
    <rect class="o-gold o-ol" x="12" y="10" width="76" height="36" rx="4"/>
    <rect class="o-crimson o-ol" x="22" y="16" width="56" height="26" rx="3"/>
    <rect class="o-wood-d o-ol" x="8" y="38" width="20" height="54" rx="4"/>
    <rect class="o-wood-d o-ol" x="72" y="38" width="20" height="54" rx="4"/>
    <circle class="o-gold o-ol" cx="18" cy="40" r="6"/><circle class="o-gold o-ol" cx="82" cy="40" r="6"/>
    <rect class="o-crimson o-ol" x="26" y="44" width="48" height="46" rx="5"/>
    <path d="M32 52 h36" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/>`,
  plante: `
    <circle class="o-stone o-ol" cx="50" cy="54" r="30"/>
    <circle class="o-stone-d" cx="50" cy="54" r="23"/>
    <g class="o-leaf o-ol">
      <circle cx="40" cy="46" r="13"/><circle cx="60" cy="44" r="13"/><circle cx="50" cy="62" r="13"/>
      <circle cx="38" cy="62" r="10"/><circle cx="63" cy="60" r="10"/>
    </g>
    <circle class="o-leaf-d" cx="50" cy="50" r="8"/>
    <circle class="o-crimson" cx="42" cy="44" r="3"/><circle class="o-crimson" cx="60" cy="58" r="3"/><circle class="o-crimson" cx="54" cy="40" r="2.5"/>`,
  tv: `
    <rect class="o-gold o-ol" x="34" y="80" width="32" height="12" rx="3"/>
    <rect class="o-wood-d o-ol" x="45" y="70" width="10" height="12"/>
    <ellipse class="o-gold o-ol" cx="50" cy="40" rx="32" ry="34"/>
    <ellipse class="o-glass o-ol" cx="50" cy="40" rx="24" ry="26"/>
    <path d="M38 26 Q44 20 52 20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  etagere: `
    <rect class="o-wood-d o-ol" x="10" y="8" width="80" height="84" rx="3"/>
    <rect class="o-shelf" x="16" y="14" width="68" height="20"/><rect class="o-shelf" x="16" y="40" width="68" height="20"/><rect class="o-shelf" x="16" y="66" width="68" height="20"/>
    <g class="o-parch o-ol" stroke-width="1.5">
      <circle cx="26" cy="27" r="6"/><circle cx="40" cy="27" r="6"/><circle cx="62" cy="27" r="6"/>
      <circle cx="34" cy="53" r="6"/><circle cx="48" cy="53" r="6"/><circle cx="72" cy="53" r="6"/>
      <circle cx="24" cy="79" r="6"/><circle cx="56" cy="79" r="6"/><circle cx="70" cy="79" r="6"/>
    </g>`,
  carton: `
    <rect class="o-wood o-ol" x="10" y="20" width="80" height="62" rx="7"/>
    <path d="M10 34 H90 M10 68 H90" stroke="var(--iron)" stroke-width="6"/>
    <path d="M30 20 V82 M70 20 V82" stroke="var(--wood-d)" stroke-width="2"/>
    <rect class="o-gold o-ol" x="43" y="42" width="14" height="16" rx="2"/>
    <circle cx="50" cy="49" r="2.5" fill="var(--outline)"/>`,
};

// ----- Cyberpunk
const CYBER = {
  fauteuil: `
    <rect class="o-metal o-ol" x="18" y="8" width="64" height="36" rx="14"/>
    <path d="M30 18 H70" stroke="var(--neon1)" stroke-width="4" stroke-linecap="round"/>
    <rect class="o-metal-l o-ol" x="8" y="34" width="18" height="54" rx="6"/>
    <rect class="o-metal-l o-ol" x="74" y="34" width="18" height="54" rx="6"/>
    <rect class="o-metal o-ol" x="27" y="40" width="46" height="48" rx="9"/>
    <rect x="27" y="40" width="46" height="48" rx="9" fill="none" stroke="var(--neon2)" stroke-width="2"/>`,
  plante: `
    <path class="o-metal o-ol" d="M50 26 L76 41 V71 L50 86 L24 71 V41 Z"/>
    <path d="M50 26 L76 41 V71 L50 86 L24 71 V41 Z" fill="none" stroke="var(--neon2)" stroke-width="1.5"/>
    <g fill="var(--neon3)" stroke="var(--outline)" stroke-width="2">
      <path d="M50 58 C40 40 34 28 26 16 C40 24 48 36 50 58Z"/><path d="M50 58 C60 40 68 28 78 18 C64 24 54 36 50 58Z"/>
      <path d="M50 58 C46 38 47 22 50 8 C54 22 55 38 50 58Z"/>
    </g>`,
  tv: `
    <rect x="8" y="12" width="84" height="62" rx="4" fill="var(--screen)" stroke="var(--neon1)" stroke-width="3"/>
    <rect x="16" y="22" width="38" height="5" fill="var(--neon2)"/><rect x="16" y="33" width="54" height="5" fill="var(--neon1)" opacity=".8"/>
    <rect x="16" y="44" width="28" height="5" fill="var(--neon2)" opacity=".7"/><rect x="16" y="55" width="46" height="5" fill="var(--neon3)" opacity=".7"/>
    <rect class="o-metal o-ol" x="34" y="78" width="32" height="10" rx="2"/>`,
  etagere: `
    <rect class="o-metal o-ol" x="14" y="6" width="72" height="88" rx="3"/>
    <g class="o-metal-l"><rect x="20" y="12" width="60" height="14"/><rect x="20" y="30" width="60" height="14"/><rect x="20" y="48" width="60" height="14"/><rect x="20" y="66" width="60" height="14"/></g>
    <g fill="var(--neon3)"><circle cx="26" cy="19" r="2.5"/><circle cx="26" cy="55" r="2.5"/><circle cx="26" cy="73" r="2.5"/></g>
    <g fill="var(--neon1)"><circle cx="34" cy="19" r="2.5"/><circle cx="26" cy="37" r="2.5"/><circle cx="34" cy="73" r="2.5"/></g>
    <g stroke="var(--neon2)" stroke-width="2"><path d="M50 19 H74 M50 37 H70 M50 55 H74 M50 73 H66"/></g>`,
  carton: `
    <rect class="o-metal-l o-ol" x="12" y="14" width="76" height="72" rx="3"/>
    <rect x="12" y="38" width="76" height="22" fill="var(--hazard)"/>
    <path d="M18 60 L30 38 H38 L26 60Z M38 60 L50 38 H58 L46 60Z M58 60 L70 38 H78 L66 60Z" fill="var(--outline)"/>
    <rect x="12" y="14" width="76" height="72" rx="3" fill="none" stroke="var(--outline)" stroke-width="2.5"/>`,
  tonneau: `
    <circle cx="50" cy="50" r="38" fill="var(--hazard)" stroke="var(--outline)" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="var(--outline)" stroke-width="3"/>
    <circle cx="50" cy="50" r="7" fill="var(--outline)"/>
    <path d="M50 50 L36 26 A28 28 0 0 1 64 26Z M50 50 L78 50 A28 28 0 0 1 64 74Z M50 50 L36 74 A28 28 0 0 1 22 50Z" fill="var(--outline)" opacity=".85"/>`,
  rocher: `
    <path class="o-rock o-ol" d="M14 72 L18 36 L44 18 L78 26 L88 58 L70 86 L30 86Z"/>
    <path d="M30 40 L52 64 M60 30 L56 70 M40 76 L74 48" stroke="var(--rust)" stroke-width="3" stroke-linecap="round"/>`,
  gravats: `
    <path class="o-metal-l o-ol" d="M10 80 L22 54 L46 62 L40 88Z"/>
    <path class="o-rock o-ol" d="M48 86 L54 56 L80 52 L90 80Z"/>
    <path class="o-metal o-ol" d="M24 46 L50 26 L66 44 L44 60Z"/>
    <path d="M20 30 Q40 50 30 70 M60 20 Q80 34 74 50" fill="none" stroke="var(--neon1)" stroke-width="2.5" stroke-linecap="round"/>`,
  ratelier: `
    <path d="M26 64 V18 l4 -8 4 8 V64Z" fill="var(--neon2)" stroke="var(--outline)" stroke-width="2"/>
    <path d="M48 64 V22 l4 -10 4 10 V64Z" fill="var(--neon1)" stroke="var(--outline)" stroke-width="2"/>
    <path d="M70 64 V24 l4 -8 4 8 V64Z" fill="var(--neon2)" stroke="var(--outline)" stroke-width="2"/>
    <rect class="o-metal o-ol" x="10" y="58" width="80" height="14" rx="3"/>
    <rect class="o-metal-l o-ol" x="14" y="72" width="8" height="16" rx="2"/><rect class="o-metal-l o-ol" x="78" y="72" width="8" height="16" rx="2"/>`,
};

/** Thèmes visuels. Les textes ne changent pas : un fauteuil reste « un fauteuil », même dessiné en trône. */
export const THEMES = {
  manoir: { label: 'Manoir', art: MANOIR },
  chateau: { label: 'Château fort', art: CHATEAU },
  cyberpunk: { label: 'Cyberpunk', art: CYBER },
};

/** SVG d'un objet d'une case dans un thème (repli sur le Manoir), ou null (objet dessiné en CSS, ou emoji). */
export function objectSvg(type, theme = 'manoir') {
  const body = THEMES[theme]?.art[type] ?? MANOIR[type];
  if (!body) return null;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}
