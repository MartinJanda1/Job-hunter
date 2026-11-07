import { normalize } from './text'

export type DetectedLanguage = 'cs' | 'en' | 'unknown'

/** Česká slova (normalizovaná – bez diakritiky), která se v angličtině nevyskytují */
const CS_WORDS = new Set([
  'je', 'se', 'na', 'pro', 've', 'ze', 'do', 'od', 'po', 'jako', 'nebo', 'ktery', 'ktera', 'ktere', 'kteri',
  'jsme', 'jste', 'budete', 'bude', 'byt', 'mate', 'mame', 'nas', 'vas', 'vam', 'nam', 'tak', 'take', 'jen',
  'prace', 'praci', 'zkusenost', 'zkusenosti', 'znalost', 'znalosti', 'nabizime', 'pozadujeme', 'hledame',
  'vyvoj', 'vyvojar', 'pozice', 'tym', 'tymu', 'mzda', 'uvazek', 'smlouva', 'pracovni', 'dobre', 'velmi',
  'moznost', 'prostredi', 'firma', 'firmy', 'spolecnost', 'spolecnosti', 'projekt', 'projektu', 'let', 'rok',
])

/** Anglická slova, která se v češtině nevyskytují */
const EN_WORDS = new Set([
  'the', 'and', 'of', 'to', 'with', 'you', 'we', 'for', 'our', 'your', 'is', 'are', 'will', 'be', 'an', 'or',
  'this', 'that', 'skills', 'work', 'role', 'experience', 'team', 'join', 'who', 'what', 'have', 'has',
  'from', 'about', 'looking', 'working', 'strong', 'knowledge', 'ability', 'opportunity', 'benefits',
])

/** Znaky typické jen pro češtinu (á, é, í, ó, ú jsou i v jiných jazycích) */
const CS_CHARS = /[ěščřžůťďň]/gi

/**
 * Hrubé určení jazyka inzerátu z názvu + popisu. Konzervativní: 'en' jen při jasné převaze
 * anglických slov, při krátkém nebo nejasném textu 'unknown' (např. jen anglický název pozice
 * z e-mailu hlídače – inzerát samotný může být český).
 */
export function detectLanguage(text: string): DetectedLanguage {
  const tokens = normalize(text).split(/[^a-z]+/).filter(Boolean)
  if (tokens.length < 8) return 'unknown'

  let cs = 0
  let en = 0
  for (const t of tokens) {
    if (CS_WORDS.has(t)) cs++
    else if (EN_WORDS.has(t)) en++
  }
  const csChars = (text.match(CS_CHARS) ?? []).length

  if (csChars >= 3 || cs >= 3) return cs + csChars / 2 >= en ? 'cs' : en >= 6 && en > (cs + csChars / 2) * 3 ? 'en' : 'unknown'
  if (en >= 3 && en > cs * 2) return 'en'
  return 'unknown'
}
