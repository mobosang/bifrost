import { test, expect } from "../../core/fixtures/base.fixture";

test.use({ uiLanguage: "default", skipAutoLogin: true });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/session/is-auth-enabled")) {
      await route.fulfill({ json: { is_auth_enabled: true, has_valid_token: false } });
    } else if (url.pathname.endsWith("/session/login")) {
      await route.fulfill({
        status: 401,
        json: { error: { message: "Invalid username or password" } },
      });
    } else {
      await route.fulfill({ json: {} });
    }
  });
});

test("defaults to Chinese, preserves input when cancelled, persists English and switches back", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await page.locator("#username").fill("User-provided Name");
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-cancel").click();
  await expect(page.locator("#username")).toHaveValue("User-provided Name");
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("zh-CN");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
});

test("localizes labels without changing submitted credentials", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#username").fill("Model Providers");
  await page.locator("#password").fill("Secret-User-Value");
  const request = page.waitForRequest(
    (request) => request.url().endsWith("/session/login") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "登录", exact: true }).click();
  expect((await request).postDataJSON()).toEqual({
    username: "Model Providers",
    password: "Secret-User-Value",
  });
  await expect(page.getByText("用户名或密码错误", { exact: true })).toBeVisible();
});

test("localizes the workspace navigation and provider empty state", async ({ page }, testInfo) => {
  await page.route("**/session/is-auth-enabled", (route) =>
    route.fulfill({ json: { is_auth_enabled: false, has_valid_token: true } }),
  );
  await page.route("**/api/version", (route) => route.fulfill({ json: "1.0.0" }));
  await page.route("**/api/config?*", (route) =>
    route.fulfill({ json: { is_db_connected: true, metadata: { onboarding_dismissed: true } } }),
  );
  await page.route("https://getbifrost.ai/latest-release", (route) => route.fulfill({ json: {} }));
  await page.goto("/workspace/providers");
  await expect(page.getByTestId("language-switcher-trigger")).toBeVisible();
  await expect(page.getByText("模型提供商", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("添加提供商", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("workspace-zh-CN.png"), fullPage: true });
});

test("shows Chinese recovery text even when the application bundle fails", async ({ page }) => {
  await page.route("**/app/main.tsx", (route) => route.abort());
  await page.route("**/assets/i18n-test-missing.js", (route) => route.abort());
  await page.goto("/login");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "/assets/i18n-test-missing.js";
    document.body.append(script);
  });
  await expect(page.getByRole("heading", { name: "Bifrost 正在升级" })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即刷新" })).toBeVisible();
});

test("ignores an unsupported saved locale", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bifrost.locale", "unsupported"));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
});