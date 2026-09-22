# WebUI 语言维护

默认简体中文（`zh-CN`），可在登录页或工作区顶部切换为 English（`en-US`）。选择保存在当前浏览器的 localStorage，受限时尝试 cookie。切换前会提示保存编辑，确认后刷新页面，确保模块级菜单、校验规则和记忆化结果使用同一种语言。其他浏览器不受影响。

## 上游版本基线

截至 2026-09-22，本汉化分支已合并官方最新正式版 [Bifrost HTTP v2.2.1](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.1)。对应 Git 标签为 `transports/v2.2.1`，提交为 `6493abd3d1422c9bfde95f242fd57b38e73ce881`。此前汉化提交 `96ae983` 基于较早的开发分支，不能当作 v2.2.1。

本次使用正常 merge 保留上游历史。汉化只扩展界面翻译层和测试；`core`、`framework`、`plugins`、`transports` 中的受跟踪文件与该官方标签一致。后续更新应先核对官方最新正式发布标签，再合并该标签，不把持续变化的开发分支当作正式版。

### Docker 部署

官方 `maximhq/bifrost:latest` 不含本仓库汉化。可从本仓库 `dev` 分支构建镜像；生产部署建议先记录并固定已验证的提交：

```sh
git clone --branch dev https://github.com/mobosang/bifrost.git bifrost-zh
cd bifrost-zh
git rev-parse HEAD
docker build -f transports/Dockerfile.local --build-arg VERSION=2.2.1-zh -t bifrost-zh:2.2.1 .
```

已有 Compose 只需将 `image` 改为 `bifrost-zh:2.2.1`，保留原端口和数据挂载 `/mnt/user/appdata/bifrost/data:/app/data`。先在 Compose 目录停止服务并备份数据，再重建容器：

```sh
docker compose stop bifrost
tar -czf "/mnt/user/appdata/bifrost-backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /mnt/user/appdata/bifrost data
# 确认备份成功后执行；Compose 的 image 此时应已改为上面构建的镜像。
docker compose up -d --no-deps --pull never bifrost
docker compose logs --tail=100 bifrost
```

此操作保留现有持久化数据目录；官方版本升级可能执行数据库迁移，回退旧镜像时应一并恢复升级前备份。此仓库更新本身不会修改已部署设备，也不会自动发布 Docker 镜像。

## 方案与改动边界

保持原页面、路由、接口、目录和英文源文案。`vite.config.mts` 接入本目录的 Vite 插件，在编译时把已识别的展示文案转换为词库查询；不修改磁盘上的原组件，不遍历或改写 DOM，不依赖在线翻译服务，不增加 npm 依赖。英文模式直接使用源文案。

- `compiler.mjs`：使用项目已有 TypeScript AST 识别 JSX 文本、展示属性、标签、校验和提示。动态插值保留原值；不批量替换字符串、请求载荷、比较条件或对象键。
- `rules.json`：人工确认的特殊展示容器、变量、函数和字面量。不要把包含接口 ID、枚举或配置值的整个容器加入白名单；用 `propertyContainers` 仅提取已有展示属性。
  `calls` 按文件、调用名称和参数下标限定展示参数，例如只提取迁移向导的警告或步骤说明；API 参数和步骤 ID 保持原值。
- `zh-CN.json`：英文原文 → 简体中文。`{0}`、`{1}` 等对应动态值，数量必须一致。英文修改后成为新条目，旧译文不会误套用。
- `overrides.json`：按源文件相对路径覆盖同词不同义的翻译。
- `catalog.json`：提取结果及来源行号；`pending.json`：缺失译文。两者由命令生成，行号不是翻译键，不影响页面运行。
- `runtime.ts`、`dates.ts`、`notifications.ts`：语言存储、插值、Zod 默认校验、日期、通知组件适配。
- `bootMessages.json`、`plugin.mts`：JS 主包加载失败时的升级恢复界面。此界面也支持中英文。
- `errors.ts`：仅在显示边界翻译已知后端错误，保留原错误对象和未知诊断。

不翻译用户输入、模型输出、代码、日志原始载荷、模型 ID、配置键、协议常量及品牌名。CSV 导出字段保持原格式。当前仓库未包含企业版私有页面；合入这些源码后也要执行提取、审查和回归测试。语言入口目前位于登录页与工作区顶栏，公开授权页使用已保存的语言或默认中文。

## 合并上游后的流程

在 `ui` 目录运行：

```sh
npm run i18n:extract
npm run i18n:audit
```

1. 将 `pending.json` 中的条目补入 `zh-CN.json`。提取器会保留原有译文，不自动覆盖人工翻译。
2. 检查 `review.json` 中未识别的自然语言候选。它包含代码示例、开发日志、比较条件等误报，**不是全部待翻译列表**。确认是展示文字后，再添加精确规则或在显示处调用 `t()`。候选报告不提交 Git。
3. 查看 `catalog.json` 的来源位置，检查新增展示方式、字符串拼接和第三方控件默认文案；静态提取检查通过不代表所有运行时文案已覆盖。
4. 运行检查和构建：

```sh
npm run i18n:extract
npm run i18n:check
npm run i18n:test
npm run build
```

`i18n:check` 对缺失翻译和占位符不一致返回非零状态；未识别的新文案会显示原英文，不阻止应用启动。旧键不会自动删除，确认无引用后可手动清理。生成文件有合并冲突时保留人工词库，再重新执行提取。

同词不同义示例：

```json
{
	"components/example.tsx": {
		"Key": "键"
	}
}
```

需手动标注的复杂展示位置：

```tsx
import { t } from "@/lib/i18n/runtime";

<span>{t("Delete {0}", [displayName])}</span>
<code data-i18n-ignore>{exampleCode}</code>
```

给 `t()` 传递固定源文案并把用户数据放在插值参数中。`data-i18n-ignore` 禁止自动转换该子树，但其中显式 `t()` 仍可提取。不要对请求对象或状态比较值使用 `t()`。

## 验证与限制

单元测试覆盖编译转换、嵌套编辑、请求值保护、原始内容保护、语言回退、存储受限和插值。独立 Playwright 套件 mock API，可在不运行 Go 后端时验证默认中文、切换记忆、取消保留输入、登录请求值不变、导航及升级恢复页：

```sh
# 终端 1，在 ui 目录
npm run dev

# 终端 2，在 tests/e2e 目录
npx playwright test --config=i18n.config.ts
```

已启动服务器时设置 `SKIP_WEB_SERVER=1`。可用 `BASE_URL` 指定地址、`PLAYWRIGHT_CHANNEL=msedge` 使用本机 Edge。原有功能测试在公共 fixture 中固定英文，减少上游测试选择器变更；国际化测试使用实际产品默认语言。

静态规则需要随上游组件写法调整，不能保证未来任意代码自动识别。词库以离线初译为基础，已校正主导航、常用操作和大量技术术语；长说明文字仍建议结合实际业务语境持续审校。未知后端/第三方错误、远端内容不进行猜测性翻译。构建插件不提供精确源码映射，调试转换问题时以源文件和提取目录为准。
