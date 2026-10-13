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
| `cinecalidad` | ✅ | ❌ |
| `lamovie` | ✅ | ✅ |
| `fuegocine` | ✅ | ✅ |
| `seriesmetro` | ✅ | ✅ |
| `peliserieshoy` | ✅ | ✅ |
| `embed69` | ✅ | ✅ |
| `cuevana` | ✅ | ✅ |
| `pelisplus` | ✅ | ✅ |
| `pelispedia` | ✅ | ✅ |
| `allcalidad` | ✅ | ✅ |
| `doramasflix` | ✅ | ✅ |
| `animeav1` | ✅ | ✅ |
| `jkanime` | ✅ | ✅ |
| `henaojara` | ✅ | ✅ |
| `latanime` | ✅ | ✅ |
| `tioanime` | ✅ | ✅ |
| `seriesflix` | ✅ | ✅ |
| `areshd` | ✅ | ✅ |
---

## Recomendaciones de Plugins, Extensiones o Add-Ons

Estas son algunas recomendaciones en Español para Nuvio, Stremio y CloudStream


### Plugins para Nuvio

- **[Nuvio Providers Latinos](https://raw.githubusercontent.com/KennethJYS/Nuvio-Providers-Latino/refs/heads/main/manifest.json) por KennethJYS** — Addon para ver series, películas y anime.

### Extensiones para Cloudstream

- **[Extensión de Cloudstream](https://raw.githubusercontent.com/redblacker8/storm-ext/refs/heads/builds/repo.json) por redblacker8** — Addon para ver series, películas y anime.

### Addons para Stremio - Compatibles con Nuvio

- **[Animes](https://stremio-addons.net/addons/animeflv)** — Addon para ver anime en español o doblado
- **[Lat-Add](https://stremio-addons.net/addons/lat-add)** — Addon para ver series y películas en español. Requiere unirse a Discord para obtenerlo
- **[Addon-Latam](https://stremio-addons.net/addons/addon-latam)** — Addon para ver series, anime y películas en español o dobladas
- **[DeepFlix](https://stremio-addons.net/addons/deepflix)** — Addon para ver series, anime y películas en español o dobladas
- **[LatinoBrid](https://stremio-addons.net/addons/latinobrid)** — Addon para ver series, anime y películas en español o dobladas
- **[Progreso Latino](https://stremio-addons.net/addons/progreso-latino)** — Addon para ver series, anime y películas en español o dobladas. Requiere login


---

## Recomendaciones de Software

Otras apps y proyectos que vale la pena conocer:

- **[Nuvio](https://nuvio.tv)** — Centro multimedia open-source para tu biblioteca en móvil, TV y escritorio.
- **[Stremio](https://www.stremio.com)** — Centro multimedia con addons para películas, series y TV en vivo
- **[CloudStream](https://github.com/recloudstream/cloudstream)** — Reproductor multimedia para Android basado en extensiones.
- **[Tuvora](https://tuvora.co)** — Reproductor IPTV gratis para M3U, Xtream Codes y Stalker en TV, móvil y escritorio
- **[OwnTV](https://github.com/ahXN00/OwnTV)** — Reproductor IPTV nativo para Android TV con doble motor (libmpv + ExoPlayer)

---

## Uso de la IA

Este repositorio ha sido creado con modelos gratuitos de [OpenCode](https://opencode.ai). 

Gran parte de mi labor ha estado en:

- La elección de proveedores
- Asegurar que los distintos proveedores brinden fuentes para ver el contenido en Nuvio.

Todas las cosas las puedo en la IA que me fortalece. 

---

## Descargo de Responsabilidad

**Nuvio Latam+ Plugin no tiene ninguna asociación, afiliación ni relación con los sitios web de los cuales los scripts obtienen el contenido.** 

Los administradores de esos sitios pueden en cualquier momento y sin previo aviso cerrar el sitio, mudar su contenido a otro dominio o implementar medidas que impidan el scraping. Cuando eso ocurra, uno o varios providers de este plugin pueden dejar de funcionar de un día para otro.

Por eso recomiendo no depender de una sola fuente: complementa este plugin con **add-ons** adicionales para tener siempre alternativas disponibles.
