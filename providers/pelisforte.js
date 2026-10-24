"use strict";

// PelisForte provider for Nuvio Latam+.
//
// Source: https://www2.pelisforte.se (WordPress, "torofilm" theme).
// Chain:  detail page -> <div id="options-N"><iframe> -> mp4.nu wrapper
//         -> r.php redirect -> Okhd embed (packed JW Player config) -> HLS.
//
// Independent implementation for this repo: no require(), no cheerio,
// Hermes-safe (no URL/URLSearchParams, no matchAll, no optional chaining).
// The resolution approach was informed by the public "sky latino" plugin,
// which targets the same upstream site.

var BASE = "https://www2.pelisforte.se";
var UA = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

var MAX_OPTIONS = 6;
var MAX_STREAMS = 6;

var LANG_PRIORITY = { Latino: 0, Castellano: 1, Subtitulado: 2, "Español": 3 };

function log(msg) {
  try {
    console.log("[Pelisforte] " + msg);
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

// HEAD avoids downloading a multi-GB MP4 just to learn the final URL.
function fetchFinal(url, referer) {
  return fetch(url, { method: "HEAD", headers: headersFor(referer), redirect: "follow" })
    .then(function (res) {
      return {
        url: res.url || url,
        status: res.status,
        type: (res.headers && res.headers.get && res.headers.get("content-type")) || ""
      };
    })
    .catch(function () {
      return fetch(url, { headers: headersFor(referer), redirect: "follow" }).then(function (res) {
        try {
          if (res.body && res.body.cancel) res.body.cancel();
        } catch (e) {}
        return { url: res.url || url, status: res.status, type: "" };
      });
    });
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function htmlText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function originOf(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : BASE;
}

function getTmdb(tmdbId, mediaType) {
  var kind = mediaType === "movie" ? "movie" : "tv";
  var url =
    "https://api.themoviedb.org/3/" + kind + "/" + encodeURIComponent(tmdbId) +
    "?api_key=" + TMDB_API_KEY + "&language=es-MX&append_to_response=alternative_titles";

  return fetch(url)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data) return { titles: [], year: 0 };
      var titles = [];
      var main = data.title || data.name || "";
      var original = data.original_title || data.original_name || "";
      if (main) titles.push(main);
      if (original && titles.indexOf(original) < 0) titles.push(original);
      var alt = data.alternative_titles || {};
      var list = alt.titles || alt.results || [];
      for (var i = 0; i < list.length && titles.length < 8; i++) {
        var value = list[i] && list[i].title;
        if (value && titles.indexOf(value) < 0) titles.push(value);
      }
      var date = data.release_date || data.first_air_date || "";
      return { titles: titles, year: parseInt(String(date).slice(0, 4), 10) || 0 };
    });
}

function parseCards(html, wantSeries) {
  var wanted = wantSeries ? "/serie/" : "/pelicula/";
  var cards = [];
  var re = /<article[\s\S]*?<\/article>/g;
  var block;
  while ((block = re.exec(html))) {
    var seg = block[0];
    var href = seg.match(/href="(https:\/\/www2\.pelisforte\.se\/[^"]+)"/);
    if (!href || href[1].indexOf(wanted) < 0) continue;
    var heading = seg.match(/<h2[^>]*entry-title[^>]*>([\s\S]*?)<\/h2>/i);
    var year = seg.match(/<span class="year">(\d{4})<\/span>/i);
    cards.push({
      url: href[1],
      title: htmlText(heading ? heading[1] : ""),
      year: year ? parseInt(year[1], 10) : 0
    });
  }
  return cards;
}

function scoreCard(card, titles, year) {
  var candidate = norm(card.title);
  if (!candidate) return 0;
  var best = 0;
  for (var i = 0; i < titles.length; i++) {
    var wanted = norm(titles[i]);
    if (!wanted) continue;
    var score = 0;
    if (candidate === wanted) score = 100;
    else if (candidate.indexOf(wanted) >= 0 || wanted.indexOf(candidate) >= 0) score = 80;
    else {
      var words = wanted.split(" ");
      var hits = 0;
      for (var w = 0; w < words.length; w++) {
        if (words[w].length > 1 && candidate.indexOf(words[w]) >= 0) hits++;
      }
      var ratio = words.length ? hits / words.length : 0;
      if (ratio >= 0.7) score = 50 + Math.round(ratio * 20);
    }
    if (score > best) best = score;
  }
  if (best <= 0) return 0;
  if (year && card.year) {
    if (Math.abs(year - card.year) > 1) return 0;
    if (year === card.year) best += 10;
  }
  return best;
}

