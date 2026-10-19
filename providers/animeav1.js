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
var animeav1_exports = {};
__export(animeav1_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(animeav1_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// AnimeAV1 provider for Nuvio. Inspired by the CloudStream AnimeAV1Provider
// (catalogo search -> media page episodes -> embeds:{DUB,SUB} JSON ->
// PlayerZilla m3u8 + direct mp4s + OkRu).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://animeav1.com";
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
function resolveZilla(playUrl) {
  var m3u8Url = playUrl.replace("/play/", "/m3u8/");
  return {
    url: m3u8Url,
    quality: "HD",
    headers: { "User-Agent": UA, "Referer": BASE_URL + "/" }
  };
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
            return { url: url, quality: "HD", headers: { Referer: embedUrl } };
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
        return { url: url2, quality: "HD", headers: { Referer: embedUrl } };
      }
      return null;
    } catch (err) {
      return null;
    }
  });
}
function processServer(server, url, langLabel, pageUrl) {
  return __async(this, null, function* () {
    try {
      var slow = (server || "").toLowerCase();
      var result = null;
      var label = server || "Online";
      if (url.indexOf("player.zilla-networks.com") !== -1) {
        label = "Zilla";
        result = resolveZilla(url);
      } else if (url.indexOf("yourupload.com") !== -1) {
        label = "YourUpload";
        result = yield resolveYourUpload(url, pageUrl);
      } else if (url.indexOf("mp4upload.com") !== -1) {
        label = "MP4Upload";
        result = yield resolveMp4Upload(url, pageUrl);
      } else if (url.indexOf("ok.ru") !== -1) {
        label = "OkRu";
        result = yield resolveOkru(url);
      } else if (url.indexOf("voe.sx") !== -1) {
        label = "VOE";
        result = yield resolveVoe(url);
      } else {
        console.log(`[AnimeAV1] Sin resolver (${server}): ${url.substring(0, 70)}`);
        return null;
      }
      if (!result || !result.url)
        return null;
      return {
        name: withSourceName("AnimeAV1", label),
        title: `${result.quality || "HD"} · ${langLabel} · ${label}`,
        url: result.url,
        quality: result.quality || "HD",
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
function searchCatalog(query) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/catalogo?search=${encodeURIComponent(query)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var artRe = /<article[\s\S]*?<\/article>/g;
      var m;
      while ((m = artRe.exec(html)) !== null) {
        var block = m[0];
        var hrefM = block.match(/href="([^"]+)"/);
        var titleM = block.match(/<h3[^>]*>([^<]+)/);
        if (!hrefM || !titleM)
          continue;
        var href = hrefM[1];
        if (href.charAt(0) === "/")
          href = BASE_URL + href;
        out.push({ title: decodeHtml(titleM[1].trim()), href: href });
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function parseEmbedsJson(episodeHtml) {
  var m = episodeHtml.match(/embeds:(\{(?:DUB|SUB):\[.*?\]\})/);
  if (!m)
    return null;
  try {
    var json = m[1].replace(/SUB/g, '"SUB"').replace(/DUB/g, '"DUB"').replace(/url/g, '"url"').replace(/server/g, '"server"');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
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
    console.log(`[AnimeAV1] Buscando: TMDB ${tmdbId} (${mediaType})` + (wantMovie ? "" : ` S${season}E${episode}`));
    try {
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[AnimeAV1] Sin títulos TMDB");
        return [];
      }
      var mediaUrl = null;
      for (var ti = 0; ti < titles.length && !mediaUrl; ti++) {
        var results = yield searchCatalog(titles[ti]);
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
          console.log(`[AnimeAV1] Seleccionado: "${best.title}" score=${bestScore}`);
          mediaUrl = best.href;
        }
      }
      if (!mediaUrl) {
        console.log("[AnimeAV1] Sin resultados en búsqueda");
        return [];
      }
      var epUrl = null;
      if (wantMovie) {
        var mRes = yield fetch(mediaUrl, { headers: HEADERS, redirect: "follow" });
        if (!mRes.ok)
          return [];
        var mHtml = yield mRes.text();
        var epLinks = [];
        var epRe = /href="([^"]+?\/(\d+)\/?)"/g;
        var em;
        while ((em = epRe.exec(mHtml)) !== null) {
          if (em[1].indexOf(mediaUrl.split("?")[0].replace(/\/$/, "")) === 0 || em[1].charAt(0) === "/") {
            var full = em[1].charAt(0) === "/" ? BASE_URL + em[1] : em[1];
            if (epLinks.indexOf(full) === -1)
              epLinks.push(full);
          }
        }
        epUrl = epLinks.length ? epLinks[0] : mediaUrl.replace(/\/$/, "") + "/1";
        console.log(`[AnimeAV1] Película: ${epUrl}`);
      } else {
        epUrl = mediaUrl.replace(/\/$/, "") + "/" + parseInt(episode);
        console.log(`[AnimeAV1] Episodio: ${epUrl}`);
      }
      var eRes = yield fetch(epUrl, { headers: HEADERS, redirect: "follow" });
      if (!eRes.ok)
        return [];
      var embeds = parseEmbedsJson(yield eRes.text());
      if (!embeds) {
        console.log("[AnimeAV1] Sin embeds en episodio");
        return [];
      }
      var groups = [];
      if (embeds.DUB && embeds.DUB.length)
        groups.push({ lang: "Latino", list: embeds.DUB });
      if (embeds.SUB && embeds.SUB.length)
        groups.push({ lang: "Subtitulado", list: embeds.SUB });
      var streams = [];
      for (var gi = 0; gi < groups.length; gi++) {
        console.log(`[AnimeAV1] Resolviendo ${groups[gi].list.length} servidores (${groups[gi].lang})...`);
        var resolved = yield allSettled(groups[gi].list.map(function(s) { return processServer(s.server, s.url, groups[gi].lang, epUrl); }));
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
        if (streams.length)
          break;
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[AnimeAV1] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[AnimeAV1] Error: ${e.message}`);
      return [];
    }
  });
}
