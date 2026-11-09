import { afterEach, expect, it } from "vitest";
import { changeLocale } from "@/lib/i18n";
import { getErrorMessage } from "./baseApi";

afterEach(() => changeLocale("en"));

it("localizes known authentication errors while preserving the original response", async () => {
	const error = { data: { error: { message: "Invalid username or password" } } };
	await changeLocale("zh-CN");
	expect(getErrorMessage(error)).toBe("用户名或密码错误");
	expect(error.data.error.message).toBe("Invalid username or password");
	await changeLocale("en");
	expect(getErrorMessage(error)).toBe("Invalid username or password");
});

it("preserves unknown diagnostics and fallback messages used by control flow", async () => {
	await changeLocale("zh-CN");
	expect(getErrorMessage(new Error("user_provider: custom diagnostic"))).toBe("user_provider: custom diagnostic");
	expect(getErrorMessage(null)).toBe("An unexpected error occurred");
});