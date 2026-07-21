# FocusTodo (专注清单) 前端架构文档

## 项目概述

FocusTodo 是一款番茄钟 + 任务管理 Web 应用。原始版本依赖后端服务进行数据同步，经由 **Lexible** (2026/7) 修改为**完全本地版**，所有数据仅存储在浏览器本地，不产生任何网络请求。

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 视图 | React 16.14.0 | Class 组件为主 (PureComponent)，Redux 状态管理 |
| 样式 | CSS (main.css) | 410KB，单文件，CSS Modules 风格 |
| 工具库 | jQuery, Moment.js, Bootstrap Datepicker | 全部打包进 main.js |
| 加密 | jsrsasign | RSA 加解密，用于许可证校验 |
| 运行 | 纯静态文件 | Python http.server 或 Node.js http-server |
| i18n | 自定义 key-value | 32 种语言，文件在 `i18n/` 目录 |

## 文件结构

```
FocusTodo/
├── index.html              # 入口页面，加载 patch.js → js/main.js
├── patch.js                # 🔧 预加载补丁（先于 main.js 执行）
├── main.css                # 全局样式 (410KB)
├── js/
│   ├── main.js             # 🏗️ 主应用包 (2.2MB，含 React + 所有库)
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

```
浏览器请求 index.html
  │
  ├─ 1. 加载 patch.js（最先执行）
  │     ├─ 注入关于页信息
  │     ├─ 设置 local@local 伪造登录凭证
  │     ├─ 拦截 localStorage 保护关键 key
  │     ├─ 阻断 XMLHttpRequest / fetch / jQuery.ajax
  │     ├─ 注册导出/导入功能
  │     │     └─ v63/user 端点：拦截删除/注销，验证用户名后清除 cookie+Portrait 再放行
  │     ├─ 注册删除数据视觉提示（密码→用户名）
  │     ├─ 隐藏"功能开关"设置项
  │     ├─ 禁用评分弹窗
  │     ├─ 自定义主题管理器（Bing每日壁纸 + 本地上传）
  │     └─ 调试工具：手动修改用户名
  │
  ├─ 2. 加载 js/main.js（React 应用启动）
  │     ├─ 初始化 IndexedDB (PomodoroDB6)
  │     ├─ 读取 localStorage 恢复用户状态
  │     ├─ ReactDOM.render(<Provider store={store}><App /></Provider>)
  │     └─ 渲染主界面
  │
  └─ 3. main.css 并行加载，应用样式
```

## 数据存储

### 1. IndexedDB — `PomodoroDB6` (version 2)

共 8 个 Object Store：

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
- **API 拦截**: 重写 `XMLHttpRequest`, `fetch`, `jQuery.ajax` 阻断所有网络请求
- **localStorage 代理**: 保护关键 cookie key 不被删除

### 当前补丁列表

| 节 | 功能 | 说明 |
|----|------|------|
| 0 | 关于页信息 | 在版本行下方注入修改者信息 (Lexible · 2026/7/9) |
| 1 | 字体统一 | Noto Sans SC 全局字体，抵御 JS 内联样式覆盖 |
| 2 | 本地登录凭证 | 伪造 `local@local` 用户，自动修复乱码 |
| 3 | 数据保护 | 防止 ExpiredDate 和 cookies 被清除，定期检查并恢复 |
| 4 | 网络阻断 | XMLHttpRequest + fetch 拦截，白名单放行 Bing 壁纸 |
| 5 | jQuery 阻断 + 用户操作 | jQuery.ajax 拦截；v63/user 端点：修改用户名保存到本地 / 删除数据重置 / 注销账号 |
| 6 | 数据导出/导入 | 完整数据迁移 (IndexedDB + localStorage)，自动备份，导入前确认 |
| 7 | 删除提示美化 | 密码框上方显示警告提示"此操作将删除所有数据并重置为默认状态" |
| 8 | 禁用评分弹窗 | HasRated=true, ShowRateDialog=false，禁用 React Fiber 中的 isSupportRating |
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