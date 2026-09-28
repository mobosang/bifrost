import type { Plugin } from "vite";
import path from "node:path";
import { transform } from "./compiler.mjs";
import chinese from "./zh-CN.json";
import messages from "./bootMessages.json";
import ts from "typescript";

// Parse inline scripts so upstream formatting/quote changes cannot turn
// translated HTML back into literal JavaScript or break the recovery script.
function translateBootScripts(html: string): string {
	return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, opening, source: string, closing) => {
		const file = ts.createSourceFile("boot.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const edits: { start: number; end: number; code: string }[] = [];
		function visit(node: ts.Node) {
			if (ts.isStringLiteral(node)) {
				let remaining = node.text;
				const parts: string[] = [];
				while (remaining) {
					const match = messages
						.map((key) => ({ key, index: remaining.indexOf(key) }))
						.filter((item) => item.index >= 0)
						.sort((a, b) => a.index - b.index)[0];
					if (!match) break;
					parts.push(JSON.stringify(remaining.slice(0, match.index)), `window.__bfBootText(${JSON.stringify(match.key)})`);
					remaining = remaining.slice(match.index + match.key.length);
				}
				if (parts.length) {
					parts.push(JSON.stringify(remaining));
					edits.push({ start: node.getStart(file), end: node.end, code: `(${parts.join(" + ")})` });
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(file);
		for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.code + source.slice(edit.end);
		return opening + source + closing;
	});
}

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
				html = translateBootScripts(html);
				return html.replace("<head>", "<head>" + boot);
			},
		},
	};
}