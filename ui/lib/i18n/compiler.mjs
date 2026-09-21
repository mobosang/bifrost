import ts from "typescript";
import rules from "./rules.json" with { type: "json" };

// Only presentation positions are eligible. Never rewrite arbitrary strings,
// comparison operands, object keys, API values, routes, or user supplied data.
const attributes = new Set([
	"placeholder",
	"title",
	"aria-label",
	"aria-description",
	"alt",
	"label",
	"description",
	"emptyMessage",
	"loadingMessage",
	"searchPlaceholder",
	"disabledReason",
	"tooltip",
	"helperText",
	"buttonText",
	"confirmText",
	"cancelText",
	"entity",
	"secondaryTotalLabel",
	"totalLabel",
	"emptyTitle",
	"emptyDescription",
	"noOptionsMessage",
	"loadingText",
	"emptyText",
]);
const properties = new Set([
	"label",
	"title",
	"description",
	"placeholder",
	"message",
	"helperText",
	"tooltip",
	"emptyMessage",
	"disabledReason",
	"header",
	"error",
	"required",
	"successMessage",
	"errorMessage",
	"buttonText",
	"aria-label",
	"aria-description",
	"shortLabel",
	"helpText",
	"validate",
]);
const rawElements = /^(pre|code|script|style|textarea|Streamdown|Markdown|CodeBlock|CodeEditor|MonacoEditor|Editor|SyntaxHighlighter)$/;
const displayCalls = /^(toast\.(success|error|warning|info|message|loading)|setErrorMessage|setSuccessMessage|useSetTopbarTitle)$/;
const validationMethods = new Set([
	"min",
	"max",
	"length",
	"regex",
	"email",
	"url",
	"nonempty",
	"positive",
	"nonnegative",
	"int",
	"required",
	"gt",
	"lt",
	"gte",
	"lte",
	"refine",
	"number",
]);
const displayVariable = /(?:[Ll]abel|[Tt]itle|[Mm]essage|[Dd]escription|[Pp]laceholder|[Tt]ooltip|[Hh]elperText|[Ee]rror|[Ee]rrorText)$/;
for (const name of [
	"hint",
	"emptyIndicator",
	"destination",
	"audienceTooltip",
	"clientIdTooltip",
	"useIdPCredentialsRequiredWarning",
	"entityLabelPlural",
])
	attributes.add(name);

function displayFunction(node, file, filename) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (ts.isFunctionLike(parent)) {
			let owner = parent.parent;
			if (ts.isCallExpression(owner) && /^(useMemo|useCallback)$/.test(owner.expression.getText(file))) owner = owner.parent;
			const name =
				parent.name?.getText(file) || (ts.isVariableDeclaration(owner) || ts.isPropertyAssignment(owner) ? owner.name.getText(file) : "");
			return (
				/^(?:get|derive).*(?:Label|Title|Description|Message|Tooltip|Display)|^format|^validate|^relativeTime|(?:Label|Title|HelpText|Error|Validation)$/.test(
					name,
				) || (rules.functions[filename] ?? []).includes(name)
			);
		}
	}
	return false;
}

export function normalize(text) {
	return text.replace(/\s+/g, " ").trim();
}

function jsxText(text) {
	const lines = text.replace(/\r/g, "").split("\n");
	return lines
		.map((line, i) => {
			line = line.replace(/\t/g, " ");
			if (i) line = line.replace(/^ +/, "");
			if (i < lines.length - 1) line = line.replace(/ +$/, "");
			return line;
		})
		.filter(Boolean)
		.join(" ")
		.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|ldquo|rdquo|rarr);/gi, (_, entity) => {
			if (entity[0] === "#")
				return String.fromCodePoint(entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
			return {
				amp: "&",
				lt: "<",
				gt: ">",
				quot: '"',
				apos: "'",
				nbsp: "\u00a0",
				hellip: "…",
				mdash: "—",
				ndash: "–",
				ldquo: "“",
				rdquo: "”",
				rarr: "→",
			}[entity];
		});
}

