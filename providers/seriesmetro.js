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
var seriesmetro_exports = {};
__export(seriesmetro_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(seriesmetro_exports);
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
var UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function unpackPacker(data) {
  const match = data.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)\)\)/);
  if (!match)
    return null;
  let [, p, a, c, k] = match;
  a = parseInt(a);
  c = parseInt(c);
  k = k.split("|");
  while (c--) {
    if (k[c])
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
  }
  return p;
}
function resolveFastream(url) {
  return __async(this, null, function* () {
    var _a;
    try {
      const res = yield fetch(url, {
        headers: {
          "User-Agent": UA2,
          "Referer": "https://www3.seriesmetro.net/"
        },
        redirect: "follow"
      });
      const data = yield res.text();
      const unpacked = unpackPacker(data);
      if (!unpacked)
        return null;
      const m3u8 = (_a = unpacked.match(/file:"(https?:\/\/[^"]+\.m3u8[^"]*)"/)) == null ? void 0 : _a[1];
      if (!m3u8)
        return null;
      const quality = yield detectQuality(m3u8, { "Referer": "https://fastream.to/", "User-Agent": UA2 });
      return {
        url: m3u8,
        quality,
        headers: { "User-Agent": UA2, "Referer": "https://fastream.to/" }
      };
    } catch (e) {
      console.error("[Fastream] Error:", e);
      return null;
    }
  });
}
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE = "https://www3.seriesmetro.net";
var UA3 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA3,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};
var LANG_PRIORITY = ["latino", "lat", "castellano", "espa\xF1ol", "esp", "vose", "sub", "subtitulado"];
var LANG_MAP = {
  "latino": "Latino",
  "lat": "Latino",
  "castellano": "Espa\xF1ol",
  "espa\xF1ol": "Espa\xF1ol",
  "esp": "Espa\xF1ol",
  "vose": "Subtitulado",
  "sub": "Subtitulado",
  "subtitulado": "Subtitulado"
};
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
    const name = data === esMx ? "Latino" : "Ingl\xE9s";
    console.log(`[SeriesMetro] TMDB (${name}): "${title}"`);
    return { title, originalTitle, titleEs };
  });
}
function findContentUrl(tmdbInfo, mediaType) {
  return __async(this, null, function* () {
    const { title, originalTitle, titleEs } = tmdbInfo;
    const category = mediaType === "movie" ? "pelicula" : "serie";
    const slugs = [];
    if (title)
      slugs.push(buildSlug(title));
    if (originalTitle && originalTitle !== title)
      slugs.push(buildSlug(originalTitle));
    if (titleEs && titleEs !== title)
      slugs.push(buildSlug(titleEs));
    try {
      return yield Promise.any(
        slugs.map((slug) => __async(this, null, function* () {
          const url = `${BASE}/${category}/${slug}/`;
          const html = yield fetch(url, { headers: HEADERS }).then((r) => r.text());
          if (!html.includes("trembed=") && !html.includes("data-post="))
            throw new Error("not found");
          console.log(`[SeriesMetro] \u2713 Encontrado: /${category}/${slug}/`);
          return { url, html };
        }))
      );
    } catch (e) {
      console.log("[SeriesMetro] No encontrado por slug");
      return null;
    }
  });
}
function getEpisodeUrl(serieUrl, serieHtml, season, episode) {
  return __async(this, null, function* () {
    var _a;
    const dpost = (_a = serieHtml.match(/data-post="(\d+)"/)) == null ? void 0 : _a[1];
    if (!dpost) {
      console.log("[SeriesMetro] No se encontr\xF3 data-post");
      return null;
    }
    try {
      const formData = new URLSearchParams({
        action: "action_select_season",
        post: dpost,
        season: String(season)
      });
      const response = yield fetch(`${BASE}/wp-admin/admin-ajax.php`, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, HEADERS), {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": serieUrl
        }),
        body: formData.toString()
      });
      const text = yield response.text();
      const epUrls = [...text.matchAll(/href="([^"]+\/capitulo\/[^"]+)"/g)].map((m) => m[1]);
      const found = epUrls.find((u) => {
        const m = u.match(/temporada-(\d+)-capitulo-(\d+)/i);
        return m && parseInt(m[1]) === season && parseInt(m[2]) === episode;
      });
      if (found) {
        console.log(`[SeriesMetro] \u2713 Episodio S${season}E${episode} encontrado: ${found}`);
        return found;
      }
      console.log(`[SeriesMetro] Episodio S${season}E${episode} no encontrado`);
      return null;
    } catch (e) {
      console.log(`[SeriesMetro] Error getEpisodeUrl: ${e.message}`);
      return null;
    }
  });
}
function extractStreams(pageUrl, referer) {
  return __async(this, null, function* () {
    var _a;
    const data = yield fetch(pageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": referer }) }).then((r) => r.text());
    const options = [...data.matchAll(/href="#options-(\d+)"[^>]*>[\s\S]*?<span class="server">([\s\S]*?)<\/span>/g)];
    const trids = [...data.matchAll(/\?trembed=(\d+)(?:&#038;|&)trid=(\d+)(?:&#038;|&)trtype=(\d+)/g)];
    if (trids.length === 0 || options.length === 0)
      return [];
    const trid = trids[0][2];
    const trtype = trids[0][3];
    const sorted = options.sort(([, , a], [, , b]) => {
      const aLang = a.replace(/<[^>]+>/g, "").split("-").pop().trim().toLowerCase();
      const bLang = b.replace(/<[^>]+>/g, "").split("-").pop().trim().toLowerCase();
      const ai = LANG_PRIORITY.indexOf(aLang);
      const bi = LANG_PRIORITY.indexOf(bLang);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const streams = [];
    for (const [, idx, srvRaw] of sorted) {
      const srvText = srvRaw.replace(/<[^>]+>/g, "").trim();
      const langRaw = srvText.split("-").pop().trim().toLowerCase();
      const lang = LANG_MAP[langRaw] || langRaw;
      try {
        const embedPage = yield fetch(
          `${BASE}/?trembed=${idx}&trid=${trid}&trtype=${trtype}`,
          { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": pageUrl }) }
        ).then((r) => r.text());
        const fastreamUrl = (_a = embedPage.match(/<iframe[^>]*src="(https?:\/\/fastream\.to\/[^"]+)"/i)) == null ? void 0 : _a[1];
        if (!fastreamUrl)
          continue;
        const stream = yield resolveFastream(fastreamUrl);
        if (!stream)
          continue;
        streams.push({
          name: "SeriesMetro",
          title: `${stream.quality} \xB7 ${lang} \xB7 Fastream`,
          url: stream.url,
          quality: stream.quality,
          headers: stream.headers
        });
        if (lang === "Latino") {
          console.log("[SeriesMetro] Latino encontrado, retornando");
          return streams;
        }
      } catch (e) {
        console.log(`[SeriesMetro] Error embed ${idx}: ${e.message}`);
      }
    }
    return streams;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    const startTime = Date.now();
    console.log(`[SeriesMetro] Buscando: TMDB ${tmdbId} (${mediaType})${season ? ` S${season}E${episode}` : ""}`);
    try {
      const tmdbInfo = yield getTmdbData(tmdbId, mediaType);
      if (!tmdbInfo)
        return [];
      const found = yield findContentUrl(tmdbInfo, mediaType);
      if (!found)
        return [];
      let targetUrl = found.url;
      if (mediaType === "tv" && season && episode) {
        const epUrl = yield getEpisodeUrl(found.url, found.html, season, episode);
        if (!epUrl) {
          console.log(`[SeriesMetro] Episodio S${season}E${episode} no encontrado`);
          return [];
        }
        console.log(`[SeriesMetro] Episodio: ${epUrl}`);
        targetUrl = epUrl;
      }
      const streams = yield extractStreams(targetUrl, targetUrl);
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[SeriesMetro] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[SeriesMetro] Error: ${e.message}`);
      return [];
    }
  });
}
