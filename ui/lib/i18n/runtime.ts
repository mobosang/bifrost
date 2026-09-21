import chinese from "./zh-CN.json";
import overrides from "./overrides.json";
import { config } from "zod";
import { zhCN } from "zod/locales";

export type Locale = "zh-CN" | "en-US";
export const LOCALE_STORAGE_KEY = "bifrost.locale";

export function readLocale(): Locale {
	if (typeof window === "undefined") return "zh-CN";
	let saved: string | null = null;
	try {
		saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
	} catch {
		/* Storage can be disabled. */
	}
	if (saved !== "en-US" && saved !== "zh-CN") {
		try {
			saved = document.cookie.match(/(?:^|; )bifrost_locale=(en-US|zh-CN)(?:;|$)/)?.[1] ?? null;
		} catch {
			/* Sandboxed document. */
		}
	}
	return saved === "en-US" ? "en-US" : "zh-CN";
}

// Deliberately fixed for a page lifetime. Upstream schemas and navigation
// include module-level constants and memoized strings. Changing the locale
// reloads the page explicitly, so those values cannot retain a stale language.
export const locale: Locale = readLocale();
if (locale === "zh-CN") config(zhCN());
export const getLocale = () => locale;

export function saveLocale(next: Locale): boolean {
	if (next !== "zh-CN" && next !== "en-US") return false;
	let stored = false;
	try {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		stored = window.localStorage.getItem(LOCALE_STORAGE_KEY) === next;
	} catch {
		/* Try a cookie below. */
	}
	try {
		document.cookie = `bifrost_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
		stored ||= document.cookie.includes(`bifrost_locale=${next}`);
	} catch {
		/* Report failure instead of reloading into the wrong language. */
	}
	return stored && readLocale() === next;
}

const dictionary: Readonly<Record<string, string>> = chinese;
const contexts: Readonly<Record<string, Record<string, string>>> = overrides;

export function translate(source: string, values: readonly unknown[] = [], language: Locale = locale, context?: string): string {
	const translated = language === "zh-CN" ? (context && contexts[context]?.[source]) || dictionary[source] || source : source;
	return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
		Number(index) < values.length ? String(values[Number(index)]) : match,
	);
}

export function t(source: string, values?: readonly unknown[], context?: string): string {
	return translate(source, values, locale, context);
}

if (typeof document !== "undefined") document.documentElement.lang = locale;