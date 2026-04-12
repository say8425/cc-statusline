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

### Worktree

![worktree_diff](worktree_diff.png)

### Worktree + Métricas de Uso

![worktree_usage](worktree_usage.png)

### Métricas de Uso

![Captura de pantalla de la línea de estado con métricas de uso](usage_metrics.png)

## Características

- **Tiempo de sesión**: Tiempo transcurrido de la sesión actual
- **Costo**: Costo de la sesión en USD
- **Contexto**: Uso de tokens con porcentaje (codificado por colores)
- **Git Diff**: Cantidad de archivos, inserciones, eliminaciones
- **PR URL**: Hipervínculo OSC 8 clickeable
- **TrueColor**: Colores dinámicos basados en umbrales
- **Hora de reinicio**: Hora de reinicio del límite de 5 horas (HH:MM)
- **Soporte de Worktree**: Muestra el nombre real del proyecto en sesiones `cc --worktree`
- **Uso del bloque**: Porcentaje de utilización de 5 horas
- **Temporizador de reinicio semanal**: Tiempo de reinicio del límite semanal (MM/DD HH:MM)
- **Uso semanal**: Porcentaje de utilización de 7 días

## Guía de Emojis

| Emoji | Descripción                          |
| ----- | ------------------------------------ |
| 📁    | Nombre de la carpeta del proyecto    |
| 🌲    | Nombre del worktree (en sesiones worktree) |
| 🌿    | Rama Git actual                      |
| ⏱️    | Tiempo transcurrido de sesión        |
| 💰    | Costo de sesión en USD               |
| 🧠    | Uso de ventana de contexto           |
| ⏳    | Hora de reinicio                     |
| 📊    | Utilización de 5 horas %             |
| ⏰    | Tiempo de reinicio semanal           |
| 📅    | Utilización de 7 días %              |
| ✏️    | Cambios sin confirmar                |
| 📎    | Enlace de Pull Request               |

## Métricas de Uso

Muestra información de uso desde la entrada JSON stdin de Claude Code.

### Cómo Funciona

Claude Code pasa `rate_limits` en la entrada JSON stdin (CLI 2.1.80+):

1. **Utilización de 5 horas** - Porcentaje de uso del bloque de facturación actual (`rate_limits.five_hour.used_percentage`)
2. **Utilización de 7 días** - Porcentaje de uso semanal (`rate_limits.seven_day.used_percentage`)
3. **Temporizador de reinicio** - Tiempo exacto de reinicio (`rate_limits.five_hour.resets_at`), formato `HH:MM`
4. **Temporizador de reinicio semanal** - Tiempo de reinicio del límite semanal (`rate_limits.seven_day.resets_at`), formato `MM/DD HH:MM` (ej., `02/15 17:00`)

Las métricas de uso se **muestran automáticamente** cuando `rate_limits` está presente en el JSON stdin. No se necesitan flags ni configuración adicional.

> [!NOTE]
> `rate_limits` solo está disponible para suscriptores de Claude.ai (Pro/Max) después de la primera respuesta de la API. Consulte la [documentación oficial de statusline](https://code.claude.com/docs/en/statusline) para el esquema JSON completo.

## Dependencias

- [Bun](https://bun.sh) - Runtime de JavaScript
- [gh](https://cli.github.com) - GitHub CLI (opcional, para PR URL)

## Umbrales de Color

| Métrica          | Normal (blanco) | Advertencia (amarillo) | Crítico (rojo) |
| ---------------- | --------------- | ---------------------- | -------------- |
| Contexto %       | < 50%           | 50-80%                 | > 80%          |
| Uso del bloque % | < 50%           | 50-80%                 | > 80%          |

## Licencia

MIT
