# FocusTodo (专注清单) 前端架构文档

## 项目概述

FocusTodo 是一款番茄钟 + 任务管理 Web 应用。原始版本依赖后端服务进行数据同步，经由 **Lexible** 修改后将任务、专注记录与设置保存在浏览器本地。Bing 壁纸仍有明确允许的外部资源来源，不能把当前版本描述为不产生任何网络请求。

当前版本 `7.1.1-local.1.1.1`。2026-10-04 当前阶段与剩余事项见 [更新报告](docs/UPDATE-7.1.1-local.1.1.1.md)，版本维护见 [版本规范](docs/VERSIONING.md)。本文件保留了部分原 bundle 的推测结构，不能替代可重建的组件源码。

维护导航：[README](README.md) → [维护指南](docs/MAINTENANCE.md) → 本文的模块边界。计时与数据边界、加载顺序是当前明确接入；下方原组件树和 Redux 概览包含历史推测，改动前需要回到 bundle 实际代码核对。

## 当前计时与数据边界

- `local-timer-core.js`：纯状态转换和实际时间片段结算；不足 25 秒的待结算专注不写入历史，短暂停保留有效区间供继续累计；停止/模式切换/解除任务会清零会话显示，历史记录独立保留。完成事件与部分记录分开表达。
- `local-data.js`：数据库 v3 升级、计时事务、完整备份、导入恢复日志；记录和会话在同一事务提交。重置事务恢复默认系统清单；启动补回缺失系统清单并保留已有清单设置。跨标签页广播已提交记录以刷新各页统计。
- `local-timer-ui.js`：连接旧 React 计时器，管理恢复确认、事件重绑定、卸载清理、完成提示和音频恢复。音频使用独立 Web Lock，后台页面暂停白噪音。
- `local-release.js`：从 `release.json` 和 Git remote 生成版本及更新元信息。
- `local-app-ui.js`：通知更新详情、关于页版本与 GitHub 图标、无需密码的 5 秒删除确认。
- 用户更新与维护报告分开：详情只显示标题、日期、版本、作者和简短条目，不展示 Markdown 按钮；报告在仓库 docs 中提供，`release.json` 的 report 字段仅供维护和一致性检查。
- 加载顺序：`local-release.js` → `local-timer-core.js` → `local-data.js` → `local-timer-ui.js` → `local-app-ui.js` → `patch.js` → `js/main.js`。应用启动等待 `FocusLocalReady` 完成导入日志恢复。
- `scripts/revise-timer-integration.cjs` 只更新明确的计时接入边界，可重复执行；旧 `upgrade-*.cjs` 仍是一次性改造记录，不能当作最终版本完整构建脚本。
- `scripts/revise-app-integration.cjs` 维护关于、通知、删除及项目刷新保护；与计时脚本共用 `scripts/lib/bundle-editor.cjs` 的检查和写入流程。
- 本地账号读取统一使用 localStorage，避免旧浏览器 Cookie 覆盖重置/导入后的用户名。`local-ui.css` 使用原应用主题变量，使通知、独立弹窗及导入/导出按钮跟随外观切换。
- 本地服务优先采用 `scripts/server.cjs`，只绑定 loopback，支持 GET/HEAD 和单段音频范围请求。

### 修改路径与约束

计时操作依次经过旧 React 的明确回调、`local-timer-ui.js`、`local-data.js` 事务以及 `local-timer-core.js` 状态转换，提交成功后再刷新界面。纯计时模块不直接操作 DOM 或 IndexedDB。用户更新/删除窗口由 `local-app-ui.js` 负责，删除调用同一数据服务，不经过账号密码或后端端点。

显示版本统一来自 `release.json` 的生成结果；数据库 v3 和旧设置 Version 不是产品版本，不应同步改名。涉及旧组件接入的变更需要同时保存脚本和改后的 `js/main.js`，两者不能当作完整源码/构建产物的关系处理。

