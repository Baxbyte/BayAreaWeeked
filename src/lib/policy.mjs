// Family-friendly content policy for listing text (titles, descriptions, venue names, tags).
// 1) Events that are sexually explicit are dropped entirely.
// 2) Profanity is masked everywhere it would be shown (e.g. "f***").

const EXPLICIT = /\b(strip ?club|strip ?tease|stripper|stripping|gentlemen'?s club|exotic dancers?|lap ?dance|pole dance party|fetish|kink|kinky|bdsm|bondage|dominatrix|erotic|erotica|xxx|porn|porno|pornographic|nude|nudes|nudity|naked|nudist|topless|lingerie|sex party|sex positive|swingers?|orgy|playboy|onlyfans|adult entertainment|adult film|escort|sexy|sensual|seduction|thirst trap|booty|twerk|leather (party|night|daddy)|folsom street fair|dore alley|up your alley|underwear (party|night))\b/i;

export function isExplicit(...texts) {
  return EXPLICIT.test(texts.filter(Boolean).join(' '));
}

const PROFANITY = [
  'motherfuckers', 'motherfucker', 'motherfucking', 'fuckers', 'fucker', 'fucking', 'fucked', 'fucks', 'fuck', 'fck', 'f\\*ck',
  'shitty', 'shits', 'shit', 'bullshit', 'bitches', 'bitch', 'assholes', 'asshole', 'dickhead', 'dick', 'dicks', 'cocks?', 'pussy', 'pussies',
  'cunts?', 'twats?', 'bastards?', 'damn', 'goddamn', 'slut', 'sluts', 'whore', 'whores', 'wtf', 'stfu', 'hoes?',
];
const PROF_RE = new RegExp(`\\b(${PROFANITY.join('|')})\\b`, 'gi');

export function clean(text) {
  if (!text) return text;
  return String(text).replace(PROF_RE, (w) => `${w[0]}${'*'.repeat(Math.max(2, w.length - 1))}`);
}
