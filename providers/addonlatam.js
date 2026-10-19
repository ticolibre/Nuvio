var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
var addonlatam_exports = {};
__export(addonlatam_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(addonlatam_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var PROVIDER_NAME = "Addon Latam";
// Addon de Stremio "Addon Latam" (community.addonlatam).
// La URL con token es la de distribucion publica, publicada en
// https://stremio-addons.net/addons/addon-latam
var ADDON_BASE = "https://addonlatam.duckdns.org/A0wrYOb7z4LiG5vrhQwcb-g4";
var ADDON_HOST = "addonlatam.duckdns.org";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
// Nombres legibles de los servidores conocidos del addon.
var SOURCE_LABELS = {
  "goodstream.one": "GoodStream",
  "okcdn.ru": "OK.ru",
  "vids.st": "Vids.st",
  "videro.my": "Videro",
  "pixeldrain.com": "Pixeldrain",
  "dropboxusercontent.com": "Dropbox",
  "plauymito.live": "Plauymito",
  "xuperiptv.com": "XuperTV",
  "lioniptv.us": "LionIPTV"
};
// Maximo de opciones cuyo servidor final se resuelve (evita muchas peticiones).
var MAX_RESOLVE = 12;
// Timeout best-effort para la resolucion del servidor (igual que areshd/monoschinos).
var HAS_TIMERS = typeof setTimeout === "function";
function withTimeout(promise, ms) {
  if (!HAS_TIMERS)
    return promise;
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}
function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}
function friendlySource(host) {
  const h = String(host || "").toLowerCase();
  if (!h)
    return "";
  for (const key in SOURCE_LABELS) {
    if (h === key || h.endsWith(`.${key}`))
      return SOURCE_LABELS[key];
  }
  return h;
}
// El addon a veces embebe HTML escapado despues de la URL real
// (p.ej. ".../master.m3u8&quot;,&quot;ondemandDash&quot;:...) -> se recorta.
function cleanStreamUrl(url) {
  return String(url || "").split("&quot;")[0].split('"')[0].trim();
}
function pickQuality(text) {
  const t = String(text || "");
  if (/2160p|\b4k\b|\buhd\b/i.test(t))
    return "4K";
  const m = t.match(/\b(1080p|720p|576p|480p|360p)\b/i);
  return m ? m[1].toLowerCase() : "HD";
}
function flattenTitle(text) {
  return String(text || "").split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean).join(" \xB7 ");
}
// Sustituye el marcador "Server" que deja el addon por el servidor real.
function labelTitle(title, source) {
  if (!source)
    return title;
  return title.split(" \xB7 ").map((part) => part.trim() === "Server" ? source : part).join(" \xB7 ");
}
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "movie" ? `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}` : `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const data = yield fetch(endpoint, { headers: { "User-Agent": UA } }).then((r) => r.json());
      return data && data.imdb_id ? data.imdb_id : null;
    } catch (e) {
      console.log(`[AddonLatam] Error TMDB: ${e.message}`);
      return null;
    }
  });
}
// El addon entrega parte de las opciones detras de su propio redirector
// (/redirect/<token cifrado>). Se sigue con HEAD (sin descargar cuerpo) para
// saber en que servidor termina. Si falla, se devuelve null y no se etiqueta.
function resolveSource(url) {
  return __async(this, null, function* () {
    try {
      const res = yield withTimeout(fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": UA },
        redirect: "follow"
      }), 6000);
      if (!res)
        return null;
      const finalUrl = res.url || "";
      const host = hostFromUrl(finalUrl).toLowerCase();
      if (!host || host === ADDON_HOST)
        return null;
      return host;
    } catch (e) {
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    const startTime = Date.now();
    console.log(`[AddonLatam] Buscando: TMDB ${tmdbId} (${mediaType})${mediaType === "tv" ? ` S${season}E${episode}` : ""}`);
    try {
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.log("[AddonLatam] Sin IMDb ID en TMDB");
        return [];
      }
      const endpoint = mediaType === "tv" ? `${ADDON_BASE}/stream/series/${imdbId}:${parseInt(season)}:${parseInt(episode)}.json` : `${ADDON_BASE}/stream/movie/${imdbId}.json`;
      console.log(`[AddonLatam] Fetching: ${endpoint}`);
      const res = yield fetch(endpoint, {
        headers: { "User-Agent": UA, "Accept": "application/json" },
        redirect: "follow"
      });
      if (!res.ok) {
        console.log(`[AddonLatam] HTTP ${res.status}`);
        return [];
      }
      const data = yield res.json();
      const list = data && Array.isArray(data.streams) ? data.streams : [];
      const candidates = [];
      const seen = {};
      for (const item of list) {
        if (!item || !item.url)
          continue;
        const url = cleanStreamUrl(item.url);
        if (!url || seen[url])
          continue;
        seen[url] = true;
        const rawTitle = flattenTitle(item.title);
        candidates.push({
          url,
          title: rawTitle,
          quality: pickQuality(`${item.title || ""} ${rawTitle}`),
          isRedirect: hostFromUrl(url).toLowerCase() === ADDON_HOST
        });
      }
      if (candidates.length === 0) {
        console.log("[AddonLatam] Sin streams");
        return [];
      }
      const pending = candidates.filter((c) => c.isRedirect).slice(0, MAX_RESOLVE);
      const sourceByUrl = {};
      if (pending.length > 0) {
        const resolved = yield Promise.all(pending.map((c) => resolveSource(c.url).catch(() => null)));
        pending.forEach((c, i) => {
          if (resolved[i])
            sourceByUrl[c.url] = resolved[i];
        });
      }
      const streams = candidates.map((c) => {
        const host = c.isRedirect ? sourceByUrl[c.url] : hostFromUrl(c.url);
        const source = friendlySource(host);
        const title = labelTitle(c.title, source);
        return {
          name: withSourceName(PROVIDER_NAME, source),
          title: title || source || PROVIDER_NAME,
          url: c.url,
          quality: c.quality,
          headers: { "User-Agent": UA }
        };
      });
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[AddonLatam] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (err) {
      console.error(`[AddonLatam] Error: ${err.message}`);
      return [];
    }
  });
}