Web Locks 提供跨页写入和音频互斥；无锁环境的计时记录去重已验收，但导入/重置的完整维护归属仍待专项处理。不要把“计时事务测试通过”外推为全部跨页维护安全。数据库迁移、主题迁移或拆包应先制定回滚与旧备份兼容方案，见维护指南及更新报告。

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 视图 | React 16.14.0 | Class 组件为主 (PureComponent)，Redux 状态管理 |
| 样式 | CSS (main.css) | 410KB，单文件，CSS Modules 风格 |
| 工具库 | jQuery, Moment.js, Bootstrap Datepicker | 全部打包进 main.js |
| 加密 | jsrsasign | RSA 加解密，用于许可证校验 |
| 运行 | 纯静态文件 | 内置 Node.js loopback 服务器，Python http.server 回退 |
| i18n | 自定义 key-value | 32 种语言，文件在 `i18n/` 目录 |

## 文件结构

```
FocusTodo/
├── index.html              # 入口，加载顺序见上文
├── release.json            # 官方/本地版本、作者、日期和更新内容
├── patch.js                # 🔧 预加载补丁（先于 main.js 执行）
├── main.css                # 全局样式 (410KB)
├── js/
│   ├── main.js             # 🏗️ 主应用包 (2.2MB，含 React + 所有库)
│   ├── local-release.js    # 生成的版本与更新元信息
│   ├── local-app-ui.js     # 关于、更新详情、删除冷却确认
│   ├── local-timer-core.js # 纯计时状态转换
│   ├── local-data.js       # 事务、备份与恢复日志
│   ├── local-timer-ui.js   # 旧计时器明确接入及音频
│   ├── purchase.js         # 购买页面
│   └── resetpassword.js    # 重置密码页面
├── i18n/                   # 国际化文本 (32 种语言)
│   ├── strings_zh.txt      # 简体中文（默认）
│   ├── strings_en.txt
│   └── ...
├── img/                    # 图片资源
├── audio/                  # 铃声 & 白噪音音频
├── font/                   # 字体文件
├── start.ps1               # Windows 启动脚本
└── 启动.bat                 # 双击启动
```

## 加载时序

当前实际顺序如下。`patch.js` 仍保留旧网络和用户操作兼容拦截，但界面删除不再进入旧密码/用户名接口。

```
浏览器请求 index.html
  │
  ├─ 1. 加载 local-release/core/data/timer-ui/app-ui
  │     └─ 注册版本、计时、持久化和独立界面服务
  │
  ├─ 2. 加载 patch.js（在旧主应用前执行）
  │     ├─ 设置 local@local 伪造登录凭证
  │     ├─ 拦截 localStorage 保护关键 key
  │     ├─ 阻断 XMLHttpRequest / fetch / jQuery.ajax
  │     ├─ 注册导出/导入功能
  │     │     └─ v63/user 兼容拦截；不作为当前界面删除入口
  │     ├─ 隐藏"功能开关"设置项
  │     ├─ 禁用评分弹窗
  │     ├─ 自定义主题管理器（Bing每日壁纸 + 本地上传）
  │     └─ 调试工具：手动修改用户名
  │
  ├─ 3. 加载 js/main.js（React 应用启动）
  │     ├─ 初始化 IndexedDB (PomodoroDB6)
  │     ├─ 读取 localStorage 恢复用户状态
  │     ├─ ReactDOM.render(<Provider store={store}><App /></Provider>)
  │     └─ 渲染主界面，关于/通知/删除在明确边界调用 local-app-ui
  │
  └─ main.css/local-ui.css 并行加载，应用样式
```

## 数据存储

### 1. IndexedDB — `PomodoroDB6` (version 3)

原有 8 张业务表保留，另加 2 张本地状态表，共 10 个 Object Store：

| Store | keyPath | 索引 | 用途 |
|-------|---------|------|------|
| **Project** | `id` | state, sync, parentId | 清单（任务列表） |
| **Task** | `id` | projectId, deadline, reminderDate, finishedDate, sync | 任务 |
| **Subtask** | `id` | taskId, sync, finishedDate | 子任务 |
| **Pomodoro** | `id` | taskId, subtaskId, endDate, sync | 番茄计时记录 |
| **Schedule** | `id` | taskId, subtaskId, endDate, sync | 日程/日历事件 |
| **Group** | `groupId` | groupLeader, createdDate, secret | 小组 |
| **GroupUser** | `id` | groupId, uuid, sync, name, todayPomodoroTime, weekPomodoroTime, focusEndDate | 小组成员 |
| **Message** | `messageId` | groupId, userId, state, sync, creationDate, replyUserId, replyMessageId, parentId, username | 小组留言 |
| **TimerSession** | `id` | 无 | 当前计时状态、任务关联、进度、片段和待确认区间 |
| **LocalMeta** | `id` | 无 | 数据维护标记、跨存储导入恢复日志 |

