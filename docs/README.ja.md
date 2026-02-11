# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | 日本語 | [中文](README.zh.md) | [Español](README.es.md)

Claude Code用カスタムステータスライン。

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## インストール

`~/.claude/settings.json`に以下を追加してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## スクリーンショット

### Git diffのみ

![scenario1_diff_only](scenario1_diff_only.png)

### PRのみ

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)


### 使用量メトリクス

![使用量メトリクス付きステータスラインのスクリーンショット](usage_metrics.png)

## 機能

- **セッション時間**: 現在のセッション経過時間
- **コスト**: セッションコスト（USD）
- **コンテキスト**: トークン使用量とパーセンテージ（色分け表示）
- **Git Diff**: ファイル数、追加、削除
- **PR URL**: クリック可能なOSC 8ハイパーリンク
- **TrueColor**: しきい値に基づく動的カラー
- **リセット時刻**: 5時間使用量リセット時刻（HH:MM）
- **ブロック使用量**: 5時間使用率（サーバーAPI基準）
- **週間リセットタイマー**: 7日使用量リセット時刻（MM/DD HH:MM）
- **週間使用量**: 7日使用率（サーバーAPI基準）

## 絵文字ガイド

| 絵文字 | 説明                         |
| ------ | ---------------------------- |
| 📁     | プロジェクトフォルダ名       |
| 🌿     | 現在のGitブランチ            |
| ⏱️     | セッション経過時間           |
| 💰     | セッションコスト（USD）      |
| 🧠     | コンテキストウィンドウ使用量 |
| ⏳     | リセット時刻                 |
| 📊     | 5時間使用率 %                |
| ⏰     | 週間制限リセット時間         |
| 📅     | 7日使用率 %                  |
| ✏️     | コミットされていない変更     |
| 📎     | Pull Requestリンク           |

## 使用量メトリクス

Anthropic Usage APIから使用量情報を取得して表示します。

> [!WARNING]
> `--show-usage`機能は、非公式にリバースエンジニアリングされたAnthropic APIエンドポイントを使用して使用量データを取得します。これは公式にサポートされたAPIではなく、予告なく変更または廃止される可能性があります。**自己責任でご使用ください。**この機能の使用により発生するアカウント制限やサービス中断等のいかなる結果についても、作者は責任を負いません。

> [!NOTE]
> この機能はmacOS Keychain（`Claude Code-credentials`）からOAuthトークンを読み取るため、**macOS専用**です。

### 動作方法

macOS KeychainのOAuthアクセストークンを使用してAnthropic Usage API（`/api/oauth/usage`）を呼び出します：

1. **5時間使用率** - 現在のビリングブロックのサーバー計算使用パーセンテージ
2. **7日使用率** - サーバー計算の週間使用パーセンテージ
3. **リセットタイマー** - サーバーから提供される正確なリセット時間（`five_hour.resets_at`）
4. **週間リセットタイマー** - 7日使用量リセット時刻（`seven_day.resets_at`）、`MM/DD HH:MM`形式（例：`02/15 17:00`）

### 有効化

使用量メトリクスは**デフォルトで非表示**です。有効にするには、`--show-usage`フラグを使用してください：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --show-usage",
    "padding": 0
  }
}
```

## 依存関係

- [Bun](https://bun.sh) - JavaScriptランタイム
- [gh](https://cli.github.com) - GitHub CLI（オプション、PR URL用）

## カラーしきい値

| 指標             | 正常（白） | 警告（黄） | 危険（赤） |
| ---------------- | ---------- | ---------- | ---------- |
| コンテキスト %   | < 50%      | 50-80%     | > 80%      |
| ブロック使用量 % | < 50%      | 50-80%     | > 80%      |

## ライセンス

MIT
