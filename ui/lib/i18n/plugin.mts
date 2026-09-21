import type { Plugin } from "vite";
import path from "node:path";
import { transform } from "./compiler.mjs";
import chinese from "./zh-CN.json";
import messages from "./bootMessages.json";

export function localization(root: string): Plugin {
	return {
		name: "bifrost-localization",
		enforce: "pre",
		transform(code, id) {
			const filename = path.relative(root, id.split("?")[0]).replaceAll("\\", "/");
			if (
				!/^(app|components|hooks|lib)\/.+\.[tj]sx?$/.test(filename) ||
				filename.startsWith("lib/i18n/") ||
				/(?:\.test|\.gen)\./.test(filename)
			)
				return null;
			const transformed = transform(code, filename);
			return transformed ? { code: transformed, map: null } : null;
		},
		transformIndexHtml: {
			order: "pre",
			handler(html) {
				// These strings also have to work if the main JavaScript bundle is
				// unavailable during an upgrade. Keep this dictionary self-contained.
				const dict = Object.fromEntries(messages.map((key) => [key, (chinese as Record<string, string>)[key] || key]));
				const boot = `<script>(function(){var l;try{l=localStorage.getItem('bifrost.locale')}catch(e){}if(l!=='en-US'&&l!=='zh-CN'){try{var c=document.cookie.match(/(?:^|; )bifrost_locale=(en-US|zh-CN)(?:;|$)/);l=c&&c[1]}catch(e){}}l=l==='en-US'?'en-US':'zh-CN';document.documentElement.lang=l;var d=${JSON.stringify(dict).replaceAll("<", "\\u003c")};window.__bfBootText=function(s){return l==='zh-CN'?(d[s]||s):s}})();</script>`;
				for (const message of messages.slice(1)) {
					for (const quote of ['"', "'"])
						html = html.replaceAll(quote + message + quote, `window.__bfBootText(${JSON.stringify(message)})`);
				}
				html = html.replace("<h1>Bifrost is upgrading</h1>", "<h1>'+window.__bfBootText('Bifrost is upgrading')+'</h1>");
				// Reload now is embedded in the HTML string rather than a JS literal.
				html = html.replace(">Reload now</button>", ">'+window.__bfBootText('Reload now')+'</button>");
				return html.replace("<head>", "<head>" + boot);
			},
		},
	};
}