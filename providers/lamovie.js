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
  return new Promise((resolve5, reject) => {
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
    var step = (x) => x.done ? resolve5(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var lamovie_exports = {};
__export(lamovie_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(lamovie_exports);
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var TIER_MAPS = {
  vimeos: { h: "720p", n: "480p" },
  goodstream: { x: "1080p", h: "720p", n: "480p", l: "360p" },
  vidhide: { n: "720p", l: "480p" },
  streamwish: { x: "1080p", h: "1080p", n: "720p", l: "480p" },
  voe: { n: "720p", l: "360p" }
};
var TIER_PRIORITY = ["x", "o", "h", "n", "l"];
function getCdnTierMap(url) {
  if (url.includes("vimeos"))
    return TIER_MAPS.vimeos;
  if (url.includes("goodstream"))
    return TIER_MAPS.goodstream;
  if (url.includes("cloudwindow-route"))
    return TIER_MAPS.voe;
  if (url.includes("minochinos") || url.includes("vidhide") || url.includes("dintezuvio") || url.includes("dramiyos"))
    return TIER_MAPS.vidhide;
  if (url.includes("premilkyway") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("streamwish"))
    return TIER_MAPS.streamwish;
  return null;
}
function smartQuality(_0) {
  return __async(this, arguments, function* (url, headers = {}) {
    const inferred = inferQuality(url);
    if (inferred !== "Unknown")
      return inferred;
    return yield detectQuality(url, headers);
  });
}
function inferQuality(url) {
  if (!url)
    return "Unknown";
  const tierMap = getCdnTierMap(url);
  if (tierMap) {
    const tierMatch = url.match(/_,([a-z,]+),\.urlset/);
    if (tierMatch) {
      const tiers = tierMatch[1].split(",").filter(Boolean);
      for (const t of TIER_PRIORITY) {
        if (tiers.includes(t) && tierMap[t])
          return tierMap[t];
      }
    }
  }
  const numMatch = url.match(/[_\-\/](\d{3,4})p/);
  if (numMatch)
    return numMatch[1] + "p";
  return "Unknown";
}
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
function resolve(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[GoodStream] Resolviendo: ${embedUrl}`);
      const response = yield fetch(embedUrl, {
        headers: {
          "User-Agent": UA2,
          "Referer": "https://goodstream.one",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow"
      });
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const html = yield response.text();
      const match = html.match(/file:\s*"([^"]+)"/);
      if (!match) {
        console.log('[GoodStream] No se encontr\xF3 patr\xF3n file:"..."');
        return null;
      }
      const videoUrl = match[1];
      const refererHeaders = { "Referer": embedUrl, "Origin": "https://goodstream.one", "User-Agent": UA2 };
      const quality = inferQuality(videoUrl);
      console.log(`[GoodStream] URL encontrada (${quality}): ${videoUrl.substring(0, 80)}...`);
      return { url: videoUrl, quality, headers: refererHeaders };
    } catch (err) {
      console.log(`[GoodStream] Error: ${err.message}`);
      return null;
    }
  });
}
var UA3 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function b64toString(str) {
  try {
    if (typeof atob !== "undefined")
      return atob(str);
    return Buffer.from(str, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}
function voeDecode(ct, luts) {
  try {
    const rawLuts = luts.replace(/^\[|\]$/g, "").split("','").map((s) => s.replace(/^'+|'+$/g, ""));
    const escapedLuts = rawLuts.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    let txt = "";
    for (let ch of ct) {
      let x = ch.charCodeAt(0);
      if (x > 64 && x < 91)
        x = (x - 52) % 26 + 65;
      else if (x > 96 && x < 123)
        x = (x - 84) % 26 + 97;
      txt += String.fromCharCode(x);
    }
    for (const pat of escapedLuts)
      txt = txt.replace(new RegExp(pat, "g"), "_");
    txt = txt.split("_").join("");
    const decoded1 = b64toString(txt);
    if (!decoded1)
      return null;
    let step4 = "";
    for (let i = 0; i < decoded1.length; i++) {
      step4 += String.fromCharCode((decoded1.charCodeAt(i) - 3 + 256) % 256);
    }
    const revBase64 = step4.split("").reverse().join("");
    const finalStr = b64toString(revBase64);
    if (!finalStr)
      return null;
    return JSON.parse(finalStr);
  } catch (e) {
    console.log("[VOE] voeDecode error:", e.message);
    return null;
  }
}
function fetchUrl(_0) {
  return __async(this, arguments, function* (url, headers = {}) {
    const resp = yield fetch(url, {
      method: "GET",
      headers: __spreadValues({
        "User-Agent": UA3,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }, headers),
      redirect: "follow"
    });
    return resp;
  });
}
function resolve2(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[VOE] Resolviendo: ${embedUrl}`);
      let pageResp = yield fetchUrl(embedUrl, { Referer: embedUrl });
      if (!pageResp.ok)
        throw new Error(`HTTP ${pageResp.status}`);
      let data = yield pageResp.text();
      if (/permanentToken/i.test(data)) {
        const m2 = data.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (m2) {
          console.log(`[VOE] Permanent token redirect -> ${m2[1]}`);
          const r2 = yield fetchUrl(m2[1], { Referer: embedUrl });
          if (r2.ok) {
            data = yield r2.text();
          }
        }
      }
      const rMain = data.match(
        /json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i
      );
      if (rMain) {
        const encodedArray = rMain[1];
        const loaderUrl = rMain[2].startsWith("http") ? rMain[2] : new URL(rMain[2], embedUrl).href;
        console.log(`[VOE] Found encoded array + loader: ${loaderUrl}`);
        const jsResp = yield fetchUrl(loaderUrl, { Referer: embedUrl });
        const jsData = jsResp.ok ? yield jsResp.text() : "";
        const replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (replMatch) {
          const decoded = voeDecode(encodedArray, replMatch[1]);
          if (decoded && (decoded.source || decoded.direct_access_url)) {
            const url = decoded.source || decoded.direct_access_url;
            const quality = inferQuality(url);
            console.log(`[VOE] URL encontrada: ${url.substring(0, 80)}...`);
            return { url, quality, headers: { Referer: embedUrl } };
          }
        }
      }
      const re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
      const re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
      const matches = [];
      let m;
      while ((m = re1.exec(data)) !== null)
        matches.push(m);
      while ((m = re2.exec(data)) !== null)
        matches.push(m);
      for (const match of matches) {
        const candidate = match[1];
        if (!candidate)
          continue;
        let url = candidate;
        if (url.startsWith("aHR0")) {
          try {
            url = atob(url);
          } catch (e) {
          }
        }
        console.log(`[VOE] URL encontrada (fallback): ${url.substring(0, 80)}...`);
        return { url, quality: inferQuality(url), headers: { Referer: embedUrl } };
      }
      console.log("[VOE] No se encontr\xF3 URL");
      return null;
    } catch (err) {
      console.log(`[VOE] Error: ${err.message}`);
      return null;
    }
  });
}
var UA4 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function unpackEval(payload, radix, symtab) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const unbase = (str) => {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      const pos = chars.indexOf(str[i]);
      if (pos === -1)
        return NaN;
      result = result * radix + pos;
    }
    return result;
  };
  return payload.replace(/\b([0-9a-zA-Z]+)\b/g, (match) => {
    const idx = unbase(match);
    if (isNaN(idx) || idx >= symtab.length)
      return match;
    return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
  });
}
function extractHlsUrl(unpacked, embedHost) {
  const objMatch = unpacked.match(/\{[^{}]*"hls[234]"\s*:\s*"([^"]+)"[^{}]*\}/);
  if (objMatch) {
    try {
      const normalized = objMatch[0].replace(/(\w+)\s*:/g, '"$1":');
      const obj = JSON.parse(normalized);
      const url = obj.hls4 || obj.hls3 || obj.hls2;
      if (url)
        return url.startsWith("/") ? embedHost + url : url;
    } catch (e) {
      const urlMatch = objMatch[0].match(/"hls[234]"\s*:\s*"([^"]+\.m3u8[^"]*)"/);
      if (urlMatch) {
        const url = urlMatch[1];
        return url.startsWith("/") ? embedHost + url : url;
      }
    }
  }
  const m3u8Match = unpacked.match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
  if (m3u8Match) {
    const url = m3u8Match[1];
    return url.startsWith("/") ? embedHost + url : url;
  }
  return null;
}
var DOMAIN_MAP = {
  "hglink.to": "vibuxer.com"
};
function resolve3(embedUrl) {
  return __async(this, null, function* () {
    var _a;
    try {
      let fetchUrl2 = embedUrl;
      for (const [from, to] of Object.entries(DOMAIN_MAP)) {
        if (fetchUrl2.includes(from)) {
          fetchUrl2 = fetchUrl2.replace(from, to);
          break;
        }
      }
      const embedHost = ((_a = fetchUrl2.match(/^(https?:\/\/[^/]+)/)) == null ? void 0 : _a[1]) || "https://hlswish.com";
      console.log(`[HLSWish] Resolviendo: ${embedUrl}`);
      if (fetchUrl2 !== embedUrl)
        console.log(`[HLSWish] \u2192 Mapped to: ${fetchUrl2}`);
      const resp = yield fetch(fetchUrl2, {
        headers: {
          "User-Agent": UA4,
          "Referer": "https://embed69.org/",
          "Origin": "https://embed69.org",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9"
        },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      const data = yield resp.text();
      const fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        let url = fileMatch[1];
        if (url.startsWith("/"))
          url = embedHost + url;
        if (url.includes("vibuxer.com/stream/")) {
          console.log(`[HLSWish] Siguiendo redirect: ${url.substring(0, 80)}...`);
          try {
            const redirectResp = yield fetch(url, {
              headers: { "User-Agent": UA4, "Referer": embedHost + "/" },
              redirect: "follow"
            });
            const finalUrl = redirectResp.url;
            if (finalUrl && finalUrl.includes(".m3u8")) {
              url = finalUrl;
            }
          } catch (e) {
          }
        }
        console.log(`[HLSWish] URL encontrada: ${url.substring(0, 80)}...`);
        return { url, quality: smartQuality(url), headers: { "User-Agent": UA4, "Referer": embedHost + "/" } };
      }
      const packMatch = data.match(
        /eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/
      );
      if (packMatch) {
        const unpacked = unpackEval(packMatch[1], parseInt(packMatch[2]), packMatch[4].split("|"));
        const url = extractHlsUrl(unpacked, embedHost);
        if (url) {
          console.log(`[HLSWish] URL encontrada: ${url.substring(0, 80)}...`);
          return { url, quality: smartQuality(url), headers: { "User-Agent": UA4, "Referer": embedHost + "/" } };
        }
      }
      const rawM3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (rawM3u8) {
        console.log(`[HLSWish] URL encontrada: ${rawM3u8[0].substring(0, 80)}...`);
        return { url: rawM3u8[0], quality: smartQuality(rawM3u8[0]), headers: { "User-Agent": UA4, "Referer": embedHost + "/" } };
      }
      console.log("[HLSWish] No se encontr\xF3 URL");
      return null;
    } catch (err) {
      console.log(`[HLSWish] Error: ${err.message}`);
      return null;
    }
  });
}
var UA5 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function resolve4(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[Vimeos] Resolviendo: ${embedUrl}`);
      const resp = yield fetch(embedUrl, {
        headers: {
          "User-Agent": UA5,
          "Referer": "https://vimeos.net/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      const data = yield resp.text();
      const packMatch = data.match(
        /eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/
      );
      if (packMatch) {
        const payload = packMatch[1];
        const radix = parseInt(packMatch[2]);
        const symtab = packMatch[4].split("|");
        const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const unbase = (str) => {
          let result = 0;
          for (let i = 0; i < str.length; i++) {
            result = result * radix + chars.indexOf(str[i]);
          }
          return result;
        };
        const unpacked = payload.replace(/\b(\w+)\b/g, (match) => {
          const idx = unbase(match);
          return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
        });
        const m3u8Match = unpacked.match(/["']([^"']+\.m3u8[^"']*)['"]/i);
        if (m3u8Match) {
          const url = m3u8Match[1];
          const refererHeaders = { "User-Agent": UA5, "Referer": "https://vimeos.net/" };
          const quality = inferQuality(url);
          console.log(`[Vimeos] URL encontrada: ${url.substring(0, 80)}...`);
          return { url, quality, headers: refererHeaders };
        }
      }
      console.log("[Vimeos] No se encontr\xF3 URL");
      return null;
    } catch (err) {
      console.log(`[Vimeos] Error: ${err.message}`);
      return null;
    }
  });
}
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var UA6 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var HEADERS = { "User-Agent": UA6, "Accept": "application/json" };
var BASE_URL = "https://lamovie.org";
var ANIME_COUNTRIES = ["JP", "CN", "KR"];
var GENRE_ANIMATION = 16;
var RESOLVERS = {
  "goodstream.one": resolve,
  "hlswish.com": resolve3,
  "streamwish.com": resolve3,
  "streamwish.to": resolve3,
  "strwish.com": resolve3,
  "voe.sx": resolve2,
  // 'filemoon.sx': resolveFilemoon,
  // 'filemoon.to': resolveFilemoon,
  "vimeos.net": resolve4
};
var IGNORED_HOSTS = [];
function httpGet(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const res = yield fetch(url, {
      headers: __spreadValues({ "User-Agent": UA6 }, options.headers),
      redirect: "follow"
    });
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    return contentType.includes("json") ? res.json() : res.text();
  });
}
var getServerName = (url) => {
  if (url.includes("goodstream"))
    return "GoodStream";
  if (url.includes("hlswish") || url.includes("streamwish"))
    return "StreamWish";
  if (url.includes("voe.sx"))
    return "VOE";
  if (url.includes("filemoon"))
    return "Filemoon";
  if (url.includes("vimeos.net"))
    return "Vimeos";
  return "Online";
};
var getResolver = (url) => {
  try {
    if (IGNORED_HOSTS.some((h) => url.includes(h)))
      return null;
    for (const [pattern, resolver] of Object.entries(RESOLVERS)) {
      if (url.includes(pattern))
        return resolver;
    }
  } catch (e) {
  }
  return null;
};
function buildSlug(title, year) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return year ? `${slug}-${year}` : slug;
}
function getCategories(mediaType, genres, originCountries) {
  if (mediaType === "movie")
    return ["peliculas"];
  const isAnimation = (genres || []).includes(GENRE_ANIMATION);
  if (!isAnimation)
    return ["series"];
  const isAnimeCountry = (originCountries || []).some((c) => ANIME_COUNTRIES.includes(c));
  if (isAnimeCountry)
    return ["animes"];
  return ["animes", "series"];
}
function getTmdbData(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const langs = [
      { lang: "es-MX", name: "Latino" },
      { lang: "en-US", name: "Ingl\xE9s" }
    ];
    const [esMx, enUs] = yield Promise.all(
      langs.map(
        ({ lang }) => httpGet(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=${lang}`, { headers: HEADERS }).catch(() => null)
      )
    );
    const data = esMx && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(esMx.title || esMx.name) ? esMx : enUs;
    if (!data)
      return null;
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    const name = data === esMx ? "Latino" : "Ingl\xE9s";
    console.log(`[LaMovie] TMDB (${name}): "${title}"${title !== originalTitle ? ` | Original: "${originalTitle}"` : ""}`);
    return {
      title,
      originalTitle,
      year: (data.release_date || data.first_air_date || "").substring(0, 4),
      genres: (data.genres || []).map((g) => g.id),
      originCountries: data.origin_country || ((_a = data.production_countries) == null ? void 0 : _a.map((c) => c.iso_3166_1)) || []
    };
  });
}
var HTML_HEADERS = {
  "User-Agent": UA6,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};
