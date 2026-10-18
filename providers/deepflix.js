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
var deepflix_exports = {};
__export(deepflix_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(deepflix_exports);
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var BASE_URL = "https://mg.homelabx.qzz.io";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "movie" ? `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}` : `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const data = yield fetch(endpoint, { headers: { "User-Agent": UA } }).then((r) => r.json());
      return data && data.imdb_id ? data.imdb_id : null;
    } catch (e) {
      console.log(`[DeepFlix] Error TMDB: ${e.message}`);
      return null;
    }
  });
}
function buildEndpoint(imdbId, mediaType, season, episode) {
  if (mediaType === "tv") {
    return `${BASE_URL}/stream/series/${imdbId}:${parseInt(season)}:${parseInt(episode)}.json`;
  }
  return `${BASE_URL}/stream/movie/${imdbId}.json`;
}
function parseMeta(description) {
  const text = String(description || "");
  const qualityMatch = text.match(/🎥\s*([^\n]+)/);
  const langMatch = text.match(/🗣️\s*([^\n]+)/);
  const titleMatch = text.match(/🎬\s*([^\n]+)/);
  let title = titleMatch ? titleMatch[1].trim() : "";
  title = title.replace(/\s*🍂[\s\S]*$/, "").trim();
  return {
    title,
    quality: qualityMatch ? qualityMatch[1].trim() : "HD",
    langs: langMatch ? langMatch[1].trim() : ""
  };
}
function langLabel(raw) {
  if (!raw)
    return "";
  const parts = [];
  if (raw.indexOf("🇲🇽") !== -1 || raw.indexOf("🇨🇴") !== -1 || raw.indexOf("🇦🇷") !== -1)
    parts.push("Latino");
  if (raw.indexOf("🇪🇸") !== -1)
    parts.push("Espa\xF1ol");
  if (raw.indexOf("🇺🇸") !== -1)
    parts.push("Ingl\xE9s");
  const label = parts.length > 0 ? parts.join("/") : raw;
  return raw.indexOf("?") !== -1 ? `${label} (?)` : label;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    const startTime = Date.now();
    console.log(`[DeepFlix] Buscando: TMDB ${tmdbId} (${mediaType})${mediaType === "tv" ? ` S${season}E${episode}` : ""}`);
    try {
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.log("[DeepFlix] Sin IMDb ID en TMDB");
        return [];
      }
      const endpoint = buildEndpoint(imdbId, mediaType, season, episode);
      console.log(`[DeepFlix] Fetching: ${endpoint}`);
      const res = yield fetch(endpoint, {
        headers: { "User-Agent": UA, "Accept": "application/json" },
        redirect: "follow"
      });
      if (!res.ok) {
        console.log(`[DeepFlix] HTTP ${res.status}`);
        return [];
      }
      const data = yield res.json();
      const list = data && Array.isArray(data.streams) ? data.streams : [];
      const streams = [];
      const seen = {};
      for (const item of list) {
        if (!item || !item.url)
          continue;
        if (seen[item.url])
          continue;
        seen[item.url] = true;
        const meta = parseMeta(item.description);
        const label = langLabel(meta.langs);
        streams.push({
          name: "DeepFlix",
          title: [meta.quality, label, "DeepFlix"].filter(Boolean).join(" \xB7 "),
          url: item.url,
          quality: meta.quality,
          headers: { "User-Agent": UA }
        });
      }
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[DeepFlix] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (err) {
      console.error(`[DeepFlix] Error: ${err.message}`);
      return [];
    }
  });
}
