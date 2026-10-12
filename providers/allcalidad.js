var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var allcalidad_exports = {};
__export(allcalidad_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(allcalidad_exports);

// AllCalidad provider for Nuvio. Inspired by the CloudStream AllCalidadProvider.
// Pure JSON REST API (no HTML scraping):
// search -> episodes (tv) -> player embeds -> resolvers.
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://allcalidad.re";
var API = BASE_URL + "/api/rest";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json",
  "Referer": BASE_URL + "/"
};
var LANG_PRIORITY = ["LAT", "ESP", "SUB"];
var LANG_LABELS = { "LAT": "Latino", "ESP": "Español", "SUB": "Subtitulado" };
function allSettled(promises) {
  return Promise.all(promises.map(function(p) {
    return Promise.resolve(p).then(
      function(v) { return { status: "fulfilled", value: v }; },
      function(e) { return { status: "rejected", reason: e }; }
    );
  }));
}
function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function stripYearSuffix(title) {
  return (title || "").replace(/\s*\(\d{4}\)\s*$/, "").trim();
}
function scorePost(post, targets, year) {
  var best = -9999;
  var nc = normalize(stripYearSuffix(post.title));
  for (var i = 0; i < targets.length; i++) {
    var nt = normalize(targets[i]);
    if (!nt)
      continue;
    var score = 0;
    if (nc === nt)
      score += 600;
    var ct = nt.split(" ").filter(Boolean);
    var cr = nc.split(" ").filter(Boolean);
    var common = 0;
    for (var t = 0; t < ct.length; t++) {
      if (cr.indexOf(ct[t]) !== -1)
        common++;
    }
    score += common * 50;
    if (ct.length > 0 && common === ct.length) {
      var ratio = ct.length / Math.max(cr.length, 1);
      score += ratio >= 0.6 ? 500 : ratio >= 0.4 ? 250 : 80;
    }
    if (cr.length === 1 && ct.length === 1 && cr[0] !== ct[0])
      score -= 300;
    var py = (post.release_date || "").substring(0, 4);
    if (py && year) {
      if (py === year)
        score += 150;
      else
        score -= 100;
    }
    if (score > best)
      best = score;
  }
  return best;
}
// --- quality inference (string-only) ---
var TIER_MAPS = {
  vimeos: { h: "720p", n: "480p" },
  goodstream: { x: "1080p", h: "720p", n: "480p", l: "360p" },
  vidhide: { n: "720p", l: "480p" },
  streamwish: { x: "1080p", h: "1080p", n: "720p", l: "480p" },
  voe: { n: "720p", l: "360p" }
};
var TIER_PRIORITY = ["x", "o", "h", "n", "l"];
function inferQuality(url) {
  if (!url)
    return "HD";
  var tierMap = null;
  if (url.indexOf("vimeos") !== -1)
    tierMap = TIER_MAPS.vimeos;
  else if (url.indexOf("goodstream") !== -1)
    tierMap = TIER_MAPS.goodstream;
  else if (url.indexOf("cloudwindow-route") !== -1)
    tierMap = TIER_MAPS.voe;
  else if (url.indexOf("minochinos") !== -1 || url.indexOf("vidhide") !== -1 || url.indexOf("dintezuvio") !== -1)
    tierMap = TIER_MAPS.vidhide;
  else if (url.indexOf("premilkyway") !== -1 || url.indexOf("hlswish") !== -1 || url.indexOf("vibuxer") !== -1 || url.indexOf("streamwish") !== -1)
    tierMap = TIER_MAPS.streamwish;
  if (tierMap) {
    var tierMatch = url.match(/_,([a-z,]+),\.urlset/);
    if (tierMatch) {
      var tiers = tierMatch[1].split(",").filter(Boolean);
      for (var i = 0; i < TIER_PRIORITY.length; i++) {
        var t = TIER_PRIORITY[i];
        if (tiers.indexOf(t) !== -1 && tierMap[t])
          return tierMap[t];
      }
    }
  }
  var numMatch = url.match(/[_\-\/](\d{3,4})p/);
  if (numMatch)
    return numMatch[1] + "p";
  return "HD";
}
function embedQuality(embed) {
  var q = embed.quality || "";
  var m = q.match(/(\d{3,4})p/);
  if (m)
    return m[1] + "p";
  if (/full\s*hd|1080/i.test(q))
    return "1080p";
  if (/720|hd/i.test(q))
    return "HD";
  return "HD";
}
// --- host resolvers ---
function b64toString(str) {
  try {
    return atob(str);
  } catch (e) {
    return null;
  }
}
function getOrigin(u) {
  var m = (u || "").match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}
