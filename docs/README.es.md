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
- **Modelo**: Nombre del modelo en uso y reasoning effort (p. ej., `Fable 5 high`; el effort solo se muestra en modelos compatibles), con una insignia `⚡ultra` cuando ultracode está habilitado en la configuración de Claude Code y la sesión reporta effort `xhigh`
- **Git Diff**: Cantidad de archivos, inserciones, eliminaciones
- **Visor de Diff clicable**: Haz clic en `✏️` para abrir un visor de diff local en tu navegador, proporcionado por [diffdeck](https://github.com/say8425/diffdeck) (instalado automáticamente como dependencia) — árbol de archivos, modos working-tree / vs-base, modo watch (actualización automática), plegado de archivos y búsqueda integrada (`Cmd/Ctrl+F`) en todo el diff, incluidas las líneas eliminadas
- **PR URL**: Hipervínculo OSC 8 clickeable
- **Soporte de Worktree**: Muestra el nombre real del proyecto en sesiones `cc --worktree`
- **TrueColor**: Colores dinámicos basados en umbrales
- **Hora de reinicio**: Hora de reinicio del límite de 5 horas (HH:MM)
- **Uso del bloque**: Porcentaje de utilización de 5 horas
- **Temporizador de reinicio semanal**: Tiempo de reinicio del límite semanal (MM/DD HH:MM)
- **Uso semanal**: Porcentaje de utilización de 7 días

## Guía de Emojis

| Emoji | Descripción                          |
| ----- | ------------------------------------ |
| 📁    | Nombre de la carpeta del proyecto (haz clic para abrir el gestor de archivos) |
| 🌲    | Nombre del worktree (haz clic para abrir la carpeta del worktree) |
| 🌿    | Rama Git actual                      |
| ⏱️    | Tiempo transcurrido de sesión        |
| 💰    | Costo de sesión en USD               |
| 🧠    | Uso de ventana de contexto           |
| 🤖    | Modelo actual y effort               |
| ⏳    | Hora de reinicio                     |
| 📊    | Utilización de 5 horas %             |
| ⏰    | Tiempo de reinicio semanal           |
| 📅    | Utilización de 7 días %              |
| ✏️    | Cambios sin confirmar (haz clic para abrir el visor de diff)                |
| 📎    | Enlace de Pull Request — estado entre corchetes (`[Open]`/`[Draft]`/`[Merged]`/`[Closed]`) más un resumen de CI entre paréntesis (`(N passed)`/`(N running)`/`(N failed)`) cuando existen checks |

## Visor de Diff

Haz clic en `✏️` en el statusline para abrir un visor de diff local en tu navegador. El visor lo proporciona [diffdeck](https://github.com/say8425/diffdeck) ([`@say8425/diffdeck`](https://www.npmjs.com/package/@say8425/diffdeck) en npm), instalado automáticamente como dependencia de tiempo de ejecución de cc-statusline — el statusline lo inicia como un daemon en segundo plano y enlaza a él desde el punto de entrada `✏️`.

![diff_viewer](diff_viewer.png)

- **Dos modos de diff**: `Working tree` (contra HEAD) y `vs <base>` (merge-base contra la rama objetivo del PR o la rama predeterminada). Después de hacer commit, el punto de entrada se mantiene como `✏️ vs <base>` — al hacer clic, el visor se abre en modo base, así tu diff nunca desaparece a mitad de la revisión.

![diff_vs_base](diff_vs_base.png)

- **Diff de imágenes**: las imágenes binarias modificadas (png/jpg/gif/webp/avif/bmp/ico) se muestran en línea en el flujo del diff, en el mismo orden que el árbol de archivos — paneles Old/New lado a lado sobre un fondo de tablero de ajedrez, plegables como cualquier otro archivo

![image_diff](image_diff.png)
- Alternancia de vista **Unified / Split**
- **Modo Watch**: actualización automática (~2s de sondeo) que detecta cambios preservando la posición de desplazamiento
- **Árbol de archivos**: alternancia de posición izquierda/derecha, ancho ajustable arrastrando, flatten (colapsar directorios vacíos) y ocultar la barra lateral
- **Plegado de archivos**: haz clic en la cabecera de un archivo para plegarlo/desplegarlo; los lockfiles y los archivos con más de 1.500 líneas modificadas comienzan plegados
- **Búsqueda integrada** (`Cmd/Ctrl+F`): busca en todo el diff, incluidas las líneas eliminadas, con navegación entre coincidencias y resaltado
- **Copiar ruta**: pasa el cursor sobre la cabecera de un archivo para copiar su ruta relativa
- **diff-grab**: selecciona líneas en el diff (arrastrando el texto o con el botón `+` del margen), escribe un prompt y pulsa Enter — la ruta del archivo, el rango de líneas, el fragmento de código y tu prompt se copian al portapapeles, listos para pegar en un agente como Claude Code
- Alternancia para **incluir archivos sin seguimiento**

### Cómo Funciona (Visor de Diff)

El statusline inicia diffdeck como un daemon en segundo plano bajo demanda en `127.0.0.1:49573` cuando el repositorio tiene algo que mostrar. Las solicitudes están protegidas por token y vinculadas a localhost.

| Variable de entorno | Efecto |
| ------------------- | ------ |
| `CC_STATUSLINE_DIFF_PORT` | Cambiar el puerto (predeterminado: `49573`) |
| `CC_STATUSLINE_DIFF_DISABLE=1` | Desactivar el visor de diff por completo |

> [!TIP]
> Abre el visor a través del enlace `✏️` en lugar de un marcador — el enlace siempre lleva un token actualizado y garantiza que el servidor esté en ejecución.

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
