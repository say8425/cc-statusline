# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | 中文 | [Español](README.es.md)

Claude Code 自定义状态栏。

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## 安装

将以下内容添加到 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## 截图

### 仅 Git diff

![scenario1_diff_only](scenario1_diff_only.png)

### 仅 PR

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)


### 使用量指标

![带有使用量指标的状态栏截图](usage_metrics.png)

## 功能

- **会话时间**: 当前会话经过时间
- **费用**: 会话费用（美元）
- **上下文**: 令牌使用量及百分比（颜色标识）
- **Git Diff**: 文件数、新增、删除
- **PR URL**: 可点击的 OSC 8 超链接
- **TrueColor**: 基于阈值的动态颜色
- **重置时间**: 5小时使用量重置时间（HH:MM）
- **块使用量**: 5小时使用率（来自服务器 API）
- **每周重置计时器**: 7天使用量重置时间（MM/DD HH:MM）
- **周使用量**: 7天使用率（来自服务器 API）

## 表情符号指南

| 表情 | 说明                |
| ---- | ------------------- |
| 📁   | 项目文件夹名        |
| 🌿   | 当前 Git 分支       |
| ⏱️   | 会话经过时间        |
| 💰   | 会话费用（美元）    |
| 🧠   | 上下文窗口使用量    |
| ⏳   | 重置时间            |
| 📊   | 5小时使用率 %       |
| ⏰   | 每周限制重置时间    |
| 📅   | 7天使用率 %         |
| ✏️   | 未提交的更改        |
| 📎   | Pull Request 链接   |

## 使用量指标

从 Anthropic Usage API 获取并显示使用量信息。

> [!WARNING]
> `--show-usage` 功能使用非官方的逆向工程 Anthropic API 端点来获取使用量数据。这不是官方支持的 API，可能随时变更或停止，恕不另行通知。**使用风险自负。**作者对因使用此功能而可能导致的任何后果（包括但不限于账户限制或服务中断）不承担任何责任。

> [!NOTE]
> 此功能需要从 macOS Keychain（`Claude Code-credentials`）读取 OAuth 令牌，因此**仅限 macOS**。

### 工作原理

使用 macOS Keychain 中的 OAuth 访问令牌调用 Anthropic Usage API（`/api/oauth/usage`）：

1. **5小时使用率** - 当前计费块的服务器计算使用百分比
2. **7天使用率** - 服务器计算的周使用百分比
3. **重置计时器** - 服务器提供的精确重置时间（`five_hour.resets_at`）
4. **每周重置计时器** - 7天使用量重置时间（`seven_day.resets_at`），`MM/DD HH:MM` 格式（如 `02/15 17:00`）

### 启用

使用量指标**默认隐藏**。要启用，请使用 `--show-usage` 标志：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --show-usage",
    "padding": 0
  }
}
```

## 依赖项

- [Bun](https://bun.sh) - JavaScript 运行时
- [gh](https://cli.github.com) - GitHub CLI（可选，用于 PR URL）

## 颜色阈值

| 指标       | 正常（白色） | 警告（黄色） | 危险（红色） |
| ---------- | ------------ | ------------ | ------------ |
| 上下文 %   | < 50%        | 50-80%       | > 80%        |
| 块使用量 % | < 50%        | 50-80%       | > 80%        |

## 许可证

MIT
