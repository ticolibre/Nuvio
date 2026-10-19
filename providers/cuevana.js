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
var cuevana_exports = {};
__export(cuevana_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(cuevana_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// Cuevana provider for Nuvio. Inspired by the CloudStream CuevanaProvider
// (search -> ver-pelicula/ver-serie pages -> player.php -> var url -> resolvers).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://wv3.cuevana3.eu";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Referer": BASE_URL + "/"
};
var LANG_PRIORITY = ["LAT", "ESP", "SUB"];
var LANG_LABELS = { "LAT": "Latino", "ESP": "Español", "SUB": "Subtitulado" };
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
    if (nc === nt) {
      score += 600;
    }
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
    if (score > best)
      best = score;
  }
  return best;
}
// --- quality inference (string-only, no extra requests) ---
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
// --- resolvers ---
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
      console.log(`[Cuevana][VOE] Resolviendo: ${embedUrl}`);
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
      console.log(`[Cuevana][VOE] Error: ${err.message}`);
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
      console.log(`[Cuevana][StreamWish] Resolviendo: ${embedUrl}`);
      var fetchUrl = embedUrl;
      if (fetchUrl.indexOf("hglink.to") !== -1)
        fetchUrl = fetchUrl.replace("hglink.to", "vibuxer.com");
      var hm = fetchUrl.match(/^(https?:\/\/[^/]+)/);
      var embedHost = hm ? hm[1] : "https://hlswish.com";
      var resp = yield fetch(fetchUrl, {
        headers: {
          "User-Agent": UA,
          "Referer": BASE_URL + "/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
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
      console.log(`[Cuevana][StreamWish] Error: ${err.message}`);
      return null;
    }
  });
}
function resolveVidhide(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[Cuevana][VidHide] Resolviendo: ${embedUrl}`);
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
      console.log(`[Cuevana][VidHide] Error: ${e.message}`);
      return null;
    }
  });
}
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[Cuevana][MixDrop] Resolviendo: ${embedUrl}`);
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
      console.log(`[Cuevana][MixDrop] Error: ${e.message}`);
      return null;
    }
  });
}
function getResolver(server) {
  var s = (server || "").toLowerCase();
  if (s.indexOf("streamwish") !== -1 || s.indexOf("hglink") !== -1)
    return resolveStreamwish;
  if (s.indexOf("vidhide") !== -1)
    return resolveVidhide;
  if (s.indexOf("voe") !== -1)
    return resolveVoe;
  if (s.indexOf("mixdrop") !== -1)
    return resolveMixdrop;
  return null;
}
function getServerLabel(server) {
  var s = (server || "").toLowerCase();
  if (s.indexOf("streamwish") !== -1)
    return "StreamWish";
  if (s.indexOf("vidhide") !== -1)
    return "VidHide";
  if (s.indexOf("voe") !== -1)
    return "VOE";
  if (s.indexOf("mixdrop") !== -1)
    return "MixDrop";
  return server || "Online";
}
// --- site parsing ---
function extractSearchResults(html, wantMovie) {
  var out = [];
  var liRe = /<li class="TPostMv">([\s\S]*?)<\/li>/g;
  var m;
  while ((m = liRe.exec(html)) !== null) {
    var block = m[1];
    var a = block.match(/<a[^>]+href="([^"]+)"/);
    if (!a)
      continue;
    var href = a[1];
    var isMovie = href.indexOf("/ver-pelicula/") !== -1;
    var isSerie = href.indexOf("/ver-serie/") !== -1;
    if (wantMovie && !isMovie)
      continue;
    if (!wantMovie && !isSerie)
      continue;
    var alt = block.match(/<img[^>]+alt="([^"]+)"/);
    var span = block.match(/<span class="Title[^"]*">([^<]+)</);
    var title = decodeHtml(((alt && alt[1]) || (span && span[1]) || "").trim());
    if (!title)
      continue;
    out.push({ title: title, href: href.indexOf("http") === 0 ? href : BASE_URL + href });
  }
  return out;
}
function findBestResult(results, targets) {
  var best = null;
  var bestScore = -9999;
  for (var i = 0; i < results.length; i++) {
    var sc = scoreTitle(results[i].title, targets);
    if (sc > bestScore) {
      bestScore = sc;
      best = results[i];
    }
  }
  if (!best || bestScore < 300)
    return null;
  return best;
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
function searchCuevana(title, wantMovie) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/search?q=${encodeURIComponent(title)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      return extractSearchResults(yield res.text(), wantMovie);
    } catch (e) {
      return [];
    }
  });
}
function langCode(label) {
  var l = (label || "").toLowerCase();
  if (l.indexOf("latino") !== -1)
    return "LAT";
  if (l.indexOf("castellano") !== -1 || (l.indexOf("espa") !== -1 && l.indexOf("latin") === -1))
    return "ESP";
  if (l.indexOf("subtitul") !== -1)
    return "SUB";
  return null;
}
function extractPlayerOptions(pageHtml) {
  // [{lang, iframe, server}] grouped from open_submenu language tabs
  var out = [];
  var chunks = pageHtml.split('<li class="open_submenu');
  for (var i = 1; i < chunks.length; i++) {
    var chunk = chunks[i];
    var langM = chunk.match(/Espa(?:ñ|n)ol (Latino|Castellano)|Subtitulado|Latino/);
    var lang = langM ? langCode(langM[0]) : null;
    if (!lang)
      continue;
    var optRe = /data-tr="([^"]+)"[^>]*><span[^>]*><span[^>]*>\d+<!-- -->\.\s*<!-- -->([A-Za-z0-9]+)<!-- -->/g;
    var m;
    while ((m = optRe.exec(chunk)) !== null) {
      var iframe = m[1];
      if (iframe.indexOf("http") !== 0)
        iframe = BASE_URL + (iframe.charAt(0) === "/" ? "" : "/") + iframe;
      out.push({ lang: lang, iframe: iframe, server: m[2] });
    }
  }
  return out;
}
function resolvePlayerUrl(iframeUrl, pageUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(iframeUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": pageUrl },
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var m = html.match(/var url = '([^']+)'/);
      if (!m)
        return null;
      var u = m[1];
      if (u.indexOf("http") !== 0)
        u = resolveUrl(u, iframeUrl);
      return u;
    } catch (e) {
      return null;
    }
  });
}
function getSerieSlugBase(seriePageUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(seriePageUrl, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var m = html.match(/"slug"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/);
      if (m)
        return m[1];
      var parts = (seriePageUrl.split("?")[0] || "").split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    } catch (e) {
      return null;
    }
  });
}
function processOption(opt, pageUrl) {
  return __async(this, null, function* () {
    try {
      var resolver = getResolver(opt.server);
      if (!resolver) {
        console.log(`[Cuevana] Sin resolver: ${opt.server}`);
        return null;
      }
      var target = yield resolvePlayerUrl(opt.iframe, pageUrl);
      if (!target)
        return null;
      var result = yield resolver(target);
      if (!result || !result.url)
        return null;
      var langLabel = LANG_LABELS[opt.lang] || opt.lang;
      var serverLabel = getServerLabel(opt.server);
      return {
        name: withSourceName("Cuevana", serverLabel),
        title: `${result.quality || "HD"} · ${langLabel} · ${serverLabel}`,
        url: result.url,
        quality: result.quality || "HD",
        headers: result.headers || {}
      };
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
    var startTime = Date.now();
    console.log(`[Cuevana] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      var wantMovie = mediaType === "movie";
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[Cuevana] Sin títulos TMDB");
        return [];
      }
      var pageUrl = null;
      for (var ti = 0; ti < titles.length && !pageUrl; ti++) {
        var results = yield searchCuevana(titles[ti], wantMovie);
        if (!results.length)
          continue;
        var best = findBestResult(results, titles);
        if (best) {
          console.log(`[Cuevana] Seleccionado: "${best.title}"`);
          pageUrl = best.href;
        }
      }
      if (!pageUrl) {
        console.log("[Cuevana] Sin resultados en búsqueda");
        return [];
      }
      if (!wantMovie) {
        var base = yield getSerieSlugBase(pageUrl);
        if (!base) {
          console.log("[Cuevana] Sin slug de serie");
          return [];
        }
        pageUrl = `${BASE_URL}/episodio/${base}-temporada-${season}-episodio-${episode}`;
        console.log(`[Cuevana] Episodio: ${pageUrl}`);
      }
      var pageRes = yield fetch(pageUrl, { headers: HEADERS, redirect: "follow" });
      if (!pageRes.ok) {
        console.log(`[Cuevana] HTTP ${pageRes.status} en página`);
        return [];
      }
      var pageHtml = yield pageRes.text();
      var options = extractPlayerOptions(pageHtml);
      if (!options.length) {
        console.log("[Cuevana] Sin opciones de reproductor");
        return [];
      }
      console.log(`[Cuevana] ${options.length} opciones encontradas`);
      var streams = [];
      for (var li = 0; li < LANG_PRIORITY.length; li++) {
        var lang = LANG_PRIORITY[li];
        var langOpts = options.filter(function(o) { return o.lang === lang; });
        if (!langOpts.length)
          continue;
        console.log(`[Cuevana] Resolviendo ${langOpts.length} embeds (${lang})...`);
        var resolved = yield allSettled(langOpts.map(function(o) { return processOption(o, pageUrl); }));
        var valid = [];
        for (var ri = 0; ri < resolved.length; ri++) {
          if (resolved[ri].status === "fulfilled" && resolved[ri].value)
            valid.push(resolved[ri].value);
        }
        if (valid.length) {
          streams = valid;
          console.log(`[Cuevana] ✓ Streams en ${lang}, omitiendo resto`);
          break;
        }
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[Cuevana] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[Cuevana] Error: ${e.message}`);
      return [];
    }
  });
}