function resolveUrl(rel, base) {
  if (!rel)
    return base;
  if (/^https?:\/\//i.test(rel))
    return rel;
  var o = getOrigin(base);
  if (!o)
    return rel;
  if (rel.charAt(0) === "/")
    return o + rel;
  var b = (base || "").split("?")[0];
  if (b.charAt(b.length - 1) !== "/")
    b = b.substring(0, b.lastIndexOf("/") + 1);
  return b + rel;
}
function voeDecode(ct, luts) {
  try {
    var rawLuts = luts.replace(/^\[|\]$/g, "").split("','").map(function(s) { return s.replace(/^'+|'+$/g, ""); });
    var escapedLuts = rawLuts.map(function(i) { return i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    var txt = "";
    for (var ci = 0; ci < ct.length; ci++) {
      var ch = ct[ci];
      var x = ch.charCodeAt(0);
      if (x > 64 && x < 91)
        x = (x - 52) % 26 + 65;
      else if (x > 96 && x < 123)
        x = (x - 84) % 26 + 97;
      txt += String.fromCharCode(x);
    }
    for (var p = 0; p < escapedLuts.length; p++)
      txt = txt.replace(new RegExp(escapedLuts[p], "g"), "_");
    txt = txt.split("_").join("");
    var decoded1 = b64toString(txt);
    if (!decoded1)
      return null;
    var step4 = "";
    for (var i = 0; i < decoded1.length; i++)
      step4 += String.fromCharCode((decoded1.charCodeAt(i) - 3 + 256) % 256);
    var finalStr = b64toString(step4.split("").reverse().join(""));
    if (!finalStr)
      return null;
    return JSON.parse(finalStr);
  } catch (e) {
    return null;
  }
}
function resolveVoe(embedUrl) {
  return __async(this, null, function* () {
    try {
      var pageResp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": embedUrl },
        redirect: "follow"
      });
      if (!pageResp.ok)
        throw new Error(`HTTP ${pageResp.status}`);
      var data = yield pageResp.text();
      if (/permanentToken/i.test(data)) {
        var m2 = data.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (m2) {
          var r2 = yield fetch(m2[1], { headers: { "User-Agent": UA, "Referer": embedUrl }, redirect: "follow" });
          if (r2.ok)
            data = yield r2.text();
        }
      }
      var rMain = data.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
      if (rMain) {
        var loaderUrl = rMain[2].indexOf("http") === 0 ? rMain[2] : resolveUrl(rMain[2], embedUrl);
        var jsData = yield fetch(loaderUrl, { headers: { "User-Agent": UA, "Referer": embedUrl }, redirect: "follow" }).then(function(r) { return r.ok ? r.text() : ""; });
        var replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (replMatch) {
          var decoded = voeDecode(rMain[1], replMatch[1]);
          if (decoded && (decoded.source || decoded.direct_access_url)) {
            var url = decoded.source || decoded.direct_access_url;
            return { url: url, quality: inferQuality(url), headers: { Referer: embedUrl } };
          }
        }
      }
      var matches = [];
      var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
      var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
      var m;
      while ((m = re1.exec(data)) !== null)
        matches.push(m[1]);
      while ((m = re2.exec(data)) !== null)
        matches.push(m[1]);
      for (var i = 0; i < matches.length; i++) {
        var url2 = matches[i];
        if (url2.indexOf("aHR0") === 0) {
          try {
            url2 = atob(url2);
          } catch (e) {
          }
        }
        return { url: url2, quality: inferQuality(url2), headers: { Referer: embedUrl } };
      }
      return null;
    } catch (err) {
      return null;
    }
  });
}
function unpackEval(payload, radix, symtab) {
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var unbase = function(str) {
    var result = 0;
    for (var i = 0; i < str.length; i++) {
      var pos = chars.indexOf(str[i]);
      if (pos === -1)
        return NaN;
      result = result * radix + pos;
    }
    return result;
  };
  return payload.replace(/\b([0-9a-zA-Z]+)\b/g, function(match) {
    var idx = unbase(match);
    if (isNaN(idx) || idx >= symtab.length)
      return match;
    return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
  });
}
function resolveStreamwish(embedUrl) {
  return __async(this, null, function* () {
    try {
      var fetchUrl = embedUrl;
      if (fetchUrl.indexOf("hglink.to") !== -1)
        fetchUrl = fetchUrl.replace("hglink.to", "vibuxer.com");
      var hm = fetchUrl.match(/^(https?:\/\/[^/]+)/);
      var embedHost = hm ? hm[1] : "https://hlswish.com";
      var resp = yield fetch(fetchUrl, {
        headers: { "User-Agent": UA, "Referer": BASE_URL + "/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var data = yield resp.text();
      var fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        var url = fileMatch[1];
        if (url.charAt(0) === "/")
          url = embedHost + url;
        return { url: url, quality: inferQuality(url), headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
      }
      var packMatch = data.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
      if (packMatch) {
        var unpacked = unpackEval(packMatch[1], parseInt(packMatch[2]), packMatch[4].split("|"));
        var om = unpacked.match(/"hls[234]"\s*:\s*"([^"]+)"/);
        if (om) {
          var u2 = om[1];
          if (u2.charAt(0) === "/")
            u2 = embedHost + u2;
          return { url: u2, quality: inferQuality(u2), headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
        }
      }
      var rawM3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (rawM3u8)
        return { url: rawM3u8[0], quality: inferQuality(rawM3u8[0]), headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
      return null;
    } catch (err) {
      return null;
    }
  });
}
function resolveVidhide(embedUrl) {
  return __async(this, null, function* () {
    try {
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": BASE_URL + "/" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var html = yield resp.text();
      var evalMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (!evalMatch)
        return null;
      var um = evalMatch[0].match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
      if (!um)
        return null;
      var unpacked = unpackEval(um[1], parseInt(um[2]), um[4].split("|"));
      var hls = unpacked.match(/"hls4"\s*:\s*"([^"]+)"/) || unpacked.match(/"hls2"\s*:\s*"([^"]+)"/);
      if (!hls)
        return null;
      var m3u8Url = hls[1];
      if (m3u8Url.indexOf("http") !== 0)
        m3u8Url = resolveUrl(m3u8Url, embedUrl);
      var origin = getOrigin(embedUrl);
      return {
        url: m3u8Url,
        quality: inferQuality(m3u8Url),
        headers: { "User-Agent": UA, "Referer": origin + "/", "Origin": origin }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveVimeos(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[AllCalidad][Vimeos] Resolviendo: ${embedUrl}`);
      var url = embedUrl;
      if (url.indexOf("/embed-") === -1) {
        var idm = url.match(/vimeos\.net\/(?:d\/)?([^/?#]+)/i);
        if (!idm)
          return null;
        url = `https://vimeos.net/embed-${idm[1]}`;
      }
      var resp = yield fetch(url, {
        headers: { "User-Agent": UA, "Referer": "https://vimeos.net/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var data = yield resp.text();
      var packMatch = data.match(/eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/);
      if (!packMatch)
        return null;
      var payload = packMatch[1];
      var radix = parseInt(packMatch[2]);
      var symtab = packMatch[4].split("|");
      var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      var unbase = function(str) {
        var result = 0;
        for (var i = 0; i < str.length; i++)
          result = result * radix + chars.indexOf(str[i]);
        return result;
      };
      var unpacked = payload.replace(/\b(\w+)\b/g, function(match) {
        var idx = unbase(match);
        return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
      });
      var m3u8Match = unpacked.match(/["']([^"']+\.m3u8[^"']*)['"]/i);
      if (!m3u8Match)
        return null;
      return {
        url: m3u8Match[1],
        quality: inferQuality(m3u8Match[1]),
        headers: { "User-Agent": UA, "Referer": "https://vimeos.net/" }
      };
    } catch (err) {
      console.log(`[AllCalidad][Vimeos] Error: ${err.message}`);
      return null;
    }
  });
}
function resolveGoodstream(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[AllCalidad][GoodStream] Resolviendo: ${embedUrl}`);
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://goodstream.one", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var html = yield resp.text();
      var match = html.match(/file:\s*"([^"]+)"/);
      if (!match)
        return null;
      return {
        url: match[1],
        quality: inferQuality(match[1]),
        headers: { "User-Agent": UA, "Referer": embedUrl, "Origin": "https://goodstream.one" }
      };
    } catch (err) {
      console.log(`[AllCalidad][GoodStream] Error: ${err.message}`);
      return null;
    }
  });
}
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[AllCalidad][MixDrop] Resolviendo: ${embedUrl}`);
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var html = yield resp.text();
      var m = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
      if (!m)
        return null;
      var p = m[1];
      var a = parseInt(m[2]);
      var c = parseInt(m[3]);
      var k = m[4].split("|");
      while (c--) {
        if (k[c])
          p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
      }
      var wm = p.match(/MDCore\.wurl\s*=\s*"([^"]+)"/);
      if (!wm)
        return null;
      var url = wm[1];
      if (url.indexOf("//") === 0)
        url = "https:" + url;
      else if (url.charAt(0) === "/")
        url = "https://mxdrop.to" + url;
      return { url: url, quality: inferQuality(url), headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/" } };
    } catch (e) {
      console.log(`[AllCalidad][MixDrop] Error: ${e.message}`);
      return null;
    }
  });
}
function getResolver(url) {
  var low = (url || "").toLowerCase();
  if (low.indexOf("voe.sx") !== -1)
    return { fn: resolveVoe, label: "VOE" };
  if (low.indexOf("goodstream") !== -1)
    return { fn: resolveGoodstream, label: "GoodStream" };
  if (low.indexOf("vimeos") !== -1)
    return { fn: resolveVimeos, label: "Vimeos" };
  if (low.indexOf("streamwish.") !== -1 || low.indexOf("strwish.") !== -1 || low.indexOf("hlswish.") !== -1 || low.indexOf("hglink.to") !== -1 || low.indexOf("vibuxer.") !== -1)
    return { fn: resolveStreamwish, label: "StreamWish" };
  if (low.indexOf("vidhide") !== -1 || low.indexOf("filelions.") !== -1 || low.indexOf("dintezuvio.") !== -1)
    return { fn: resolveVidhide, label: "VidHide" };
  if (low.indexOf("mixdrop") !== -1)
    return { fn: resolveMixdrop, label: "MixDrop" };
  return null;
}
function langCode(label) {
  var l = (label || "").toLowerCase();
  if (l.indexOf("latino") !== -1)
    return "LAT";
  if (l.indexOf("castellano") !== -1 || l.indexOf("espa") !== -1)
    return "ESP";
  if (l.indexOf("subtitul") !== -1 || l.indexOf("sub ") !== -1)
    return "SUB";
  return "LAT";
}
// --- API ---
function apiGet(path) {
  return __async(this, null, function* () {
    var res = yield fetch(API + path, { headers: HEADERS, redirect: "follow" });
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}
function getTmdbTitles(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var endpoint = mediaType === "movie" ? "movie" : "tv";
    var urls = [
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`,
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-ES`,
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    ];
    var results = yield Promise.all(urls.map(function(u) {
      return fetch(u, { headers: { "User-Agent": UA } }).then(function(r) { return r.json(); }).catch(function() { return null; });
    }));
    var titles = [];
    var year = "";
    for (var i = 0; i < results.length; i++) {
      var data = results[i];
      if (!data)
        continue;
      var t = mediaType === "movie" ? data.title : data.name;
      var ot = mediaType === "movie" ? data.original_title : data.original_name;
      if (t && titles.indexOf(t) === -1)
        titles.push(t);
      if (ot && titles.indexOf(ot) === -1)
        titles.push(ot);
      if (!year)
        year = (data.release_date || data.first_air_date || "").substring(0, 4);
    }
    return { titles: titles, year: year };
  });
}
function hyphenate(title) {
  return normalize(title).replace(/\s+/g, "-");
}
function searchPosts(query) {
  return __async(this, null, function* () {
    try {
      var data = yield apiGet(`/search?query=${encodeURIComponent(query)}&page=1&post_type=movies,tvshows,animes&posts_per_page=24`);
      return ((data && data.data && data.data.posts) || []);
    } catch (e) {
      return [];
    }
  });
}
function processEmbed(embed) {
  return __async(this, null, function* () {
    try {
      if (!embed.url || embed.url.indexOf("http") !== 0)
        return null;
      if (embed.url.indexOf("magnet:") === 0)
        return null;
      var r = getResolver(embed.url);
      if (!r) {
        console.log(`[AllCalidad] Sin resolver: ${embed.url.substring(0, 70)}`);
        return null;
      }
      var result = yield r.fn(embed.url);
      if (!result || !result.url)
        return null;
      var langLabel = LANG_LABELS[embed.lang] || "Latino";
      var qm = (embed.quality || "").match(/(\d{3,4})p/);
      var quality = qm ? qm[1] + "p" : embedQuality(embed);
      if ((quality === "HD" || quality === "Unknown") && result.quality && result.quality !== "HD" && result.quality !== "Unknown")
        quality = result.quality;
      return {
        name: "AllCalidad",
        title: `${quality} · ${langLabel} · ${r.label}`,
        url: result.url,
        quality: quality,
        headers: result.headers || {}
      };
    } catch (e) {
      return null;
    }
  });
}
function getPlayerEmbeds(postId) {
  return __async(this, null, function* () {
    try {
      var data = yield apiGet(`/player?post_id=${postId}&_any=1`);
      var embeds = (data && data.data && data.data.embeds) || [];
      var out = [];
      for (var i = 0; i < embeds.length; i++) {
        var e = embeds[i] || {};
        if (!e.url || e.url.indexOf("http") !== 0)
          continue;
        out.push({ url: e.url, lang: langCode(e.lang), quality: e.quality || "HD" });
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[AllCalidad] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      var wantMovie = mediaType === "movie";
      var info = yield getTmdbTitles(tmdbId, mediaType);
      if (!info.titles.length) {
        console.log("[AllCalidad] Sin títulos TMDB");
        return [];
      }
      var queries = [];
      var addQ = function(q) {
        q = (q || "").trim();
        if (q && queries.indexOf(q) === -1 && queries.length < 14)
          queries.push(q);
      };
      for (var qi = 0; qi < info.titles.length; qi++) {
        var rawT = info.titles[qi];
        addQ(rawT);
        addQ(hyphenate(rawT));
        var words = normalize(rawT).split(" ").filter(Boolean);
        if (words.length >= 2) {
          addQ(words.slice(0, 2).join(" "));
          addQ(words.slice(0, 2).join("-"));
        }
      }
      var searchResults = yield Promise.all(queries.map(function(q) { return searchPosts(q); }));
      var candidates = [];
      for (var sqi = 0; sqi < searchResults.length; sqi++) {
        var posts = searchResults[sqi];
        for (var pi = 0; pi < posts.length; pi++) {
          var p = posts[pi];
          if (!p || !p.title)
            continue;
          var type = p.type || "";
          if (wantMovie && type !== "movies")
            continue;
          if (!wantMovie && type !== "tvshows" && type !== "animes")
            continue;
          var dup = false;
          for (var di = 0; di < candidates.length; di++) {
            if (candidates[di]._id === p._id) {
              dup = true;
              break;
            }
          }
          if (!dup)
            candidates.push(p);
        }
      }
      if (!candidates.length) {
        console.log("[AllCalidad] Sin resultados en búsqueda");
        return [];
      }
      var best = null;
      var bestScore = -9999;
      for (var ci = 0; ci < candidates.length; ci++) {
        var sc = scorePost(candidates[ci], info.titles, info.year);
        if (sc > bestScore) {
          bestScore = sc;
          best = candidates[ci];
        }
      }
      if (!best || bestScore < 300) {
        console.log(`[AllCalidad] Sin match suficiente (mejor: ${bestScore})`);
        return [];
      }
      console.log(`[AllCalidad] Seleccionado: "${best.title}" score=${bestScore}`);
      var embeds = [];
      if (wantMovie) {
        embeds = yield getPlayerEmbeds(best._id);
      } else {
        var epData = null;
        try {
          epData = yield apiGet(`/episodes?post_id=${best._id}`);
        } catch (e) {
          epData = null;
        }
        var eps = (epData && epData.data) || [];
        var epId = null;
        for (var ei = 0; ei < eps.length; ei++) {
          if (parseInt(eps[ei].season_number) === parseInt(season) && parseInt(eps[ei].episode_number) === parseInt(episode)) {
            epId = eps[ei]._id;
            break;
          }
        }
        if (!epId) {
          console.log("[AllCalidad] Episodio no encontrado");
          return [];
        }
        embeds = yield getPlayerEmbeds(epId);
      }
      if (!embeds.length) {
        console.log("[AllCalidad] Sin embeds");
        return [];
      }
      console.log(`[AllCalidad] ${embeds.length} embeds`);
      var streams = [];
      for (var li = 0; li < LANG_PRIORITY.length; li++) {
        var lang = LANG_PRIORITY[li];
        var langEmbeds = embeds.filter(function(o) { return o.lang === lang; });
        if (!langEmbeds.length)
          continue;
        console.log(`[AllCalidad] Resolviendo ${langEmbeds.length} embeds (${lang})...`);
        var resolved = yield allSettled(langEmbeds.map(function(o) { return processEmbed(o); }));
        var valid = [];
        for (var vi = 0; vi < resolved.length; vi++) {
          if (resolved[vi].status === "fulfilled" && resolved[vi].value)
            valid.push(resolved[vi].value);
        }
        if (valid.length) {
          streams = valid;
          console.log(`[AllCalidad] ✓ Streams en ${lang}, omitiendo resto`);
          break;
        }
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[AllCalidad] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[AllCalidad] Error: ${e.message}`);
      return [];
    }
  });
}
