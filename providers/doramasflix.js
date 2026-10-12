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
var doramasflix_exports = {};
__export(doramasflix_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(doramasflix_exports);

// DoramasFlix provider for Nuvio. Inspired by the CloudStream
// DoramasFlixProvider (GraphQL API: searchAll -> detail/listSeasons/episodes
// -> links_online -> resolvers).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var GQL = "https://doraflix.fluxcedene.net/api/gql";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var GQL_HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json",
  "Content-Type": "application/json; charset=utf-8"
};
var LANG_PRIORITY = ["LAT", "ESP", "SUB"];
var LANG_LABELS = { "LAT": "Latino", "ESP": "Español", "SUB": "Subtitulado" };
var LANG_IDS = {
  "13109": "Coreano",
  "13110": "Japonés",
  "13111": "Mandarín",
  "13112": "Tailandés",
  "37": "ESP",
  "38": "LAT",
  "192": "SUB"
};
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
function hyphenate(title) {
  return normalize(title).replace(/\s+/g, "-");
}
function scoreName(candidate, targets) {
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
        headers: { "User-Agent": UA, "Referer": "https://doramasflix.co/", "Accept": "text/html" },
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
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://doramasflix.co/" },
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
      return null;
    }
  });
}
function resolveGoodstream(embedUrl) {
  return __async(this, null, function* () {
    try {
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
      return null;
    }
  });
}
function resolveOkru(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[DoramasFlix][OkRu] Resolviendo: ${embedUrl}`);
      var raw = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://ok.ru/" },
        redirect: "follow"
      }).then(function(r) { return r.text(); });
      if (raw.indexOf("copyrightsRestricted") !== -1 || raw.indexOf("COPYRIGHTS_RESTRICTED") !== -1 || raw.indexOf("LIMITED_ACCESS") !== -1 || raw.indexOf("notFound") !== -1 || raw.indexOf("urls") === -1) {
        console.log("[DoramasFlix][OkRu] Video no disponible o eliminado");
        return null;
      }
      var data = raw.replace(/\\&quot;/g, '"').replace(/\\u0026/g, "&").replace(/\\/g, "");
      var re = /"name":"([^"]+)","url":"([^"]+)"/g;
      var m;
      var videos = [];
      while ((m = re.exec(data)) !== null) {
        var type = m[1];
        var url = m[2];
        if (type.toLowerCase().indexOf("mobile") === -1 && url.indexOf("http") === 0)
          videos.push({ type: type, url: url });
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
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[DoramasFlix][MixDrop] Resolviendo: ${embedUrl}`);
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
      console.log(`[DoramasFlix][MixDrop] Error: ${e.message}`);
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
  if (low.indexOf("ok.ru") !== -1)
    return { fn: resolveOkru, label: "OkRu" };
  if (low.indexOf("streamwish.") !== -1 || low.indexOf("strwish.") !== -1 || low.indexOf("hlswish.") !== -1 || low.indexOf("hglink.to") !== -1 || low.indexOf("vibuxer.") !== -1)
    return { fn: resolveStreamwish, label: "StreamWish" };
  if (low.indexOf("vidhide") !== -1 || low.indexOf("filelions.") !== -1 || low.indexOf("dintezuvio.") !== -1)
    return { fn: resolveVidhide, label: "VidHide" };
  if (low.indexOf("mixdrop") !== -1)
    return { fn: resolveMixdrop, label: "MixDrop" };
  return null;
}
function langInfo(langId) {
  var code = LANG_IDS[String(langId || "")];
  if (code === "LAT" || code === "ESP" || code === "SUB")
    return { code: code, label: LANG_LABELS[code] };
  if (code)
    return { code: "OTR", label: code };
  return { code: "OTR", label: String(langId || "Online") };
}
// --- GraphQL API ---
function gqlOp(operationName, variables, query) {
  return __async(this, null, function* () {
    var res = yield fetch(GQL, {
      method: "POST",
      headers: GQL_HEADERS,
      body: JSON.stringify({ operationName: operationName, variables: variables, query: query }),
      redirect: "follow"
    });
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}
var Q_SEARCH = "query searchAll($input: String!) {\n  searchDorama(input: $input, limit: 5) {\n    _id\n    slug\n    name\n    name_es\n    poster_path\n    isTVShow\n    poster\n    __typename\n  }\n  searchMovie(input: $input, limit: 5) {\n    _id\n    name\n    name_es\n    slug\n    poster_path\n    poster\n    __typename\n  }\n}";
var Q_DETAIL_MOVIE = "query detailMovieExtra($slug: String!) {\n  detailMovie(filter: {slug: $slug}) {\n    name\n    name_es\n    links_online\n  }\n}";
var Q_LIST_SEASONS = "query listSeasons($serie_id: MongoID!) {\n  listSeasons(sort: NUMBER_ASC, filter: {serie_id: $serie_id}) {\n    slug\n    season_number\n  }\n}";
var Q_LIST_EPISODES = "query listEpisodesPagination($page: Int!, $serie_id: MongoID!, $season_number: Float!) {\n  paginationEpisode(\n    page: $page\n    perPage: 1000\n    sort: NUMBER_ASC\n    filter: {type_serie: \"dorama\", serie_id: $serie_id, season_number: $season_number}\n  ) {\n       items {\n      _id\n      name\n      episode_number\n      season_number\n      slug\n    }\n    pageInfo {\n      hasNextPage\n    }\n  }\n}";
var Q_EP_LINKS = "query GetEpisodeLinks($episode_slug: String!) {\n  detailEpisode(filter: {slug: $episode_slug, type_serie: \"dorama\"}) {\n    links_online\n   }\n}";
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
function processLink(link, langId) {
  return __async(this, null, function* () {
    try {
      if (!link || link.indexOf("http") !== 0 || link.indexOf("magnet:") === 0)
        return null;
      var r = getResolver(link);
      if (!r) {
        console.log(`[DoramasFlix] Sin resolver: ${link.substring(0, 70)}`);
        return null;
      }
      var result = yield r.fn(link);
      if (!result || !result.url)
        return null;
      var li = langInfo(langId);
      return {
        name: "DoramasFlix",
        title: `${result.quality || "HD"} · ${li.label} · ${r.label}`,
        url: result.url,
        quality: result.quality || "HD",
        lang: li.code,
        headers: result.headers || {}
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveLinks(links) {
  return __async(this, null, function* () {
    var order = LANG_PRIORITY.concat(["OTR"]);
    var streams = [];
    for (var li = 0; li < order.length; li++) {
      var code = order[li];
      var group = links.filter(function(l) { return langInfo(l.lang).code === code; });
      if (!group.length)
        continue;
      console.log(`[DoramasFlix] Resolviendo ${group.length} links (${code})...`);
      var resolved = yield allSettled(group.map(function(l) { return processLink(l.link, l.lang); }));
      var valid = [];
      for (var vi = 0; vi < resolved.length; vi++) {
        if (resolved[vi].status === "fulfilled" && resolved[vi].value)
          valid.push(resolved[vi].value);
      }
      if (valid.length) {
        streams = valid;
        console.log(`[DoramasFlix] ✓ Streams en ${code}, omitiendo resto`);
        break;
      }
    }
    return streams;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[DoramasFlix] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      var wantMovie = mediaType === "movie";
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[DoramasFlix] Sin títulos TMDB");
        return [];
      }
      var queries = [];
      for (var qi = 0; qi < titles.length; qi++) {
        if (queries.indexOf(titles[qi]) === -1)
          queries.push(titles[qi]);
        var hy = hyphenate(titles[qi]);
        if (hy && queries.indexOf(hy) === -1)
          queries.push(hy);
      }
      var candidates = [];
      for (var sqi = 0; sqi < queries.length; sqi++) {
        var sres = null;
        try {
          sres = yield gqlOp("searchAll", { input: queries[sqi] }, Q_SEARCH);
        } catch (e) {
          continue;
        }
        var sdata = (sres && sres.data) || {};
        var lists = (sdata.searchDorama || []).concat(sdata.searchMovie || []);
        for (var ci = 0; ci < lists.length; ci++) {
          var item = lists[ci] || {};
          var isMovie = item.__typename === "Movie";
          if (wantMovie && !isMovie)
            continue;
          if (!wantMovie && isMovie)
            continue;
          var dup = false;
          for (var di = 0; di < candidates.length; di++) {
            if (candidates[di]._id && candidates[di]._id === item._id) {
              dup = true;
              break;
            }
          }
          if (!dup)
            candidates.push(item);
        }
      }
      if (!candidates.length) {
        console.log("[DoramasFlix] Sin resultados en búsqueda");
        return [];
      }
      var names = titles.slice();
      var best = null;
      var bestScore = -9999;
      for (var bi = 0; bi < candidates.length; bi++) {
        var cands = [candidates[bi].name, candidates[bi].name_es].filter(Boolean);
        var sc = -9999;
        for (var ni = 0; ni < cands.length; ni++) {
          var s2 = scoreName(cands[ni], names);
          if (s2 > sc)
            sc = s2;
        }
        if (sc > bestScore) {
          bestScore = sc;
          best = candidates[bi];
        }
      }
      if (!best || bestScore < 300) {
        console.log(`[DoramasFlix] Sin match suficiente (mejor: ${bestScore})`);
        return [];
      }
      console.log(`[DoramasFlix] Seleccionado: "${best.name}" score=${bestScore}`);
      var links = [];
      if (wantMovie) {
        var dres = yield gqlOp("detailMovieExtra", { slug: best.slug }, Q_DETAIL_MOVIE);
        var dm = (dres && dres.data && dres.data.detailMovie) || {};
        links = dm.links_online || [];
      } else {
        var seasonsRes = yield gqlOp("listSeasons", { serie_id: best._id }, Q_LIST_SEASONS);
        var seasons = ((seasonsRes && seasonsRes.data && seasonsRes.data.listSeasons) || []);
        var targetSeason = null;
        for (var si = 0; si < seasons.length; si++) {
          if (parseInt(seasons[si].season_number) === parseInt(season)) {
            targetSeason = seasons[si];
            break;
          }
        }
        var seasonList = targetSeason ? [targetSeason] : seasons;
        var epSlug = null;
        for (var sj = 0; sj < seasonList.length && !epSlug; sj++) {
          var sn = seasonList[sj].season_number;
          var page = 1;
          var hasNext = true;
          var guard = 0;
          while (hasNext && guard < 5 && !epSlug) {
            guard++;
            var epres = yield gqlOp("listEpisodesPagination", { serie_id: best._id, season_number: sn, page: page }, Q_LIST_EPISODES);
            var pag = (epres && epres.data && epres.data.paginationEpisode) || {};
            var items = pag.items || [];
            for (var ek = 0; ek < items.length; ek++) {
              if (parseInt(items[ek].season_number) === parseInt(season) && parseInt(items[ek].episode_number) === parseInt(episode)) {
                epSlug = items[ek].slug;
                break;
              }
            }
            hasNext = !!(pag.pageInfo && pag.pageInfo.hasNextPage);
            page++;
          }
        }
        if (!epSlug) {
          console.log("[DoramasFlix] Episodio no encontrado");
          return [];
        }
        var lres = yield gqlOp("GetEpisodeLinks", { episode_slug: epSlug }, Q_EP_LINKS);
        var dep = (lres && lres.data && lres.data.detailEpisode) || {};
        links = dep.links_online || [];
      }
      if (!links.length) {
        console.log("[DoramasFlix] Sin links");
        return [];
      }
      console.log(`[DoramasFlix] ${links.length} links`);
      var streams = yield resolveLinks(links);
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[DoramasFlix] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[DoramasFlix] Error: ${e.message}`);
      return [];
    }
  });
}
