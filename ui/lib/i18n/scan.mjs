import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "./compiler.mjs";
import bootMessages from "./bootMessages.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "lib/i18n");
const catalog = {};
for (const key of bootMessages) catalog[key] = ["index.html (pre-boot upgrade screen)"];
function walk(folder) {
	for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		const relative = path.relative(root, full).replaceAll("\\", "/");
		if (relative.startsWith("lib/i18n") || /(?:\.test|\.gen)\./.test(relative)) continue;
		if (entry.isDirectory()) walk(full);
		else if (/\.tsx?$/.test(entry.name)) {
			for (const item of analyze(fs.readFileSync(full, "utf8"), relative).messages) {
				(catalog[item.key] ??= []).push(`${relative}:${item.line} (${item.reason})`);
			}
		}
	}
}
for (const folder of ["app", "components", "hooks", "lib"]) walk(path.join(root, folder));
const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const translations = JSON.parse(fs.readFileSync(path.join(dir, "zh-CN.json"), "utf8"));
const missing = Object.keys(sorted).filter((key) => !translations[key]);
const obsolete = Object.keys(translations).filter((key) => !sorted[key]);
const invalid = Object.entries(translations)
	.filter(
		([key, value]) =>
			typeof value !== "string" ||
			JSON.stringify([...key.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort()) !==
				JSON.stringify([...String(value).matchAll(/\{\d+\}/g)].map((m) => m[0]).sort()),
	)
	.map(([key]) => key);
const overrides = JSON.parse(fs.readFileSync(path.join(dir, "overrides.json"), "utf8"));
for (const [context, entries] of Object.entries(overrides)) {
	for (const [key, value] of Object.entries(entries)) {
		if (
			typeof value !== "string" ||
			!value.trim() ||
			JSON.stringify([...key.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort()) !==
				JSON.stringify([...String(value).matchAll(/\{\d+\}/g)].map((m) => m[0]).sort())
		)
			invalid.push(`${context}: ${key}`);
	}
}
if (process.argv.includes("--check")) {
	console.log(
		JSON.stringify({ total: Object.keys(sorted).length, missing: missing.length, invalid, missingExamples: missing.slice(0, 20) }, null, 2),
	);
	if (missing.length || invalid.length) process.exitCode = 1;
} else {
	fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify(sorted, null, 2) + "\n");
	fs.writeFileSync(path.join(dir, "pending.json"), JSON.stringify(Object.fromEntries(missing.map((key) => [key, ""])), null, 2) + "\n");
	console.log(JSON.stringify({ total: Object.keys(sorted).length, missing: missing.length, obsolete: obsolete.length, invalid }, null, 2));
}