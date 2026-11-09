import { readFileSync } from "node:fs";
import { runInNewContext, Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { bootLocalization } from "./plugin.mjs";

const hook = bootLocalization().transformIndexHtml as { handler: (html: string) => string };

describe("boot recovery localization", () => {
	it.each([null, "en", "en-US", "ja"])("respects the %s preference without the app bundle", (saved) => {
		for (const quote of ['"', "'"]) {
			const output = hook.handler(
				`<head><script>window.markup = ${quote}<h1>Bifrost is upgrading</h1><button>Reload now</button>${quote};</script>`,
			);
			const context = {
				window: {} as { markup: string },
				document: { documentElement: { lang: "" }, cookie: "" },
				localStorage: { getItem: () => saved },
			};
			for (const script of output.matchAll(/<script>([\s\S]*?)<\/script>/g)) runInNewContext(script[1], context);
			expect(context.document.documentElement.lang).toBe(saved ? "en" : "zh-CN");
			expect(context.window.markup).toBe(
				saved ? "<h1>Bifrost is upgrading</h1><button>Reload now</button>" : "<h1>Bifrost 正在升级</h1><button>立即刷新</button>",
			);
		}
	});

	it("keeps every current inline script valid", () => {
		const output = hook.handler(readFileSync(new URL("../../index.html", import.meta.url), "utf8"));
		for (const script of output.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Script(script[1])).not.toThrow();
	});
});