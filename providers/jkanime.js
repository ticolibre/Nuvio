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
var jkanime_exports = {};
__export(jkanime_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(jkanime_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// JKAnime provider for Nuvio. Inspired by the CloudStream JKAnimeProvider
// (buscar -> anime page token -> ajax episodes -> servers[] base64 embeds).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://jkanime.net";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Referer": BASE_URL + "/"
};
function allSettled(promises) {
  return Promise.all(promises.map(function(p) {
    return Promise.resolve(p).then(
      function(v) { return { status: "fulfilled", value: v }; },
      function(e) { return { status: "rejected", reason: e }; }
    );
  }));
}
function decodeHtml(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function scoreTitle(candidate, targets) {
  var nc = normalize(candidate);
  var best = -9999;
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
      if (ct.length <= 2) {
        score += 250;
      } else {
        var ratio = ct.length / Math.max(cr.length, 1);
        score += ratio >= 0.6 ? 500 : ratio >= 0.4 ? 250 : 80;
      }
    }
    if (cr.length === 1 && ct.length === 1 && cr[0] !== ct[0])
      score -= 300;
    if (score > best)
      best = score;
  }
  return best;
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
// --- quality inference (string-only) ---
function inferQuality(url) {
  if (!url)
    return "HD";
  var tierMap = null;
  if (url.indexOf("vimeos") !== -1)
    tierMap = { h: "720p", n: "480p" };
  else if (url.indexOf("cloudwindow-route") !== -1)
    tierMap = { n: "720p", l: "360p" };
  else if (url.indexOf("vidhide") !== -1 || url.indexOf("dintezuvio") !== -1)
    tierMap = { n: "720p", l: "480p" };
  else if (url.indexOf("premilkyway") !== -1 || url.indexOf("hlswish") !== -1 || url.indexOf("vibuxer") !== -1 || url.indexOf("streamwish") !== -1)
    tierMap = { x: "1080p", h: "1080p", n: "720p", l: "480p" };
  if (tierMap) {
    var tierMatch = url.match(/_,([a-z,]+),\.urlset/);
    if (tierMatch) {
      var tiers = tierMatch[1].split(",").filter(Boolean);
      var prio = ["x", "o", "h", "n", "l"];
      for (var i = 0; i < prio.length; i++) {
        if (tiers.indexOf(prio[i]) !== -1 && tierMap[prio[i]])
          return tierMap[prio[i]];
      }
    }
  }
  var numMatch = url.match(/[_\-\/](\d{3,4})p/);
  if (numMatch)
    return numMatch[1] + "p";
  return "HD";
}
function b64toString(str) {
  try {
    return atob(str);
  } catch (e) {
    return null;
  }
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
function unpackGeneric(data) {
  var m = data.match(/eval\(function\(p,a,c,k,e,d?\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
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
  return p;
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
      var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      var radix = parseInt(um[2]);
      var symtab = um[4].split("|");
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
      var unpacked = um[1].replace(/\b([0-9a-zA-Z]+)\b/g, function(match) {
        var idx = unbase(match);
        if (isNaN(idx) || idx >= symtab.length)
          return match;
        return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
      });
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
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[JKAnime][MixDrop] Resolviendo: ${embedUrl}`);
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var html = yield resp.text();
      var unpacked = unpackGeneric(html);
      if (!unpacked)
        return null;
      var wm = unpacked.match(/MDCore\.wurl\s*=\s*"([^"]+)"/);
      if (!wm)
        return null;
      var url = wm[1];
      if (url.indexOf("//") === 0)
        url = "https:" + url;
      else if (url.charAt(0) === "/")
        url = "https://mxdrop.to" + url;
      var qm = url.match(/[_-](\d{3,4})p/);
      return { url: url, quality: qm ? qm[1] + "p" : "HD", headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/" } };
    } catch (e) {
      console.log(`[JKAnime][MixDrop] Error: ${e.message}`);
      return null;
    }
  });
}
function resolveYourUpload(embedUrl, pageUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": pageUrl || BASE_URL + "/" },
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var m = html.match(/file:\s*'([^']+\.mp4[^']*)'/i) || html.match(/file:\s*"([^"]+\.mp4[^"]*)"/i);
      if (!m || m[1].indexOf("http") !== 0)
        return null;
      return {
        url: m[1],
        quality: "HD",
        headers: { "User-Agent": UA, "Referer": "https://www.yourupload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveMp4Upload(embedUrl, pageUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": pageUrl || BASE_URL + "/" },
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var m = html.match(/src:\s*"([^"]+\.mp4[^"]*)"/i) || html.match(/src:\s*'([^']+\.mp4[^']*)'/i);
      if (!m || m[1].indexOf("http") !== 0)
        return null;
      return {
        url: m[1],
        quality: "HD",
        headers: { "User-Agent": UA, "Referer": "https://www.mp4upload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveOkru(embedUrl) {
  return __async(this, null, function* () {
    try {
      var raw = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://ok.ru/" },
        redirect: "follow"
      }).then(function(r) { return r.text(); });
      if (raw.indexOf("copyrightsRestricted") !== -1 || raw.indexOf("COPYRIGHTS_RESTRICTED") !== -1 || raw.indexOf("LIMITED_ACCESS") !== -1 || raw.indexOf("notFound") !== -1 || raw.indexOf("urls") === -1)
        return null;
      var data = raw.replace(/\\&quot;/g, '"').replace(/\\u0026/g, "&").replace(/\\/g, "");
      var re = /"name":"([^"]+)","url":"([^"]+)"/g;
      var m;
      var videos = [];
      while ((m = re.exec(data)) !== null) {
        if (m[1].toLowerCase().indexOf("mobile") === -1 && m[2].indexOf("http") === 0)
          videos.push({ type: m[1], url: m[2] });
      }
      if (!videos.length)
        return null;
      var QUALITY_ORDER = ["full", "hd", "sd", "low", "lowest"];
      videos.sort(function(a, b) {
        var ai = -1, bi = -1;
        for (var i = 0; i < QUALITY_ORDER.length; i++) {
          if (ai === -1 && a.type.toLowerCase().indexOf(QUALITY_ORDER[i]) !== -1)
            ai = i;
          if (bi === -1 && b.type.toLowerCase().indexOf(QUALITY_ORDER[i]) !== -1)
            bi = i;
        }
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      var best = videos[0];
      var QUALITY_MAP = { full: "1080p", hd: "720p", sd: "480p", low: "360p", lowest: "240p" };
      return {
        url: best.url,
        quality: QUALITY_MAP[best.type] || best.type,
        headers: { "User-Agent": UA, "Referer": "https://ok.ru/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function processEmbed(url, lang, pageUrl) {
  return __async(this, null, function* () {
    try {
      var low = (url || "").toLowerCase();
      var result = null;
      var label = "Online";
      if (low.indexOf("voe.sx") !== -1) {
        label = "VOE";
        result = yield resolveVoe(url);
      } else if (low.indexOf("mixdrop") !== -1 || low.indexOf("mdbekjwqa") !== -1 || low.indexOf("d-s.io") !== -1) {
        label = "MixDrop";
        result = yield resolveMixdrop(url);
      } else if (low.indexOf("vidhide") !== -1 || low.indexOf("filelions.") !== -1 || low.indexOf("dintezuvio.") !== -1) {
        label = "VidHide";
        result = yield resolveVidhide(url);
      } else if (low.indexOf("yourupload.com") !== -1) {
        label = "YourUpload";
        result = yield resolveYourUpload(url, pageUrl);
      } else if (low.indexOf("mp4upload.com") !== -1) {
        label = "MP4Upload";
        result = yield resolveMp4Upload(url, pageUrl);
      } else if (low.indexOf("ok.ru") !== -1) {
        label = "OkRu";
        result = yield resolveOkru(url);
      } else {
        console.log(`[JKAnime] Sin resolver: ${url.substring(0, 70)}`);
        return null;
      }
      if (!result || !result.url)
        return null;
      var langLabel = lang === "LAT" ? "Latino" : lang === "ESP" ? "Español" : "Subtitulado";
      return {
        name: withSourceName("JKAnime", label),
        title: `${result.quality || "HD"} · ${langLabel} · ${label}`,
        url: result.url,
        quality: result.quality || "HD",
        lang: lang,
        headers: result.headers || {}
      };
    } catch (e) {
      return null;
    }
  });
}
function getTmdbTitles(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var endpoint = mediaType === "movie" ? "movie" : "tv";
    var urls = [
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`,
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    ];
    var results = yield Promise.all(urls.map(function(u) {
      return fetch(u, { headers: { "User-Agent": UA } }).then(function(r) { return r.json(); }).catch(function() { return null; });
    }));
    var titles = [];
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
    }
    return titles;
  });
}
function searchSite(query) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/buscar/${encodeURIComponent(query)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var divRe = /<div class="col[^"]*"[^>]*>[\s\S]*?<div class="anime__item">([\s\S]*?)<\/div>\s*<\/div>/g;
      var m;
      while ((m = divRe.exec(html)) !== null) {
        var block = m[1];
        var hrefM = block.match(/<a[^>]+href="([^"]+)"/);
        var titleM = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/);
        if (!hrefM || !titleM)
          continue;
        var titleHtml = titleM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        var href = hrefM[1];
        if (href.charAt(0) === "/")
          href = BASE_URL + href;
        out.push({ title: decodeHtml(titleHtml), href: href });
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function decodeHtml(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function getSession(animeUrl) {
  return __async(this, null, function* () {
    var res = yield fetch(animeUrl, { headers: HEADERS, redirect: "follow" });
    if (!res.ok)
      return null;
    var html = yield res.text();
    var tokM = html.match(/<meta name="csrf-token"[^>]*content="([^"]+)"/);
    var idM = html.match(/id="guardar-anime"[^>]*data-anime="(\d+)"/) || html.match(/data-anime="(\d+)"/);
    if (!tokM || !idM)
      return null;
    var rawCookies = res.headers.get("set-cookie") || "";
    var cookie = rawCookies.split(",").map(function(c) { return c.split(";")[0].trim(); }).filter(Boolean).join("; ");
    return { html: html, token: tokM[1], animeId: idM[1], cookie: cookie };
  });
}
function getEpisodeNumbers(session) {
  return __async(this, null, function* () {
    var nums = [];
    var page = 1;
    var guard = 0;
    while (guard < 30) {
      guard++;
      var body = "_token=" + encodeURIComponent(session.token);
      var res = null;
      try {
        res = yield fetch(`${BASE_URL}/ajax/episodes/${session.animeId}/${page}/`, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": BASE_URL + "/",
            "Cookie": session.cookie
          },
          body: body,
          redirect: "follow"
        });
      } catch (e) {
        break;
      }
      if (!res.ok)
        break;
      var data = null;
      try {
        data = yield res.json();
      } catch (e) {
        break;
      }
      var list = (data && data.data) || [];
      for (var i = 0; i < list.length; i++) {
        var n = parseInt(list[i].number);
        if (!isNaN(n) && nums.indexOf(n) === -1)
          nums.push(n);
      }
      if (!data.next_page_url)
        break;
      page++;
    }
    return nums.sort(function(a, b) { return a - b; });
  });
}
function extractServers(episodeHtml) {
  var m = episodeHtml.match(/var servers = (\[[\s\S]*?\]);/);
  if (!m)
    return [];
  var urls = [];
  var re = /"remote"\s*:\s*"([^"]+)"/g;
  var r;
  while ((r = re.exec(m[1])) !== null) {
    try {
      var dec = atob(r[1]);
      if (dec.indexOf("http") === 0 && urls.indexOf(dec) === -1)
        urls.push(dec);
    } catch (e) {
    }
  }
  return urls;
}
function langOf(animeTitle) {
  var t = (animeTitle || "").toLowerCase();
  if (t.indexOf("latino") !== -1 || t.indexOf("castellano") !== -1)
    return "LAT";
  return "SUB";
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    var wantMovie = mediaType === "movie";
    if (!wantMovie && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[JKAnime] Buscando: TMDB ${tmdbId} (${mediaType})` + (wantMovie ? "" : ` S${season}E${episode}`));
    try {
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[JKAnime] Sin títulos TMDB");
        return [];
      }
      var animeUrl = null;
      var animeTitle = "";
      for (var ti = 0; ti < titles.length && !animeUrl; ti++) {
        var results = yield searchSite(titles[ti]);
        if (!results.length)
          continue;
        var best = null;
        var bestScore = -9999;
        for (var bi = 0; bi < results.length; bi++) {
          var sc = scoreTitle(results[bi].title, titles);
          if (sc > bestScore) {
            bestScore = sc;
            best = results[bi];
          }
        }
        if (best && bestScore >= 300) {
          animeTitle = best.title;
          animeUrl = best.href;
          console.log(`[JKAnime] Seleccionado: "${animeTitle}" score=${bestScore}`);
        }
      }
      if (!animeUrl) {
        console.log("[JKAnime] Sin resultados en búsqueda");
        return [];
      }
      var session = yield getSession(animeUrl);
      if (!session) {
        console.log("[JKAnime] Sin sesión/token");
        return [];
      }
      var nums = yield getEpisodeNumbers(session);
      if (!nums.length) {
        console.log("[JKAnime] Sin episodios");
        return [];
      }
      var targetEp = wantMovie ? nums[0] : parseInt(episode);
      if (!wantMovie && nums.indexOf(targetEp) === -1) {
        console.log("[JKAnime] Episodio no listado");
        return [];
      }
      var epUrl = animeUrl.replace(/\/$/, "") + "/" + targetEp;
      console.log(`[JKAnime] Episodio: ${epUrl}`);
      var eRes = yield fetch(epUrl, { headers: HEADERS, redirect: "follow" });
      if (!eRes.ok)
        return [];
      var serverUrls = extractServers(yield eRes.text());
      if (!serverUrls.length) {
        console.log("[JKAnime] Sin servidores en episodio");
        return [];
      }
      console.log(`[JKAnime] ${serverUrls.length} servidores`);
      var lang = langOf(animeTitle);
      var langLabel = lang === "LAT" ? "Latino" : lang === "ESP" ? "Español" : "Subtitulado";
      var resolved = yield allSettled(serverUrls.map(function(u) { return processEmbed(u, lang, epUrl); }));
      var streams = [];
      for (var ri = 0; ri < resolved.length; ri++) {
        if (resolved[ri].status !== "fulfilled" || !resolved[ri].value)
          continue;
        streams.push(resolved[ri].value);
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[JKAnime] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[JKAnime] Error: ${e.message}`);
      return [];
    }
  });
}
