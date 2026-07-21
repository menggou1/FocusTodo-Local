# FocusTodo

FocusTodo 专注清单 - 完全本地版

## 项目说明

FocusTodo 是一款番茄钟 + 任务管理 Web 应用。经 **Lexible** (2026/7) 修改为**完全本地版**，所有数据仅存储在浏览器本地，不产生任何网络请求。

## 快速开始

### Windows
双击 `启动.bat` 或运行 `start.ps1`

### 命令行
```bash
# Python
python -m http.server 8080

# Node.js
npx http-server -p 8080
```

然后访问 http://localhost:8080

## 主要功能

- 🍅 番茄钟计时器（25/5/15 分钟可调）
- ✅ 任务管理（清单、子任务、截止日期、提醒）
- 📅 日历视图
- 📊 专注时间报表
- 🎨 自定义主题（Bing 每日壁纸 + 本地上传）
- 💾 数据导出/导入备份
- 🌲 专注森林（阳光奖励）
- 🌐 32 种语言支持

## 技术栈

- React 16.14.0 + Redux
- jQuery + Moment.js + Bootstrap Datepicker
- IndexedDB (PomodoroDB6) + localStorage
- 纯静态文件，无需后端

## 文件结构

```
FocusTodo/
├── index.html          # 入口
├── patch.js            # 本地化补丁
├── main.css            # 样式
├── js/main.js          # 主应用
├── i18n/               # 国际化
├── img/                # 图片
├── audio/              # 音频
└── font/               # 字体
```

## 数据存储

- **IndexedDB**: 任务、番茄记录、日程等
- **localStorage**: 设置、用户凭证、主题等

## 许可证

请勿用于商业用途，仅供个人使用。