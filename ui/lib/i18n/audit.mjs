import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { analyze } from "./compiler.mjs";

// A review aid, not a coverage percentage: these include intentional English
// examples, exported schemas, developer diagnostics and runtime comparisons.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const candidates = [];
function walk(folder) {
	for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		const filename = path.relative(root, full).replaceAll("\\", "/");
		if (filename.startsWith("lib/i18n/") || /(?:\.test|\.gen)\./.test(filename)) continue;
		if (entry.isDirectory()) {
			walk(full);
			continue;
		}
		if (!/\.tsx?$/.test(filename)) continue;
		const { file, messages } = analyze(fs.readFileSync(full, "utf8"), filename);
		const classified = messages.map((message) => [message.start, message.end]);
		function visit(node) {
			if (
				(ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) &&
				!classified.some(([start, end]) => node.getStart(file) >= start && node.end <= end)
			) {
				const text = ts.isTemplateExpression(node) ? node.head.text : node.text;
				const parent = node.parent;
				const attribute = ts.isJsxAttribute(parent) ? parent.name.getText(file) : "";
				if (
					/[A-Za-z]{2,} [A-Za-z]{2,}/.test(text) &&
					!/[\r\n]/.test(text) &&
					!/^(?:https?:|\/)/.test(text) &&
					!/(?:flex|text|bg|border|rounded|items|grid)-/.test(text) &&
					!/^(?:className|style|data-testid)$/.test(attribute)
				) {
					candidates.push({
						file: filename,
						line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
						text,
						context: parent.getText(file).slice(0, 240),
					});
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(file);
	}
}
for (const folder of ["app", "components", "hooks", "lib"]) walk(path.join(root, folder));
fs.writeFileSync(path.join(root, "lib/i18n/review.json"), JSON.stringify(candidates, null, 2) + "\n");
console.log(
	`${candidates.length} unclassified candidates written to lib/i18n/review.json. Review their usage before adding extraction rules.`,
);