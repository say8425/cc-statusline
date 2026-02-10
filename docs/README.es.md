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

### Métricas de Uso

![Captura de pantalla de la línea de estado con temporizador de reinicio de límite](limit_reset.png)

## Características

- **Tiempo de sesión**: Tiempo transcurrido de la sesión actual
- **Costo**: Costo de la sesión en USD
- **Contexto**: Uso de tokens con porcentaje (codificado por colores)
- **Git Diff**: Cantidad de archivos, inserciones, eliminaciones
- **PR URL**: Hipervínculo OSC 8 clickeable
- **TrueColor**: Colores dinámicos basados en umbrales
- **Temporizador de reinicio**: Tiempo restante hasta el reinicio del límite
- **Uso del bloque**: Porcentaje de utilización de 5 horas (desde API del servidor)
- **Uso semanal**: Porcentaje de utilización de 7 días (desde API del servidor)

## Guía de Emojis

| Emoji | Descripción                          |
| ----- | ------------------------------------ |
| 📁    | Nombre de la carpeta del proyecto    |
| 🌿    | Rama Git actual                      |
| ⏱️    | Tiempo transcurrido de sesión        |
| 💰    | Costo de sesión en USD               |
| 🧠    | Uso de ventana de contexto           |
| ⏳    | Cuenta regresiva de reinicio         |
| 📊    | Utilización de 5 horas %             |
| 📅    | Utilización de 7 días %              |
| ✏️    | Cambios sin confirmar                |
| 📎    | Enlace de Pull Request               |

## Métricas de Uso

Muestra información de uso desde la API de Uso de Anthropic.

> [!WARNING]
> La función `--show-usage` utiliza un endpoint no oficial de la API de Anthropic, obtenido mediante ingeniería inversa, para recuperar datos de uso. Esta no es una API oficialmente soportada y puede cambiar o dejar de funcionar en cualquier momento sin previo aviso. **Úselo bajo su propio riesgo.** El autor no asume responsabilidad por ninguna consecuencia, incluyendo pero no limitado a restricciones de cuenta o interrupciones del servicio, que puedan surgir del uso de esta función.

> [!NOTE]
> Esta función es **solo para macOS** ya que lee el token OAuth del macOS Keychain (`Claude Code-credentials`).

### Cómo Funciona

Llama a la API de Uso de Anthropic (`/api/oauth/usage`) usando el token de acceso OAuth del macOS Keychain para obtener:

1. **Utilización de 5 horas** - Porcentaje de uso calculado por el servidor para el bloque de facturación actual
2. **Utilización de 7 días** - Porcentaje de uso semanal calculado por el servidor
3. **Temporizador de reinicio** - Tiempo exacto de reinicio desde el servidor (`resets_at`)

### Activar

Las métricas de uso están **ocultas por defecto**. Para activarlas, use la bandera `--show-usage`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --show-usage",
    "padding": 0
  }
}
```

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
