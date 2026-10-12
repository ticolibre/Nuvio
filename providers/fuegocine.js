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
  return new Promise((resolve6, reject) => {
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
    var step = (x) => x.done ? resolve6(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var fuegocine_exports = {};
__export(fuegocine_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(fuegocine_exports);
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE = "https://www.fuegocine.com";
var PAGE_REFERER = "https://www.fuegocine.com/";
var QUALITY_HINT = /\b(4K|UHD|FHD|HD|SD|1080p?|720p?|480p?|360p?)\b/i;
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
function b64decode(str) {
  try {
    if (typeof atob !== "undefined")
      return atob(str);
    return Buffer.from(str, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}
function httpGet(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const res = yield fetch(url, {
      headers: __spreadValues({ "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, options.headers),
      method: options.method || "GET",
      redirect: "follow"
    });
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    return ct.includes("json") ? res.json() : res.text();
  });
}
function unpackDeanEdwards(block) {
  try {
    const m = /\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/.exec(block);
    if (!m)
      return null;
    const payload = m[1];
    const radix = parseInt(m[2], 10);
    const symtab = m[4].split("|");
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const unbase = (str) => {
      let result = 0;
      for (let i = 0; i < str.length; i++)
        result = result * radix + chars.indexOf(str[i]);
      return result;
    };
    return payload.replace(/\b(\w+)\b/g, (match) => {
      const idx = unbase(match);
      return symtab[idx] !== void 0 && symtab[idx] !== "" ? symtab[idx] : match;
    });
  } catch (e) {
    return null;
  }
}
function extractPackedM3u8(body, baseUrl) {
  try {
    let code = null;
    const block = /eval\(function\(p,a,c,k,e,[dr]\)[\s\S]+?\.split\('\|'\)/.exec(body || "");
    if (block)
      code = unpackDeanEdwards(block[0]);
    if (!code)
      return null;
    const found = {};
    const re = /"(hls[234])":"([^"]+)"/g;
    let mm;
    while ((mm = re.exec(code)) !== null)
      found[mm[1]] = mm[2];
    for (const key of ["hls4", "hls3", "hls2"]) {
      let u = found[key];
      if (!u)
        continue;
      if (!/^https?:/.test(u) && baseUrl) {
        try {
          u = new URL(u, baseUrl).href;
        } catch (e) {
          continue;
        }
      }
      if (/^https?:[^"']*\.m3u8/i.test(u))
        return u;
    }
    const any = /https?:[^"'\s\\]+\.m3u8[^"'\s\\]*/i.exec(code);
    if (any)
      return any[0];
    return null;
  } catch (e) {
    return null;
  }
}
function firstM3u8(body) {
  const m = /https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*/i.exec(body || "");
  return m ? m[0] : null;
}
function isDirectVideo(url) {
  return /\.mp4(\?|$)/i.test(url) || /\.m3u8(\?|$)/i.test(url) || /\/hls\//i.test(url);
}
function isVideoUrl(_0) {
  return __async(this, arguments, function* (url, ref) {
    try {
      const res = yield fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": UA, ...(ref ? { Referer: ref } : {}) }
      });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (/video\/|audio\/|mpegurl|mp2t|mp4|m3u8/.test(ct))
        return true;
      if (!res.ok)
        return false;
      return null;
    } catch (e) {
      return null;
    }
  });
}
function normalizeHost(url) {
  return String(url).replace(/^https?:\/\/hgcloud\.to\//i, "https://audinifer.com/").replace(/\b(hglink|hlswish|streamwish|strwish)\.(to|com|net)\b/gi, "vibuxer.com");
}
function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}
function hostReferer(embedUrl, pageReferer) {
  const host = hostFromUrl(embedUrl).toLowerCase();
  if (host.includes("vimeos"))
    return "https://vimeos.net/";
  if (host.includes("goodstream"))
    return embedUrl;
  if (host.includes("vids.st"))
    return "https://vids.st/";
  if (host.includes("unlimplay"))
    return pageReferer || PAGE_REFERER;
  return pageReferer || embedUrl;
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
    const decoded1 = b64decode(txt);
    if (!decoded1)
      return null;
    let step4 = "";
    for (let i = 0; i < decoded1.length; i++) {
      step4 += String.fromCharCode((decoded1.charCodeAt(i) - 3 + 256) % 256);
    }
    const finalStr = b64decode(step4.split("").reverse().join(""));
    return finalStr ? JSON.parse(finalStr) : null;
  } catch (e) {
    return null;
  }
}
function resolveGoodStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://goodstream.one", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        redirect: "follow"
      });
      if (!response.ok)
        return null;
      const html = yield response.text();
      const match = html.match(/file:\s*"([^"]+)"/);
      if (!match)
        return null;
      return { url: match[1], headers: { "User-Agent": UA, "Referer": embedUrl, "Origin": "https://goodstream.one" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveStreamWish(embedUrl) {
  return __async(this, null, function* () {
    try {
      const fetchUrl = normalizeHost(embedUrl);
      const embedHost = (fetchUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || "https://vibuxer.com";
      const resp = yield fetch(fetchUrl, {
        headers: {
          "User-Agent": UA,
          "Referer": "https://embed69.org/",
          "Origin": "https://embed69.org",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9"
        },
        redirect: "follow"
      });
      if (!resp.ok)
        return null;
      const data = yield resp.text();
      const fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        let url = fileMatch[1];
        if (url.startsWith("/"))
          url = embedHost + url;
        if (url.includes("vibuxer.com/stream/")) {
          try {
            const redirectResp = yield fetch(url, {
              headers: { "User-Agent": UA, "Referer": embedHost + "/" },
              redirect: "follow"
            });
            if (redirectResp.url && /\.m3u8/.test(redirectResp.url))
              url = redirectResp.url;
          } catch (e) {
          }
        }
        return { url, headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
      }
      const packed = extractPackedM3u8(data, embedHost) || firstM3u8(data);
      if (packed)
        return { url: packed, headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVOE(embedUrl) {
  return __async(this, null, function* () {
    try {
      let pageResp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": embedUrl, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        redirect: "follow"
      });
      if (!pageResp.ok)
        return null;
      let data = yield pageResp.text();
      if (/permanentToken/i.test(data)) {
        const m2 = data.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (m2 && m2[1]) {
          const r2 = yield fetch(m2[1], { headers: { "User-Agent": UA, "Referer": embedUrl }, redirect: "follow" });
          if (r2.ok)
            data = yield r2.text();
        }
      }
      const rMain = data.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
      if (rMain) {
        const encodedArray = rMain[1];
        const loaderUrl = rMain[2].startsWith("http") ? rMain[2] : new URL(rMain[2], embedUrl).href;
        const jsResp = yield fetch(loaderUrl, { headers: { "User-Agent": UA, "Referer": embedUrl }, redirect: "follow" });
        const jsData = jsResp.ok ? yield jsResp.text() : "";
        const replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (replMatch) {
          const decoded = voeDecode(encodedArray, replMatch[1]);
          if (decoded && (decoded.source || decoded.direct_access_url)) {
            const url = decoded.source || decoded.direct_access_url;
            return { url, headers: { "User-Agent": UA, "Referer": embedUrl } };
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
        let url = match[1];
        if (url && url.startsWith("aHR0"))
          url = b64decode(url);
        if (url && /^https?:/.test(url))
          return { url, headers: { "User-Agent": UA, "Referer": embedUrl } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVimeosGeneric(embedUrl, pageReferer) {
  return __async(this, null, function* () {
    const ref = hostReferer(embedUrl, pageReferer);
    try {
      const res = yield fetch(embedUrl, { headers: { "User-Agent": UA, "Referer": ref }, redirect: "follow" });
      const body = res.ok ? yield res.text() : "";
      const packed = extractPackedM3u8(body, embedUrl) || firstM3u8(body);
      if (packed) {
        const useRef = hostFromUrl(embedUrl).includes("vimeos") ? "https://vimeos.net/" : ref;
        return { url: packed, headers: { "User-Agent": UA, "Referer": useRef } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveFastream(embedUrl, pageReferer) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(embedUrl, { headers: { "User-Agent": UA, "Referer": pageReferer }, redirect: "follow" });
      const body = res.ok ? yield res.text() : "";
      const fm = /file\s*:\s*"https?:\/\/[^"]+\.m3u8[^"]*"/i.exec(body);
      const u = fm ? fm[0].slice(fm[0].indexOf('"') + 1, -1) : firstM3u8(body);
      if (u)
        return { url: u, headers: { "User-Agent": UA, "Referer": "https://fastream.to/" } };
      const block = /eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\('\|'\)/.exec(body);
      const unpacked = block ? unpackDeanEdwards(block[0]) : null;
      const u2 = unpacked && /file:"(https?:\/\/[^"]+\.m3u8[^"]*)"/.exec(unpacked);
      if (u2)
        return { url: u2[1], headers: { "User-Agent": UA, "Referer": "https://fastream.to/" } };
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVids(embedUrl) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(embedUrl, { headers: { "User-Agent": UA, "Referer": "https://vids.st/" }, redirect: "follow" });
      const body = res.ok ? yield res.text() : "";
      const re = /url\s*[:=]\s*["']?(https?:[^"'\s<>]+)/gi;
      let m;
      while ((m = re.exec(body)) !== null) {
        const u = m[1].replace(/\\\//g, "/");
        if (/\.(mp4|m3u8)(\?|$)/i.test(u))
          return { url: u, headers: { "User-Agent": UA, "Referer": "https://vids.st/" } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveUnlimplay(embedUrl, pageReferer) {
  return __async(this, null, function* () {
    try {
      const ref = pageReferer || PAGE_REFERER;
      const res = yield fetch(embedUrl, { headers: { "User-Agent": UA, "Referer": ref }, redirect: "follow" });
      const body = res.ok ? yield res.text() : "";
      const all = [...body.matchAll(/https?:[^"'\s<>\\]+master\.m3u8[^"'\s<>\\]*/gi)].map((x) => x[0]);
      const pick = all.find((u) => /vimeos/i.test(u)) || all.find((u) => /vidhide|vibuxer|streamwish/i.test(u)) || all[0];
      if (pick) {
        const ref2 = /vimeos/i.test(pick) ? "https://vimeos.net/" : ref;
        return { url: pick, headers: { "User-Agent": UA, "Referer": ref2 } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveAnonmp4(embedUrl) {
  return __async(this, null, function* () {
    try {
      const getRes = yield fetch(embedUrl, { headers: { "User-Agent": UA, "Referer": PAGE_REFERER }, redirect: "follow" });
      if (!getRes.ok)
        return null;
      const html = yield getRes.text();
      const seed = html.match(/PLAY_SEED\s*=\s*'([^']+)'/);
      const sig = html.match(/PLAY_SIG\s*=\s*'([^']+)'/);
      if (!seed || !sig)
        return null;
      const apiUrl = new URL("/video-api", embedUrl).href;
      const postRes = yield fetch(apiUrl, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": embedUrl
        },
        body: JSON.stringify({ ticket: seed[1], sig: sig[1] })
      });
      const json = yield postRes.json().catch(() => null);
      if (!json || typeof json !== "object")
        return null;
      const direct = json.stream_url || json.orignalmp4 || json.mp4 || json.url || json.file || json.source;
      if (typeof direct === "string" && /^https?:\/\//.test(direct))
        return { url: direct, headers: { "User-Agent": UA } };
      for (const v of Object.values(json)) {
        if (typeof v === "string" && /^https?:\/\//.test(v) && /\.(mp4|m3u8)(\?|$)/i.test(v))
          return { url: v, headers: { "User-Agent": UA } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
var KNOWN_EMBEDS = /vimeos\.net|goodstream\.(one|gg)|streamwish\.|hlswish|strwish|vibuxer|hglink|vidhide|voe\.sx|fastream\.to|audinifer\.com|hgcloud\.to|premilkyway|unlimplay\.com/i;
function resolveHost(embedUrl, pageReferer) {
  return __async(this, null, function* () {
    try {
      const host = hostFromUrl(embedUrl).toLowerCase();
      if (host.includes("goodstream"))
        return yield resolveGoodStream(embedUrl);
      if (/streamwish|hlswish|strwish|vibuxer|premilkyway|hglink/i.test(host))
        return yield resolveStreamWish(embedUrl);
      if (host.includes("voe.sx"))
        return yield resolveVOE(embedUrl);
      if (host.includes("fastream"))
        return yield resolveFastream(embedUrl, pageReferer);
      if (host.includes("vids.st"))
        return yield resolveVids(embedUrl);
      if (host.includes("unlimplay"))
        return yield resolveUnlimplay(embedUrl, pageReferer);
      if (host.includes("anonmp4"))
        return yield resolveAnonmp4(embedUrl);
      if (host.includes("vidlove.cc")) {
        const u = new URL(embedUrl);
        const seg = u.pathname.split("/").filter(Boolean);
        const kind = seg[1];
        const id = seg[2];
        const season = seg[3];
        const episode = seg[4];
        const server = u.searchParams.get("server") || "";
        if (!(kind === "movie" || kind === "tv") || !id || !/^\d+$/.test(id))
          return null;
        const qs = kind === "tv" ? `id=${id}&season=${season}&episode=${episode}` : `id=${id}`;
        const apiUrl = `https://api.vidlove.cc/${kind}?${qs}&mode=json${server ? "&sources=" + server : ""}`;
        const apiRes = yield fetch(apiUrl, { headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://player.vidlove.cc/" }, redirect: "follow" });
        if (!apiRes.ok)
          return null;
        const data = yield apiRes.json().catch(() => null);
        const s = data && data.source;
        if (s && s.url && /^https?:/i.test(s.url))
          return { url: s.url, headers: { "User-Agent": UA, "Referer": "https://player.vidlove.cc/" } };
        return null;
      }
      return yield resolveVimeosGeneric(embedUrl, pageReferer);
    } catch (e) {
      return null;
    }
  });
}
function parseQuality(title = "") {
  const m = String(title).match(QUALITY_HINT);
  return m ? m[1].toUpperCase() : "";
}
function resolveServerUrl(rawUrl) {
  function decodeParam(url, key) {
    const m = url.match(new RegExp(`[?&]${key}=([^&"'\\s]+)`));
    if (!m)
      return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return m[1];
    }
  }
  const r = decodeParam(rawUrl, "r");
  if (r) {
    try {
      const cleaned = r.replace(/\s/g, "");
      const padded = cleaned + "=".repeat((4 - cleaned.length % 4) % 4);
      const decoded = b64decode(padded);
      if (decoded) {
        try {
          return decodeURIComponent(decoded);
        } catch (e) {
          return decoded;
        }
      }
    } catch (e) {
    }
  }
  const link = decodeParam(rawUrl, "link");
  if (link)
    return link;
  return rawUrl;
}
function enhanceCandidate(c, pageReferer) {
  return __async(this, null, function* () {
    const url = normalizeHost(c.rawUrl);
    if (/vids\.st$/i.test(hostFromUrl(url))) {
      const r = yield resolveHost(url, pageReferer);
      if (!r || !r.url)
        return null;
      return { url: r.url, headers: r.headers || {}, quality: c.quality, server: "vids.st" };
    }
    if (KNOWN_EMBEDS.test(url)) {
      const r = yield resolveHost(url, pageReferer);
      if (!r || !r.url)
        return null;
      const alive = yield isVideoUrl(r.url, (r.headers && r.headers.Referer) || pageReferer);
      if (alive === false)
        return null;
      return { url: r.url, headers: r.headers || {}, quality: c.quality, server: hostFromUrl(url) };
    }
    if (isDirectVideo(url)) {
      const ok = yield isVideoUrl(url, pageReferer);
      if (ok === false)
        return null;
      return { url, headers: { "User-Agent": UA }, quality: c.quality, server: "" };
    }
    return null;
  });
}
function enhanceCandidates(candidates, pageReferer) {
  return __async(this, null, function* () {
    const resolved = yield Promise.all((candidates || []).slice(0, 12).map((c) => enhanceCandidate(c, pageReferer).catch(() => null)));
    return resolved.filter(Boolean);
  });
}
function getTmdbData(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const langs = ["es-MX", "es-ES", "en-US"];
    const results = yield Promise.all(langs.map(
      (lang) => fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=${lang}`, { headers: { "User-Agent": UA } }).then((r) => r.json()).catch(() => null)
    ));
    const [mx, es, en] = results;
    const base = mx || es || en;
    if (!base)
      return null;
    const pick = (d) => d ? mediaType === "movie" ? d.title : d.name : null;
    const title = pick(mx) || pick(es) || pick(en);
    const titleEs = pick(es) || pick(mx);
    const originalTitle = mediaType === "movie" ? base.original_title : base.original_name;
    const year = (base.release_date || base.first_air_date || "").substring(0, 4);
    const titles = [...new Set([title, titleEs, originalTitle, pick(en)].filter(Boolean))];
    console.log(`[FuegoCine] TMDB: "${title}" | ES: "${titleEs}" | Original: "${originalTitle}" | ${year}`);
    return { titles, year };
  });
}
function normalize(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function searchFeed(query, maxResults = 10) {
  return __async(this, null, function* () {
    const url = `${BASE}/feeds/posts/default?q=${encodeURIComponent(query)}&alt=json&max-results=${maxResults}`;
    try {
      const data = yield fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" }).then((r) => r.json());
      return data && data.feed && data.feed.entry ? data.feed.entry : [];
    } catch (e) {
      return [];
    }
  });
}
function extractServersFromContent(content = "") {
  const noComments = content.replace(/<!--[\s\S]*?-->/g, "");
  const servers = [];
  const blocks = noComments.match(/const\s+_SV_LINKS\s*=\s*\[([\s\S]*?)\]\s*<\/script>/g) || [noComments];
  const re = /\{\s*lang:\s*"([^"]*)"\s*,\s*name:\s*"([^"]*)"\s*,\s*quality:\s*"([^"]*)"\s*,\s*url:\s*"([^"]*)"/g;
  for (const block of blocks) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(block))) {
      if (!m[4] || m[4].length < 12)
        continue;
      servers.push({ lang: m[1], name: m[2], quality: m[3], rawUrl: m[4] });
    }
  }
  return servers;
}
function entryTitle(entry) {
  return entry && entry.title && entry.title.$t ? entry.title.$t : "";
}
function entryContent(entry) {
  return entry && entry.content && entry.content.$t ? entry.content.$t : "";
}
function entryYear(entry) {
  const t = entryTitle(entry);
  const m = t.match(/\((19|20)\d{2}\)/);
  if (m)
    return m[0].replace(/[()]/g, "");
  const cats = (entry.category || []).map((c) => c.term);
  const y = cats.find((c) => /^(19|20)\d{2}$/.test(c));
  return y || null;
}
function entryOriginalTitle(entry) {
  const content = entryContent(entry);
  const m = content.match(/data-original-title=['"]([^'"]+)['"]/i);
  return m ? m[1] : "";
}
function includesGuarded(a, b, ratio = 0.6) {
  if (!a || !b)
    return false;
  if (!a.includes(b) && !b.includes(a))
    return false;
  return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= ratio;
}
function scoreMovie(entry, title, year) {
  const content = entryContent(entry);
  const normWant = normalize(title);
  const normTitle = normalize(entryTitle(entry).replace(/\(\d{4}\)/, ""));
  const normOrig = normalize(entryOriginalTitle(entry));
  const entryY = entryYear(entry);
  let score = 0;
  let hasTitleEvidence = false;
  if (normOrig && normOrig === normWant) {
    score += 10;
    hasTitleEvidence = true;
  } else if (normOrig && includesGuarded(normOrig, normWant)) {
    score += 5;
    hasTitleEvidence = true;
  } else if (normTitle === normWant) {
    score += 6;
    hasTitleEvidence = true;
  } else if (includesGuarded(normTitle, normWant)) {
    score += 3;
    hasTitleEvidence = true;
  }
  let yearMatch = false;
  if (year && entryY) {
    if (entryY === String(year)) {
      score += 3;
      yearMatch = true;
    } else {
      score -= 8;
    }
  }
  if (content.includes('data-post-type="movie"'))
    score += 2;
  if (content.includes('data-post-type="episode"'))
    score -= 5;
  return { score, hasTitleEvidence, yearMatch };
}
function episodeMatches(entry, season, episode) {
  const content = entryContent(entry);
  const sn = content.match(/data-season-number="(\d+)"/);
  const en = content.match(/data-episode-count="(\d+)"/);
  if (sn && en)
    return Number(sn[1]) === Number(season) && Number(en[1]) === Number(episode);
  const t = normalize(entryTitle(entry));
  return t.includes(`${season}x${episode}`) || t.includes(`s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`);
}
function findMoviePost(titles, year) {
  return __async(this, null, function* () {
    let best = null;
    let bestScore = -Infinity;
    for (const title of titles) {
      const queries = year ? [`${title} ${year}`, title] : [title];
      for (const q of queries) {
        const entries = yield searchFeed(q, 10);
        for (const e of entries) {
          const { score: s, hasTitleEvidence, yearMatch } = scoreMovie(e, title, year);
          if (!hasTitleEvidence && !yearMatch)
            continue;
          if (s > bestScore) {
            bestScore = s;
            best = e;
          }
        }
        if (best && bestScore >= 8)
          break;
      }
      if (best && bestScore >= 8)
        break;
    }
    if (!best || bestScore <= 0)
      return null;
    return best;
  });
}
function getMovieServers(titles, year) {
  return __async(this, null, function* () {
    const best = yield findMoviePost(titles, year);
    if (!best)
      return { post: null, servers: [] };
    return { post: entryTitle(best), servers: extractServersFromContent(entryContent(best)) };
  });
}
function getEpisodeServers(titles, season, episode) {
  return __async(this, null, function* () {
    for (const title of titles) {
      const queries = [`${title} ${season}x${episode}`, `${title} temporada ${season}`, title];
      for (const q of queries) {
        const entries = yield searchFeed(q, 10);
        const ep = entries.find((e) => episodeMatches(e, season, episode));
        if (ep) {
          const servers = extractServersFromContent(entryContent(ep));
          if (servers.length)
            return { post: entryTitle(ep), servers };
        }
      }
    }
    return { post: null, servers: [] };
  });
}
function serversToCandidates(servers) {
  return (Array.isArray(servers) ? servers : []).map((s) => {
    const rawUrl = resolveServerUrl(s.rawUrl);
    if (!/^https?:\/\//i.test(rawUrl))
      return null;
    return { rawUrl, quality: parseQuality(`${s.quality || ""} ${s.name || ""}`) };
  }).filter(Boolean);
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    const startTime = Date.now();
    console.log(`[FuegoCine] Buscando: TMDB ${tmdbId} (${mediaType})${season ? ` S${season}E${episode}` : ""}`);
    try {
      const tmdbInfo = yield getTmdbData(tmdbId, mediaType);
      if (!tmdbInfo || tmdbInfo.titles.length === 0)
        return [];
      const found = mediaType === "tv" && season && episode ? yield getEpisodeServers(tmdbInfo.titles, season, episode) : yield getMovieServers(tmdbInfo.titles, tmdbInfo.year);
      if (!found || !found.servers || found.servers.length === 0) {
        console.log("[FuegoCine] No se encontraron servidores");
        return [];
      }
      console.log(`[FuegoCine] post: ${found.post || "none"} (${found.servers.length} servidores)`);
      const verified = yield enhanceCandidates(serversToCandidates(found.servers), PAGE_REFERER);
      const streams = verified.map((v) => {
        const inferred = inferQuality(v.url);
        const quality = v.quality || (inferred !== "Unknown" ? inferred : "Unknown");
        const label = v.quality ? `FuegoCine ${v.quality} ${v.server || ""}`.trim() : `FuegoCine ${quality} \xB7 ${v.server || "Directo"}`.trim();
        return {
          name: "FuegoCine",
          title: label,
          url: v.url,
          quality,
          headers: v.headers || {}
        };
      });
      const elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[FuegoCine] \u2713 ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[FuegoCine] Error: ${e.message}`);
      return [];
    }
  });
}