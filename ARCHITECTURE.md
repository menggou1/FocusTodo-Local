# FocusTodo (专注清单) 前端架构文档

## 项目概述

FocusTodo 是一款番茄钟 + 任务管理 Web 应用。原始版本依赖后端服务进行数据同步，经由 **Lexible** 修改后将任务、专注记录与设置保存在浏览器本地。Bing 壁纸仍有明确允许的外部资源来源，不能把当前版本描述为不产生任何网络请求。

当前本地版排除小组、在线排名和旧森林入口，也停用隐藏森林的后台奖励初始化。Group/GroupUser/Message 表保留旧备份兼容，不代表这些在线功能可用。

当前应用版本 `7.1.1-local.1.7.2`。版本变化与验收报告从[更新记录](CHANGELOG.md)进入，开发与发布见[维护指南](docs/MAINTENANCE.md)，未完成工作只见[统一待办与验收](docs/BACKLOG.md)。本文件说明模块边界，保留的原 bundle 推测结构不能替代可重建的组件源码。

维护导航：[README](README.md) → [维护指南](docs/MAINTENANCE.md) → 本文的模块边界。计时与数据边界、加载顺序是当前明确接入；下方原组件树和 Redux 概览包含历史推测，改动前需要回到 bundle 实际代码核对。

## 当前计时与数据边界

首屏由 `startup.css` / `js/local-startup.js` 经版本生成器内联到 HTML，先于外部应用资源显示骨架与真实步骤进度。样式异步下载，脚本使用 `defer` 并行下载、按原顺序执行；真实应用和必要样式就绪后展示，不等待图片和字体。中英文复用同步词库，其他系统语言使用异步旧解析器；数据与主题恢复的先后边界保持不变。

- `local-timer-core.js`：纯状态转换和实际时间片段结算；不足 25 秒的待结算专注不写入历史，短暂停保留有效区间供继续累计；停止/模式切换/解除任务会清零会话显示，历史记录独立保留。完成事件与部分记录分开表达。
- `local-data.js`：数据库 v3 升级、计时事务、完整备份、导入恢复日志；记录和会话在同一事务提交。重置事务恢复默认系统清单；启动补回缺失系统清单并保留已有清单设置。跨标签页广播已提交记录以刷新各页统计。
- 无 Web Locks 的维护使用独立 `PomodoroDB6-maintenance-lock` 数据库事务；其生命周期覆盖主库日志与设置写入，拥有者页关闭后自动释放，暂停时保留锁。主库 `LocalMeta` 保存操作 ID、拥有者和设置/回滚阶段，接管必须先取得事务锁；未完成日志保留并阻止旧写入。浏览器数据备份包含主库业务数据和设置，锁数据库不承载用户内容。
- `local-timer-ui.js`：连接旧 React 计时器，管理恢复确认、事件重绑定、卸载清理、完成提示和音频恢复。音频使用独立 Web Lock，后台页面暂停白噪音。
- `local-release.js`：从 `release.json` 和 Git remote 生成版本及更新元信息。
- `local-backup.js`：紧凑 JSON/Gzip 编码、内容识别、128 MB 解压边界、备份范围和体积分析；业务表和计时快照校验仍由数据层负责。主题图片仍保留 data URL，不引入数据库升级。
- `local-app-ui.js`：通知更新详情、关于页版本与 GitHub 图标、无需密码的 5 秒删除确认。
- `local-theme-storage.js`：协调主题 JSON、激活 ID 和 Theme 三键，用不含图片副本的小日志恢复对应元信息。主题模块在导入日志恢复后完成主题恢复，再启动主题界面；内部日志不进入备份。
- `local-i18n.js` / `local-settings-ui.js`：同步决定界面语言，提供原界面和本地补丁的回退；通用设置只显式提供完整中文/英语，其他既有翻译由系统选择，缺项不显示键名。用户数据不经过 DOM 翻译。
- 用户更新与维护报告分开：详情只显示标题、日期、版本、作者和简短条目，不展示 Markdown 按钮；报告在仓库 docs 中提供，`release.json` 的 report 字段仅供维护和一致性检查。
- 加载顺序：`local-release.js` → `local-timer-core.js` → `local-data.js` → `local-timer-ui.js` → `local-app-ui.js` → `local-backup.js` → `local-theme-storage.js` → `local-settings-ui.js` → `local-network.js` → `patch.js` → `js/main.js`。应用启动等待 `FocusLocalReady` 完成导入日志与主题恢复。
- `scripts/revise-timer-integration.cjs` 只更新明确的计时接入边界，可重复执行；旧 `upgrade-*.cjs` 仍是一次性改造记录，不能当作最终版本完整构建脚本。
- `scripts/revise-app-integration.cjs` 维护关于、通知、删除及项目刷新保护；与计时脚本共用 `scripts/lib/bundle-editor.cjs` 的检查和写入流程。
- 本地账号读取统一使用 localStorage，避免旧浏览器 Cookie 覆盖重置/导入后的用户名。`local-ui.css` 使用原应用主题变量，使通知、独立弹窗及导入/导出按钮跟随外观切换。
- 经典主题选择通过 `scripts/revise-app-integration.cjs` 接入 `FocusThemes.selectClassic`，在原组件事件中同步移除自定义背景覆盖和选中标记；Bing、上传和自动刷新结果按最新选择序号决定是否激活，下载缓存与激活分开。
- 本地服务优先采用 `scripts/server.cjs`，只绑定 loopback，支持 GET/HEAD 和单段音频范围请求。

