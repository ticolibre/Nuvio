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
var tioanime_exports = {};
__export(tioanime_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(tioanime_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// TioAnime provider for Nuvio. Inspired by the CloudStream TioAnimeProvider
// (search API -> anime page episodes -> ver page videos[] embeds).
// Only YourUpload (direct mp4) and OkRu embeds are resolvable with plain
// fetch; Mega/Maru/Netu/StreamSB/custom players are skipped with logs.
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://tioanime.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Referer": BASE_URL + "/"
};
var LANG_LABELS = { "LAT": "Latino", "ESP": "Español", "SUB": "Subtitulado" };
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
function searchAnime(query) {
  return __async(this, null, function* () {
    try {
      var body = "value=" + encodeURIComponent(query);
      var res = yield fetch(`${BASE_URL}/api/search`, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": BASE_URL + "/"
        },
        body: body,
        redirect: "follow"
      });
      if (!res.ok)
        return [];
      var data = yield res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  });
}
function entryLang(entryFlag, animeTitle) {
  if (entryFlag === 1)
    return "LAT";
  var t = (animeTitle || "").toLowerCase();
  if (t.indexOf("latino") !== -1 || t.indexOf("castellano") !== -1)
    return "LAT";
  return "SUB";
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
function inferQuality(url) {
  if (!url)
    return "HD";
  var tierMap = null;
  if (url.indexOf("vimeos") !== -1)
    tierMap = { h: "720p", n: "480p" };
  else if (url.indexOf("goodstream") !== -1)
    tierMap = { x: "1080p", h: "720p", n: "480p", l: "360p" };
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
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var radix = parseInt(packMatch[2]);
        var symtab = packMatch[4].split("|");
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
        var unpacked = packMatch[1].replace(/\b([0-9a-zA-Z]+)\b/g, function(match) {
          var idx = unbase(match);
          if (isNaN(idx) || idx >= symtab.length)
            return match;
          return symtab[idx] && symtab[idx] !== "" ? symtab[idx] : match;
        });
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
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var unpacked = unpackGeneric(yield resp.text());
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
function processVideoEntry(entry, animeTitle, pageUrl) {
  return __async(this, null, function* () {
    try {
      var server = entry[0] || "";
      var url = entry[1] || "";
      if (!url || url.indexOf("http") !== 0)
        return null;
      var lang = entryLang(entry[3], animeTitle);
      var slow = server.toLowerCase();
      var result = null;
      var serverLabel = server;
      if (url.indexOf("yourupload.com") !== -1) {
        serverLabel = "YourUpload";
        result = yield resolveYourUpload(url, pageUrl);
      } else if (url.indexOf("ok.ru") !== -1) {
        serverLabel = "OkRu";
        result = yield resolveOkru(url);
      } else if (url.indexOf("voe.sx") !== -1) {
        serverLabel = "VOE";
        result = yield resolveVoe(url);
      } else if (url.indexOf("mixdrop") !== -1 || url.indexOf("mixdroop") !== -1 || url.indexOf("mdbekjwqa") !== -1 || url.indexOf("d-s.io") !== -1) {
        serverLabel = "MixDrop";
        result = yield resolveMixdrop(url);
      } else if (url.indexOf("vidhide") !== -1 || url.indexOf("filelions.") !== -1 || url.indexOf("dintezuvio.") !== -1 || url.indexOf("vidhidevip") !== -1) {
        serverLabel = "VidHide";
        result = yield resolveVidhide(url);
      } else if (url.indexOf("streamwish.") !== -1 || url.indexOf("strwish.") !== -1 || url.indexOf("hlswish.") !== -1 || url.indexOf("hglink.to") !== -1 || url.indexOf("vibuxer.") !== -1) {
        serverLabel = "StreamWish";
        result = yield resolveStreamwish(url);
      } else if (url.indexOf("mp4upload.com") !== -1) {
        serverLabel = "MP4Upload";
        result = yield resolveMp4Upload(url, pageUrl);
      } else {
        console.log(`[TioAnime] Sin resolver (${server}): ${url.substring(0, 70)}`);
        return null;
      }
      if (!result || !result.url)
        return null;
      var langLabel = LANG_LABELS[lang] || lang;
      return {
        name: withSourceName("TioAnime", serverLabel),
        title: `${result.quality || "HD"} · ${langLabel} · ${serverLabel}`,
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
function extractVideos(episodeHtml) {
  var m = episodeHtml.match(/var videos = (\[[\s\S]*?\]);/);
  if (!m)
    return [];
  try {
    var arr = JSON.parse(m[1].replace(/\\\//g, "/"));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function extractEpisodes(animeHtml) {
  var m = animeHtml.match(/var episodes = \[([^\]]*)\]/);
  if (!m)
    return [];
  var out = [];
  var parts = m[1].split(",");
  for (var i = 0; i < parts.length; i++) {
    var n = parseInt(parts[i].trim());
    if (!isNaN(n))
      out.push(n);
  }
  return out;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    var wantMovie = mediaType === "movie";
    var epNum = wantMovie ? 1 : episode;
    if (!wantMovie && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[TioAnime] Buscando: TMDB ${tmdbId} (${mediaType})` + (wantMovie ? "" : ` S${season}E${episode}`));
    try {
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[TioAnime] Sin títulos TMDB");
        return [];
      }
      var animeUrl = null;
      var animeTitle = "";
      var queries = [];
      var addQ = function(q) {
        q = (q || "").trim().replace(/\s+/g, " ");
        if (q && queries.indexOf(q) === -1 && queries.length < 12)
          queries.push(q);
      };
      for (var qi = 0; qi < titles.length; qi++) {
        addQ(titles[qi]);
        var words = normalize(titles[qi]).split(" ").filter(Boolean);
        var long = [];
        for (var wi = 0; wi < words.length; wi++) {
          if (words[wi].length > 3 && words[wi] !== "movie" && words[wi] !== "pelicula" && words[wi] !== "part" && words[wi] !== "parte")
            long.push(words[wi]);
        }
        if (long.length >= 2) {
          addQ(long.slice(0, 2).join(" "));
          addQ(long.slice(-2).join(" "));
        }
      }
      var searchBatches = yield Promise.all(queries.map(function(q) { return searchAnime(q); }));
      var pooled = [];
      for (var sbi = 0; sbi < searchBatches.length; sbi++) {
        var batch = searchBatches[sbi];
        for (var bj = 0; bj < batch.length; bj++) {
          var dup = false;
          for (var dj = 0; dj < pooled.length; dj++) {
            if (String(pooled[dj].id) === String(batch[bj].id)) {
              dup = true;
              break;
            }
          }
          if (!dup)
            pooled.push(batch[bj]);
        }
      }
      {
        var filtered = [];
        for (var fi = 0; fi < pooled.length; fi++) {
          var rtype = String(pooled[fi].type || "");
          var rIsMovie = rtype === "1";
          if (wantMovie && !rIsMovie)
            continue;
          if (!wantMovie && rIsMovie)
            continue;
          filtered.push(pooled[fi]);
        }
        var best = null;
        var bestScore = -9999;
        for (var bi = 0; bi < filtered.length; bi++) {
          var sc = scoreTitle(filtered[bi].title, titles);
          if (sc > bestScore) {
            bestScore = sc;
            best = filtered[bi];
          }
        }
        if (best && bestScore >= 300) {
          animeTitle = best.title;
          animeUrl = `${BASE_URL}/anime/${best.slug}`;
          console.log(`[TioAnime] Seleccionado: "${animeTitle}" score=${bestScore}`);
        }
      }
      if (!animeUrl) {
        console.log("[TioAnime] Sin resultados en búsqueda");
        return [];
      }
      var aRes = yield fetch(animeUrl, { headers: HEADERS, redirect: "follow" });
      if (!aRes.ok)
        return [];
      var animeHtml = yield aRes.text();
      var episodes = extractEpisodes(animeHtml);
      var targetEp = wantMovie ? (episodes.length ? episodes[0] : 1) : parseInt(episode);
      if (!wantMovie && episodes.length && episodes.indexOf(targetEp) === -1) {
        console.log("[TioAnime] Episodio no listado");
        return [];
      }
      var epUrl = animeUrl.replace("/anime/", "/ver/") + "-" + targetEp;
      console.log(`[TioAnime] Episodio: ${epUrl}`);
      var eRes = yield fetch(epUrl, { headers: HEADERS, redirect: "follow" });
      if (!eRes.ok)
        return [];
      var videos = extractVideos(yield eRes.text());
      if (!videos.length) {
        console.log("[TioAnime] Sin videos en episodio");
        return [];
      }
      console.log(`[TioAnime] ${videos.length} videos`);
      var resolved = yield allSettled(videos.map(function(v) { return processVideoEntry(v, animeTitle, epUrl); }));
      var streams = [];
      for (var ri = 0; ri < resolved.length; ri++) {
        if (resolved[ri].status === "fulfilled" && resolved[ri].value)
          streams.push(resolved[ri].value);
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[TioAnime] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[TioAnime] Error: ${e.message}`);
      return [];
    }
  });
}
