import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocale, saveLocale, translate } from "./runtime";
import { displayError } from "./errors";
import { readFileSync } from "node:fs";
import { analyze } from "./compiler.mjs";

afterEach(() => vi.unstubAllGlobals());

describe("locale and interpolation", () => {
	it("extracts and translates the upstream virtual-key policy warning without changing English", () => {
		const filename = "app/workspace/virtual-keys/views/virtualKeySheet.tsx";
		const source = readFileSync(new URL(`../../${filename}`, import.meta.url), "utf8");
		const key =
			"Couldn't check whether an access profile governs the keys you create. You can still create one — if a profile does govern it, the profile's providers, budgets, rate limits and MCP access replace what you set here.";
		expect(analyze(source, filename).messages.map((item) => item.key)).toContain(key);
		expect(translate(key, [], "zh-CN")).toBe(
			"无法检查你创建的密钥是否受访问配置管理。你仍可创建密钥；如果存在管理该密钥的访问配置，其中的提供商、预算、速率限制和 MCP 访问设置将替换你在此处填写的设置。",
		);
		expect(translate(key, [], "en-US")).toBe(key);
	});
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