# WebUI 语言维护与 Docker 发布

本分支基于官方正式版 [Bifrost HTTP v2.5.0](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.5.0)，通过正常 merge 保留上游历史。

## 语言方案

v2.5.0 已引入原生 i18next 和 11 种语言。本分支改用该实现，移除旧版 AST 翻译器、重复词库和自定义语言弹窗，避免后续维护两套翻译机制。

- 默认简体中文，不随浏览器的英文偏好改变；已保存的其他语言继续有效。
- 旧版 `bifrost.locale=en-US` 和 `bifrost_locale` cookie 自动兼容为原生 `en`。localStorage 不可用时使用 cookie；两者都不可用时仍可切换当前页面语言。
- 登录、首次设置、工作区账户菜单和客户端设置均可切换语言。切换立即生效，不刷新页面，也不提交服务器配置。
- 翻译位于 `ui/locales/zh-CN/`，与上游使用相同的命名空间、键、占位符和复数规则。本次校正 120 处界面文案，并为常见认证错误补充原生翻译键。
- `plugin.mts` 仅翻译 `index.html` 中主包加载失败时的升级恢复提示；页面组件完全使用原生 i18next。恢复提示不依赖主 JavaScript 包。

用户输入、模型输出、提供商及模型 ID、凭据、协议字段、原始日志和代码示例保留原值。已知认证和网络错误在显示时翻译；未知后端或第三方诊断保留原文，日志存储的控制流回退消息也保持原值。企业版私有页面不在此仓库内。

汉化改动仅作用于前端；后端 Go 源码与官方发布标签一致，不增加 Go 推理请求路径的耗时或分配，因此无需新增请求路径基准或付费提供商 harness 测试。

## 后续同步与增量翻译

1. 核对官方最新正式发布标签，再正常 merge 对应 `transports/vX.Y.Z`，保留本分支的中文默认值、偏好兼容和 Docker 版本注入。不要把上游开发分支作为正式版基线。
2. 查看 `ui/locales/en/` 的增量，补齐 `ui/locales/zh-CN/`。新增键时按根目录 `AGENTS.md` 同步所有语言，保留 `{{placeholders}}`、`<Trans>` 标签和数组形状。不要重新序列化整个词库文件。
3. 新增界面文字使用 `useTranslation(namespace)` 或 `i18n.t(key, { ns })`；不要翻译接口载荷、枚举和状态比较值。
4. 在 `ui/` 中执行：

```sh
npm ci
npm run i18n:check
node node_modules/vitest/vitest.mjs run --maxWorkers=4 --testTimeout=15000
npm run build
```

`npm run i18n:check -- --untranslated --json` 可列出与英文相同的候选，审查其中的 `zh-CN` 部分；SDK、OAuth、URL、示例请求头和品牌名允许保留。默认完整性检查必须退出 0。只格式化本次实际修改的文件，避免格式化整个项目。

UI 单元测试和原有功能 E2E 固定英文，以保留上游断言。`tests/e2e/i18n.config.ts` 专门运行 mock API 的 `language.spec.ts`，覆盖默认中文、旧偏好迁移、三处语言入口、输入与请求值保护和恢复界面：

```sh
# 终端 1：ui 目录
npm run dev

# 终端 2：tests/e2e 目录
npm ci
npx playwright install chromium
npx playwright test --config=i18n.config.ts
```

已有服务器时设置 `SKIP_WEB_SERVER=1`；用 `BASE_URL` 指定地址，`PLAYWRIGHT_CHANNEL=msedge` 可使用本机 Edge。上游 `language-switcher.spec.ts` 仍通过原有完整后端 E2E 流程运行。

## Docker Hub 发布

