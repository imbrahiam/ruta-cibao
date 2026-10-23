/**
 * Hermes ships `Intl` without `PluralRules`, which ICU plurals in the catalogue
 * need ("1 lugar", "3 lugares"). Loaded before anything formats a message.
 */
import "@formatjs/intl-locale/polyfill-force.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
