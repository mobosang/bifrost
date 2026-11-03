import { test, expect } from "../../core/fixtures/base.fixture";

test.use({ uiLanguage: "default", skipAutoLogin: true });

test("localizes MCP resources and protocol choices while keeping resource identities unchanged", async ({
  page,
}) => {
  const client = {
    config: {
      client_id: "user-server-id",
      name: "user_server",
      connection_type: "http",
      connection_string: { value: "https://example.com/mcp" },
      auth_type: "none",
      tools_to_execute: ["*"],
      tools_to_auto_execute: [],
    },
    tools: [],
    state: "healthy",
    vk_configs: [],
    prompts: [
      { name: "user_server_UserPrompt", description: "User prompt description", arguments: [] },
    ],
    resources: [
      {
        name: "UserResource",
        uri: "test://User-Resource",
        description: "User resource description",
      },
    ],
    resource_templates: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/mcp/clients")) json = { clients: [client], total_count: 1 };
    if (path.includes("/mcp/client/user-server-id")) json = client;
    await route.fulfill({ json });
  });
  await page.goto("/workspace/mcp-registry");
  await page
    .getByTestId("mcp-clients-table")
    .getByRole("button", { name: "MCP 服务器操作" })
    .click();
  await page.getByTestId("mcp-client-edit-user-server-id-menu-item").click();
  await expect(page.getByTestId("mcp-client-max-protocol-version-select")).toContainText(
    "使用全局设置",
  );
  await page.getByTestId("mcp-client-max-protocol-version-select").click();
  await expect(page.getByTestId("mcp-client-max-protocol-version-auto")).toHaveText("自动（最新）");
  await page.getByTestId("mcp-client-max-protocol-version-2025-11-25").click();
  await expect(page.getByTestId("mcp-client-max-protocol-version-select")).toContainText(
    "2025-11-25",
  );
  await page.getByTestId("mcpclient-tab-resources").click();
  await expect(page.getByTestId("mcpclient-tab-resources")).toHaveText("提示词与资源");
  await expect(page.getByTestId("mcp-expose-prompts-status")).toHaveText("全部对外提供");
  await expect(page.getByTestId("mcp-expose-resources-status")).toHaveText("全部对外提供");
  await expect(page.getByTestId("mcp-expose-resources-row-test://User-Resource")).toContainText(
    "User resource description",
  );
  await page.getByTestId("mcp-expose-resources-toggle-test://User-Resource").click();
  await expect(page.getByTestId("mcp-expose-resources-status")).toHaveText("均不对外提供");
  await expect(page.getByTestId("mcp-expose-resources-all")).toHaveAccessibleName(
    /对外提供所有资源/,
  );
});

test("localizes relay creation and preserves credentials, route names and URLs", async ({
  page,
}) => {
  let created = false;
  const relay = {
    name: "user_relay",
    base_url: "https://api.example.com/User-Path",
    auth: { type: "bearer" },
    routes: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/relays")) {
      if (route.request().method() === "POST") {
        created = true;
        json = relay;
      } else json = { relays: created ? [relay] : [], total_count: created ? 1 : 0 };
    }
    if (path.endsWith("/relays/user_relay")) json = relay;
    await route.fulfill({ json });
  });
  await page.goto("/workspace/relays");
  await expect(page.getByTestId("relays-create-first")).toHaveText("添加中继");
  await page.getByTestId("relays-create-first").click();
  await expect(page.getByTestId("relay-auth-type")).toContainText("Bearer 令牌");
  await page.getByTestId("relay-name").fill("user_relay");
  await page.getByTestId("relay-new-base-url").fill("https://api.example.com/User-Path");
  await page.getByTestId("relay-credential").fill("User-Provided-Secret");
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/relays") && req.method() === "POST",
  );
  await page.getByTestId("relay-create").click();
  expect((await request).postDataJSON()).toMatchObject({
    name: "user_relay",
    base_url: "https://api.example.com/User-Path",
    auth: { type: "bearer" },
    credential: { value: { value: "User-Provided-Secret" } },
  });
  await expect(page.getByText("中继已添加", { exact: true })).toBeVisible();
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByTestId("relay-edit-config")).toHaveAccessibleName(
    "Edit relay configuration",
  );
});

