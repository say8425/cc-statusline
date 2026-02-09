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

## CLI 选项

| 选项 | 说明 | 默认值 |
|------|------|:------:|
| [`--plan <plan>`](#套餐选择) | 设置订阅套餐的费用限制 (pro, max5x, max20x) | `pro` |
| [`--no-usage`](#禁用) | 隐藏使用量指标行 | - |

## 截图

### 仅 Git diff

![scenario1_diff_only](scenario1_diff_only.png)

### 仅 PR

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### Context 正常 (< 50%)

![正常上下文使用量（低于50%）的状态栏截图](context_normal.png)

### Context 警告 (50-80%)

![警告上下文使用量（50%-80%）的状态栏截图](context_warning.png)

### Context 危险 (> 80%)

![危险上下文使用量（超过80%）的状态栏截图](context_critical.png)

### 限制重置计时器

![带有限制重置计时器的状态栏截图](limit_reset.png)

## 功能

- **会话时间**: 当前会话经过时间
- **费用**: 会话费用（美元）
- **上下文**: 令牌使用量及百分比（颜色标识）
- **Git Diff**: 文件数、新增、删除
- **PR URL**: 可点击的 OSC 8 超链接
- **TrueColor**: 基于阈值的动态颜色
- **限制重置计时器**: 使用量限制重置剩余时间
- **块使用量**: 5小时块费用使用量及百分比
- **燃烧率**: 每分钟令牌消耗率

## 表情符号指南

| 表情 | 说明                |
| ---- | ------------------- |
| 📁   | 项目文件夹名        |
| 🌿   | 当前 Git 分支       |
| ⏱️   | 会话经过时间        |
| 💰   | 会话费用（美元）    |
| 🧠   | 上下文窗口使用量    |
| ⏳   | 限制重置倒计时      |
| 📊   | 5小时块费用使用量   |
| 🔥   | 令牌燃烧率（每分钟）|
| ✏️   | 未提交的更改        |
| 📎   | Pull Request 链接   |

## 使用量指标

显示5小时计费块的使用量信息。

> [!NOTE]
> Anthropic未公开订阅使用量的计算公式。块使用量是基于API公示价格的估算值，可能与实际`/usage`值存在差异。

### 工作原理

自动解析 `~/.claude/projects/` 中的 JSONL 文件以检测：

1. **5小时计费块** - 基于累计时间和非活动间隔检测块边界（重置计时器按小时向下取整）
2. **费用计算** - 使用模型特定价格（opus/sonnet/haiku）× 令牌数量计算费用
3. **跨项目扫描** - 扫描 `~/.claude/projects/` 下的所有项目（块在项目间共享）
4. **燃烧率** - 计算每分钟平均令牌消耗量

无需手动配置。

### 套餐选择

套餐会从 macOS Keychain（`Claude Code-credentials` → `rateLimitTier`）**自动检测**，无需配置。

> [!NOTE]
> 自动检测**仅限 macOS**。在其他平台上，请使用 `--plan` 标志明确指定套餐。

如需手动指定，使用 `--plan` 标志：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --plan max5x",
    "padding": 0
  }
}
```

| 套餐 | 费用限制 | 命令 |
|------|----------|------|
| Pro | $8 | `--plan pro` |
| Max 5x | $40 | `--plan max5x` |
| Max 20x | $160 | `--plan max20x` |
| 自动检测（默认） | - | - |

### 禁用

要隐藏使用量指标行（重置计时器、块使用量、燃烧率），请使用 `--no-usage` 标志：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-usage",
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
