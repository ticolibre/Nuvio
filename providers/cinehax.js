"use strict";

// CineHax provider for Nuvio Latam+.
//
// Source: https://cinehax.org (VideoAPI-generated site, "popr" theme).
// Chain:  TMDB id -> https://videoapp.mov/e/movie/{tmdb}
//                    https://videoapp.mov/e/tv/{tmdb}/{season}/{episode}
//         -> <iframe src="https://vimeos.net/embed-XXXX.html?cf=...">
//         -> master m3u8 (sNN.vimeos.net/... .urlset/master.m3u8)
//
// videoapp.mov is keyed by TMDB id, so no catalogue search is needed: it
// answers for titles that cinehax.org does not list, and the REST API on the
// site returns the same player_url. It does require a Referer header, and
// vimeos.net requires Referer https://videoapp.mov/. The m3u8 itself plays
// with only a User-Agent.
//
// Independent implementation for this repo: no require(), Hermes-safe
// (no URL/URLSearchParams, no matchAll, no optional chaining, no async/await).

var BASE = "https://cinehax.org";
var PLAYER = "https://videoapp.mov";
var VIMEOS = "https://vimeos.net";
var UA = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
      return { body: body, url: (res && res.url) || url };
    });
  });
}

function unescapeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\\//g, "/");
}

function playerUrlFor(tmdbId, isMovie, season, episode) {
  if (isMovie) return PLAYER + "/e/movie/" + encodeURIComponent(String(tmdbId));
  return (
    PLAYER + "/e/tv/" + encodeURIComponent(String(tmdbId)) +
    "/" + encodeURIComponent(String(season)) +
    "/" + encodeURIComponent(String(episode))
  );
}

function extractIframe(body) {
  var match = String(body || "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  var src = unescapeHtml(match[1]).trim();
  if (!/^https?:\/\//i.test(src)) return null;
  return src;
}

function extractMasters(body) {
  var text = unescapeHtml(body);
  var found = [];
  var seen = {};
  var re = /https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*/gi;
  var match;
  while ((match = re.exec(text)) !== null) {
    var url = match[0];
    if (seen[url]) continue;
    seen[url] = true;
    found.push(url);
  }
  return found;
}

function pickMaster(list) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (/master\.m3u8/i.test(list[i])) return list[i];
  }
  for (i = 0; i < list.length; i++) {
    if (/\.urlset/i.test(list[i])) return list[i];
  }
  return list[0];
}

function qualityLabel(height) {
  if (!height) return "HD";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  if (height >= 360) return "360p";
  return "HD";
}

// Reads the master playlist only to learn the best resolution (1-2 KB).
function qualityOf(masterUrl) {
  return fetchText(masterUrl, null)
    .then(function (master) {
      var best = 0;
      var re = /RESOLUTION=\d+x(\d+)/g;
      var match;
      while ((match = re.exec(master.body)) !== null) {
        var height = parseInt(match[1], 10);
        if (height > best && height <= 2160) best = height;
      }
      return qualityLabel(best);
    })
    .catch(function () {
      return "HD";
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) return Promise.resolve([]);
  var isMovie = mediaType === "movie";
  if (!isMovie && (!season || !episode)) return Promise.resolve([]);

  var started = Date.now();
  var playerUrl = playerUrlFor(tmdbId, isMovie, season, episode);
  log(
    "Buscando: TMDB " + tmdbId + " (" + mediaType + ")" +
    (isMovie ? "" : " S" + season + "E" + episode)
  );

  return fetchText(playerUrl, BASE + "/")
    .then(function (player) {
      var iframe = extractIframe(player.body);
      if (!iframe) {
        log("Player sin embed (no disponible)");
        return null;
      }
      log("Embebido: " + iframe.slice(0, 60) + "...");
      return fetchText(iframe, PLAYER + "/").then(function (embed) {
        var masters = extractMasters(embed.body);
        if (!masters.length) {
          log("Embed sin m3u8");
          return null;
        }
        return pickMaster(masters);
      });
    })
    .then(function (masterUrl) {
      if (!masterUrl) return [];
      return qualityOf(masterUrl).then(function (quality) {
        log("Encontrado: " + quality + " en " + (Date.now() - started) + " ms");
        return [
          {
            name: "CineHax",
            title: quality + " · Latino · Vimeos",
            url: masterUrl,
            quality: quality,
            headers: { "User-Agent": UA }
          }
        ];
      });
    })
    .catch(function (error) {
      log("Error: " + ((error && error.message) || error));
      return [];
    });
}

module.exports = { getStreams: getStreams };
