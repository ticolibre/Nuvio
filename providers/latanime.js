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
var latanime_exports = {};
__export(latanime_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(latanime_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// LatAnime provider for Nuvio. Inspired by the CloudStream LatAnimeProvider
// (buscar -> anime page episodes -> play-video data-player base64 embeds).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://latanime.org";
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
function entryLang(href, title) {
  var s = ((href || "") + " " + (title || "")).toLowerCase();
  if (s.indexOf("latino") !== -1)
    return "LAT";
  if (s.indexOf("castellano") !== -1)
    return "ESP";
  return "SUB";
}
function scoreTitle(candidate, targets, isSeries) {
  var nc = normalize(candidate).replace(/\b(latino|castellano|castelano|subtitulado|subtitulada|sub|dubbed|doblado|audio|espanol)\b/g, "").replace(/\b(?:temporada|season|parte|part|ova|movie|pelicula)\s*\d+\b/g, "").replace(/\b(?:19|20)\d{2}\b/g, "");
  if (isSeries) {
    // El sitio marca la temporada en el titulo ("... S2 Latino", "... 3 Parte 2",
    // "... (TV)"). Para comparar nombres hay que quitarla: no es parte del titulo.
    nc = nc.replace(/\b(?:temporada|season)\s*\d{1,2}\b/g, " ").replace(/\b(?:parte|part)\s*\d\b/g, " ").replace(/\bs\s?\d{1,2}\b/g, " ").replace(/\btv\b/g, " ").replace(/\s+\d{1,2}\s*$/, " ");
  }
  nc = nc.replace(/\s+/g, " ").trim();
  var cr = nc.split(" ").filter(Boolean);
  var best = -9999;
  for (var i = 0; i < targets.length; i++) {
    var nt = normalize(targets[i]);
    if (!nt)
      continue;
    var ct = nt.split(" ").filter(Boolean);
    if (!ct.length)
      continue;
    var score = 0;
    if (nc === nt)
      score += 600;
    var common = 0;
    for (var t = 0; t < ct.length; t++) {
      if (cr.indexOf(ct[t]) !== -1)
        common++;
    }
    score += common * 50;
    // Cuanto del titulo buscado aparece (coverTarget) y cuanto del resultado
    // es realmente el titulo (coverCandidate). Sin ambas cosas, un titulo
    // corto como "Obsession" o "Elite" se "encuentra" dentro de cualquier
    // serie que solo comparta esa palabra.
    var coverTarget = common / ct.length;
    var coverCandidate = cr.length ? common / cr.length : 0;
    if (common === ct.length) {
      if (ct.length <= 2) {
        // Titulos cortos: solo vale si el resultado no agrega palabras de mas.
        if (cr.length <= ct.length)
          score += 250;
        else if (cr.length <= ct.length + 1)
          score += 120;
        else
          score -= 200;
      } else {
        var ratio = ct.length / Math.max(cr.length, 1);
        score += ratio >= 0.6 ? 500 : ratio >= 0.4 ? 250 : 80;
      }
    } else if (coverTarget >= 0.75 && coverCandidate >= 0.5) {
      score += 150;
    }
    // Palabras que el resultado agrega al titulo buscado ("... The Last Attack",
    // "... Shippuden"). Un extra puede ser legitimo, tres ya es otra entrega.
    var extra = cr.length - common;
    if (extra > 0)
      score -= extra * 40;
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
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[LatAnime][MixDrop] Resolviendo: ${embedUrl}`);
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
      console.log(`[LatAnime][MixDrop] Error: ${e.message}`);
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
      var rawM3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (rawM3u8)
        return { url: rawM3u8[0], quality: inferQuality(rawM3u8[0]), headers: { "User-Agent": UA, "Referer": embedHost + "/" } };
      return null;
    } catch (err) {
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
      } else if (low.indexOf("streamwish.") !== -1 || low.indexOf("strwish.") !== -1 || low.indexOf("hlswish.") !== -1 || low.indexOf("hglink.to") !== -1 || low.indexOf("vibuxer.") !== -1) {
        label = "StreamWish";
        result = yield resolveStreamwish(url);
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
        console.log(`[LatAnime] Sin resolver: ${url.substring(0, 70)}`);
        return null;
      }
      if (!result || !result.url)
        return null;
      var langLabel = lang === "LAT" ? "Latino" : lang === "ESP" ? "Español" : "Subtitulado";
      return {
        name: withSourceName("LatAnime", label),
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
// Limite de busquedas en el sitio por cada consulta (cada titulo = 1 request).
var MAX_TITLE_QUERIES = 5;
function getTmdbTitles(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var endpoint = mediaType === "movie" ? "movie" : "tv";
    var urls = [
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`,
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`,
      `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`
    ];
    var results = yield Promise.all(urls.map(function(u) {
      return fetch(u, { headers: { "User-Agent": UA } }).then(function(r) { return r.json(); }).catch(function() { return null; });
    }));
    var queries = [];
    var targets = [];
    var seenTargets = {};
    var seenQueries = {};
    var clean = function(t) {
      var key = normalize(t);
      // Sin letras latinas no sirve: el sitio indexa en espanol/romaji.
      if (!key || !/[a-z]/.test(key))
        return "";
      return key;
    };
    var push = function(list, seen, t, limit) {
      var key = clean(t);
      if (!key || seen[key])
        return;
      if (limit && list.length >= limit)
        return;
      seen[key] = true;
      list.push(t);
    };
    for (var i = 0; i < 2; i++) {
      var data = results[i];
      if (!data)
        continue;
      push(targets, seenTargets, mediaType === "movie" ? data.title : data.name);
      push(targets, seenTargets, mediaType === "movie" ? data.original_title : data.original_name);
    }
    // Los titulos base siempre se buscan y siempre puntuan.
    for (var b = 0; b < targets.length; b++)
      push(queries, seenQueries, targets[b], MAX_TITLE_QUERIES);
    // Titulos alternativos: el romaji es clave para anime que el sitio indexa
    // con su nombre japones ("Shingeki no Kyojin" en vez de "Attack on Titan").
    // Se excluyen los de otras entregas (OVA, temporada, pelicula).
    var alts = results[2] && Array.isArray(results[2].results) ? results[2].results : [];
    var romaji = [];
    var others = [];
    for (var a = 0; a < alts.length; a++) {
      var alt = alts[a];
      if (!alt || !alt.title)
        continue;
      var type = String(alt.type || "").toLowerCase();
      if (/oad|ova|season|chapter|special|alternative|series/.test(type))
        continue;
      if (type.indexOf("romaji") !== -1)
        romaji.push(alt.title);
      else if (alt.iso_3166_1 === "ES" || alt.iso_3166_1 === "MX" || alt.iso_3166_1 === "US")
        others.push(alt.title);
    }
    var ordered = romaji.concat(others);
    // Solo los alternativos "cortos" sirven para puntuar: uno con muchas mas
    // palabras que el titulo base suele ser un arco o temporada concreta
    // ("Bleach Sennen Kessen-hen" = temporada 17), no la serie completa.
    var baseMax = 1;
    for (var m = 0; m < targets.length; m++) {
      var words = normalize(targets[m]).split(" ").filter(Boolean).length;
      if (words > baseMax)
        baseMax = words;
    }
    for (var o = 0; o < ordered.length; o++) {
      var name = ordered[o];
      var altWords = normalize(name).split(" ").filter(Boolean).length;
      var isArc = /[:]|\s-\s/.test(name) || altWords > baseMax + 1;
      if (!isArc)
        push(targets, seenTargets, name);
      push(queries, seenQueries, name, MAX_TITLE_QUERIES);
    }
    return { queries: queries, targets: targets };
  });
}
function searchSite(query) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/buscar?q=${encodeURIComponent(query)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var chunks = html.split("col-6 my-3");
      for (var ci = 1; ci < chunks.length; ci++) {
        var block = chunks[ci];
        var hrefM = block.match(/<a[^>]+href="([^"]*\/anime\/[^"]*)"/);
        var titleM = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
        if (!hrefM || !titleM)
          continue;
        var href = hrefM[1];
        if (href.charAt(0) === "/")
          href = BASE_URL + href;
        var titleHtml = titleM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!titleHtml)
          continue;
        var dup = false;
        for (var d = 0; d < out.length; d++) {
          if (out[d].href === href) {
            dup = true;
            break;
          }
        }
        if (!dup)
          out.push({ title: decodeHtml(titleHtml), href: href });
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function extractEpisodes(animeHtml, animeUrl) {
  var out = [];
  var re = /href="([^"]*\/ver\/[^"]*)"/g;
  var m;
  while ((m = re.exec(animeHtml)) !== null) {
    var u = m[1];
    if (u.charAt(0) === "/")
      u = BASE_URL + u;
    var nm = u.match(/-episodio-(\d+)\/?$/);
    if (nm && out.map(function(e) { return e.url; }).indexOf(u) === -1)
      out.push({ url: u, num: parseInt(nm[1]) });
  }
  return out;
}
function extractPlayers(episodeHtml) {
  var out = [];
  var re = /data-player="([^"]+)"/g;
  var m;
  while ((m = re.exec(episodeHtml)) !== null) {
    var raw = m[1];
    var dec = null;
    try {
      dec = atob(raw);
    } catch (e) {
      continue;
    }
    dec = dec.replace("https://monoschinos2.com/reproductor?url=", "").replace("https://mojon.latanime.org/aqua/fn?url=", "");
    if (dec.indexOf("http") === 0 && out.indexOf(dec) === -1)
      out.push(dec);
  }
  return out;
}
// Temporada que anuncia el titulo del sitio: "S3", "Temporada 2", "3 Parte 2"
// o un numero suelto al final ("Shingeki no Kyojin 2"). season = null si el
// titulo no indica ninguna, que en este sitio equivale a la primera temporada.
function seasonInfo(title) {
  var t = normalize(title).replace(/\b(latino|castellano|castelano|subtitulado|subtitulada|sub|doblado|dubbed|audio)\b/g, " ").replace(/\s+/g, " ").trim();
  var part = t.match(/\b(?:parte|part)\s*(\d)\b/);
  var num = t.match(/\bs\s?(\d{1,2})\b/) || t.match(/\b(?:temporada|season)\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*(?:a|ra|da)?\s*(?:temporada|season)\b/);
  var season = num ? parseInt(num[1], 10) : null;
  if (season === null) {
    var bare = t.match(/(?:^|\s)(\d{1,2})$/);
    if (bare) {
      var n = parseInt(bare[1], 10);
      if (n >= 2 && n <= 9)
        season = n;
    }
  }
  var isFinal = /\bfinal\s+(season|chapters?)\b/.test(t) || /\bthe final season\b/.test(t);
  return { season: season, part: part ? parseInt(part[1], 10) : 1, final: isFinal };
}

// Un resultado solo sirve si es la misma serie (no OVA ni pelicula) y la misma
// temporada: si no, S1E1 terminaria apuntando a la pagina de la S3.
function isEpisodeEntry(title, targetSeason) {
  var t = normalize(title);
  if (/\b(ova|oav|movie|pelicula|especial|special)\b/.test(t))
    return false;
  var info = seasonInfo(title);
  if (info.part > 1)
    return false;
  if (info.season === null)
    return targetSeason === 1 && !info.final;
  return info.season === targetSeason;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    var wantMovie = mediaType === "movie";
    if (!wantMovie && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[LatAnime] Buscando: TMDB ${tmdbId} (${mediaType})` + (wantMovie ? "" : ` S${season}E${episode}`));
    try {
      var meta = yield getTmdbTitles(tmdbId, mediaType);
      if (!meta.queries.length) {
        console.log("[LatAnime] Sin títulos TMDB");
        return [];
      }
      var titles = meta.targets;
      var animeUrl = null;
      var animeTitle = "";
      var animeScore = -9999;
      var animeRank = 99;
      var targetSeason = wantMovie ? 1 : parseInt(season, 10) || 1;
      for (var ti = 0; ti < meta.queries.length; ti++) {
        var results = yield searchSite(meta.queries[ti]);
        for (var bi = 0; bi < results.length; bi++) {
          if (!wantMovie && !isEpisodeEntry(results[bi].title, targetSeason))
            continue;
          var sc = scoreTitle(results[bi].title, titles, !wantMovie);
          var rk = (function() {
            var c = entryLang(results[bi].href, results[bi].title);
            return c === "LAT" ? 0 : c === "ESP" ? 1 : 2;
          })();
          if (sc > animeScore || (sc === animeScore && rk < animeRank)) {
            animeScore = sc;
            animeRank = rk;
            animeTitle = results[bi].title;
            animeUrl = results[bi].href;
          }
        }
      }
      if (animeUrl)
        console.log(`[LatAnime] Seleccionado: "${animeTitle}" score=${animeScore}`);
      // Para series se pide coincidencia casi exacta: un resultado con palabras
      // de mas ("... Vigilantes", "... Memories") es otra entrega, no la serie.
      var minScore = wantMovie ? 300 : 700;
      if (!animeUrl || animeScore < minScore) {
        console.log("[LatAnime] Sin resultados en búsqueda");
        return [];
      }
      var lang = entryLang(animeUrl, animeTitle);
      var aRes = yield fetch(animeUrl, { headers: HEADERS, redirect: "follow" });
      if (!aRes.ok)
        return [];
      var eps = extractEpisodes(yield aRes.text(), animeUrl);
      var targetEp = wantMovie ? 1 : parseInt(episode);
      var epUrl = null;
      for (var ei = 0; ei < eps.length; ei++) {
        if (eps[ei].num === targetEp) {
          epUrl = eps[ei].url;
          break;
        }
      }
      if (!epUrl && wantMovie && eps.length)
        epUrl = eps[0].url;
      if (!epUrl) {
        console.log("[LatAnime] Episodio no encontrado");
        return [];
      }
      console.log(`[LatAnime] Episodio: ${epUrl}`);
      var eRes = yield fetch(epUrl, { headers: HEADERS, redirect: "follow" });
      if (!eRes.ok)
        return [];
      var players = extractPlayers(yield eRes.text());
      if (!players.length) {
        console.log("[LatAnime] Sin reproductores en episodio");
        return [];
      }
      console.log(`[LatAnime] ${players.length} reproductores`);
      var resolved = yield allSettled(players.map(function(u) { return processEmbed(u, lang, epUrl); }));
      var streams = [];
      for (var ri = 0; ri < resolved.length; ri++) {
        if (resolved[ri].status !== "fulfilled" || !resolved[ri].value)
          continue;
        var dup = false;
        for (var di = 0; di < streams.length; di++) {
          if (streams[di].url === resolved[ri].value.url) {
            dup = true;
            break;
          }
        }
        if (!dup)
          streams.push(resolved[ri].value);
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[LatAnime] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[LatAnime] Error: ${e.message}`);
      return [];
    }
  });
}
function entryLang(href, title) {
  var s = ((href || "") + " " + (title || "")).toLowerCase();
  if (s.indexOf("latino") !== -1)
    return "LAT";
  if (s.indexOf("castellano") !== -1)
    return "ESP";
  return "SUB";
}
