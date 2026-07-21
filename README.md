# FocusTodo

FocusTodo 专注清单 - 本地开发版

## 项目说明

本项目基于 [lamngockhuong/FocusTodo](https://github.com/lamngockhuong/FocusTodo) 修改，为方便开发调试而设计的本地版本。

> **免责声明**：本项目仅供个人学习研究使用。请支持 [FocusTodo 官方](https://focustodo.cn)。

## 必要环境

### 方式一：Python（推荐）
- Python 3.6+
- 无需安装任何依赖

### 方式二：Node.js
- Node.js 14+
- 可选安装 `http-server`：`npm install -g http-server`

### 方式三：浏览器直接打开
- 双击 `index.html` 即可（部分浏览器可能限制 localStorage/IndexedDB 功能）

## 快速开始

### Windows
双击 `启动.bat` 或运行 PowerShell `.\start.ps1`

### macOS / Linux
```bash
python3 -m http.server 8080
# 或
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

## 文档

- [前端架构文档](./ARCHITECTURE.md) - 详细的技术架构说明
- [English](./README_en.md)

## 许可证

请勿用于商业用途，仅供个人学习研究使用。请支持正版软件。