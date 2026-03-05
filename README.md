# 🏫 StudySpotCheck | 研究生错题库高效点检系统

[![Electron](https://img.shields.io/badge/Electron-v30.0-blue.svg)](https://electronjs.org)
[![Build/Release](https://github.com/shallow1822/Wrong-Question-Spot-Check-System/actions/workflows/release.yml/badge.svg)](https://github.com/shallow1822/Wrong-Question-Spot-Check-System/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **为高效而生，为考研陪伴**。这是一款基于艾宾浩斯记忆曲线（Ebbinghaus Forgetting Curve）设计的错题高效管理与点检系统，拥有温和的动漫视觉风格，支持全平台运行。

---

## ✨ 核心特性

- **📅 艾宾浩斯智能算法**：系统根据遗忘曲线自动计算复习优先级，确保您在最恰当的时间巩固错题。
- **🎨 极简动漫美学**：采用莫兰迪/大正风格色彩系统，内置“温和白”与“温和黑”双主题，圆润的 UI 设计让学习不再枯燥。
- **👨‍🎨 独家矢量 Logo**：内置手绘风格矢量小男孩 Logo，随主题自动变色，极具亲和力。
- **📄 PDF 原文溯源**：支持一键上传 PDF 讲义，录入错题时可关联 PDF 页面，复习时可直接分屏查阅原文。
- **📊 仪表盘统计**：直观展示每日复习进度、错题分布及学科构成，学习成果一目了然。
- **🚀 跨平台自动发布**：集成 GitHub Actions，支持推送 Tag 自动打包 Windows 及 macOS 安装包。

---

## 🛠️ 技术栈

- **桌面环境**: [Electron](https://www.electronjs.org/)
- **数据存储**: [SQLite3](https://www.sqlite.org/) (通过 `better-sqlite3`)
- **前端技术**: Vanilla JS / CSS3 (无重型框架，极致加载速度)
- **图形资源**: SVG 矢量图形
- **构建工具**: [electron-builder](https://www.electron.build/)

---

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/shallow1822/Wrong-Question-Spot-Check-System.git
cd Wrong-Question-Spot-Check-System
```

### 2. 安装依赖
```bash
npm install
```

### 3. 运行开发模式
```bash
npm start
```

### 4. 发布构建
生成 Windows 可执行文件：
```bash
npm run build
```

---

## 📦 版本发布 (GitHub Actions)

本项目已配置自动化流水线，您只需推送版本标签即可：
```bash
git tag v1.0.2
git push origin v1.0.2
```

---

## 🌈 视觉预览

*由于是本地项目，以下为风格描述：*
- **日间模式**：温暖的米白纸张感背景，沉稳的茶色文字。
- **夜间模式**：深炭灰色调，柔和的清冷蓝点缀，护眼且专注。

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。

---

**Antigravity** 倾情打造 - 为您的考研之路保驾护航 🚀