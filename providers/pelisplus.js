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
var pelisplus_exports = {};
__export(pelisplus_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(pelisplus_exports);
// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

// Pelisplus provider for Nuvio. Inspired by the CloudStream PelisplusHDProvider
// (search -> pelicula/serie pages -> video[] embeds: embed69 / xupalace).
// Hermes-safe: no require(), no URL/URLSearchParams, no allSettled/any/matchAll.
// Embed69 links are resolved with a self-contained SHA-256 + AES-256-CBC
// implementation (no crypto-js dependency).
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://pelisplushd.bz";
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
// --- SHA-256 (bytes in, bytes out) ---
function utf8Bytes(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) {
      out.push(c);
    } else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else if (c >= 55296 && c <= 56319 && i + 1 < str.length && str.charCodeAt(i + 1) >= 56320 && str.charCodeAt(i + 1) <= 57343) {
      var hi = c, lo = str.charCodeAt(++i);
      var cp = ((hi - 55296) << 10) + (lo - 56320) + 65536;
      out.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return out;
}
var SHA256_K = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
  3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
  3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
  2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
  666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
  2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
  430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
  1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
];
function sha256Bytes(msgBytes) {
  var h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  var h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  var ml = msgBytes.length;
  var bitLenHi = Math.floor(ml / 536870912), bitLenLo = ml << 3;
  var msg = msgBytes.slice();
  msg.push(128);
  while (msg.length % 64 !== 56)
    msg.push(0);
  msg.push(bitLenHi >>> 24 & 255, bitLenHi >>> 16 & 255, bitLenHi >>> 8 & 255, bitLenHi & 255);
  msg.push(bitLenLo >>> 24 & 255, bitLenLo >>> 16 & 255, bitLenLo >>> 8 & 255, bitLenLo & 255);
  var w = new Array(64);
  for (var off = 0; off < msg.length; off += 64) {
    for (var i = 0; i < 16; i++)
      w[i] = (msg[off + i * 4] << 24 | msg[off + i * 4 + 1] << 16 | msg[off + i * 4 + 2] << 8 | msg[off + i * 4 + 3]) >>> 0;
    for (var j = 16; j < 64; j++) {
      var s0 = ((w[j - 15] >>> 7 | w[j - 15] << 25) ^ (w[j - 15] >>> 18 | w[j - 15] << 14) ^ w[j - 15] >>> 3) >>> 0;
      var s1 = ((w[j - 2] >>> 17 | w[j - 2] << 15) ^ (w[j - 2] >>> 19 | w[j - 2] << 13) ^ w[j - 2] >>> 10) >>> 0;
      w[j] = w[j - 16] + s0 + w[j - 7] + s1 >>> 0;
    }
    var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (var k = 0; k < 64; k++) {
      var S1 = ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) >>> 0;
      var ch = (e & f ^ ~e & g) >>> 0;
      var t1 = (h + S1 + ch + SHA256_K[k] + w[k]) >>> 0;
      var S0 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) >>> 0;
      var maj = (a & b ^ a & c ^ b & c) >>> 0;
      var t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  var out = [];
  var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (var q = 0; q < 8; q++) {
    out.push(hs[q] >>> 24 & 255, hs[q] >>> 16 & 255, hs[q] >>> 8 & 255, hs[q] & 255);
  }
  return out;
}
function bytesToHex(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++)
    s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return s;
}
// --- AES-256-CBC decrypt (bytes in, bytes out) ---
var AES_SBOX = [
  99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118,
  202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192,
  183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21,
  4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117,
  9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132,
  83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207,
  208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168,
  81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210,
  205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115,
  96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219,
  224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121,
  231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8,
  186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138,
  112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158,
  225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223,
  140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22
];
var AES_INV_SBOX = [
  82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251,
  124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203,
  84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78,
  8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37,
  114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101, 182, 146,
  108, 112, 72, 80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132,
  144, 216, 171, 0, 140, 188, 211, 10, 247, 228, 88, 5, 184, 179, 69, 6,
  208, 44, 30, 143, 202, 63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107,
  58, 145, 17, 65, 79, 103, 220, 234, 151, 242, 207, 206, 240, 180, 230, 115,
  150, 172, 116, 34, 231, 173, 53, 133, 226, 249, 55, 232, 28, 117, 223, 110,
  71, 241, 26, 113, 29, 41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27,
  252, 86, 62, 75, 198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244,
  31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95,
  96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239,
  160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97,
  23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125,
];
function aesExpandKey256(keyBytes) {
  var rcon = [1];
  for (var i = 1; i < 15; i++)
    rcon[i] = (rcon[i - 1] << 1) ^ (rcon[i - 1] & 128 ? 283 : 0);
  var ks = keyBytes.slice();
  var nk = 8, nb = 4, nr = 14;
  for (var k = nk; k < nb * (nr + 1); k++) {
    var t = ks.slice((k - 1) * 4, k * 4);
    if (k % nk === 0) {
      t = [AES_SBOX[t[1]], AES_SBOX[t[2]], AES_SBOX[t[3]], AES_SBOX[t[0]]];
      t[0] ^= rcon[k / nk - 1];
    } else if (k % nk === 4) {
      t = [AES_SBOX[t[0]], AES_SBOX[t[1]], AES_SBOX[t[2]], AES_SBOX[t[3]]];
    }
    for (var j = 0; j < 4; j++)
      ks.push(ks[(k - nk) * 4 + j] ^ t[j]);
  }
  return ks;
}
function aesGmul(a, b) {
  var p = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1)
      p ^= a;
    var hi = a & 128;
    a = a << 1 & 255;
    if (hi)
      a ^= 27;
    b >>= 1;
  }
  return p;
}
function aesInvCipher(block, keySched) {
  var nr = 14;
  var s = block.slice();
  var i, r, c, k;
  var xorKey = function(st, off) {
    for (k = 0; k < 16; k++)
      st[k] ^= keySched[off + k];
  };
  var invShiftRows = function(st) {
    var t = st.slice();
    for (r = 0; r < 4; r++)
      for (c = 0; c < 4; c++)
        st[c * 4 + r] = t[((c - r + 8) % 4) * 4 + r];
  };
  var invSubBytes = function(st) {
    for (k = 0; k < 16; k++)
      st[k] = AES_INV_SBOX[st[k]];
  };
  var invMixColumns = function(st) {
    var t = st.slice();
    for (c = 0; c < 4; c++) {
      var a0 = t[c * 4], a1 = t[c * 4 + 1], a2 = t[c * 4 + 2], a3 = t[c * 4 + 3];
      st[c * 4] = aesGmul(a0, 14) ^ aesGmul(a1, 11) ^ aesGmul(a2, 13) ^ aesGmul(a3, 9);
      st[c * 4 + 1] = aesGmul(a0, 9) ^ aesGmul(a1, 14) ^ aesGmul(a2, 11) ^ aesGmul(a3, 13);
      st[c * 4 + 2] = aesGmul(a0, 13) ^ aesGmul(a1, 9) ^ aesGmul(a2, 14) ^ aesGmul(a3, 11);
      st[c * 4 + 3] = aesGmul(a0, 11) ^ aesGmul(a1, 13) ^ aesGmul(a2, 9) ^ aesGmul(a3, 14);
    }
  };
  xorKey(s, nr * 16);
  for (i = nr - 1; i >= 1; i--) {
    invShiftRows(s);
    invSubBytes(s);
    xorKey(s, i * 16);
    invMixColumns(s);
  }
  invShiftRows(s);
  invSubBytes(s);
  xorKey(s, 0);
  return s;
}
function b64ToBytes(b64) {
  try {
    var bin = atob(b64);
    var out = [];
    for (var i = 0; i < bin.length; i++)
      out.push(bin.charCodeAt(i));
    return out;
  } catch (e) {
    return null;
  }
}
function bytesToUtf8(bytes) {
  var s = "";
  var i = 0;
  while (i < bytes.length) {
    var c = bytes[i];
    if (c < 128) {
      s += String.fromCharCode(c);
      i++;
    } else if (c >= 194 && c <= 223 && i + 1 < bytes.length) {
      s += String.fromCharCode((c & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else if (c >= 224 && c <= 239 && i + 2 < bytes.length) {
      s += String.fromCharCode((c & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    } else if (c >= 240 && c <= 244 && i + 3 < bytes.length) {
      var cp = (c & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63;
      cp -= 65536;
      s += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
      i += 4;
    } else {
      i++;
    }
  }
  return s;
}
function aesCbcDecrypt(keyBytes, ivBytes, ctBytes) {
  try {
    if (!keyBytes || keyBytes.length !== 32 || !ivBytes || ivBytes.length !== 16)
      return null;
    if (!ctBytes || ctBytes.length === 0 || ctBytes.length % 16 !== 0)
      return null;
    var sched = aesExpandKey256(keyBytes);
    var out = [];
    var prev = ivBytes;
    for (var off = 0; off < ctBytes.length; off += 16) {
      var dec = aesInvCipher(ctBytes.slice(off, off + 16), sched);
      for (var i = 0; i < 16; i++)
        out.push(dec[i] ^ prev[i]);
      prev = ctBytes.slice(off, off + 16);
    }
    var pad = out[out.length - 1];
    if (pad < 1 || pad > 16)
      return null;
    for (var j = 0; j < pad; j++) {
      if (out[out.length - 1 - j] !== pad)
        return null;
    }
    return out.slice(0, out.length - pad);
  } catch (e) {
    return null;
  }
}
function solveEmbed69Pow(challenge, difficulty, salt) {
  var prefix = "";
  for (var i = 0; i < difficulty; i++)
    prefix += "0";
  var nonce = 0;
  while (nonce < 5000000) {
    var hex = bytesToHex(sha256Bytes(utf8Bytes(challenge + nonce)));
    if (hex.indexOf(prefix) === 0)
      return sha256Bytes(utf8Bytes(challenge + nonce + salt));
    nonce++;
  }
  return null;
}
function decryptEmbedLink(encryptedLink, keyBytes) {
  try {
    var raw = b64ToBytes(encryptedLink);
    if (!raw || raw.length <= 16)
      return null;
    var pt = aesCbcDecrypt(keyBytes, raw.slice(0, 16), raw.slice(16));
    if (!pt)
      return null;
    return bytesToUtf8(pt);
  } catch (e) {
    return null;
  }
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
      return null;
    }
  });
}
var VIDEO_HOSTS = ["voe.sx", "streamwish.", "strwish.", "hlswish.", "hglink.to", "vibuxer.", "filemoon.", "vidhide", "vidhidepro.", "filelions.", "dintezuvio.", "dood.", "uqload.", "mixdrop.", "upstream.", "mp4upload."];
function resolveMixdrop(embedUrl) {
  return __async(this, null, function* () {
    try {
      console.log(`[MixDrop] Resolviendo: ${embedUrl}`);
      var resp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/", "Accept": "text/html" },
        redirect: "follow"
      });
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      var html = yield resp.text();
      var m = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
      if (!m) {
        console.log("[MixDrop] Sin packer");
        return null;
      }
      var p = m[1];
      var a = parseInt(m[2]);
      var c = parseInt(m[3]);
      var k = m[4].split("|");
      while (c--) {
        if (k[c])
          p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
      }
      var wm = p.match(/MDCore\.wurl\s*=\s*"([^"]+)"/);
      if (!wm) {
        console.log("[MixDrop] Sin wurl");
        return null;
      }
      var url = wm[1];
      if (url.indexOf("//") === 0)
        url = "https:" + url;
      else if (url.charAt(0) === "/")
        url = "https://mxdrop.to" + url;
      var qm = url.match(/[_-](\d{3,4})p/);
      return { url: url, quality: qm ? qm[1] + "p" : "HD", headers: { "User-Agent": UA, "Referer": "https://mxdrop.to/" } };
    } catch (e) {
      console.log(`[MixDrop] Error: ${e.message}`);
      return null;
    }
  });
}
function isVideoHostUrl(url) {
  if (!url || url.indexOf("http") !== 0)
    return false;
  var low = url.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|css|js|ico|svg)(\?|$)/.test(low))
    return false;
  if (low.indexOf("embed69.org") !== -1 || low.indexOf("pelisplushd.bz") !== -1 || low.indexOf("xupalace.org") !== -1)
    return false;
  for (var i = 0; i < VIDEO_HOSTS.length; i++) {
    if (low.indexOf(VIDEO_HOSTS[i]) !== -1)
      return true;
  }
  return false;
}
function getResolver(url) {
  var low = (url || "").toLowerCase();
  if (low.indexOf("voe.sx") !== -1)
    return { fn: resolveVoe, label: "VOE" };
  if (low.indexOf("streamwish.") !== -1 || low.indexOf("strwish.") !== -1 || low.indexOf("hlswish.") !== -1 || low.indexOf("hglink.to") !== -1 || low.indexOf("vibuxer.") !== -1)
    return { fn: resolveStreamwish, label: "StreamWish" };
  if (low.indexOf("vidhide") !== -1 || low.indexOf("filelions.") !== -1 || low.indexOf("dintezuvio.") !== -1)
    return { fn: resolveVidhide, label: "VidHide" };
  if (low.indexOf("mixdrop") !== -1)
    return { fn: resolveMixdrop, label: "MixDrop" };
  return null;
}
// --- embed69 backend (PoW + AES, self-contained) ---
function parseDataLink(html) {
  try {
    var match = html.match(/let\s+dataLink\s*=\s*(\[.+\]);/);
    if (!match)
      return null;
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}
function resolveEmbed69Page(embedUrl) {
  return __async(this, null, function* () {
    // [{url, lang, servername}] decrypted but not host-resolved
    try {
      console.log(`[Pelisplus][Embed69] Página: ${embedUrl}`);
      var pageResp = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://embed69.org/" },
        redirect: "follow"
      });
      if (!pageResp.ok)
        throw new Error(`HTTP ${pageResp.status}`);
      var html = yield pageResp.text();
      var dataLink = parseDataLink(html);
      if (!dataLink || !dataLink.length)
        return [];
      var chM = html.match(/POW_CHALLENGE = '([^']+)'/);
      var diM = html.match(/POW_DIFFICULTY = (\d+)/);
      var saM = html.match(/POW_SALT = '([^']+)'/);
      if (!chM || !diM || !saM)
        return [];
      var aesKey = solveEmbed69Pow(chM[1], parseInt(diM[1]), saM[1]);
      if (!aesKey)
        return [];
      var out = [];
      for (var s = 0; s < dataLink.length; s++) {
        var section = dataLink[s];
        var lang = section.video_language || "LAT";
        var embeds = section.sortedEmbeds || [];
        for (var e = 0; e < embeds.length; e++) {
          if (embeds[e].servername === "download")
            continue;
          var dec = decryptEmbedLink(embeds[e].link, aesKey);
          if (dec)
            out.push({ url: dec, lang: lang, servername: embeds[e].servername });
        }
      }
      return out;
    } catch (err) {
      console.log(`[Pelisplus][Embed69] Error: ${err.message}`);
      return [];
    }
  });
}
function scrapeLockerLinks(embedUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": "https://embed69.org/" },
        redirect: "follow"
      });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var found = [];
      var re = /https?:\/\/[^"'\s<>]+/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        var u = m[0].replace(/[.,;!?]+$/, "");
        if (isVideoHostUrl(u) && found.indexOf(u) === -1)
          found.push(u);
      }
      return found.map(function(u) { return { url: u, lang: "LAT", servername: null }; });
    } catch (e) {
      return [];
    }
  });
}
function resolveXupalace(embedUrl) {
  return __async(this, null, function* () {
    // [urls] host links found via go_to_player or iframe
    try {
      var res = yield fetch(embedUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html", "Referer": BASE_URL + "/" },
        redirect: "follow"
      });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      if (embedUrl.indexOf("xupalace.org/video") !== -1) {
        var re = /(go_to_player|go_to_playerVast)\('([^']+)'/g;
        var m;
        while ((m = re.exec(html)) !== null) {
          if (isVideoHostUrl(m[2]) && out.indexOf(m[2]) === -1)
            out.push(m[2]);
        }
      } else {
        var im = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (im && isVideoHostUrl(im[1]))
          out.push(im[1]);
      }
      return out.map(function(u) { return { url: u, lang: "LAT", servername: null }; });
    } catch (e) {
      return [];
    }
  });
}
function classifyVideoUrl(url) {
  if (url.indexOf("embed69.org/f/") !== -1)
    return "e69f";
  if (url.indexOf("embed69.org/") !== -1)
    return "e69locker";
  if (url.indexOf("xupalace.org") !== -1)
    return "xupalace";
  if (isVideoHostUrl(url))
    return "direct";
  return "unknown";
}
// --- TMDB + search ---
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
    var year = "";
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
      if (!year)
        year = (data.release_date || data.first_air_date || "").substring(0, 4);
    }
    return { titles: titles, year: year };
  });
}
function parseSearchItem(tag) {
  var h = tag.match(/href="([^"]+)"/);
  var t = tag.match(/data-title="([^"]+)"/);
  if (!h)
    return null;
  var href = h[1];
  if (href.charAt(0) === "/")
    href = BASE_URL + href;
  var raw = decodeHtml(t ? t[1] : "");
  var tm = raw.match(/VER (.+?) \((\d{4})\)/);
  return {
    title: tm ? tm[1] : raw.replace(/^VER\s+/, "").replace(/\s+Online.*$/i, ""),
    year: tm ? tm[2] : "",
    href: href,
    isMovie: href.indexOf("/pelicula/") !== -1,
    isSerie: href.indexOf("/serie/") !== -1
  };
}
function searchSite(query, wantMovie) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(`${BASE_URL}/search?s=${encodeURIComponent(query)}`, { headers: HEADERS, redirect: "follow" });
      if (!res.ok)
        return [];
      var html = yield res.text();
      var out = [];
      var re = /<a[^>]+class="Posters-link[^"]*"[^>]*>/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        var item = parseSearchItem(m[0]);
        if (!item)
          continue;
        if (wantMovie && !item.isMovie)
          continue;
        if (!wantMovie && !item.isSerie)
          continue;
        out.push(item);
      }
      return out;
    } catch (e) {
      return [];
    }
  });
}
function scoreResult(item, targets, year) {
  var best = -9999;
  for (var i = 0; i < targets.length; i++) {
    var nt = normalize(targets[i]);
    if (!nt)
      continue;
    var nc = normalize(item.title);
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
    if (item.year && year) {
      if (item.year === year)
        score += 150;
      else
        score -= 100;
    }
    if (score > best)
      best = score;
  }
  return best;
}
function extractVideoUrls(pageHtml) {
  var out = [];
  var re = /video\[\d+\]\s*=\s*'([^']+)'/g;
  var m;
  while ((m = re.exec(pageHtml)) !== null) {
    if (m[1].indexOf("http") === 0 && out.indexOf(m[1]) === -1)
      out.push(m[1]);
  }
  return out;
}
function findEpisodeUrl(serieHtml, serieBase, season, episode) {
  var re = /href="([^"]*temporada[^"]*)"/g;
  var m;
  while ((m = re.exec(serieHtml)) !== null) {
    var u = m[1];
    var sm = u.match(/temporada\/(\d+)\/capitulo\/(\d+)/);
    if (sm && parseInt(sm[1]) === parseInt(season) && parseInt(sm[2]) === parseInt(episode)) {
      if (u.charAt(0) === "/")
        u = BASE_URL + u;
      return u;
    }
  }
  return `${serieBase}/temporada/${parseInt(season)}/capitulo/${parseInt(episode)}`;
}
function collectEmbeds(videoUrls) {
  return __async(this, null, function* () {
    var all = [];
    for (var i = 0; i < videoUrls.length; i++) {
      var kind = classifyVideoUrl(videoUrls[i]);
      if (kind === "e69f") {
        var dec = yield resolveEmbed69Page(videoUrls[i]);
        all = all.concat(dec);
      } else if (kind === "e69locker") {
        var lock = yield scrapeLockerLinks(videoUrls[i]);
        all = all.concat(lock);
      } else if (kind === "xupalace") {
        var xu = yield resolveXupalace(videoUrls[i]);
        all = all.concat(xu);
      } else if (kind === "direct") {
        all.push({ url: videoUrls[i], lang: "LAT", servername: null });
      } else {
        console.log(`[Pelisplus] URL no soportada: ${videoUrls[i].substring(0, 70)}`);
      }
    }
    return all;
  });
}
function processEmbed(embed) {
  return __async(this, null, function* () {
    try {
      var r = getResolver(embed.url);
      if (!r) {
        console.log(`[Pelisplus] Sin resolver: ${embed.url.substring(0, 70)}`);
        return null;
      }
      var result = yield r.fn(embed.url);
      if (!result || !result.url)
        return null;
      var langLabel = LANG_LABELS[embed.lang] || "Latino";
      return {
        name: withSourceName("Pelisplus", r.label),
        title: `${result.quality || "HD"} · ${langLabel} · ${r.label}`,
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
    console.log(`[Pelisplus] Buscando: TMDB ${tmdbId} (${mediaType})` + (mediaType === "tv" ? ` S${season}E${episode}` : ""));
    try {
      var wantMovie = mediaType === "movie";
      var info = yield getTmdbTitles(tmdbId, mediaType);
      if (!info.titles.length) {
        console.log("[Pelisplus] Sin títulos TMDB");
        return [];
      }
      var pageUrl = null;
      for (var ti = 0; ti < info.titles.length && !pageUrl; ti++) {
        var results = yield searchSite(info.titles[ti], wantMovie);
        if (!results.length)
          continue;
        var best = null;
        var bestScore = -9999;
        for (var ri = 0; ri < results.length; ri++) {
          var sc = scoreResult(results[ri], info.titles, info.year);
          if (sc > bestScore) {
            bestScore = sc;
            best = results[ri];
          }
        }
        if (best && bestScore >= 300) {
          console.log(`[Pelisplus] Seleccionado: "${best.title}" (${best.year || "?"}) score=${bestScore}`);
          pageUrl = best.href;
        }
      }
      if (!pageUrl) {
        console.log("[Pelisplus] Sin resultados en búsqueda");
        return [];
      }
      var videoUrls = [];
      if (wantMovie) {
        var mRes = yield fetch(pageUrl, { headers: HEADERS, redirect: "follow" });
        if (!mRes.ok)
          return [];
        videoUrls = extractVideoUrls(yield mRes.text());
      } else {
        var sRes = yield fetch(pageUrl, { headers: HEADERS, redirect: "follow" });
        if (!sRes.ok)
          return [];
        var serieHtml = yield sRes.text();
        var epUrl = findEpisodeUrl(serieHtml, pageUrl, season, episode);
        console.log(`[Pelisplus] Episodio: ${epUrl}`);
        var eRes = yield fetch(epUrl, { headers: HEADERS, redirect: "follow" });
        if (!eRes.ok)
          return [];
        videoUrls = extractVideoUrls(yield eRes.text());
      }
      if (!videoUrls.length) {
        console.log("[Pelisplus] Sin videos en página");
        return [];
      }
      console.log(`[Pelisplus] ${videoUrls.length} video URLs`);
      var embeds = yield collectEmbeds(videoUrls);
      if (!embeds.length) {
        console.log("[Pelisplus] Sin embeds útiles");
        return [];
      }
      var streams = [];
      for (var li = 0; li < LANG_PRIORITY.length; li++) {
        var lang = LANG_PRIORITY[li];
        var langEmbeds = embeds.filter(function(o) { return o.lang === lang; });
        if (!langEmbeds.length)
          continue;
        console.log(`[Pelisplus] Resolviendo ${langEmbeds.length} embeds (${lang})...`);
        var resolved = yield allSettled(langEmbeds.map(function(o) { return processEmbed(o); }));
        var valid = [];
        for (var vi = 0; vi < resolved.length; vi++) {
          if (resolved[vi].status === "fulfilled" && resolved[vi].value)
            valid.push(resolved[vi].value);
        }
        if (valid.length) {
          streams = valid;
          console.log(`[Pelisplus] ✓ Streams en ${lang}, omitiendo resto`);
          break;
        }
      }
      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log(`[Pelisplus] ✓ ${streams.length} streams en ${elapsed}s`);
      return streams;
    } catch (e) {
      console.log(`[Pelisplus] Error: ${e.message}`);
      return [];
    }
  });
}