### 2. localStorage

约 60+ 个 key，按类别：

| 类别 | Key 示例 | 说明 |
|------|---------|------|
| 凭证 | `cookie.ACCT`, `cookie.NAME`, `cookie.PID`, `cookie.UID` | 用户身份（Base64 编码） |
| 番茄 | `WorkInterval`, `ShortBreakInterval`, `LongBreakInterval`, `LongBreakPomodoros` | 计时设置 |
| 功能开关 | `AutoWork`, `AutoBreak`, `BanBreak`, `Forest`, `Group`, `RnkLst` | 功能启用/禁用 |
| 外观 | `Theme`, `DarkMode`, `Countdown` | 主题与显示 |
| 音效 | `WorkAlarm`, `BreakAlarm`, `BgMusic`, `RtnVol`, `WNVol` | 铃声与音量 |
| 高级版 | `ExpiredDate`, `Price`, `PriceUSD`, `PriceInfo`, `Receipt` | 订阅状态 |
| 排行榜 | `Sunlight`, `PrevRank30`, `PrevRankAll`, `LastSyncFocusTimeAll` | 专注森林 & 排行 |
| 奖励 | `LaunchReward`, `DailyTaskReward`, `PomodoroReward`, `TaskReward` | 阳光奖励 |
| 小组件 | `WidgetExpanded`, `Widgets`, `AllWidgets` | 计时器小组件 |
| 定时器 | `timingTaskId`, `timingSubtaskId` | 当前计时的任务 |
| 同步 | `SyncTimestamp`, `ConfigTimestamp`, `ServerTimestamp` | 同步时间戳 |
| 自定义主题 | `lexible-custom-themes`, `lexible-active-custom-theme` | Bing每日壁纸 + 本地上传主题 |

## 应用架构

### 状态管理 (Redux)

```
<Provider store={rootStore}>
  <App />
</Provider>
```

- 使用 `react-redux` 的 `connect()` 连接组件
- 主要 Reducer 推测包含: `userInfo`, `preference`, `goals`, `tasks`, `projects`, `pomodoros` 等

### 路由/导航

使用内部状态驱动的视图切换（无 React Router），通过侧边栏菜单切换主视图：

| 菜单项 | 视图 | 说明 |
|--------|------|------|
| 任务列表 | 默认视图 | 按清单分组显示任务 |
| 今日事 | MyDay | 今日待办 |
| 日历 | Calendar | 日历视图 |
| 已完成 | History | 历史任务 |
| 搜索 | Search | 关键词搜索 |
| 报表 | Report | 专注时间统计图表 |
| 设置 | Settings | 子菜单：账号/高级版/通用/番茄/清单管理/关于 |

### 组件树（推测结构）

```
App
├── Sidebar (侧边栏)
│   ├── UserInfo (头像、用户名)
│   ├── ProjectList (清单列表)
│   ├── FolderList (清单夹)
│   └── MenuItems (导航菜单)
├── MainContent (主内容区)
│   ├── TaskList (任务列表视图)
│   │   ├── TaskItem
│   │   └── SubtaskItem
│   ├── CalendarView (日历视图)
│   ├── ReportView (报表视图)
│   │   ├── PomodoroChart
│   │   ├── TaskChart
│   │   └── ProjectTimeDistribution
│   ├── SearchView (搜索视图)
│   └── SettingsView (设置视图)
│       ├── AccountSettings (账号设置) ★ 导出/导入按钮
│       ├── PurchaseSettings (高级版)
│       ├── AppearanceSettings (外观设置) ★ 自定义主题
│       ├── GeneralSettings (通用设置) ★ 功能开关已隐藏
│       ├── PomodoroSettings (番茄设置)
│       ├── ProjectManagement (清单管理)
│       └── AboutSettings (关于)
├── Timer (番茄计时器)
│   ├── TimerDisplay (倒计时)
│   ├── TaskSelector (任务选择)
│   └── Widgets (小组件)
├── ModalRoot (弹窗容器 #modal-root)
│   ├── LoginDialog
│   ├── PasswordConfirmDialog ★ 被 patch.js 替换
│   ├── ConfirmDialog
│   └── UpgradePromptDialog
└── ForestView (专注森林)
```