test("localizes relay settings and preserves the general tab when validation redirects to it", async ({
  page,
}, testInfo) => {
  const relay = {
    name: "user_relay",
    base_url: "https://api.example.com",
    auth: { type: "none" },
    description: "User description",
    routes: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/relays")) json = { relays: [relay], total_count: 1 };
    if (path.endsWith("/relays/user_relay")) json = relay;
    await route.fulfill({ json });
  });
  await page.goto("/workspace/relays");
  await page.getByTestId("relay-edit-config").click();
  await expect(page.getByTestId("relay-tab-general")).toHaveText("常规");
  await expect(page.getByTestId("relay-tab-general")).toHaveAttribute("data-state", "active");
  await page.getByTestId("relay-base-url").fill("invalid url");
  await page.getByTestId("relay-tab-network").click();
  await page
    .getByTestId("relay-config-sheet")
    .getByRole("button", { name: /保存.*配置/ })
    .click();
  await expect(page.getByTestId("relay-tab-general")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("relay-base-url")).toBeVisible();
  await expect(page.getByTestId("relay-config-sheet")).toContainText(
    "请输入不含查询参数、片段或用户信息的绝对 HTTP(S) URL",
  );
  await page.screenshot({ path: testInfo.outputPath("relay-settings-zh-CN.png"), fullPage: true });
});

test("localizes Warp topic settings and restores their English labels", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/feature-flags")) json = { flags: [{ id: "warp", enabled: true }] };
    if (path.endsWith("/providers")) json = { providers: [{ name: "openai", status: "active" }] };
    if (path.endsWith("/keys")) json = [];
    if (path === "/api/providers/openai/keys") json = { keys: [] };
    if (path.endsWith("/warp/config"))
      json = {
        configured: true,
        enabled: true,
        provider: "openai",
        model: "gpt-test",
        models: [],
        embedding_provider: "openai",
        embedding_model: "embedding-test",
        embedding_dimension: 1536,
        vector_store_connected: true,
        topic_discovery_min_requests: 100,
      };
    await route.fulfill({ json });
  });
  await page.goto("/workspace/config/warp");
  await expect(page.getByTestId("warp-topics-start-btn")).toHaveText("初始化主题");
  await expect(page.getByText("新主题发现阈值", { exact: true })).toBeVisible();
  await page.getByTestId("warp-topics-info").hover();
  await expect(page.getByTestId("warp-topics-info-content")).toContainText(
    "主题根据提问内容对请求分组",
  );
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByTestId("warp-topics-start-btn")).toHaveText("Seed topics");
});

test("localizes news sources, preserves feed names and URLs, and switches to English", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/notifications")) json = { notifications: [] };
    if (path.endsWith("/rss/items")) json = { enabled: true, items: [], errors: [] };
    if (path.endsWith("/rss/settings")) json = { enabled: true };
    if (path.endsWith("/rss/feeds"))
      json =
        route.request().method() === "POST"
          ? {
              id: 1,
              name: "Model Providers",
              url: "https://example.com/News.xml",
              source: "custom",
              enabled: true,
            }
          : { feeds: [] };
    await route.fulfill({ json });
  });
  await page.goto("/workspace/providers");
  await page.getByTestId("topbar-notifications-btn").click();
  await expect(page.getByTestId("notification-tab-news")).toContainText("新闻");
  await page.getByTestId("notification-tab-news").click();
  await expect(page.getByTestId("rss-empty-state")).toContainText("暂无新闻");
  await page.getByTestId("rss-sources-btn").click();
  await expect(page.getByTestId("rss-sources-sheet")).toContainText("新闻源");
  await page.getByTestId("rss-add-feed-submit").click();
  await expect(page.getByTestId("rss-add-feed-name-error")).toHaveText("为订阅源命名");
  await page.getByTestId("rss-add-feed-name").fill("Model Providers");
  await page.getByTestId("rss-add-feed-url").fill("https://example.com/News.xml");
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/rss/feeds") && req.method() === "POST",
  );
  await page.getByTestId("rss-add-feed-submit").click();
  expect((await request).postDataJSON()).toEqual({
    name: "Model Providers",
    url: "https://example.com/News.xml",
  });
  await expect(page.getByText("已添加 Model Providers", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await page.getByTestId("topbar-notifications-btn").click();
  await expect(page.getByTestId("notification-tab-news")).toContainText("News");
});

