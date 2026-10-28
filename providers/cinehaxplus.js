"use strict";

// CineHax+ provider for Nuvio Latam+.
//
// Source: https://cinehaxplus.com (SSR, no login).
// Chain:  TMDB id -> site title search -> /pelicula|/serie page
//         -> data-embed + data-pass -> api-encrypted.moviemaster.lat/embed
//         -> PM_UI + PM_EMBED -> /servers -> /video -> HLS/DASH/MP4.
//
// Independent implementation for this repo: no require(), no cheerio,
// Hermes-safe (no URL/URLSearchParams, no matchAll, no optional chaining).
// The resolution approach was informed by the public "cinehax-plus" Kino
// plugin, which targets the same upstream site.

var BASE = "https://cinehaxplus.com";
var PLAYER_HOST = "https://api-encrypted.moviemaster.lat";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var UA = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36";

var MAX_SERVERS = 24;
var MAX_STREAMS = 10;
var BATCH_SIZE = 8;
// Soft budget for the server sweep. Nuvio/test harnesses cut the provider off
// at ~45 s, so return whatever has been verified instead of an empty timeout.
var TIME_BUDGET_MS = 36000;
var LANG_ORDER = { LAT: 0, ESP: 1, SUB: 2, ENG: 3 };
var LANG_LABEL = { LAT: "Latino", ESP: "Castellano", SUB: "Subtitulado", ENG: "Ingl\u00e9s" };

function log(msg) {
  try {
    console.log("[CineHax] " + msg);
  } catch (e) {}
}

function headersFor(referer) {
  var headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.5"
  };
  if (referer) headers.Referer = referer;
  return headers;
}

function fetchText(url, referer) {
  return fetch(url, { headers: headersFor(referer), redirect: "follow" }).then(function (res) {
    if (!res || (res.status && (res.status < 200 || res.status >= 300))) {
      throw new Error("http_" + (res && res.status));
    }
    return res.text().then(function (body) {
      return { body: body, url: res.url || url };
    });
  });
}

function fetchJson(url, referer) {
  return fetch(url, { headers: headersFor(referer), redirect: "follow" }).then(function (res) {
    if (!res || (res.status && (res.status < 200 || res.status >= 300))) {
      throw new Error("http_" + (res && res.status));
    }
    return res.json();
  });
}

function fetchChunk(url, referer, limit) {
  var headers = headersFor(referer);
  headers.Range = "bytes=0-" + (limit - 1);
  return fetch(url, { headers: headers, redirect: "follow" }).then(function (res) {
    if (!res || (res.status && (res.status < 200 || res.status >= 300))) {
      throw new Error("http_" + (res && res.status));
    }
    return res.text();
  });
}

