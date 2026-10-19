// Venue names that are really placeholders ("Sign in to download the location", "TBA") or out-of-state locations.
const PLACEHOLDER = /^(tba|tbd|to be (announced|determined)|online|virtual|zoom|various locations?|multiple locations?|location tbd)$|sign in to (download|see|view)|see (the )?(flyer|website|description|event page)|location (will be )?(revealed|sent|provided)|rsvp (for|to get) (the )?(address|location)|address (upon|after|provided)/i;
// "Albuquerque, N.M.", "Arrow, Okla.", "Lahaina, Hawai‘i": away games and other listings that aren't in the Bay Area.
const OTHER_STATE = /,\s*(Ala\.|Alaska|Ariz\.|Ark\.|Colo\.|Conn\.|Del\.|Fla\.|Ga\.|Hawai[i‘'’]i|Idaho|Ill\.|Ind\.|Iowa|Kan\.|Ky\.|La\.|Maine|Md\.|Mass\.|Mich\.|Minn\.|Miss\.|Mo\.|Mont\.|Neb\.|Nev\.|N\.H\.|N\.J\.|N\.M\.|N\.Y\.|N\.C\.|N\.D\.|Ohio|Okla\.|Ore\.|Pa\.|R\.I\.|S\.C\.|S\.D\.|Tenn\.|Texas|Utah|Vt\.|Va\.|Wash\.|W\.Va\.|Wis\.|Wyo\.)\s*$/i;

export const isPlaceholderVenue = (name) => !name || PLACEHOLDER.test(String(name).trim());
export const isSecretVenue = (name) => /secret location/i.test(name || '');
export const isOutOfArea = (name) => OTHER_STATE.test(String(name || '').trim());