export function analyze(source, filename) {
	const file = ts.createSourceFile(
		filename,
		source,
		ts.ScriptTarget.Latest,
		true,
		filename.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const messages = [];
	const localeEdits = [];
	const seen = new Set();
	function argument(node) {
		if (ts.isConditionalExpression(node)) {
			const choices = [node.whenTrue, node.whenFalse];
			if (choices.every((choice) => ts.isStringLiteralLike(choice) && ["", "s", "es"].includes(choice.text)))
				return `(__bfLocale() === "zh-CN" ? "" : (${node.getText(file)}))`;
			return `(${node.condition.getText(file)} ? ${argument(node.whenTrue)} : ${argument(node.whenFalse)})`;
		}
		if (ts.isStringLiteralLike(node) && /[A-Za-z]/.test(node.text)) {
			record(node, "template-value");
			return `__bfTranslate(${JSON.stringify(node.text)}, undefined, ${JSON.stringify(filename)})`;
		}
		return node.getText(file);
	}
	function record(node, reason, jsx = false) {
		if (!node) return;
		if (seen.has(node.pos)) return;
		if (messages.some((message) => message.start <= node.getStart(file) && message.end >= node.end)) return;
		let text;
		let values = [];
		if (ts.isTemplateExpression(node)) {
			text = node.head.text;
			for (const [i, span] of node.templateSpans.entries()) {
				text += `{${i}}` + span.literal.text;
				values.push(argument(span.expression));
			}
		} else if (ts.isStringLiteralLike(node)) text = jsx ? jsxText(node.text) : node.text;
		else if (ts.isJsxText(node)) text = jsxText(node.text);
		else return;
		if (!/[a-zA-Z]/.test(text) || /^\s*(https?:\/\/|\/|@|\$\{|--)/.test(text)) return;
		const leading = text.match(/^\s*/)[0];
		const trailing = text.match(/\s*$/)[0];
		const key = normalize(text);
		if (!key) return;
		if (
			/^(?:env\.[\w]+|[A-Z][A-Z0-9]*_[A-Z0-9_]+)$/.test(key) ||
			/^data:/.test(key) ||
			/^[\w.-]+\.(?:json|toml|yaml|yml|py|ts|js|md)$/.test(key)
		)
			return;
		if (
			/^[├└│]/.test(key) ||
			/^#[\da-f]{3,8}$/i.test(key) ||
			/^\{[A-Za-z_]\w*\}$/.test(key) ||
			/^(?:\{\d+\}|\d+(?:\.\d+)?)\s*(?:B|KB|MB|GB|TB|ms|ns|µs|tok\/s)$/.test(key) ||
			/^(?:bg-|text-|border-|var\(|rgba?\(|[a-z]+:\/\/)/.test(key)
		)
			return;
		seen.add(node.pos);
		messages.push({
			key,
			values,
			start: node.getStart(file),
			end: node.end,
			line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
			reason,
			jsx,
			leading,
			trailing,
		});
	}
	function value(node, reason, jsx = false) {
		if (!node) return;
		if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return value(node.expression, reason);
		if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) return value(node.body, reason);
		if (ts.isConditionalExpression(node)) {
			value(node.whenTrue, reason);
			value(node.whenFalse, reason);
		} else if (
			ts.isBinaryExpression(node) &&
			[ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(
				node.operatorToken.kind,
			)
		) {
			value(node.right, reason);
		} else record(node, reason, jsx);
	}
	function containerName(node) {
		for (let parent = node.parent; parent; parent = parent.parent) {
			if (ts.isVariableDeclaration(parent)) return parent.name.getText(file);
			if (ts.isStatement(parent)) break;
		}
		return "";
	}
	function isPayload(node) {
		for (let parent = node.parent; parent; parent = parent.parent) {
			if (ts.isFunctionLike(parent) || ts.isJsxElement(parent)) break;
			if (ts.isPropertyAssignment(parent) && /^(defaultValues|initialValues|payload|body|messages|prompt)$/.test(parent.name.getText(file)))
				return true;
			if (
				ts.isVariableDeclaration(parent) &&
				/(?:payload|requestBody|formData|initialValues|defaultValues)/i.test(parent.name.getText(file))
			)
				return true;
			if (
				ts.isCallExpression(parent) &&
				/(?:\bfetch|\buseState|\bsetValue|\breset|\.(?:post|put|patch)|\b(?:create|update|save|submit)\w*)\s*$/.test(
					parent.expression.getText(file),
				)
			)
				return true;
		}
		return false;
	}
	function visit(node, raw = false) {
		if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
			const opening = ts.isJsxElement(node) ? node.openingElement : node;
			raw ||=
				rawElements.test(opening.tagName.getText(file)) ||
				opening.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(file) === "data-i18n-ignore");
			// A native option without an explicit value submits its text.
			if (
				opening.tagName.getText(file) === "option" &&
				!opening.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(file) === "value")
			)
				raw = true;
		}
		if (raw) {
			// Explicit calls remain extractable inside code/ignored subtrees.
			if (ts.isCallExpression(node) && node.expression.getText(file) === "t") record(node.arguments[0], "explicit");
			ts.forEachChild(node, (child) => visit(child, true));
			return;
		}
		if (ts.isStringLiteralLike(node) && (rules.literals?.[filename] ?? []).includes(node.text)) record(node, "reviewed-literal");
		if (ts.isTemplateExpression(node) && (rules.templatePrefixes?.[filename] ?? []).includes(node.head.text))
			record(node, "reviewed-template");
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			const target = ts.isElementAccessExpression(node.left) ? node.left.expression.getText(file) : node.left.getText(file);
			if ((rules.variables?.[filename] ?? []).includes(target)) value(node.right, "reviewed-assignment");
		}
		if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && (rules.variables?.[filename] ?? []).includes(node.name.getText(file)))
			value(node.initializer, "reviewed-variable");
		if (ts.isJsxText(node)) record(node, "jsx-text", true);
		if (
			ts.isJsxAttribute(node) &&
			(attributes.has(node.name.getText(file)) || /(?:Label|Placeholder|Description|Message|Text)$/.test(node.name.getText(file))) &&
			node.initializer
		)
			value(node.initializer, `attribute:${node.name.getText(file)}`, ts.isStringLiteral(node.initializer));
		if (
			ts.isJsxAttribute(node) &&
			node.name.getText(file) === "name" &&
			ts.isJsxOpeningLikeElement(node.parent.parent) &&
			/^(Area|Bar|Line|Pie|XAxis|YAxis|Radar)$/.test(node.parent.parent.tagName.getText(file))
		)
			value(node.initializer, "chart-name", !!node.initializer && ts.isStringLiteral(node.initializer));
		if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) value(node.expression, "jsx-expression");
		if (
			(ts.isBindingElement(node) || ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
			(displayVariable.test(node.name.getText(file)) || node.name.getText(file) === "noResultsText") &&
			!filename.startsWith("lib/store/")
		)
			value(node.initializer, "display-variable");
		if (
			(ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) &&
			(rules.containers[filename] ?? []).includes(containerName(node)) &&
			!(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
		)
			record(node, "reviewed-container");
		if (ts.isPropertyAssignment(node) && properties.has(node.name.getText(file).replace(/^["']|["']$/g, ""))) {
			// API modules and schema/config data carry descriptions/messages too.
			// Only UI source and the explicitly reviewed validation schema qualify.
			if (
				!isPayload(node) &&
				(filename.endsWith("tsx") ||
					filename.startsWith("app/") ||
					/lib\/(?:constants|config|schemas|types)\//.test(filename) ||
					filename.endsWith("utils/timeRange.ts") ||
					(rules.propertyContainers?.[filename] ?? []).includes(containerName(node)))
			)
				value(node.initializer, `property:${node.name.getText(file)}`);
		}
		if (
			ts.isPropertyAssignment(node) &&
			(rules.textArrays[filename] ?? []).includes(node.name.getText(file)) &&
			ts.isArrayLiteralExpression(node.initializer)
		)
			for (const entry of node.initializer.elements) value(entry, "reviewed-text-array");
		if (
			ts.isPropertyAssignment(node) &&
			filename === "app/workspace/docs/page.tsx" &&
			["content", "badge"].includes(node.name.getText(file))
		)
			value(node.initializer, "documentation-card");
		if (ts.isCallExpression(node)) {
			const name = node.expression.getText(file);
			if (name === "t") record(node.arguments[0], "explicit");
			if (displayCalls.test(name)) value(node.arguments[0], `call:${name}`);
			if (/^set\w+(?:Error|ErrorMessage|SuccessMessage)$/.test(name)) value(node.arguments[0], "message-setter");
			if (name === "setError" && node.arguments.length === 1) value(node.arguments[0], "message-setter");
			if (/^(announce|onValueError)$/.test(name)) value(node.arguments[0], "display-message");
			if (/^Validator\./.test(name)) value(node.arguments[node.arguments.length - 1], "validator-message");
			if (
				ts.isPropertyAccessExpression(node.expression) &&
				/^(toLocaleString|toLocaleDateString|toLocaleTimeString)$/.test(node.expression.name.text)
			) {
				const first = node.arguments[0];
				if (!first) localeEdits.push({ start: node.arguments.pos, end: node.arguments.pos, code: "__bfLocale()" });
				else if (ts.isStringLiteral(first) && ["en-US", "default"].includes(first.text))
					localeEdits.push({ start: first.getStart(file), end: first.end, code: "__bfLocale()" });
			}
			if (
				ts.isPropertyAccessExpression(node.expression) &&
				validationMethods.has(node.expression.name.text) &&
				(/schemas\.ts$/.test(filename) || /^z\s*\./.test(name))
			) {
				// A string limit/pattern is never an error message: numeric/pattern
				// methods take the message as their second argument.
				const method = node.expression.name.text;
				value(node.arguments[["min", "max", "length", "regex", "gt", "lt", "gte", "lte", "refine"].includes(method) ? 1 : 0], "validation");
			}
		}
		if (
			ts.isReturnStatement(node) &&
			!filename.startsWith("lib/store/") &&
			(filename.endsWith("types/schemas.ts") || displayFunction(node, file, filename))
		)
			value(node.expression, "display-return");
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "date-fns")
			localeEdits.push({ start: node.moduleSpecifier.getStart(file), end: node.moduleSpecifier.end, code: '"@/lib/i18n/dates"' });
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "sonner")
			localeEdits.push({ start: node.moduleSpecifier.getStart(file), end: node.moduleSpecifier.end, code: '"@/lib/i18n/notifications"' });
		ts.forEachChild(node, (child) => visit(child, raw));
	}
	visit(file);
	return { file, messages, localeEdits };
}

export function transform(source, filename) {
	let { messages, localeEdits } = analyze(source, filename);
	if (!messages.length && !localeEdits.length) return null;
	// Resolve inner formatter changes before replacing outer template literals.
	// Editing both against the original offsets would corrupt nested expressions.
	for (const edit of localeEdits.sort((a, b) => b.start - a.start))
		source = source.slice(0, edit.start) + edit.code + source.slice(edit.end);
	if (localeEdits.length) messages = analyze(source, filename).messages;
	const edits = messages
		.filter((message) => !["explicit", "template-value"].includes(message.reason))
		.map((message) => {
			const args = [
				JSON.stringify(message.key),
				message.values.length ? `[${message.values.join(", ")}]` : "undefined",
				JSON.stringify(filename),
			];
			let code = `__bfTranslate(${args.join(", ")})`;
			if (message.leading) code = `${JSON.stringify(message.leading)} + ${code}`;
			if (message.trailing) code += ` + ${JSON.stringify(message.trailing)}`;
			return { ...message, code: message.jsx ? `{${code}}` : `(${code})` };
		});
	let code = source;
	for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.code + code.slice(edit.end);
	return `import { t as __bfTranslate, getLocale as __bfLocale } from "@/lib/i18n/runtime";\n${code}`;
}