import { changeLocale, i18nReady } from "./lib/i18n";

// Keep upstream assertions in English; locale tests select their own language.
await i18nReady;
await changeLocale("en");