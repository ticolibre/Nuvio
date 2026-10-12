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
var pelispedia_exports = {};
__export(pelispedia_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(pelispedia_exports);

// Pelispedia provider for Nuvio. Inspired by the CloudStream PelispediaProvider
// (search -> pelicula/serie pages -> trembed iframes -> fastream embeds).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://pelispedia.is";
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
  return (s || "").replace(/&amp;|&#038;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
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
// --- fastream resolver (same backend as seriesmetro) ---
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
  return __async(this, arguments, function* (m3u8Url, headers) {
    try {
      var res = yield fetch(m3u8Url, {
        headers: { "User-Agent": UA, "Referer": "https://fastream.to/" },
        redirect: "follow"
      });
      var data = yield res.text();
      if (data.indexOf("#EXT-X-STREAM-INF") === -1) {
        var match = m3u8Url.match(/[_-](\d{3,4})p/);
        return match ? match[1] + "p" : "Unknown";
      }
      var bestWidth = 0;
      var bestHeight = 0;
      var lines = data.split("\n");
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
        if (m) {
          var h = parseInt(m[2]);
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
function unpackPacker(data) {
  var match = data.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)\)\)/);
  if (!match)
    return null;
  var p = match[1];
  var a = parseInt(match[2]);
  var c = parseInt(match[3]);
  var k = match[4].split("|");
  while (c--) {
    if (k[c])
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
  }
  return p;
}
function resolveFastream(url, referer) {
  return __async(this, null, function* () {
    try {
      console.log(`[Pelispedia][Fastream] Resolviendo: ${url}`);
      var res = yield fetch(url, {
        headers: { "User-Agent": UA, "Referer": referer || BASE_URL + "/" },
        redirect: "follow"
      });
      var data = yield res.text();
      var unpacked = unpackPacker(data);
      if (!unpacked)
        return null;
      var m3u8m = unpacked.match(/file:"(https?:\/\/[^"]+\.m3u8[^"]*)"/);
      if (!m3u8m)
        return null;
      var quality = yield detectQuality(m3u8m[1]);
      console.log(`[Pelispedia][Fastream] URL encontrada (${quality})`);
      return {
        url: m3u8m[1],
        quality: quality,
        headers: { "User-Agent": UA, "Referer": "https://fastream.to/" }
      };
    } catch (e) {
      console.log(`[Pelispedia][Fastream] Error: ${e.message}`);
      return null;
    }
  });
}
// --- site parsing ---
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
function searchSite(query, wantMovie) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var artRe = /<article[\s\S]*?<\/article>/g;
      var m;
      while ((m = artRe.exec(html)) !== null) {
        var block = m[0];
        var hrefM = block.match(/<a[^>]+class="[^"]*lnk-blk[^"]*"[^>]*href="([^"]+)"/) || block.match(/href="([^"]+)"[^>]*class="[^"]*lnk-blk[^"]*"/) || block.match(/href="([^"]+)"/);
        var titleM = block.match(/entry-title[^>]*>([^<]+)/);
        if (!hrefM || !titleM)
          continue;
        var href = hrefM[1];
        if (href.charAt(0) === "/")
          href = BASE_URL + href;
        var isMovie = href.indexOf("/pelicula/") !== -1;
        var isSerie = href.indexOf("/serie/") !== -1;
        if (wantMovie && !isMovie)
          continue;
        if (!wantMovie && !isSerie)
          continue;
        out.push({ title: decodeHtml(titleM[1].trim()), href: href });
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function findBest(results, targets) {
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
function extractTrembeds(pageHtml) {
  var out = [];
  var re = /<iframe[^>]*(?:src|data-src)="(https?:[^"]*trembed[^"]*)"/gi;
  var m;
  while ((m = re.exec(pageHtml)) !== null) {
    var u = decodeHtml(m[1]);
    if (out.indexOf(u) === -1)
      out.push(u);
  }
  return out;
}
function resolveTrembed(trembedUrl, pageUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(trembedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": pageUrl },
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var im = html.match(/<iframe[^>]+src="(https?:[^"]+)"[^>]*>/i);
      if (!im)
        return null;
      var src = decodeHtml(im[1]);
      if (src.indexOf("fastream.to") === -1) {
        console.log(`[Pelispedia] Embed no-fastream: ${src.substring(0, 70)}`);
        return null;
      }
      return yield resolveFastream(src, pageUrl);
    } catch (e) {
      return null;
    }
  });
}
function getSeasonPosts(serieHtml) {
  var out = [];
  var re = /data-post="(\d+)"[^>]*data-season="(\d+)"|data-season="(\d+)"[^>]*data-post="(\d+)"/g;
  var m;
  while ((m = re.exec(serieHtml)) !== null) {
    var post = m[1] || m[4];
    var season = m[2] || m[3];
    out.push({ post: post, season: season });
  }
  return out;
}
function fetchSeasonEpisodes(post, seasonNum) {
  return __async(this, null, function* () {
    try {
      var body = "action=action_select_season&season=" + encodeURIComponent(seasonNum) + "&post=" + encodeURIComponent(post);
      var res = yield fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Accept": "*/*",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": BASE_URL + "/"
        },
        body: body,
        redirect: "follow"
      });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var re = /href="([^"]*temporada[^"]*)"/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        var u = m[1];
        if (u.charAt(0) === "/")
          u = BASE_URL + u;
        if (out.indexOf(u) === -1)
          out.push(u);
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function matchEpisodeUrl(urls, season, episode) {
  for (var i = 0; i < urls.length; i++) {
    var m = urls[i].match(/temporada(?:\/|-)(\d+)(?:\/capitulo\/|-capitulo-)(\d+)/);
    if (m && parseInt(m[1]) === parseInt(season) && parseInt(m[2]) === parseInt(episode))
      return urls[i];
  }
  return null;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    var startTime = Date.now();
    console.log(`[Pelispedia] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      var wantMovie = mediaType === "movie";
      var titles = yield getTmdbTitles(tmdbId, mediaType);
      if (!titles.length) {
        console.log("[Pelispedia] Sin títulos TMDB");
        return [];
      }
      var pageUrl = null;
      for (var ti = 0; ti < titles.length && !pageUrl; ti++) {
        var results = yield searchSite(titles[ti], wantMovie);
        if (!results.length)
          continue;
        var best = findBest(results, titles);
        if (best) {
          console.log(`[Pelispedia] Seleccionado: "${best.title}"`);
          pageUrl = best.href;
        }
      }
      if (!pageUrl) {
        console.log("[Pelispedia] Sin resultados en búsqueda");
        return [];
      }
      var targetPages = [];
      if (wantMovie) {
        targetPages.push(pageUrl);
      } else {
        var sRes = yield fetch(pageUrl, { headers: HEADERS, redirect: "follow" });
        if (!sRes.ok)
          return [];
        var serieHtml = yield sRes.text();
        var seasonPosts = getSeasonPosts(serieHtml);
        if (!seasonPosts.length) {
          console.log("[Pelispedia] Sin temporadas");
          return [];
        }
        var epLists = yield Promise.all(seasonPosts.map(function(sp) { return fetchSeasonEpisodes(sp.post, sp.season); }));
        var epUrls = [];
        for (var ei = 0; ei < epLists.length; ei++)
          epUrls = epUrls.concat(epLists[ei]);
        var epUrl = matchEpisodeUrl(epUrls, season, episode);
        if (!epUrl) {
          console.log("[Pelispedia] Episodio no encontrado");
          return [];
        }
        console.log(`[Pelispedia] Episodio: ${epUrl}`);
        targetPages.push(epUrl);
      }
      var streams = [];
      for (var pi = 0; pi < targetPages.length; pi++) {
        var pRes = yield fetch(targetPages[pi], { headers: HEADERS, redirect: "follow" });
        if (!pRes.ok)
          continue;
        var trembeds = extractTrembeds(yield pRes.text());
        if (!trembeds.length) {
          console.log("[Pelispedia] Sin reproductores en página");
          continue;
        }
        console.log(`[Pelispedia] ${trembeds.length} reproductores`);
        var resolved = yield allSettled(trembeds.map(function(t) { return resolveTrembed(t, targetPages[pi]); }));
        for (var ri = 0; ri < resolved.length; ri++) {
          if (resolved[ri].status !== "fulfilled" || !resolved[ri].value)
            continue;
          var r = resolved[ri].value;
          var dup = false;
          for (var di = 0; di < streams.length; di++) {
            if (streams[di].url === r.url) {
              dup = true;
              break;
            }
          }
          if (!dup) {
            streams.push({
              name: "Pelispedia",
              title: `${r.quality || "Unknown"} · Latino · Fastream`,
              url: r.url,
              quality: r.quality || "Unknown",
              headers: r.headers || {}
            });
          }
        }
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[Pelispedia] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[Pelispedia] Error: ${e.message}`);
      return [];
    }
  });
}
