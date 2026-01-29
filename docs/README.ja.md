# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md)

Claude Code用カスタムステータスライン。

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## プレビュー

### Git diffのみ
![scenario1_diff_only](scenario1_diff_only.png)

### PRのみ
![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR
![scenario3_diff_pr](scenario3_diff_pr.png)

## 機能

- **セッション時間**: 現在のセッション経過時間
- **コスト**: セッションコスト（USD）
- **コンテキスト**: トークン使用量とパーセンテージ（色分け表示）
- **Git Diff**: ファイル数、追加、削除
- **PR URL**: クリック可能なOSC 8ハイパーリンク
- **TrueColor**: しきい値に基づく動的カラー

## 絵文字ガイド

| 絵文字 | 説明 |
|--------|------|
| 📁 | プロジェクトフォルダ名 |
| 🌿 | 現在のGitブランチ |
| ⏱️ | セッション経過時間 |
| 💰 | セッションコスト（USD） |
| 🧠 | コンテキストウィンドウ使用量 |
| ✏️ | コミットされていない変更 |
| 📎 | Pull Requestリンク |

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

## 依存関係

- [Bun](https://bun.sh) - JavaScriptランタイム
- [gh](https://cli.github.com) - GitHub CLI（オプション、PR URL用）

## カラーしきい値

| 指標 | 正常（白） | 警告（黄） | 危険（赤） |
| --- | --- | --- | --- |
| コンテキスト % | < 50% | 50-80% | > 80% |

## ライセンス

MIT