## patch.js 补丁系统

`patch.js` 在 `main.js` 之前加载，通过以下机制修改应用行为：

### 注入方式
- **DOM 操作**: 通过 `MutationObserver` 监测 DOM 变化，在合适的时机插入/替换元素
- **API 拦截**: 重写 `XMLHttpRequest`, `fetch`, `jQuery.ajax` 限制请求，精确主机名白名单允许 Bing 壁纸来源，CSP 约束直接资源请求
- **localStorage 代理**: 保护关键 cookie key 不被删除

### 当前补丁列表

| 节 | 功能 | 说明 |
|----|------|------|
| 原 0 | 关于页信息 | DOM 注入已移除；改由 local-app-ui 在 React 边界渲染，版本来自 release.json |
| 1 | 字体统一 | Noto Sans SC 全局字体，抵御 JS 内联样式覆盖 |
| 2 | 本地登录凭证 | 伪造 `local@local` 用户，自动修复乱码 |
| 3 | 数据保护 | 防止 ExpiredDate 和 cookies 被清除，定期检查并恢复 |
| 4 | 网络阻断 | XMLHttpRequest + fetch 拦截，白名单放行 Bing 壁纸 |
| 5 | jQuery 阻断 + 用户操作 | jQuery.ajax 拦截；v63/user 保留旧兼容路径，当前删除 UI 直接调用本地 reset |
| 6 | 数据导出/导入 | 完整数据迁移 (IndexedDB + localStorage)，自动备份，导入前确认 |
| 原 7 | 删除提示美化 | 密码提示轮询已移除；改由 local-app-ui 展示 5 秒冷却及备份提示，无密码 |
| 8 | 禁用评分弹窗 | 使用偏好开关 HasRated=true、ShowRateDialog=false，不再高频遍历 React 内部树 |
| 9 | 隐藏功能开关 | 隐藏"通用设置"中的"功能开关"分类标题和分隔线 |
| 10 | 自定义主题管理器 | Bing每日壁纸（12小时自动刷新）+ 本地上传图片，缩略图预览，删除功能 |
| 11 | 调试工具 | window.testSetUsername(name) 手动测试用户名修改 |

## 国际化 (i18n)

- 格式: `key = value` (类似 Java Properties)
- 默认语言: `zh` (简体中文)
- 语言文件路径: `i18n/strings_{lang}.txt`
- 应用内使用: `e.i18n.prop("key")` 获取翻译文本
- 语言检测: 读取 `localStorage.getItem("app_language")` 或浏览器语言

## 关键技术细节

### Base64 编码
应用使用自定义 UTF-8 Base64 编码存储用户名/账号:
```
编码: btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, ...))
解码: decodeURIComponent(atob(str).split('').map(c => '%' + c.charCodeAt(0).toString(16)).join(''))
```

### 高级版机制
- `ExpiredDate = '0'` → 永不过期（patch.js 强制设置）
- `ExpiredDate = 时间戳` → 到期时间
- 应用读取 `Base64.decode(cookie.ACCT)` 获取账号
- 收据验证: `Receipt` key 存储购买凭证

### 番茄计时
- 默认 25 分钟专注 / 5 分钟短休 / 15 分钟长休
- 每 4 个番茄触发长休
- 计时模式: 倒计时 / 正向计时
- 支持白噪音背景音和完成铃声

### 自定义主题系统
- Bing 每日壁纸：多 API 容错（biturl.top → bing.com），12小时自动刷新
- 本地上传：最大 10MB，压缩至 1920×1080，生成 240×160 缩略图
- 存储结构：`lexible-custom-themes` (JSON) + `lexible-active-custom-theme` (ID)
- 背景守护：1秒轮询检测 Theme 变化，自动恢复自定义背景
