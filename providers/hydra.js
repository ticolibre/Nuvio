"use strict";

// Hydra provider for Nuvio Latam+.
//
// Source: https://hydra-torrent.noe359866.workers.dev (add-on de Stremio
// "Hydra", community.streamflix.es).
//
// Puente directo al add-on: TMDB -> IMDb -> /stream/{movie|series}/...json.
// Solo se devuelven enlaces web/HLS/directos. Los torrents del add-on
// (entradas con infoHash y sin url) se descartan: Nuvio no tiene debrid.
//
// Hydra agrega contenido de otros add-ons. Como este plugin ya tiene los
// providers DeepFlix y Addon Latam por separado, aqui se ignoran sus enlaces
// (mg.homelabx.qzz.io y addonlatam.duckdns.org) para no duplicar opciones.
//
// Si algun dia quieres usar tu propia configuracion de Hydra (con debrid),
// cambia BASE_URL por tu URL configurada (https://host/<config>/manifest.json
// -> BASE_URL = "https://host/<config>").

var BASE_URL = "https://hydra-torrent.noe359866.workers.dev";
var PROVIDER_NAME = "Hydra";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// El add-on puede devolver ~100 opciones; sin debrid la mayoria son torrents.
// Tras quitar torrents, CAM y los enlaces de DeepFlix/Addon Latam quedan solo
// las fuentes propias de Hydra. Dejamos margen por si alguna vez son muchas.
var MAX_STREAMS = 50;

// Hosts que pertenecen a providers ya incluidos en este plugin.
// Hydra los relayea; se descartan para evitar streams duplicados.
var IGNORED_HOSTS = {
  "addonlatam.duckdns.org": "Addon Latam",
  "mg.homelabx.qzz.io": "DeepFlix"
};

// El add-on marca como "CAM" las copias grabadas en sala. Se descartan:
// son la peor calidad disponible.
var CAM_RE = /(?:^|[^a-z0-9])(?:cam|camrip|hdcam|hqcam)(?![a-z0-9])/i;

var HAS_TIMERS = typeof setTimeout === "function";

function log(msg) {
  try {
    console.log("[Hydra] " + msg);
  } catch (e) {}
}

function withTimeout(promise, ms) {
  if (!HAS_TIMERS) return promise;
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, ms);
    })
  ]);
}

function getImdbId(tmdbId, mediaType) {
  var endpoint =
    mediaType === "movie"
      ? "https://api.themoviedb.org/3/movie/" + encodeURIComponent(tmdbId) + "/external_ids?api_key=" + TMDB_API_KEY
      : "https://api.themoviedb.org/3/tv/" + encodeURIComponent(tmdbId) + "/external_ids?api_key=" + TMDB_API_KEY;

  return fetch(endpoint, { headers: { "User-Agent": UA }, redirect: "follow" })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      return data && data.imdb_id ? data.imdb_id : null;
    })
    .catch(function (e) {
      log("Error TMDB: " + (e && e.message ? e.message : String(e)));
      return null;
    });
}

function buildEndpoint(imdbId, mediaType, season, episode) {
  if (mediaType === "tv") {
    return BASE_URL + "/stream/series/" + imdbId + ":" + parseInt(season, 10) + ":" + parseInt(episode, 10) + ".json";
  }
  return BASE_URL + "/stream/movie/" + imdbId + ".json";
}