function pickCard(cards, titles, year) {
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < cards.length; i++) {
    var score = scoreCard(cards[i], titles, year);
    if (score > bestScore) {
      bestScore = score;
      best = cards[i];
    }
  }
  return bestScore >= 70 ? best : null;
}

function searchCards(title, wantSeries) {
  var url = BASE + "/?s=" + encodeURIComponent(title);
  return fetchText(url, BASE + "/").then(function (page) {
    return parseCards(page.body, wantSeries);
  });
}

function parseEpisodes(html) {
  var episodes = [];
  var seen = {};
  var re = /<article[\s\S]*?<\/article>/g;
  var block;
  while ((block = re.exec(html))) {
    var seg = block[0];
    var href = seg.match(/href="(https:\/\/www2\.pelisforte\.se\/episodio\/[^"]+)"/);
    if (!href || seen[href[1]]) continue;
    var num = seg.match(/<span class="num-epi">(\d+)x(\d+)<\/span>/i);
    var season = 0;
    var episode = 0;
    if (num) {
      season = parseInt(num[1], 10);
      episode = parseInt(num[2], 10);
    } else {
      var fromUrl = href[1].match(/-(\d+)x(\d+)\/?$/);
      if (!fromUrl) continue;
      season = parseInt(fromUrl[1], 10);
      episode = parseInt(fromUrl[2], 10);
    }
    seen[href[1]] = true;
    episodes.push({ season: season, episode: episode, url: href[1] });
  }
  return episodes;
}

function parseSeasons(html) {
  var seasons = [];
  var re = /data-season="(\d+)"/g;
  var m;
  while ((m = re.exec(html))) {
    var value = parseInt(m[1], 10);
    if (value > 0 && seasons.indexOf(value) < 0) seasons.push(value);
  }
  return seasons;
}

function parsePost(html) {
  var m = html.match(/data-post="(\d+)"/);
  return m ? m[1] : "";
}

// The site prints `var torofilm_Public = {...}` (capital P). Older snapshots
// used lowercase; accept both so season switching keeps working.
function parseAjax(html) {
  var m = html.match(/var\s+torofilm_[Pp]ublic\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    var conf = JSON.parse(m[1]);
    if (conf && conf.url && conf.content_nonce) {
      return { url: conf.url, nonce: conf.content_nonce };
    }
  } catch (e) {}
  return null;
}

function fetchSeason(ajax, post, season, referer) {
  var body =
    "action=action_select_season" +
    "&nonce=" + encodeURIComponent(ajax.nonce) +
    "&season=" + encodeURIComponent(season) +
    "&post=" + encodeURIComponent(post);

  var headers = headersFor(referer);
  headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  headers["X-Requested-With"] = "XMLHttpRequest";

  return fetch(ajax.url, { method: "POST", headers: headers, body: body, redirect: "follow" })
    .then(function (res) {
      if (!res || (res.status && (res.status < 200 || res.status >= 300))) return "";
      return res.text();
    })
    .catch(function () {
      return "";
    });
}

function findEpisode(seriesHtml, seriesUrl, season, episode) {
  var listed = parseEpisodes(seriesHtml);
  for (var i = 0; i < listed.length; i++) {
    if (listed[i].season === season && listed[i].episode === episode) return Promise.resolve(listed[i].url);
  }
  if (parseSeasons(seriesHtml).indexOf(season) < 0) return Promise.resolve("");

  var ajax = parseAjax(seriesHtml);
  var post = parsePost(seriesHtml);
  if (!ajax || !post) return Promise.resolve("");

  return fetchSeason(ajax, post, season, seriesUrl).then(function (fragment) {
    var more = parseEpisodes(fragment);
    for (var k = 0; k < more.length; k++) {
      if (more[k].season === season && more[k].episode === episode) return more[k].url;
    }
    return "";
  });
}

function parseOptions(html) {
  var labels = {};
  var reLabel = /href="#(options-\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = reLabel.exec(html))) labels[m[1]] = htmlText(m[2]);

  var options = [];
  var seen = {};
  var re = /<div id="(options-\d+)"[\s\S]{0,900}?<iframe[^>]*?(?:data-src|src)="([^"]+)"/g;
  while ((m = re.exec(html))) {
    if (seen[m[2]]) continue;
    seen[m[2]] = true;
    options.push({ id: m[1], url: m[2], label: labels[m[1]] || "" });
  }
  return options;
}

