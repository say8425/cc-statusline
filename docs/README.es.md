# cc-statusline

[English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | Español

Línea de estado personalizada para Claude Code.

[![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white)](https://code.claude.com/docs/en/statusline)
[![npm](https://img.shields.io/npm/v/%40say8425%2Fcc-statusline?logo=npm&logoColor=%23CC3534&color=%23CC3534)](https://www.npmjs.com/package/@say8425/cc-statusline)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-black?style=flat&logo=bun)](https://bun.sh)

## Instalación

Agrega lo siguiente a `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline",
    "padding": 0
  }
}
```

## Capturas de pantalla

### Solo Git diff

![scenario1_diff_only](scenario1_diff_only.png)

### Solo PR

![scenario2_pr_only](scenario2_pr_only.png)

### Git diff + PR

![scenario3_diff_pr](scenario3_diff_pr.png)

### Context Normal (< 50%)

![Captura de pantalla de la línea de estado con uso de contexto normal, menos del 50%](context_normal.png)

### Context Advertencia (50-80%)

![Captura de pantalla de la línea de estado con uso de contexto en advertencia, entre 50% y 80%](context_warning.png)

### Context Crítico (> 80%)

![Captura de pantalla de la línea de estado con uso de contexto crítico, más del 80%](context_critical.png)

## Características

- **Tiempo de sesión**: Tiempo transcurrido de la sesión actual
- **Costo**: Costo de la sesión en USD
- **Contexto**: Uso de tokens con porcentaje (codificado por colores)
- **Git Diff**: Cantidad de archivos, inserciones, eliminaciones
- **PR URL**: Hipervínculo OSC 8 clickeable
- **TrueColor**: Colores dinámicos basados en umbrales

## Guía de Emojis

| Emoji | Descripción                       |
| ----- | --------------------------------- |
| 📁    | Nombre de la carpeta del proyecto |
| 🌿    | Rama Git actual                   |
| ⏱️    | Tiempo transcurrido de sesión     |
| 💰    | Costo de sesión en USD            |
| 🧠    | Uso de ventana de contexto        |
| ✏️    | Cambios sin confirmar             |
| 📎    | Enlace de Pull Request            |

## Dependencias

- [Bun](https://bun.sh) - Runtime de JavaScript
- [gh](https://cli.github.com) - GitHub CLI (opcional, para PR URL)

## Umbrales de Color

| Métrica    | Normal (blanco) | Advertencia (amarillo) | Crítico (rojo) |
| ---------- | --------------- | ---------------------- | -------------- |
| Contexto % | < 50%           | 50-80%                 | > 80%          |

## Licencia

MIT