function hostFromUrl(url) {
  var m = String(url || "").match(/^https?:\/\/([^\/?#]+)/i);
  if (!m) return "";
  var host = m[1].toLowerCase().split(":")[0];
  return host.replace(/^www\./, "");
}

// Nombres legibles de los servidores que suele usar Hydra.
function friendlySource(host) {
  var h = String(host || "").toLowerCase();
  if (!h) return "";
  if (h.indexOf("goodstream.") !== -1) return "GoodStream";
  if (h.indexOf("okcdn.") !== -1) return "OK.ru";
  if (h === "vids.st") return "Vids.st";
  if (h.indexOf("pixeldrain.") !== -1) return "Pixeldrain";
  if (h.indexOf("hubcloud.") !== -1) return "HubCloud";
  if (h.indexOf("hubdrive.") !== -1) return "HubDrive";
  if (h.indexOf("mp4upload.") !== -1) return "MP4Upload";
  if (h.indexOf("vidcache.") !== -1) return "VidCache";
  if (h.indexOf("vidnest.") !== -1) return "Vidnest";
  if (h.indexOf("hakunaymatata.") !== -1) return "Hakuna";
  if (h.indexOf("111477.xyz") !== -1) return "111477";
  if (h.indexOf("cloudflarestorage.com") !== -1) return "Cloudflare";
  if (h.indexOf("workers.dev") !== -1) return "Worker";
  return h;
}

function pickQuality(text) {
  var t = String(text || "");
  if (/2160p|\b4k\b|\buhd\b/i.test(t)) return "4K";
  var m = t.match(/\b(1080p|720p|576p|480p|360p)\b/i);
  return m ? m[1].toLowerCase() : "HD";
}

function flatten(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean)
    .join(" · ");
}

function cleanFilename(filename) {
  return String(filename || "")
    .replace(/\.(mkv|mp4|avi|ts|m3u8|mpd)$/i, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Segunda linea del name de Hydra: "📡 HLS · 1080p Latino", "🔗 Directo · 4K".
// Se usa cuando el add-on no manda title ni filename.
function nameDetails(item) {
  var parts = String(item.name || "")
    .split(/\r?\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (parts.length > 0 && parts[0].toLowerCase() === PROVIDER_NAME.toLowerCase()) parts.shift();
  return parts.join(" · ");
}

// Hydra deja el marcador "Server" cuando no conoce el servidor final.
// Se sustituye por el host real del enlace.
function buildTitle(item, source) {
  var title = flatten(item.title);
  var filename = item.behaviorHints && item.behaviorHints.filename ? String(item.behaviorHints.filename) : "";

  if (!title) title = cleanFilename(filename);
  if (!title) title = nameDetails(item);
  if (!title) return source || PROVIDER_NAME;

  if (source) {
    if (/\bServer\b/i.test(title)) {
      title = title.replace(/\bServer\b/gi, source);
    } else if (title.toLowerCase().indexOf(source.toLowerCase()) === -1) {
      title = title + " · " + source;
    }
  }

  return title.replace(/\s*·\s*$/, "").trim() || source || PROVIDER_NAME;
}

function isCamOption(item) {
  if (!item) return false;
  var filename = item.behaviorHints && item.behaviorHints.filename ? String(item.behaviorHints.filename) : "";
  return CAM_RE.test(String(item.title || "") + " " + filename);
}

function mapStream(item) {
  if (!item || !item.url) return null; // torrent / infoHash: sin url jugable
  var url = String(item.url).trim();
  if (!/^https?:\/\//i.test(url)) return null;

  var host = hostFromUrl(url);
  var source = friendlySource(host);
  var details = String(item.name || "") + " " + String(item.title || "");
  var filename = item.behaviorHints && item.behaviorHints.filename ? item.behaviorHints.filename : "";
  var quality = pickQuality(details + " " + filename);

  return {
    name: source ? PROVIDER_NAME + " (" + source + ")" : PROVIDER_NAME,
    title: buildTitle(item, source),
    url: url,
    quality: quality,
    headers: { "User-Agent": UA }
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) return Promise.resolve([]);
  if (mediaType === "tv" && (!season || !episode)) return Promise.resolve([]);

  var started = Date.now();
  var ep = mediaType === "tv" ? " S" + season + "E" + episode : "";
  log("Buscando: TMDB " + tmdbId + " (" + mediaType + ")" + ep);

  return getImdbId(tmdbId, mediaType)
    .then(function (imdbId) {
      if (!imdbId) {
        log("Sin IMDb ID en TMDB");
        return [];
      }

      var endpoint = buildEndpoint(imdbId, mediaType, season, episode);
      log("Fetching: " + endpoint);

      return withTimeout(
        fetch(endpoint, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          redirect: "follow"
        }),
        20000
      )
        .then(function (res) {
          if (!res) {
            log("Timeout del add-on");
            return [];
          }
          if (!res.ok) {
            log("HTTP " + res.status);
            return [];
          }
          return res.json();
        })
        .then(function (data) {
          var list = data && Array.isArray(data.streams) ? data.streams : [];
          var streams = [];
          var seen = {};
          var torrents = 0;
          var cams = 0;
          var duplicated = 0;

          for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (!item) continue;
            if (!item.url) {
              torrents++;
              continue;
            }
            if (IGNORED_HOSTS[hostFromUrl(item.url)]) {
              duplicated++;
              continue;
            }
            if (isCamOption(item)) {
              cams++;
              continue;
            }

            var stream = mapStream(item);
            if (!stream) continue;
            if (seen[stream.url]) continue;
            seen[stream.url] = true;
            streams.push(stream);
          }

          if (torrents > 0) log(torrents + " torrent(s) descartado(s)");
          if (duplicated > 0) log(duplicated + " opcion(es) de Addon Latam/DeepFlix descartada(s)");
          if (cams > 0) log(cams + " opcion(es) CAM descartada(s)");

          var out = streams.slice(0, MAX_STREAMS);
          var elapsed = ((Date.now() - started) / 1000).toFixed(2);
          log("\u2713 " + out.length + " streams en " + elapsed + "s");
          return out;
        });
    })
    .catch(function (err) {
      log("Error: " + (err && err.message ? err.message : String(err)));
      return [];
    });
}

module.exports = { getStreams: getStreams };