function languageOf(label) {
  if (/latino/i.test(label)) return "Latino";
  if (/castellano|españa/i.test(label)) return "Castellano";
  if (/subtitul/i.test(label)) return "Subtitulado";
  return "Español";
}

// Byse serves a React shell for .mp4 routes and DoodStream sits behind a
// Cloudflare challenge, so only Okhd can be resolved without a browser.
function serverOf(label) {
  if (/okhd/i.test(label)) return "Okhd";
  if (/byse/i.test(label)) return "Byse";
  if (/dood/i.test(label)) return "DoodStream";
  return "";
}

// Unpack Dean Edwards' p.a.c.k.e.r payload without executing it.
function unpack(text) {
  var marker = "eval(function(p,a,c,k,e,d)";
  var start = text.indexOf(marker);
  if (start < 0) return "";
  var argsAt = text.indexOf("}('", start);
  if (argsAt < 0) return "";

  var pos = argsAt + 2;
  var quote = text.charAt(pos);
  pos++;
  var raw = "";
  while (pos < text.length) {
    var ch = text.charAt(pos);
    if (ch === "\\") {
      raw += text.charAt(pos + 1);
      pos += 2;
      continue;
    }
    if (ch === quote) break;
    raw += ch;
    pos++;
  }
  pos++;

  var m = /^,(\d+),(\d+),(['"])([\s\S]*?)\3\.split/.exec(text.slice(pos, pos + 40000));
  if (!m) return "";

  var base = parseInt(m[1], 10);
  var count = parseInt(m[2], 10);
  var dict = m[4].split("|");
  var out = raw;
  for (var c = count - 1; c >= 0; c--) {
    if (!dict[c]) continue;
    out = out.replace(new RegExp("\\b" + c.toString(base) + "\\b", "g"), dict[c]);
  }
  return out;
}

function mediaUrls(text) {
  var decoded = String(text || "").replace(/\\\//g, "/");
  var packed = unpack(decoded);
  if (packed) decoded += "\n" + packed.replace(/\\\//g, "/");

  var found = [];
  var seen = {};
  var re = /(https?:)?\/\/[^"'\s\\)<>]+/g;
  var m;
  while ((m = re.exec(decoded))) {
    var url = m[0];
    if (url.indexOf("//") === 0) url = "https:" + url;
    if (!/\.(m3u8|mp4)(\?|#|$)/i.test(url)) continue;
    if (seen[url]) continue;
    seen[url] = true;
    found.push(url);
  }
  found.sort(function (a, b) {
    var am = /\.m3u8/i.test(a) ? 0 : 1;
    var bm = /\.m3u8/i.test(b) ? 0 : 1;
    return am - bm;
  });
  return found;
}

function probeQuality(url, referer) {
  if (!/\.m3u8/i.test(url)) return Promise.resolve("HD");
  return fetchText(url, referer)
    .then(function (page) {
      var best = 0;
      var re = /RESOLUTION=\d+x(\d+)/g;
      var m;
      while ((m = re.exec(page.body))) {
        var height = parseInt(m[1], 10);
        if (height > best) best = height;
      }
      return best ? best + "p" : "HD";
    })
    .catch(function () {
      return "HD";
    });
}

function resolveOption(option) {
  return fetchText(option.url, BASE + "/")
    .then(function (wrapper) {
      var loc = wrapper.body.match(/location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/);
      if (!loc) return null;
      var next = loc[1].indexOf("http") === 0 ? loc[1] : "https://mp4.nu/" + loc[1].replace(/^\//, "");

      return fetchFinal(next, option.url).then(function (head) {
        var finalUrl = head.url || "";
        if (!finalUrl) return null;

        if (/\.(mp4|m3u8)(\?|#|$)/i.test(finalUrl)) {
          return probeQuality(finalUrl, "https://okhd.nu/").then(function (quality) {
            return { url: finalUrl, quality: quality, referer: originOf(finalUrl) + "/" };
          });
        }

        // Okhd embed: packed player config. Referer must be mp4.nu.
        return fetchText(finalUrl, "https://mp4.nu/").then(function (embed) {
          var urls = mediaUrls(embed.body);
          if (!urls.length) return null;
          var master = urls[0];
          return probeQuality(master, originOf(finalUrl) + "/").then(function (quality) {
            return { url: master, quality: quality, referer: originOf(finalUrl) + "/" };
          });
        });
      });
    })
    .catch(function () {
      return null;
    });
}

function presentStream(result, language) {
  var quality = result.quality || "HD";
  return {
    name: "Pelisforte (Okhd)",
    title: quality + " · " + language + " · Okhd",
    url: result.url,
    quality: quality,
    headers: { "User-Agent": UA, Referer: result.referer }
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) return Promise.resolve([]);
  var isMovie = mediaType === "movie";
  if (!isMovie && (!season || !episode)) return Promise.resolve([]);

  var started = Date.now();
  log(
    "Buscando: TMDB " + tmdbId + " (" + mediaType + ")" +
    (isMovie ? "" : " S" + season + "E" + episode)
  );

  return getTmdb(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) {
        log("Sin títulos TMDB");
        return [];
      }

      var chain = Promise.resolve(null);
      var tryTitle = function (index) {
        if (index >= info.titles.length || index >= 4) return Promise.resolve(null);
        var title = info.titles[index];
        return searchCards(title, !isMovie)
          .then(function (cards) {
            var card = pickCard(cards, info.titles, info.year);
            if (card) return card;
            log('Sin coincidencia para "' + title + '"');
            return tryTitle(index + 1);
          })
          .catch(function () {
            return tryTitle(index + 1);
          });
      };
      chain = tryTitle(0);

      return chain.then(function (card) {
        if (!card) {
          log("Sin coincidencia en el sitio");
          return [];
        }
        log('Seleccionado: "' + card.title + '" (' + (card.year || "s/f") + ")");

        var pageUrl = Promise.resolve(card.url);
        if (!isMovie) {
          pageUrl = fetchText(card.url, BASE + "/").then(function (series) {
            return findEpisode(series.body, card.url, season, episode).then(function (episodeUrl) {
              return episodeUrl;
            });
          });
        }

        return pageUrl.then(function (url) {
          if (!url) {
            log("Episodio no disponible");
            return [];
          }
          return fetchText(url, BASE + "/").then(function (page) {
            if (/Video\s+Removed|video\s+(?:has\s+been\s+)?removed|Video source is unavailable/i.test(page.body)) {
              log("Sin servidores (video retirado)");
              return [];
            }

            var options = parseOptions(page.body);
            var usable = [];
            for (var i = 0; i < options.length; i++) {
              if (serverOf(options[i].label) !== "Okhd") continue;
              options[i].language = languageOf(options[i].label);
              usable.push(options[i]);
            }
            usable.sort(function (a, b) {
              var pa = LANG_PRIORITY[a.language];
              var pb = LANG_PRIORITY[b.language];
              if (pa === undefined) pa = 9;
              if (pb === undefined) pb = 9;
              var order = pa - pb;
              return order !== 0 ? order : a.id.localeCompare(b.id);
            });
            if (usable.length > MAX_OPTIONS) usable = usable.slice(0, MAX_OPTIONS);

            log(options.length + " opciones, " + usable.length + " resolubles (Okhd)");
            if (!usable.length) return [];

            var streams = [];
            var seen = {};
            var index = 0;

            var nextBatch = function () {
              if (index >= usable.length || streams.length >= MAX_STREAMS) return Promise.resolve(streams);
              var batch = usable.slice(index, index + 3);
              index += 3;
              return Promise.all(
                batch.map(function (option) {
                  return resolveOption(option).then(function (result) {
                    return result ? { result: result, language: option.language } : null;
                  });
                })
              ).then(function (results) {
                for (var r = 0; r < results.length; r++) {
                  var item = results[r];
                  if (!item || !item.result || !item.result.url) continue;
                  if (seen[item.result.url]) continue;
                  seen[item.result.url] = true;
                  streams.push(presentStream(item.result, item.language));
                }
                return nextBatch();
              });
            };

            return nextBatch().then(function (found) {
              log("✓ " + found.length + " streams en " + ((Date.now() - started) / 1000).toFixed(1) + "s");
              return found;
            });
          });
        });
      });
    })
    .catch(function (error) {
      log("Error: " + (error && error.message ? error.message : String(error)));
      return [];
    });
}

module.exports = { getStreams: getStreams };
