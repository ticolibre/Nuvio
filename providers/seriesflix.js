var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var seriesflix_exports = {};
__export(seriesflix_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(seriesflix_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function normalizeResolution(width, height) {
  if (width >= 3840 || height >= 2160)
    return "4K";
  if (width >= 1920 || height >= 1080)
    return "1080p";
  if (width >= 1280 || height >= 720)
    return "720p";
  if (width >= 854 || height >= 480)
    return "480p";
  return "360p";
}
function detectQuality(_0) {
  return __async(this, arguments, function* (m3u8Url, headers = {}) {
    try {
      const res = yield fetch(m3u8Url, {
        headers: __spreadValues({ "User-Agent": UA }, headers),
        redirect: "follow"
      });
      const data = yield res.text();
      if (!data.includes("#EXT-X-STREAM-INF")) {
        const match = m3u8Url.match(/[_-](\d{3,4})p/);
        return match ? `${match[1]}p` : "Unknown";
      }
      let bestWidth = 0;
      let bestHeight = 0;
      for (const line of data.split("\n")) {
        const m = line.match(/RESOLUTION=(\d+)x(\d+)/);
        if (m) {
          const h = parseInt(m[2]);
          if (h > bestHeight) {
            bestHeight = h;
            bestWidth = parseInt(m[1]);
          }
        }
      }
      return bestHeight > 0 ? normalizeResolution(bestWidth, bestHeight) : "Unknown";
    } catch (e) {
      return "Unknown";
    }
  });
}
var UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var BASE_URL = "https://nupload.my";
function getFinalUrlBypass(url, headers) {
  return __async(this, null, function* () {
    if (typeof XMLHttpRequest !== "undefined") {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "text";
        for (const [k, v] of Object.entries(headers)) {
          xhr.setRequestHeader(k, v);
        }
        xhr.onload = () => {
          resolve(xhr.responseURL || url);
        };
        xhr.onerror = () => reject(new Error("Network error via XHR"));
        xhr.send();
      });
    } else {
      const r = yield fetch(url, { headers, redirect: "follow" });
      if (!r.ok)
        throw new Error(`HTTP ${r.status} al seguir redirecci\xF3n`);
      return r.url;
    }
  });
}
function resolveNupload(embedUrl) {
  return __async(this, null, function* () {
    var _a;
    try {
      console.log(`[Nupload] Resolviendo: ${embedUrl}`);
      const res = yield fetch(embedUrl, {
        headers: { "User-Agent": UA2, "Referer": BASE_URL + "/" }
      });
      const html = yield res.text();
      if (!res.ok)
        throw new Error(`HTTP ${res.status} al cargar el embed`);
      const forEachMatch = html.match(/([A-Za-z]+)\.forEach\s*\(function\s+\w+\s*\(value\)\s*\{[^}]+atob/);
      if (!forEachMatch) {
        console.log("[Nupload] No se encontr\xF3 patr\xF3n de ofuscaci\xF3n ni iframe.");
        return null;
      }
      const arrayVar = forEachMatch[1];
      const offsetMatch = html.match(new RegExp(arrayVar + "\\.forEach[^-]+-\\s*(\\d+)"));
      if (!offsetMatch) {
        console.log("[Nupload] No se pudo extraer el offset num\xE9rico");
        return null;
      }
      const offset = parseInt(offsetMatch[1]);
      const arrayMatch = html.match(new RegExp("var\\s+" + arrayVar + "\\s*=\\s*(\\[[^\\]]+\\])"));
      if (!arrayMatch) {
        console.log("[Nupload] No se encontr\xF3 el array de valores ofuscados");
        return null;
      }
      const values = JSON.parse(arrayMatch[1]);
      let fileUrl = "";
      values.forEach((value) => {
        fileUrl += String.fromCharCode(parseInt(atob(value).replace(/\D/g, "")) - offset);
      });
      const sesz = (_a = html.match(/var sesz\s*=\s*"([^"]+)"/)) == null ? void 0 : _a[1];
      if (!sesz) {
        console.log("[Nupload] No se encontr\xF3 el token sesz");
        return null;
      }
      const finalUrl = fileUrl + "?s=" + sesz;
      console.log("[Nupload] Siguiendo redirecci\xF3n de la URL construida...");
      const videoUrl = yield getFinalUrlBypass(finalUrl, { "User-Agent": UA2 });
      const refererHeaders = {
        "User-Agent": UA2,
        "Referer": "https://nupload.my/",
        "Origin": "https://nupload.my"
      };
      const quality = yield detectQuality(videoUrl, {
        "Referer": "https://nupload.my/",
        "User-Agent": UA2
      });
      console.log("[Nupload] Quality detectada:", quality);
      console.log(`[Nupload] URL encontrada (${quality}): ${videoUrl.substring(0, 80)}...`);
      return { url: videoUrl, quality, headers: refererHeaders };
    } catch (e) {
      console.log(`[Nupload] Error: ${e.message}`);
      return null;
    }
  });
}
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL2 = "https://pelisflixhd1.online";
var UA3 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function buildSlug(title) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "y").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function getTmdbData(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const [esEs, esMx, enUs] = yield Promise.all(
      ["es-ES", "es-MX", "en-US"].map(
        (lang) => fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=${lang}`).then((r) => r.json()).catch(() => null)
      )
    );
    const titleEs = esEs ? mediaType === "movie" ? esEs.title : esEs.name : null;
    const data = esMx && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(mediaType === "movie" ? esMx.title : esMx.name) ? esMx : enUs;
    if (!data)
      return null;
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    const year = (data.release_date || data.first_air_date || "").substring(0, 4);
    console.log(`[SeriesFlixHD] TMDB: "${title}" (${year})`);
    return { title, originalTitle, year, titleEs };
  });
}
function fetchPage(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, {
        headers: { "User-Agent": UA3, "Accept": "text/html" }
      });
      if (!res.ok)
        return null;
      const html = yield res.text();
      return html;
    } catch (e) {
      console.log(`[SeriesFlixHD] fetch error: ${e.message}`);
      return null;
    }
  });
}
function raceFirstSuccess(promises) {
  return new Promise((res, rej) => {
    let pending = promises.length;
    if (!pending) {
      rej(new Error("empty"));
      return;
    }
    let failed = 0;
    promises.forEach((p) => {
      Promise.resolve(p).then(res, () => {
        failed++;
        if (failed >= pending)
          rej(new Error("all failed"));
      });
    });
  });
}
function extractEmbeds(html) {
  const result = { latino: [], castellano: [] };
  if (!html)
    return result;
  const collectWatch = (block) => {
    const out = [];
    const re = /data-server="([^"]+)"/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      let url = null;
      try {
        url = atob(m[1]);
      } catch (e) {
        console.log(`[SeriesFlixHD] Error decodificando base64: ${e.message}`);
      }
      if (url && url.includes("nupload.my/watch/") && out.indexOf(url) === -1)
        out.push(url);
    }
    return out;
  };
  const tabRe = /<li class="tab-video-item">([\s\S]*?)<\/ul>\s*<\/li>/g;
  let tab;
  while ((tab = tabRe.exec(html)) !== null) {
    const block = tab[1];
    if (/alt="audio Latino"/.test(block)) {
      result.latino = result.latino.concat(collectWatch(block));
    } else if (/Castellano/.test(block)) {
      result.castellano = result.castellano.concat(collectWatch(block));
    }
  }
  return result;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    const startTime = Date.now();
    console.log(`[SeriesFlixHD] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      const tmdbInfo = yield getTmdbData(tmdbId, mediaType);
      if (!tmdbInfo)
        return [];
      const variants = [];
      if (tmdbInfo.title)
        variants.push(buildSlug(tmdbInfo.title));
      if (tmdbInfo.originalTitle && tmdbInfo.originalTitle !== tmdbInfo.title)
        variants.push(buildSlug(tmdbInfo.originalTitle));
      if (tmdbInfo.titleEs && tmdbInfo.titleEs !== tmdbInfo.title && tmdbInfo.titleEs !== tmdbInfo.originalTitle)
        variants.push(buildSlug(tmdbInfo.titleEs));
      const pageUrls = [];
      const pushUrl = (u) => {
        if (pageUrls.indexOf(u) === -1)
          pageUrls.push(u);
      };
      if (mediaType === "tv") {
        const ep = String(episode);
        const s = parseInt(season);
        for (const v of variants) {
          pushUrl(`${BASE_URL2}/episodio/${v}-${s}x${ep}`);
          pushUrl(`${BASE_URL2}/episodio/${v}-${tmdbInfo.year}-${s}x${ep}`);
        }
      } else {
        for (const v of variants) {
          pushUrl(`${BASE_URL2}/pelicula/${v}`);
          pushUrl(`${BASE_URL2}/pelicula/${v}-${tmdbInfo.year}`);
        }
      }
      let html = null;
      try {
        html = yield raceFirstSuccess(
          pageUrls.map((url) => fetchPage(url).then((h) => {
            if (!h || h.indexOf("data-server") === -1 && h.indexOf("data-url") === -1)
              throw new Error("not found");
            console.log(`[SeriesFlixHD] ✓ Página encontrada`);
            return h;
          }))
        );
      } catch (e) {
        html = null;
      }
      const embeds = extractEmbeds(html);
      console.log(`[SeriesFlixHD] Latino: ${embeds.latino.length} | Castellano: ${embeds.castellano.length}`);
      const streams = [];
      for (const [urls, langLabel] of [[embeds.latino, "Latino"], [embeds.castellano, "Castellano"]]) {
        if (urls.length === 0)
          continue;
        const results = yield Promise.allSettled(urls.map((u) => resolveNupload(u)));
        const valid = results.filter((r) => r.status === "fulfilled" && r.value).map((r, i) => ({
          name: withSourceName("SeriesFlixHD", "Nupload"),
          title: `${r.value.quality} \xB7 ${langLabel} \xB7 Nupload`,
          url: r.value.url,
          quality: r.value.quality,
          headers: r.value.headers
        }));
        streams.push(...valid);
        if (valid.length > 0)
          break;
      }
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[SeriesFlixHD] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[SeriesFlixHD] Error: ${e.message}`);
      return [];
    }
  });
}
