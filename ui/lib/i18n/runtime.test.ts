import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocale, saveLocale, translate } from "./runtime";
import { displayError } from "./errors";

afterEach(() => vi.unstubAllGlobals());

describe("locale and interpolation", () => {
	it("defaults to Chinese and rejects unsupported saved values", () => {
		vi.stubGlobal("window", { localStorage: { getItem: () => "fr" } });
		vi.stubGlobal("document", { cookie: "" });
		expect(readLocale()).toBe("zh-CN");
	});
	it("uses the cookie when local storage is disabled", () => {
		vi.stubGlobal("window", {
			get localStorage() {
				throw new Error("blocked");
			},
		});
		vi.stubGlobal("document", { cookie: "bifrost_locale=en-US" });
		expect(readLocale()).toBe("en-US");
	});
	it("reports failure when neither storage mechanism works", () => {
		vi.stubGlobal("window", {
			get localStorage() {
				throw new Error("blocked");
			},
		});
		vi.stubGlobal("document", {
			get cookie() {
				return "";
			},
			set cookie(_value) {},
		});
		expect(saveLocale("en-US")).toBe(false);
	});
	it("keeps interpolation values verbatim and falls back to source text", () => {
		expect(translate("Delete {0}", ["Model Providers {1}"], "en-US")).toBe("Delete Model Providers {1}");
		expect(translate("A new upstream message", [], "zh-CN")).toBe("A new upstream message");
		expect(translate("Cancel", [], "zh-CN")).toBe("取消");
		expect(translate("Cancel", [], "en-US")).toBe("Cancel");
	});
	it("preserves unknown server diagnostics", () => {
		expect(displayError("upstream 429: model=custom-id")).toBe("upstream 429: model=custom-id");
		expect(displayError("Invalid username or password")).toBe("用户名或密码错误");
	});
});