### 修改路径与约束

计时操作依次经过旧 React 的明确回调、`local-timer-ui.js`、`local-data.js` 事务以及 `local-timer-core.js` 状态转换，提交成功后再刷新界面。纯计时模块不直接操作 DOM 或 IndexedDB。用户更新/删除窗口由 `local-app-ui.js` 负责，删除调用同一数据服务，不经过账号密码或后端端点。

显示版本统一来自 `release.json` 的生成结果；数据库 v3 和旧设置 Version 不是产品版本，不应同步改名。涉及旧组件接入的变更需要同时保存脚本和改后的 `js/main.js`，两者不能当作完整源码/构建产物的关系处理。

本地昵称和头像通过数据服务直接保存，并遵守导入/重置维护锁；旧云账号模拟不负责这些写入。Web Locks 提供跨页写入和音频互斥；自动背景音使用可取消的排队请求交接，缺少该能力时按需说明并暂停自动背景音，保留试听和完成提示音；无 Web Locks 的计时记录去重及导入/重置维护归属已分别实现并验收，维护由独立 IndexedDB 事务锁保护。任何数据库结构变更须保留旧备份兼容与回退设计，具体维护规则见[维护指南](docs/MAINTENANCE.md)。

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

HTML 内联首屏先显示；应用样式异步加载，以下脚本并行下载并按顺序执行。

```text
local-i18n-catalog → local-i18n → local-release → local-timer-core
  → local-data → local-timer-ui → local-app-ui → local-backup
  → local-theme-storage → local-settings-ui → local-network → patch → local-calendar → main
```

`patch.js` 按数据身份/存储、网络、备份界面、设置兼容和主题依次安装。身份复用数据服务原生写入能力；导入日志恢复后才恢复主题设置；主应用等待同一 `FocusLocalReady`。当前界面删除直接调用本地 reset，用户名和头像通过本地资料服务保存。日程任务与安排由同一事务创建，提交后沿用现有通道刷新其他页面；数据库仍为 v3。应用与必要样式就绪后展示，图片和字体继续加载。

## 数据存储

### 1. IndexedDB — `PomodoroDB6` (version 3)

原有 8 张业务表保留，另加 2 张本地状态表，共 10 个 Object Store：

| Store | keyPath | 索引 | 用途 |
|-------|---------|------|------|
| **Project** | `id` | state, sync, parentId | 清单（任务列表） |
| **Task** | `id` | projectId, deadline, reminderDate, finishedDate, sync | 任务 |
| **Subtask** | `id` | taskId, sync, finishedDate | 子任务 |
| **Pomodoro** | `id` | taskId, subtaskId, endDate, sync | 番茄计时记录 |
| **Schedule** | `id` | taskId, subtaskId, endDate, sync | 日程/日程事件 |
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
| 日程 | Calendar | 日程视图 |
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
│   ├── CalendarView (日程视图)
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

## 本地功能模块

入口 `patch.js` 只组织安装顺序，逻辑按所属功能维护。

| 模块 | 当前职责 |
|---|---|
| `local-data.js` | 数据、备份快照、重置/恢复、原生存储能力及本地身份保护 |
| `local-calendar.js` | 日程快速创建、重叠布局、详情/跨页刷新、日程启动本地计时与生命周期；数据写入复用本地数据服务 |
| `local-network.js` | XHR/fetch 策略、精确 Bing 白名单和现存账号操作兼容 |
| `local-backup.js` | 编码/解码/下载与导入导出界面，统一 `installUI` 入口 |
| `local-settings-ui.js` | 语言/通知设置、旧偏好和隐藏功能分类的兼容安装 |
| `local-theme-storage.js` | 主题写入/恢复日志与主题界面，恢复在导入之后 |
| `main.css` / `local-ui.css` | 按语言设置默认字体，附带字体加载后应用；组件可保留自己的字体规则 |

上述安装入口可重复调用，避免重复包装存储和网络 API、重复恢复主题。没有全局 jQuery 轮询或手动修改用户名的调试入口。

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

`cookie.NAME` 等名称是兼容旧组件的 localStorage 键，用户名不依赖浏览器 Cookie。启动、改名及旧 NAME 写入入口会清理遗留的浏览器 NAME Cookie；旧控制台改名调试函数已移除。