镜像仓库为 [jjjjmo/bifrost](https://hub.docker.com/r/jjjjmo/bifrost)，发布架构为 `linux/amd64`。

在 GitHub 仓库 Settings → Secrets and variables → Actions → **Secrets** 中添加两个 Repository secrets：

- `DOCKER_USERNAME`：Docker ID，当前为 `jjjjmo`。
- `DOCKER_PASSWORD`：具有 Read & Write 权限的 Docker Hub PAT。

Actions 中手动运行 **Publish Chinese Docker image**（`dockerhub-zh.yml`）。该工作流只在本仓库运行，顺序为：翻译检查及单元测试 → 从当前提交构建完整镜像 → 在隔离数据卷测试从官方 v2.4.0 升级并保留已存储的配置元数据 → 校验运行时版本 → 用 Chromium 测试镜像中实际构建的 WebUI → 推送 Docker Hub。任何检查失败都不会进入推送步骤。

发布标签：`2.5.0-zh`、`2.5.0`、`latest` 和 `sha-<提交前12位>`。版本和镜像标签随 `transports/version` 更新；容器中显示 `v2.5.0-zh`。工作流汇总记录提交和镜像 digest，便于部署固定版本。

本地构建也可以使用：

```sh
docker build -f transports/Dockerfile.local --build-arg VERSION=2.5.0-zh -t bifrost-zh:2.5.0 .
```

`transports/Dockerfile` 和 `.local` 在未传 VERSION 或其值为 unknown 时从 `transports/version` 读取版本，避免 `vunknown`，并兼容带或不带 `v` 的自定义版本。回归检查为 `node --test transports/docker-version.test.mjs`。

## 已部署设备升级

在当前 Compose 文件中只修改镜像，保留原来的端口、环境变量和整个数据挂载：

```yaml
services:
  bifrost:
    image: jjjjmo/bifrost:2.5.0-zh
    container_name: bifrost
    restart: unless-stopped
    ports:
      - "30120:8080"
    volumes:
      - /mnt/user/appdata/bifrost/data:/app/data
    environment:
      - APP_HOST=0.0.0.0
      - APP_PORT=8080
      - LOG_LEVEL=info
      - LOG_STYLE=json
```

在 Compose 目录先拉取镜像，再停服备份整个数据目录；确认备份成功后重建容器：

```sh
docker compose pull bifrost
docker compose stop bifrost
tar -czf "/mnt/user/appdata/bifrost-backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /mnt/user/appdata/bifrost data
# 确认备份成功后继续。
docker compose up -d --no-deps bifrost
docker compose logs --tail=100 bifrost
```

不要删除持久化数据目录或让新旧容器同时写入同一数据库。升级可能执行不可逆的数据库迁移；回退旧镜像时应同时恢复升级前的备份。发布镜像不会自动修改你的已部署设备。

## 升级前需要核对

- v2.5.0 包含工作负载身份、MCP 按用户发现、提示词缓存和中继日志等数据库迁移，部分不可逆。隔离卷的升级测试不代替你的真实配置和数据库验证。详见[官方发布说明](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.5.0)。
- 从 v2.4.0 以前升级：GitHub Copilot 不再支持 GitHub App 安装认证；需改用 PAT、GitHub OAuth 令牌或设备登录。MCP 浏览器来源限制和提示词/资源权限也需核对。
- 从 v2.3.x 以前升级：Agent Gateway 和技能市场需要配置公共 URL；新增提供商和虚拟密钥默认行为应按官方迁移说明核对。
- 尚未启用管理界面认证时，管理 API 要求设置令牌。可在原 Compose 的 environment 中加入 `BIFROST_SETUP_TOKEN=自行生成的高强度随机令牌`，重启后在设置页面输入并创建管理员。已启用管理界面认证的部署不需要为汉化额外更改认证配置。
- 使用 MCP OAuth 发现时，须配置有效的 `oauth2_server_config.issuer_url`。这些限制来自上游，汉化不绕过认证。

未运行付费提供商测试，也未访问或修改你的生产设备及持久化数据。发布流程的测试使用隔离卷和模拟 UI API。
