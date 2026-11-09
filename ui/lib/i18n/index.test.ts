import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const documentElement = { lang: "" };

// Catalogs for "de" fail to load, so i18next falls back to English for that selection.
async function loadI18n({
	saved,
	cookie = "",
	blockedStorage = false,
	blockedCookie = false,
}: {
	saved?: string;
	cookie?: string;
	blockedStorage?: boolean;
	blockedCookie?: boolean;
} = {}) {
	vi.resetModules();
	vi.doMock("i18next", async (importOriginal) => {
		const actual = await importOriginal<typeof import("i18next")>();
		return { ...actual, default: actual.createInstance() };
	});
	const storage = new Map(saved ? [["bifrost.locale", saved]] : []);
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				if (blockedStorage) throw new Error("storage blocked");
				storage.set(key, value);
			},
			removeItem: (key: string) => storage.delete(key),
		},
	});
	vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
	vi.stubGlobal("document", {
		documentElement,
		get cookie() {
			if (blockedCookie) throw new Error("cookies blocked");
			return cookie;
		},
		set cookie(value: string) {
			if (blockedCookie) throw new Error("cookies blocked");
			cookie = value;
		},
	});
	vi.doMock("./resources", async (importOriginal) => {
		const actual = await importOriginal<typeof import("./resources")>();
		return {
			...actual,
			loadCatalog: (lang: string, ns: string) => (lang === "de" ? Promise.reject(new Error("offline")) : actual.loadCatalog(lang, ns)),
		};
	});
	return import("./index");
}

beforeEach(() => {
	documentElement.lang = "";
});

afterEach(() => {
	vi.doUnmock("./resources");
	vi.doUnmock("i18next");
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("document language", () => {
	it("defaults to Chinese even when the browser prefers English", async () => {
		const { getLocale, i18nReady } = await loadI18n();
		await i18nReady;
		expect(getLocale()).toBe("zh-CN");
		expect(documentElement.lang).toBe("zh-CN");
	});

	it.each(["en", "en-US"])("preserves a saved %s preference", async (saved) => {
		const { getLocale, i18nReady } = await loadI18n({ saved });
		await i18nReady;
		expect(getLocale()).toBe("en");
		expect(window.localStorage.getItem("bifrost.locale")).toBe("en");
	});

	it("preserves the old cookie preference when localStorage is unavailable", async () => {
		const { getLocale, changeLocale, i18nReady } = await loadI18n({ cookie: "bifrost_locale=en-US", blockedStorage: true });
		await i18nReady;
		expect(getLocale()).toBe("en");
		await changeLocale("zh-CN");
		expect(document.cookie).toContain("bifrost_locale=zh-CN");
	});

	it("uses Chinese when preferences are unsupported or storage is blocked", async () => {
		const { getLocale, i18nReady } = await loadI18n({ saved: "invalid", blockedStorage: true, blockedCookie: true });
		await i18nReady;
		expect(getLocale()).toBe("zh-CN");
	});

	it("follows the active language", async () => {
		const { changeLocale, i18nReady } = await loadI18n();
		await i18nReady;
		await changeLocale("ja");
		expect(documentElement.lang).toBe("ja");
	});

	it("stays on the displayed language when the requested catalogs fail to load", async () => {
		const { changeLocale, i18nReady } = await loadI18n();
		await i18nReady;
		await changeLocale("ja");
		await changeLocale("de");
		expect(documentElement.lang).toBe("en");
	});
});