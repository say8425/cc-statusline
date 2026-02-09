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

## Opciones CLI

| Opción | Descripción | Por defecto |
|--------|-------------|:-----------:|
| [`--plan <plan>`](#selección-de-plan) | Establecer límite de costo según tu suscripción (pro, max5x, max20x) | `pro` |
| [`--no-usage`](#desactivar) | Ocultar línea de métricas de uso | - |

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

### Temporizador de Reinicio de Límite

![Captura de pantalla de la línea de estado con temporizador de reinicio de límite](limit_reset.png)

## Características

- **Tiempo de sesión**: Tiempo transcurrido de la sesión actual
- **Costo**: Costo de la sesión en USD
- **Contexto**: Uso de tokens con porcentaje (codificado por colores)
- **Git Diff**: Cantidad de archivos, inserciones, eliminaciones
- **PR URL**: Hipervínculo OSC 8 clickeable
- **TrueColor**: Colores dinámicos basados en umbrales
- **Temporizador de reinicio**: Tiempo restante hasta el reinicio del límite
- **Uso del bloque**: Uso de costo del bloque de 5 horas con porcentaje
- **Tasa de consumo**: Tasa de consumo de tokens por minuto

## Guía de Emojis

| Emoji | Descripción                          |
| ----- | ------------------------------------ |
| 📁    | Nombre de la carpeta del proyecto    |
| 🌿    | Rama Git actual                      |
| ⏱️    | Tiempo transcurrido de sesión        |
| 💰    | Costo de sesión en USD               |
| 🧠    | Uso de ventana de contexto           |
| ⏳    | Cuenta regresiva de reinicio         |
| 📊    | Uso de costo del bloque de 5 horas   |
| 🔥    | Tasa de consumo de tokens (por min)  |
| ✏️    | Cambios sin confirmar                |
| 📎    | Enlace de Pull Request               |

## Métricas de Uso

Muestra información de uso del bloque de facturación de 5 horas.

> [!NOTE]
> Anthropic no publica la fórmula exacta para el cálculo de uso de suscripción. El uso de bloque es una estimación basada en precios publicados de la API y puede diferir del valor real de `/usage`.

### Cómo Funciona

Analiza automáticamente los archivos JSONL de `~/.claude/projects/` para detectar:

1. **Bloques de facturación de 5 horas** - Detecta los límites de bloque usando tiempo acumulado y detección de brechas de inactividad (redondeado a la hora para el temporizador de reinicio)
2. **Cálculo de costos** - Calcula el costo usando precios específicos por modelo (opus/sonnet/haiku) × cantidad de tokens
3. **Escaneo entre proyectos** - Escanea todos los proyectos bajo `~/.claude/projects/` (los bloques se comparten entre proyectos)
4. **Tasa de consumo** - Calcula el consumo promedio de tokens por minuto

No requiere configuración manual.

### Selección de Plan

El plan se **detecta automáticamente** desde macOS Keychain (`Claude Code-credentials` → `rateLimitTier`), por lo que no se necesita configuración.

> [!NOTE]
> La detección automática es **solo para macOS**. En otras plataformas, usa `--plan` para especificar tu plan explícitamente.

Para especificar manualmente, usa la bandera `--plan`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --plan max5x",
    "padding": 0
  }
}
```

| Plan | Límite de Costo | Comando |
|------|-----------------|---------|
| Pro | $8 | `--plan pro` |
| Max 5x | $40 | `--plan max5x` |
| Max 20x | $160 | `--plan max20x` |
| Auto-detección (predeterminado) | - | - |

### Desactivar

Para ocultar la línea de métricas de uso (temporizador de reinicio, uso del bloque, tasa de consumo), usa la bandera `--no-usage`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bunx @say8425/cc-statusline --no-usage",
    "padding": 0
  }
}
```

## Dependencias

- [Bun](https://bun.sh) - Runtime de JavaScript
- [gh](https://cli.github.com) - GitHub CLI (opcional, para PR URL)

## Umbrales de Color

| Métrica        | Normal (blanco) | Advertencia (amarillo) | Crítico (rojo) |
| -------------- | --------------- | ---------------------- | -------------- |
| Contexto %     | < 50%           | 50-80%                 | > 80%          |
| Uso del bloque % | < 50%         | 50-80%                 | > 80%          |

## Licencia

MIT