test("localizes OpenAPI server creation without changing the spec URL or operation data", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/mcp/clients")) json = { clients: [], total_count: 0 };
    if (path.endsWith("/mcp/openapi/preview"))
      json = {
        title: "User API Title",
        version: "1.0",
        openapi_version: "3.1.0",
        description: "User supplied description",
        servers: ["https://example.com"],
        base_url: "https://example.com",
        security_schemes: [],
        tools: [
          {
            name: "getModel",
            method: "GET",
            path: "/Models",
            description: "User operation description",
          },
        ],
        unsupported: [],
        warnings: [],
        tool_count: 1,
        spec_size: 100,
        spec_hash: "test-hash",
      };
    await route.fulfill({ json });
  });
  await page.goto("/workspace/mcp-registry");
  await page.getByTestId("create-mcp-client-btn").click();
  await page.getByTestId("client-name-input").fill("user_api");
  await page.getByTestId("mcp-server-source-openapi").click();
  await expect(page.getByTestId("mcp-server-source-openapi")).toContainText("从 OpenAPI 规范生成");
  await page.getByTestId("openapi-spec-source-tab-url").click();
  await page.getByTestId("openapi-spec-url-input").fill("https://example.com/Model-Providers.json");
  await expect(page.getByTestId("openapi-parse-btn")).toContainText("获取");
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/mcp/openapi/preview") && req.method() === "POST",
  );
  await page.getByTestId("openapi-parse-btn").click();
  expect((await request).postDataJSON()).toMatchObject({
    spec_url: "https://example.com/Model-Providers.json",
    client_name: "user_api",
  });
  await expect(page.getByTestId("openapi-preview-panel")).toContainText(
    "操作（1 个中有 1 个受支持）",
  );
  await expect(page.getByTestId("openapi-preview-panel")).toContainText("User API Title");
  await expect(page.getByTestId("openapi-preview-panel")).toContainText(
    "User operation description",
  );
  await expect(page.getByTestId("openapi-preview-panel")).toContainText("/Models");
});