function extractIdFromHtml(html) {
  const match = html.match(/rel=['"]shortlink['"]\s+href=['"][^'"]*\?p=(\d+)['"]/);
  return match ? match[1] : null;
}
function getIdBySlug(category, slug) {
  return __async(this, null, function* () {
    const url = `${BASE_URL}/${category}/${slug}/`;
    try {
      const html = yield httpGet(url, {
        headers: HTML_HEADERS,
        validateStatus: (s) => s === 200
      });
      const id = extractIdFromHtml(html);
      if (id) {
        console.log(`[LaMovie] \u2713 Slug directo: /${category}/${slug} \u2192 id:${id}`);
        return { id };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function findBySlug(tmdbInfo, mediaType) {
  return __async(this, null, function* () {
    const { title, originalTitle, year, genres, originCountries } = tmdbInfo;
    const categories = getCategories(mediaType, genres, originCountries);
    const slugs = [];
    if (title)
      slugs.push(buildSlug(title, year));
    if (originalTitle && originalTitle !== title)
      slugs.push(buildSlug(originalTitle, year));
    const allCombinations = slugs.flatMap(
      (slug) => categories.map((cat) => getIdBySlug(cat, slug))
    );
    try {
      return yield Promise.any(allCombinations);
    } catch (e) {
      return null;
    }
  });
}
function getEpisodeId(seriesId, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    var _a;
    const url = `${BASE_URL}/wp-api/v1/single/episodes/list?_id=${seriesId}&season=${seasonNum}&page=1&postsPerPage=50`;
    try {
      const data = yield httpGet(url, { headers: HEADERS });
      if (!((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.posts))
        return null;
      const ep = data.data.posts.find((e) => e.season_number == seasonNum && e.episode_number == episodeNum);
      return (ep == null ? void 0 : ep._id) || null;
    } catch (e) {
      console.log(`[LaMovie] Error episodios: ${e.message}`);
      return null;
    }
  });
}
function processEmbed(embed) {
  return __async(this, null, function* () {
    try {
      const resolver = getResolver(embed.url);
      if (!resolver) {
        console.log(`[LaMovie] Sin resolver para: ${embed.url}`);
        return null;
      }
      const result = yield resolver(embed.url);
      if (!result || !result.url)
        return null;
      const serverName = getServerName(embed.url);
      const streamQuality = result.quality || "Unknown";
      return {
        name: "LaMovie",
        title: `${streamQuality} \xB7 ${serverName}`,
        url: result.url,
        quality: streamQuality,
        headers: result.headers || {}
      };
    } catch (e) {
      console.log(`[LaMovie] Error procesando embed: ${e.message}`);
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    if (!tmdbId || !mediaType)
      return [];
    const startTime = Date.now();
    console.log(`[LaMovie] Buscando: TMDB ${tmdbId} (${mediaType})${season ? ` S${season}E${episode}` : ""}`);
    try {
      const tmdbInfo = yield getTmdbData(tmdbId, mediaType);
      if (!tmdbInfo)
        return [];
      const found = yield findBySlug(tmdbInfo, mediaType);
      if (!found) {
        console.log("[LaMovie] No encontrado por slug");
        return [];
      }
      let targetId = found.id;
      if (mediaType === "tv" && season && episode) {
        const epId = yield getEpisodeId(targetId, season, episode);
        if (!epId) {
          console.log(`[LaMovie] Episodio S${season}E${episode} no encontrado`);
          return [];
        }
        targetId = epId;
      }
      const data = yield httpGet(
        `${BASE_URL}/wp-api/v1/player?postId=${targetId}&demo=0`,
        { headers: HEADERS }
      );
      if (!((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.embeds)) {
        console.log("[LaMovie] No hay embeds disponibles");
        return [];
      }
      const results = yield Promise.allSettled(
        data.data.embeds.map((embed) => processEmbed(embed))
      );
      const streams = results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[LaMovie] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[LaMovie] Error: ${e.message}`);
      return [];
    }
  });
}