function originOf(value) {
  var m = String(value || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : BASE;
}

function resolveUrl(base, relative) {
  var value = String(relative || "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.indexOf("//") === 0) return "https:" + value;
  var origin = originOf(base);
  if (value.charAt(0) === "/") return origin + value;
  var clean = base.split("?")[0].split("#")[0];
  var slash = clean.lastIndexOf("/");
  return clean.slice(0, slash + 1) + value;
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u00e1\u00e0\u00e4\u00e2\u00e3]/g, "a")
    .replace(/[\u00e9\u00e8\u00eb\u00ea]/g, "e")
    .replace(/[\u00ed\u00ec\u00ef\u00ee]/g, "i")
    .replace(/[\u00f3\u00f2\u00f6\u00f4]/g, "o")
    .replace(/[\u00fa\u00f9\u00fc\u00fb]/g, "u")
    .replace(/\u00f1/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseHref(value) {
  var m = String(value || "").match(/\/(pelicula|serie)\/([^\/?#]+)/);
  if (!m) return null;
  return { kind: m[1] === "pelicula" ? "movie" : "series", slug: m[2] };
}

function yearOf(value) {
  var m = String(value || "").match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// TMDB -> site title/slug
// ---------------------------------------------------------------------------
function getTmdbInfo(tmdbId, mediaType) {
  var kind = mediaType === "movie" ? "movie" : "tv";
  var url =
    "https://api.themoviedb.org/3/" + kind + "/" + encodeURIComponent(tmdbId) +
    "?api_key=" + TMDB_API_KEY +
    "&language=es-MX&append_to_response=alternative_titles";

  return fetch(url, { headers: { "User-Agent": UA } })
    .then(function (res) {
      if (!res || (res.status && (res.status < 200 || res.status >= 300))) return null;
      return res.json();
    })
    .then(function (data) {
      if (!data) return null;
      var titles = [];
      var main = data.title || data.name || "";
      var original = data.original_title || data.original_name || "";
      var alt = data.alternative_titles || {};
      var list = alt.titles || alt.results || [];
      var values = [main, original];
      for (var i = 0; i < list.length; i++) values.push(list[i] && list[i].title);

      for (var j = 0; j < values.length && titles.length < 8; j++) {
        var value = String(values[j] || "").trim();
        if (!value) continue;
        var exists = false;
        for (var k = 0; k < titles.length; k++) {
          if (norm(titles[k]) === norm(value)) {
            exists = true;
            break;
          }
        }
        if (!exists) titles.push(value);
      }

      var date = data.release_date || data.first_air_date || "";
      return { titles: titles, year: yearOf(date) };
    })
    .catch(function () {
      return null;
    });
}

function searchSite(text) {
  var url = BASE + "/api/suggest?q=" + encodeURIComponent(text);
  return fetchJson(url, BASE + "/")
    .then(function (data) {
      return data && Array.isArray(data.titles) ? data.titles : [];
    })
    .catch(function () {
      return [];
    });
}

function scoreTitle(item, info, isMovie, index) {
  var where = parseHref(item && item.url);
  if (!where) return -1;
  if (isMovie && where.kind !== "movie") return -1;
  if (!isMovie && where.kind !== "series") return -1;

  var title = item.title || where.slug.replace(/-/g, " ");
  var n = norm(title);
  var score = 10;
  var i;

  for (i = 0; i < info.titles.length; i++) {
    var q = norm(info.titles[i]);
    if (!q) continue;
    if (n === q) {
      score += 100;
      break;
    }
    if (n.indexOf(q) === 0 || q.indexOf(n) === 0) {
      score += 45;
    } else if (n.indexOf(q) >= 0 || q.indexOf(n) >= 0) {
      score += 25;
    }
  }

  var itemYear = parseInt(String(item.year || ""), 10) || 0;
  if (info.year && itemYear) {
    var diff = Math.abs(info.year - itemYear);
    if (diff === 0) score += 60;
    else if (diff === 1) score += 30;
    else if (diff <= 2) score += 5;
    else score -= 25;
  }

  // The site's own relevance order is a useful tiebreaker.
  score += Math.max(0, 12 - index * 2);
  return score;
}

function pickMatch(items, info, isMovie) {
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < items.length; i++) {
    var score = scoreTitle(items[i], info, isMovie, i);
    if (score > bestScore) {
      bestScore = score;
      best = items[i];
    }
  }
  if (best && bestScore >= 35) return best;
  return null;
}

function selectTitle(info, isMovie) {
  var index = 0;
  var best = null;
  var bestScore = -1;

  function next() {
    if (index >= info.titles.length || index >= 5) {
      return Promise.resolve(bestScore >= 25 ? best : null);
    }
    var title = info.titles[index++];
    return searchSite(title).then(function (items) {
      var match = pickMatch(items, info, isMovie);
      if (match) {
        var score = scoreTitle(match, info, isMovie, 0);
        if (score > bestScore) {
          bestScore = score;
          best = match;
        }
        if (score >= 100) return match;
      }
      return next();
    });
  }

  return next();
}

// ---------------------------------------------------------------------------
// Site page -> player handshake
// ---------------------------------------------------------------------------
function fetchWatchPage(slug, isMovie, season, episode) {
  var url;
  if (isMovie) {
    url = BASE + "/pelicula/" + slug;
  } else {
    url = BASE + "/serie/" + slug + "/temporada/" + season + "/episodio/" + episode;
  }

  return fetchText(url, BASE + "/").then(function (page) {
    if (page.body.indexOf("data-embed=") >= 0) return page.body;
    if (isMovie) return null;

    // Some series pages only expose episode links from the season page.
    var seasonUrl = BASE + "/serie/" + slug + "/temporada/" + season;
    return fetchText(seasonUrl, BASE + "/")
      .then(function (seasonPage) {
        var re = new RegExp("/serie/" + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/temporada/" + season + "/episodio/(\\d+)", "g");
        var m;
        var found = null;
        while ((m = re.exec(seasonPage.body)) !== null) {
          if (parseInt(m[1], 10) === parseInt(episode, 10)) {
            found = BASE + "/serie/" + slug + "/temporada/" + season + "/episodio/" + m[1];
            break;
          }
        }
        if (!found) return null;
        return fetchText(found, BASE + "/").then(function (episodePage) {
          return episodePage.body;
        });
      })
      .catch(function () {
        return null;
      });
  });
}

function parseEmbed(page) {
  var re = /data-embed="([^"]+)"/g;
  var m;
  while ((m = re.exec(String(page || ""))) !== null) {
    var tag = decodeEntities(m[1]);
    var src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
    var pass = (tag.match(/\sdata-pass="([^"]+)"/) || [])[1];
    if (!src || !pass) continue;
    if (!/\/embed\/(movie|tv)\//.test(src)) continue;
    src = String(src).replace(/https?:\/\/dm-api\.invalid\b/i, PLAYER_HOST);
    return { src: resolveUrl(BASE, src), pass: resolveUrl(BASE, pass) };
  }
  return null;
}

function embFromSrc(src) {
  var m = String(src || "").match(/\/embed\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?/);
  if (!m) return null;
  var emb = { type: m[1], tmdb: parseInt(m[2], 10) };
  if (m[1] === "tv") {
    emb.season = parseInt(m[3] || "1", 10) || 1;
    emb.episode = parseInt(m[4] || "1", 10) || 1;
  }
  var lang = (String(src || "").match(/[?&]lang=([A-Za-z]{3})/) || [])[1];
  if (lang) emb.lang = lang;
  return emb;
}

function getPass(passUrl) {
  return fetchJson(passUrl, BASE + "/").then(function (data) {
    return data && typeof data.pass === "string" ? data.pass : null;
  });
}

function getPlayerConfig(src, pass) {
  var sep = src.indexOf("?") >= 0 ? "&" : "?";
  var url = src + sep + "pass=" + encodeURIComponent(pass);

  return fetchText(url, BASE + "/").then(function (page) {
    var ui = (page.body.match(/PM_UI="([^"]+)"/) || [])[1];
    var emb = null;
    var raw = (page.body.match(/PM_EMBED=(\{[^}]+\})/) || [])[1];
    if (raw) {
      try {
        emb = JSON.parse(raw);
      } catch (e) {
        emb = null;
      }
    }
    if (!emb) emb = embFromSrc(src);
    if (!ui || !emb) return null;
    return { ui: ui, emb: emb, origin: originOf(src) };
  });
}

function playerParams(emb) {
  var value = "tmdb=" + encodeURIComponent(emb.tmdb) + "&type=" + encodeURIComponent(emb.type);
  if (emb.type === "tv") {
    value += "&season=" + encodeURIComponent(emb.season || 1);
    value += "&episode=" + encodeURIComponent(emb.episode || 1);
  }
  return value;
}

function getServers(config) {
  var url = config.origin + "/servers?" + playerParams(config.emb) + "&ui=" + encodeURIComponent(config.ui);
  return fetchJson(url, config.origin + "/").then(function (data) {
    return data && Array.isArray(data.servers) ? data.servers : [];
  });
}

function sortServers(servers) {
  var list = servers.slice();
  list.sort(function (a, b) {
    var la = LANG_ORDER[String(a.lang || "").toUpperCase()];
    var lb = LANG_ORDER[String(b.lang || "").toUpperCase()];
    if (la === undefined) la = 9;
    if (lb === undefined) lb = 9;
    if (la !== lb) return la - lb;

    var da = a.mode === "proxy" ? 1 : 0;
    var db = b.mode === "proxy" ? 1 : 0;
    if (da !== db) return da - db;

    var ta = a.detras ? 1 : 0;
    var tb = b.detras ? 1 : 0;
    if (ta !== tb) return ta - tb;

    var sa = typeof a.src === "number" ? a.src : 9;
    var sb = typeof b.src === "number" ? b.src : 9;
    return sa - sb;
  });
  return list;
}

function getVideo(config, server) {
  var url =
    config.origin + "/video?" + playerParams(config.emb) +
    "&noiframe=1&embed=" + encodeURIComponent(server.id) +
    "&r=1&ui=" + encodeURIComponent(config.ui);
  return fetchJson(url, config.origin + "/").then(function (data) {
    return data && typeof data.url === "string" ? data : null;
  });
}

// ---------------------------------------------------------------------------
// HLS validation / quality
// ---------------------------------------------------------------------------
function isAdUrl(value) {
  return /tiktokcdn|ad-site|\/ad\//i.test(String(value || ""));
}

// Ad playlists on this player reuse a real VOD's duration, so a length check is
// useless. What gives them away is the segment host: every URI points at a
// TikTok ad CDN. Scanning the first few KB is enough and avoids downloading a
// 300-450 KB media playlist just to throw it away.
function isAdChunk(text) {
  var lines = String(text || "").split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.charAt(0) === "#") continue;
    if (isAdUrl(line)) return true;
  }
  return false;
}


function qualityFromHeight(height) {
  var h = Number(height) || 0;
  if (h >= 2160) return "4K";
  if (h >= 1080) return "1080p";
  if (h >= 720) return "720p";
  if (h >= 480) return "480p";
  if (h >= 360) return "360p";
  return "Auto";
}

function qualityFromUrl(url) {
  var m = String(url || "").match(/(?:^|[_-])(\d{3,4})p(?:[_.\/-]|$)/i);
  return m ? m[1] + "p" : "Auto";
}

function parseVariants(body, baseUrl) {
  var lines = String(body || "").split(/\r?\n/);
  var variants = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf("#EXT-X-STREAM-INF") !== 0) continue;
    var next = "";
    for (var j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].trim().charAt(0) !== "#") {
        next = lines[j].trim();
        break;
      }
    }
    if (!next) continue;
    var res = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    variants.push({
      url: resolveUrl(baseUrl, next),
      height: res ? parseInt(res[2], 10) : 0
    });
  }
  variants.sort(function (a, b) {
    return b.height - a.height;
  });
  return variants;
}