test.beforeEach(async ({ page }) => {
  await page.route("https://getbifrost.ai/latest-release", (route) => route.fulfill({ json: {} }));
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
  await page.route("**/api/version", (route) => route.fulfill({ json: "v2.4.0" }));
  await page.route("**/api/config?*", (route) =>
    route.fulfill({ json: { is_db_connected: true, metadata: { onboarding_dismissed: true } } }),
  );
  await page.route("https://getbifrost.ai/latest-release", (route) => route.fulfill({ json: {} }));
  await page.goto("/workspace/providers");
  await expect(page.getByTestId("language-switcher-trigger")).toBeVisible();
  await expect(page.getByText("模型提供商", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "添加提供商", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await expect(page.getByText("v2.4.0", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("workspace-zh-CN.png"), fullPage: true });
});

test("shows Chinese recovery text even when the application bundle fails", async ({ page }) => {
  await page.route(/\/app\/main\.tsx(?:\?.*)?$/, (route) => route.abort());
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

test("localizes setup authentication without changing the token and can switch to English", async ({
  page,
}) => {
  await page.route("**/session/is-auth-enabled", (route) =>
    route.fulfill({
      json: {
        is_auth_enabled: false,
        has_valid_token: false,
        setup_required: true,
        setup_token_configured: true,
      },
    }),
  );
  await page.route("**/api/config", (route) =>
    route.fulfill({ status: 401, json: { error: "setup required" } }),
  );
  await page.route("**/session/setup", (route) =>
    route.fulfill({ status: 403, json: { error: "invalid token" } }),
  );
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "完成 Bifrost 设置" })).toBeVisible();
  await page.getByTestId("setup-token-input").fill("User-Token-Model-Providers");
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/session/setup") && req.method() === "POST",
  );
  await page.getByTestId("setup-token-submit").click();
  expect((await request).headers()["x-bifrost-setup-token"]).toBe("User-Token-Model-Providers");
  await expect(page.getByTestId("setup-token-error")).toHaveText("设置令牌无效");
  expect(await page.evaluate(() => sessionStorage.getItem("bifrost-setup-token"))).toBeNull();
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByRole("heading", { name: "Finish setting up Bifrost" })).toBeVisible();
});

test("explains missing setup configuration in Chinese and preserves configuration examples", async ({
  page,
}) => {
  await page.route("**/session/is-auth-enabled", (route) =>
    route.fulfill({
      json: {
        is_auth_enabled: false,
        has_valid_token: false,
        setup_required: true,
        setup_token_configured: false,
      },
    }),
  );
  await page.route("**/api/config", (route) =>
    route.fulfill({ status: 403, json: { error: "setup token missing" } }),
  );
  await page.goto("/login");
  await expect(page.getByText("此服务器尚未配置设置令牌，暂时无法继续设置。")).toBeVisible();
  await expect(page.getByTestId("setup-token-input")).toHaveCount(0);
  await expect(page.getByTestId("setup-token-instructions").locator("pre")).toHaveText(
    '{ "setup_token": "env.BIFROST_SETUP_TOKEN" }',
  );
});

test("localizes the v2.2.1 Virtual MCP wizard and preserves its submitted values", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path.endsWith("/config"))
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/version")) json = "2.2.1";
    if (path.endsWith("/mcp/virtual-mcps")) {
      json =
        route.request().method() === "POST"
          ? { virtual_mcp: { id: 42, name: "Model Providers", endpoint_slug: "model-providers" } }
          : { virtual_mcps: [], total_count: 0 };
    }
    await route.fulfill({ json });
  });
  await page.route("https://getbifrost.ai/latest-release", (route) => route.fulfill({ json: {} }));
  await page.goto("/workspace/virtual-mcps");
  await expect(page.getByTestId("virtual-mcp-create-btn")).toContainText("添加虚拟 MCP");
  await page.getByTestId("virtual-mcp-create-btn").click();
  await expect(page.getByTestId("virtual-mcp-wizard-step-general")).toContainText("常规");
  await page.getByTestId("virtual-mcp-name-input").fill("Model Providers");
  await page.getByTestId("virtual-mcp-slug-input").fill("model-providers");
  await page.getByTestId("virtual-mcp-description-input").fill("User supplied description");
  for (let step = 0; step < 3; step++) await page.getByTestId("virtual-mcp-wizard-next").click();
  await expect(page.getByTestId("virtual-mcp-review-endpoint")).toContainText("model-providers");
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/mcp/virtual-mcps") && req.method() === "POST",
  );
  await page.getByTestId("virtual-mcp-wizard-next").click();
  expect((await request).postDataJSON()).toEqual({
    name: "Model Providers",
    endpoint_slug: "model-providers",
    description: "User supplied description",
    enabled: true,
    tools: [],
  });
  await expect(page.getByText("虚拟 MCP 已创建", { exact: true })).toBeVisible();
});

