# Nuvio Latam+ Plugin

Providers de películas, series y doramas en **español latino** para **Nuvio Media Hub**. Streams con audio latino, castellano o subtitulado desde las fuentes más populares.

---

## Plugin vs Add-on: ¿cuál es la diferencia?

Ambos conviven sin problema: puedes tener este plugin instalado junto a tantos add-ons como quieras.

Este es un plugin de nuvio. 

| Característica | Add-on | Plugin |
|---|---|---|
| Arquitectura | Cliente-servidor | Código ejecutado en el cliente |
| Ejecución de la lógica | Servidor remoto | Dispositivo donde corre Nuvio |
| Tecnología | API HTTP y respuestas JSON | JavaScript en un entorno QuickJS |
| Protocolo | Protocolo de add-ons de Stremio | Formato propio de Nuvio |
| Instalación | URL del manifiesto del add-on | Repositorio o manifiesto de plugins |
| Compatibilidad | Puede funcionar en otros clientes compatibles con Stremio | Específico de Nuvio |

---
## Instalación

Esto es un **plugin para Nuvio**. Para instalarlo:

1. Abre Nuvio y ve a **Profile → Content & Discovery → Plugins**
2. Agrega la manifest URL:
   ```
   https://raw.githubusercontent.com/ticolibre/Nuvio/main/manifest.json
   ```
3. Haz clic en **Install Plugins repository**

---

## Providers incluidos

| Provider | Películas | Series |
|---|---|---|
| `addonlatam` | ✅ | ✅ |
| `allcalidad` | ✅ | ✅ |
| `animeav1` | ✅ | ✅ |
| `areshd` | ✅ | ✅ |
| `cinecalidad` | ✅ | ❌ |
| `cuevana` | ✅ | ✅ |
| `deepflix` | ✅ | ✅ |
| `doramasflix` | ✅ | ✅ |
| `embed69` | ✅ | ✅ |
| `henaojara` | ✅ | ✅ |
| `jkanime` | ✅ | ✅ |
| `lamovie` | ✅ | ✅ |
| `latanime` | ✅ | ✅ |
| `monoschinos` | ✅ | ✅ |
| `pelispedia` | ✅ | ✅ |
| `pelisforte` | ✅ | ✅ |
| `pelisplus` | ✅ | ✅ |
| `peliserieshoy` | ✅ | ✅ |
| `seriesflix` | ✅ | ✅ |
| `seriesmetro` | ✅ | ✅ |
| `sololatino` | ✅ | ✅ |
| `tioanime` | ✅ | ✅ |
---

## Pruebas locales (opcional)

El repositorio incluye `test.js` para comprobar los providers desde tu PC. **No se ejecuta dentro de Nuvio**: es solo una herramienta de desarrollo.

Requisitos: Node.js 18 o superior y `crypto-js` (`npm install crypto-js`).

```bash
node test.js                        # cascade: todos contra el primer título; solo los fallos pasan al siguiente
node test.js --fixtures=squidgame   # todos los providers contra un solo título
node test.js --matrix               # todos los providers contra todos los títulos
node test.js --only=jkanime -v      # un provider concreto, mostrando sus logs
```

Estados: `OK n` (n streams), `EMPTY` (respondió sin streams), `TIMEOUT`, `ERROR` y `—` (tipo no soportado).

---

## Descargo de Responsabilidad

**Nuvio Latam+ Plugin no tiene ninguna asociación, afiliación ni relación con los sitios web de los cuales los scripts obtienen el contenido.** 

Los administradores de esos sitios pueden en cualquier momento y sin previo aviso cerrar el sitio, mudar su contenido a otro dominio o implementar medidas que impidan el scraping. Cuando eso ocurra, uno o varios providers de este plugin pueden dejar de funcionar de un día para otro.

Por eso recomiendo no depender de una sola fuente: complementa este plugin con **add-ons** adicionales para tener siempre alternativas disponibles.
