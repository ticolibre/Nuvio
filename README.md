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
| `fuegocine` | ✅ | ✅ |
| `henaojara` | ✅ | ✅ |
| `jkanime` | ✅ | ✅ |
| `lamovie` | ✅ | ✅ |
| `latanime` | ✅ | ✅ |
| `monoschinos` | ✅ | ✅ |
| `pelispedia` | ✅ | ✅ |
| `pelisplus` | ✅ | ✅ |
| `peliserieshoy` | ✅ | ✅ |
| `seriesflix` | ✅ | ✅ |
| `seriesmetro` | ✅ | ✅ |
| `sololatino` | ✅ | ✅ |
| `tioanime` | ✅ | ✅ |
---

## Descargo de Responsabilidad

**Nuvio Latam+ Plugin no tiene ninguna asociación, afiliación ni relación con los sitios web de los cuales los scripts obtienen el contenido.** 

Los administradores de esos sitios pueden en cualquier momento y sin previo aviso cerrar el sitio, mudar su contenido a otro dominio o implementar medidas que impidan el scraping. Cuando eso ocurra, uno o varios providers de este plugin pueden dejar de funcionar de un día para otro.

Por eso recomiendo no depender de una sola fuente: complementa este plugin con **add-ons** adicionales para tener siempre alternativas disponibles.
