import { describe, expect, it } from "vitest";
import ts from "typescript";
import { analyze, transform } from "./compiler.mjs";

function parse(source: string) {
	return (
		ts.transpileModule(source, { fileName: "fixture.tsx", compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
			.diagnostics ?? []
	).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
}

describe("localization compiler", () => {
	it("keeps indexed type annotations unchanged inside reviewed display maps", () => {
		const source = 'const SEMANTIC_STATUS_LABELS: Record<SemanticStatusInfo["state"], string> = { ready: "Ready" };';
		const result = transform(source, "lib/types/complexityRouter.ts")!;
		expect(result).toContain('SemanticStatusInfo["state"]');
		expect(result).toContain('ready: (__bfTranslate("Ready"');
		expect(parse(result)).toEqual([]);
	});
	it("wraps reviewed custom JSX attribute literals in a JSX expression", () => {
		const result = transform('<TooltipBody heading="Of all requests in this window" />', "app/workspace/logs/views/metricStrip.tsx")!;
		expect(parse(result)).toEqual([]);
		expect(result).toContain("heading={__bfTranslate(");
	});
	it("extracts reviewed migration warnings without translating API arguments or step IDs", () => {
		const source =
			'warnings.push(`${label} is stored as a literal secret and cannot be copied; re-enter it on the Databricks provider after migrating.`); skip(STEP_IDS.createProvider, "Already configured"); api.createProvider({ name: "Already configured" });';
		const result = transform(source, "lib/utils/databricksMigration.ts")!;
		expect(analyze(source, "lib/utils/databricksMigration.ts").messages.map((item) => item.key)).toContain(
			"{0} is stored as a literal secret and cannot be copied; re-enter it on the Databricks provider after migrating.",
		);
		expect(result).toContain('api.createProvider({ name: "Already configured" })');
		expect(result).toContain('skip(STEP_IDS.createProvider, (__bfTranslate("Already configured"');
		expect(parse(result)).toEqual([]);
	});
	it("translates classifier status values while preserving status identifiers", () => {
		const source = 'const STATUS_LABELS = { disabled: "Classifier off", "not-configured": "Classifier not configured" };';
		const result = transform(source, "app/workspace/complexity-router/views/classifierStatusBadge.tsx")!;
		expect(result).toContain('"not-configured": (__bfTranslate("Classifier not configured"');
		expect(parse(result)).toEqual([]);
	});
	it("does not apply overlapping edits to plural templates in reviewed containers", () => {
		const source = 'const keysSummary = `${count} key${count > 1 ? "s" : ""}`;';
		expect(parse(transform(source, "components/ui/providerConfigCard.tsx")!)).toEqual([]);
	});
	it("extracts explicit translations inside a raw code subtree", () => {
		const source = '<code>{t("No rules defined yet")}</code>';
		expect(analyze(source, "components/test.tsx").messages.map((item) => item.key)).toEqual(["No rules defined yet"]);
	});
	it("keeps control-flow error strings in API modules unchanged", () => {
		const source = 'export function getErrorMessage() { return "An unexpected error occurred"; }';
		expect(transform(source, "lib/store/apis/baseApi.ts")).toBeNull();
	});
	it("composes a date formatter edit inside a translated template", () => {
		const source = "const view = <div>{`Latency: ${latency.toLocaleString()}ms`}</div>";
		const result = transform(source, "components/test.tsx")!;
		expect(parse(result)).toEqual([]);
		expect(result).toContain("latency.toLocaleString(__bfLocale())");
	});
	it("translates UI literals without modifying identities or request values", () => {
		const source =
			'const option = { label: "Enabled", value: "enabled" }; const payload = { model: "Enabled", role: "user" }; const view = <button data-testid="Enabled" value="enabled" title="Enable model">{option.value === "enabled" ? "Disable" : "Enable"}{userText}</button>';
		const result = transform(source, "components/test.tsx")!;
		expect(parse(result)).toEqual([]);
		expect(result).toContain('value: "enabled"');
		expect(result).toContain('model: "Enabled"');
		expect(result).toContain('option.value === "enabled"');
		expect(result).toContain('data-testid="Enabled"');
		expect(result).toContain("{userText}");
		expect(result).toContain('__bfTranslate("Disable"');
	});
	it("leaves code, user input and native option values unchanged", () => {
		const source =
			'const view = <><pre>Delete all keys</pre><code>Enabled</code><textarea>Default prompt</textarea><option>Enabled</option><span data-i18n-ignore>Enabled</span><option value="enabled">Enabled</option></>';
		const result = transform(source, "components/test.tsx")!;
		expect(result).toContain("<pre>Delete all keys</pre>");
		expect(result).toContain("<option>Enabled</option>");
		expect(result.match(/__bfTranslate\(/g)).toHaveLength(1);
	});
	it("does not translate validation field paths or arbitrary function arguments", () => {
		const source =
			'setError("name", { type: "server", message: userText }); api.save("Delete"); const view = <span>{items.find(x => x.name === "Default")?.name}</span>';
		expect(analyze(source, "components/test.tsx").messages).toEqual([]);
	});
	it("keeps descriptions and messages inside API payloads and form defaults intact", () => {
		const source =
			'const payload = { title: "Default", description: "Default model", message: "Hello" }; api.post("/models", { description: "Default model" }); const form = useForm({ defaultValues: { description: "Default model" } }); const options = [{ value: "default", label: "Default" }];';
		const result = transform(source, "components/test.tsx")!;
		expect(result).toContain('description: "Default model"');
		expect(result.match(/__bfTranslate\(/g)).toHaveLength(1);
	});
	it("extracts explicit calls without wrapping them a second time", () => {
		const source = 'const view = <span>{t("Apply and reload")}</span>';
		expect(analyze(source, "components/test.tsx").messages[0].key).toBe("Apply and reload");
		expect(transform(source, "components/test.tsx")).not.toContain('__bfTranslate("Apply and reload"');
	});
	it("never translates a status color map or CSS tokens", () => {
		const source = 'const colors = { error: "bg-red-100 text-red-800", success: "bg-green-500" };';
		expect(analyze(source, "lib/constants/logs.ts").messages).toEqual([]);
	});
});