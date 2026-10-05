# 本地版本规范

官方基础版本固定为 **7.1.1**。作者为 **Lexible**。当前完整版本为 **7.1.1-local.1.1.1**。

## 格式与递增规则

格式：`7.1.1-local.<本地主版本>.<本地功能版本>.<本地修复版本>`。

| 情况 | 示例 | 规则 |
|---|---|---|
| 当前版本 | `7.1.1-local.1.1.1` | 深色通知、短时专注过滤与删除后恢复 |
| 后续兼容修复 | `7.1.1-local.1.1.2` | 最后一位递增 |
| 后续兼容功能 | `7.1.1-local.1.2.0` | 中间一位递增，修复位归零 |
| 本地不兼容改动 | `7.1.1-local.2.0.0` | 本地主版本递增，其余归零；须单独说明迁移与回退 |

历史 `7.1.1-patch.1` 对应规范建立前的本地基础阶段，可视为本地 `1.0.0` 的历史名称。历史报告保留原名，没有额外发布一个 `7.1.1-local.1.0.0`。

`-local.1.1.0` 是保留官方基础版本的本地标识。npm 的标准 SemVer 比较会将带连字符的版本视为预发布；本项目按本地三段数字比较后续版本，不能直接用完整字符串的字典序或 npm 与官方 `7.1.1` 比较来判断更新。当前通知仅比较版本是否不同，没有实现联网检查或版本大小排序。

## 配置与生成

`release.json` 是版本、作者、日期、Git remote 名称及更新条目的唯一人工编辑入口；日期采用本地发布日的 `YYYY-MM-DD`。新增版本时，在 `updates` 最前方添加当前版本，保留历史条目并创建对应报告。

`items` 是面向用户的简短更新，勿加入内部验收或维护流程。`report` 是维护文档引用，用于仓库一致性检查，不在产品更新详情中展示链接。日常维护步骤见 [MAINTENANCE.md](MAINTENANCE.md)。

```powershell
node scripts/build-release.cjs
npm test
npm run check
npm run test:browser
git diff --check
```

生成器同步 `js/local-release.js`、`package.json` 的版本和作者、`index.html` 的标题与资源缓存参数。关于页、通知详情、计时恢复说明和备份元信息读取 `window.FocusRelease`；本地服务器读取包版本。勿单独修改生成文件中的版本。

GitHub 地址读取本地 Git 配置 `remote.Focustodo-local.url`，本次为 `https://github.com/menggou1/FocusTodo-Local.git`。展示时去掉 `.git`，支持常见 GitHub SSH 地址转为 HTTPS。构建时需要该 remote；日常浏览器运行无需 Git，也不会为了显示图标连接 GitHub。用户点击图标时在新标签页打开仓库。

`build:release` 只生成发布元信息，不能重建完整旧 bundle。需要变更旧界面接入时使用两个明确范围的脚本：

```powershell
node scripts/revise-timer-integration.cjs
node scripts/revise-app-integration.cjs
```

上述脚本用于当前项目根目录，按已知 AST 边界定位，结构变化需人工检查；不是通用 React 构建工具。旧 `upgrade-*.cjs` 是历史一次性改造，不应全部重跑。

## 与数据版本的区别

应用显示版本、IndexedDB 数据库版本和旧偏好 `Version` 各有用途。数据库本轮仍为 `PomodoroDB6` v3，旧偏好的 `Version='6.5'` 是兼容标记，不应为统一显示而改成 `7.1.1-local.1.1.0`。版本生成不清空数据、不执行数据库迁移。

通知已读键为 `FocusTodo.releaseRead`。打开最新版本详情后保存当前完整版本；只查看历史详情不会标记最新版本已读。后续版本号改变后恢复更新提示，原任务提醒继续由旧任务逻辑管理。