function probeMedia(url, referer) {
  return fetchChunk(url, referer, 8192)
    .then(function (text) {
      if (text.indexOf("#EXTM3U") < 0) return false;
      return !isAdChunk(text);
    })
    .catch(function () {
      return false;
    });
}

function inspectVariant(variants, index, url, referer) {
  if (index >= variants.length || index >= 3) return Promise.resolve(null);
  var candidate = variants[index];
  return probeMedia(candidate.url, referer).then(function (ok) {
    if (!ok) return inspectVariant(variants, index + 1, url, referer);
    return { quality: qualityFromHeight(candidate.height), url: url };
  });
}

function inspectStream(url, referer, type) {
  if (type === "mp4" || type === "dash") {
    return Promise.resolve({ quality: qualityFromUrl(url), url: url });
  }

  return fetchText(url, referer)
    .then(function (page) {
      var body = page.body;
      if (body.indexOf("#EXTM3U") < 0) return null;

      if (body.indexOf("#EXT-X-STREAM-INF") >= 0) {
        var variants = parseVariants(body, url);
        if (!variants.length) return { quality: "Auto", url: url };
        return inspectVariant(variants, 0, url, referer);
      }

      return probeMedia(url, referer).then(function (ok) {
        return ok ? { quality: qualityFromUrl(url), url: url } : null;
      });
    })
    .catch(function () {
      return null;
    });
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------
function langLabel(value) {
  var key = String(value || "").toUpperCase();
  return LANG_LABEL[key] || (key ? key : "");
}

function presentStream(server, stream, config) {
  var label = langLabel(server.lang);
  var source = server.name || "Servidor";
  return {
    name: "CineHax+ (" + source + ")",
    title: [stream.quality, label, "CineHax+"].filter(Boolean).join(" \u00b7 "),
    url: stream.url,
    quality: stream.quality,
    headers: { "User-Agent": UA, "Referer": config.origin + "/" }
  };
}

function probeServer(config, server) {
  return getVideo(config, server)
    .then(function (video) {
      if (!video || !video.url || video.type === "iframe") return null;
      var type = String(video.type || "").toLowerCase();
      if (type !== "hls" && type !== "dash" && type !== "mp4") return null;
      return inspectStream(video.url, config.origin + "/", type).then(function (stream) {
        if (!stream || !stream.url) return null;
        return { server: server, stream: stream };
      });
    })
    .catch(function () {
      return null;
    });
}

// Worker pool: each slot takes the next server as soon as it frees up, so one
// slow upstream cannot stall a whole wave and the time budget is spent probing
// instead of waiting.
function sweepServers(config, servers, streams, seen, deadline) {
  var index = 0;

  function next() {
    if (index >= servers.length || streams.length >= MAX_STREAMS || Date.now() >= deadline) {
      return Promise.resolve();
    }
    var server = servers[index++];
    return probeServer(config, server).then(function (item) {
      if (item && item.stream && item.stream.url && !seen[item.stream.url]) {
        seen[item.stream.url] = true;
        streams.push(presentStream(item.server, item.stream, config));
      }
      return next();
    });
  }

  var workers = [];
  var size = Math.min(BATCH_SIZE, servers.length);
  for (var i = 0; i < size; i++) workers.push(next());

  return Promise.all(workers).then(function () {
    return streams;
  });
}

function withDeadline(promise, ms, fallback) {
  if (typeof setTimeout !== "function") return promise;
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      resolve(fallback());
    }, Math.max(0, ms));
    promise.then(
      function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback());
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) return Promise.resolve([]);
  if (mediaType === "tv" && (!season || !episode)) return Promise.resolve([]);

  var isMovie = mediaType === "movie";
  var started = Date.now();
  log("Buscando: TMDB " + tmdbId + " (" + mediaType + ")" + (isMovie ? "" : " S" + season + "E" + episode));

  return getTmdbInfo(tmdbId, mediaType)
    .then(function (info) {
      if (!info || !info.titles.length) throw new Error("sin metadatos de TMDB");
      return selectTitle(info, isMovie);
    })
    .then(function (match) {
      if (!match) throw new Error("sin coincidencia en el sitio");
      var where = parseHref(match.url);
      if (!where) throw new Error("URL de sitio inv\u00e1lida");
      log('Seleccionado: "' + (match.title || where.slug) + '" (' + (match.year || "s/f") + ")");
      return fetchWatchPage(where.slug, isMovie, season, episode);
    })
    .then(function (page) {
      if (!page) throw new Error("p\u00e1gina sin reproductor");
      var embed = parseEmbed(page);
      if (!embed) throw new Error("sin data-embed");
      return getPass(embed.pass).then(function (pass) {
        if (!pass) throw new Error("sin pass del reproductor");
        return getPlayerConfig(embed.src, pass);
      });
    })
    .then(function (config) {
      if (!config) throw new Error("sin PM_UI/PM_EMBED");
      return getServers(config).then(function (servers) {
        if (!servers.length) throw new Error("sin servidores");
        var usable = [];
        for (var i = 0; i < servers.length; i++) {
          var server = servers[i];
          if (!server || !server.id) continue;
          if (server.type === "iframe") continue;
          usable.push(server);
        }
        usable = sortServers(usable).slice(0, MAX_SERVERS);
        log(servers.length + " servidores, " + usable.length + " a probar");
        var collected = [];
        var deadline = started + TIME_BUDGET_MS;
        var sweep = sweepServers(config, usable, collected, {}, deadline);
        var left = TIME_BUDGET_MS - (Date.now() - started);
        return withDeadline(sweep, Math.max(10000, left), function () {
          log("Presupuesto agotado, devolviendo " + collected.length + " streams");
          return collected;
        });
      });
    })
    .then(function (streams) {
      var elapsed = ((Date.now() - started) / 1000).toFixed(2);
      log("\u2713 " + streams.length + " streams en " + elapsed + "s");
      return streams;
    })
    .catch(function (error) {
      log("Error: " + (error && error.message ? error.message : String(error)));
      return [];
    });
}

module.exports = { getStreams: getStreams };