test("localizes the new classifier status and restores English after switching", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path.endsWith("/config"))
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/version")) json = "2.2.1";
    if (path.endsWith("/complexity-analyzer-config"))
      json = { keywords: { simple_keywords: [], medium_keywords: [], complex_keywords: [] } };
    if (path.endsWith("/keys")) json = [];
    await route.fulfill({ json });
  });
  await page.route("https://getbifrost.ai/latest-release", (route) => route.fulfill({ json: {} }));
  await page.goto("/workspace/complexity-router");
  await expect(page.getByRole("radio", { name: /^决策模型/ })).toBeVisible();
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByRole("radio", { name: /^Decision model/ })).toBeVisible();
});

test("localizes A2A registration and leaves card URLs and agent names unchanged", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path.endsWith("/config"))
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/agents")) json = { agents: [], count: 0 };
    if (path.endsWith("/agents/inspect"))
      json = {
        name: "User Agent Name",
        description: "User supplied card description",
        capabilities: {},
        signature_count: 0,
        security_schemes: [],
        security_requirements: [],
      };
    await route.fulfill({ json });
  });
  await page.goto("/workspace/agent-gateway");
  await expect(page.getByTestId("create-agent-btn")).toHaveAccessibleName("注册首个智能体");
  await page.getByTestId("create-agent-btn").click();
  await expect(page.getByRole("heading", { name: "新建智能体", exact: true })).toBeVisible();
  await page.getByTestId("agent-name-input").fill("model-providers");
  await page
    .getByTestId("agent-card-url-input")
    .fill("https://agent.example.com/Model-Providers.json");
  const inspect = page.waitForRequest(
    (req) => req.url().endsWith("/agents/inspect") && req.method() === "POST",
  );
  await page.getByTestId("agent-card-fetch-button").click();
  expect((await inspect).postDataJSON()).toEqual({
    agent_card_url: "https://agent.example.com/Model-Providers.json",
  });
  await expect(page.getByText("User supplied card description").first()).toBeVisible();
  const save = page.waitForRequest(
    (req) => req.url().endsWith("/agents") && req.method() === "POST",
  );
  await page.getByTestId("agent-save-button").click();
  expect((await save).postDataJSON()).toMatchObject({
    name: "model-providers",
    agent_card_url: "https://agent.example.com/Model-Providers.json",
    enabled: true,
  });
  await expect(page.getByText(/智能体注册成功/)).toBeVisible();
});

test("localizes Warp settings, keeps its launcher and restores English", async ({
  page,
}, testInfo) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/version")) json = "v2.4.0";
    if (path.endsWith("/session/is-auth-enabled"))
      json = { is_auth_enabled: false, has_valid_token: true };
    if (path === "/api/config")
      json = { is_db_connected: true, metadata: { onboarding_dismissed: true } };
    if (path.endsWith("/feature-flags")) json = { flags: [{ id: "warp", enabled: true }] };
    if (path.endsWith("/warp/config"))
      json = { enabled: false, provider: "", model: "", models: [] };
    if (path.endsWith("/keys")) json = [];
    await route.fulfill({ json });
  });
  await page.goto("/workspace/config/warp");
  await expect(page.getByTestId("warp-config-view")).toBeVisible();
  await expect(page.getByTestId("warp-no-providers")).toContainText(
    "尚未配置提供商。Warp 需要通过提供商运行模型。",
  );
  await expect(page.getByTestId("topbar-warp-btn")).toHaveAccessibleName("询问 Warp");
  await page.screenshot({ path: testInfo.outputPath("warp-zh-CN.png"), fullPage: true });
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-switcher-select").selectOption("en-US");
  await page.getByTestId("language-switcher-apply").click();
  await expect(page.getByTestId("warp-no-providers")).toContainText(
    "No provider is configured yet. Warp needs one to run its model on.",
  );
  await expect(page.getByTestId("topbar-warp-btn")).toHaveAccessibleName("Ask Warp");
});