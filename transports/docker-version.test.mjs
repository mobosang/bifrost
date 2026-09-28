import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Exercise the actual Docker RUN shell, replacing only the expensive compiler.
const cwd = fileURLToPath(new URL(".", import.meta.url));
const release = readFileSync(new URL("version", import.meta.url), "utf8").trim();
const shell = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/sh";
for (const filename of ["Dockerfile", "Dockerfile.local"]) {
	const dockerfile = readFileSync(new URL(filename, import.meta.url), "utf8");
	const block = dockerfile.replaceAll(/\\\r?\n/g, " ").match(/^[ \t]*RUN [^\r\n]+/gm).find((command) => command.includes("go build"));
	const command = block.replace(/^\s*RUN /, "").replaceAll(/\\\r?\n/g, " ").replace("cd /build/transports &&", "");
	for (const [version, expected] of [["", release], ["unknown", release], ["2.2.3-zh", "2.2.3-zh"], ["v2.2.3-custom", "2.2.3-custom"]]) {
		test(`${filename}: VERSION=${JSON.stringify(version)} embeds v${expected}`, () => {
			const output = execFileSync(shell, ["-c", 'go() { printf "%s\\n" "$@"; }; ' + command], { cwd, env: { ...process.env, VERSION: version }, encoding: "utf8" });
			assert.ok(output.includes(`main.Version=v${expected} `), output);
		});
	}
}
