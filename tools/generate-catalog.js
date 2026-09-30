#!/usr/bin/env node
/**
 * WaveTune · generador de catálogo
 *
 * Escanea assets/music/*.mp3, lee los metadatos ID3v2 (título TIT2,
 * artista TPE1, álbum TALB, año TYER/TDRC) de cada canción y regenera
 * js/catalog.js. Si un MP3 no tiene metadatos, reutiliza los datos ya
 * presentes en js/catalog.js (por slug del nombre de archivo) o deduce
 * valores a partir del nombre (NN-slug.mp3).
 *
 * Uso:  node tools/generate-catalog.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const MUSIC_DIR = path.join(ROOT, "assets", "music");
const ART_DIR = path.join(ROOT, "assets", "artwork");
const CATALOG_FILE = path.join(ROOT, "js", "catalog.js");

const ART_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg"];

/* ---------- lectura de etiquetas ID3v2 ---------- */

function readText(data, enc) {
  if (enc === 0) {
    let s = data.toString("latin1");
    // muchos grabadores escriben UTF-8 con enc=0: lo detectamos si es texto válido
    const bytes = s;
    try {
      const utf8 = Buffer.from(bytes, "latin1").toString("utf8");
      if (!utf8.includes("\uFFFD")) return utf8;
    } catch {}
    return s;
  }
  if (enc === 1) {
    let s = data.toString("utf16le");
    if (s.charCodeAt(0) === 0xfeff || s.charCodeAt(0) === 0xfffe) s = s.slice(1);
    return s;
  }
  return data.toString("utf8"); // enc 3
}

function parseId3(buf) {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return {};
  const ver = buf[3];
  const flags = buf[5];
  let size = 0;
  for (let i = 6; i < 10; i++) size = (size << 7) | buf[i];
  let off = 10;

  // cabecera extendida
  if (flags & 0x40) {
    if (ver === 4) {
      let esz = 0;
      for (let i = off; i < off + 4; i++) esz = (esz << 7) | buf[i];
      off += esz;
    } else {
      off += 4 + buf.readUInt32BE(off);
    }
  }

  const end = Math.min(10 + size, buf.length);
  const frames = {};
  while (off + 10 <= end) {
    const id = buf.toString("latin1", off, off + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) {
      off++;
      continue;
    }
    let fsize;
    if (ver === 3) {
      fsize = buf.readUInt32BE(off + 4);
    } else {
      fsize = (buf[off + 4] << 21) | (buf[off + 5] << 14) | (buf[off + 6] << 7) | buf[off + 7];
    }
    off += 10;
    if (fsize <= 0 || off + fsize > end) break;
    const data = buf.slice(off, off + fsize);
    if (id[0] === "T" && data.length > 0) {
      const enc = data[0];
      let text = readText(data.slice(1), enc);
      text = text.replace(/\u0000+$/, "").trim();
      if (text.length && text[0] === "\uFEFF") text = text.slice(1);
      if (text) frames[id] = text;
    } else if ((id === "APIC" || id === "PIC") && data.length) {
      // portada embebida: se ignora, WaveTune usa artwork/ SVG
    }
    off += fsize;
  }
  return frames;
}

function yearFrom(frames) {
  const raw = (frames.TYER || frames.TDRC || "").trim();
  const m = raw.match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/* ---------- utilidades ---------- */

function titleFromSlug(slug) {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* Busca la portada del álbum por slug, aceptando varias extensiones. */
function findArt(albumId) {
  for (const ext of ART_EXTS) {
    if (fs.existsSync(path.join(ART_DIR, albumId + ext))) return albumId + ext;
  }
  return null;
}

function loadExistingCatalog() {
  try {
    const src = fs.readFileSync(CATALOG_FILE, "utf8");
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(src + "\nthis.__CATALOG__ = CATALOG;", sandbox);
    return sandbox.__CATALOG__ || null;
  } catch {
    return null;
  }
}

/* ---------- generación ---------- */

function main() {
  if (!fs.existsSync(MUSIC_DIR)) {
    console.error("No existe", MUSIC_DIR, "— crea la carpeta con los MP3");
    process.exit(1);
  }

  const existing = loadExistingCatalog();
  const knownAlbums = {};
  if (existing) {
    existing.albums.forEach((a) => (knownAlbums[a.id] = a));
  }

  const files = fs
    .readdirSync(MUSIC_DIR)
    .filter((f) => /\.mp3$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a, 10) || 0;
      const nb = parseInt(b, 10) || 0;
      return na - nb || a.localeCompare(b);
    });

  if (!files.length) {
    console.error("No hay MP3 en", MUSIC_DIR);
    process.exit(1);
  }

  const albums = new Map(); // id -> album
  const tracks = [];
  let n = 0;

  for (const file of files) {
    n++;
    const buf = fs.readFileSync(path.join(MUSIC_DIR, file));
    const frames = parseId3(buf);

    const m = /^(?:\d+\s*-?\s*)?(.+)\.mp3$/i.exec(file);
    const slug = (m ? m[1] : file.replace(/\.mp3$/i, "")).toLowerCase().replace(/\s+/g, "-");

    let albumId = slug;
    let albumTitle = titleFromSlug(slug);

    const metaAlbum = (frames.TALB || "").trim();
    if (metaAlbum) {
      // usamos el título real del álbum pero mantenemos el id basado en el nombre
      albumTitle = metaAlbum;
    }

    const prev = knownAlbums[albumId];
    const artist = (frames.TPE1 || "").trim() || (prev ? prev.artist : "Artista desconocido");
    const year = yearFrom(frames) ?? (prev ? prev.year : 0);

    const art = findArt(albumId);

    if (!albums.has(albumId)) {
      albums.set(albumId, { id: albumId, title: albumTitle, artist, year, art });
    }

    tracks.push({
      id: n,
      title: (frames.TIT2 || "").trim() || albumTitle,
      album: albumId,
      artist: (frames.TPE1 || "").trim() || artist,
      file,
    });
  }

  const catalog = {
    albums: [...albums.values()],
    tracks,
  };

  const out =
    `/* Generado automáticamente por tools/generate-catalog.js. No editar a mano. */\n` +
    `const CATALOG = ${JSON.stringify(catalog, null, 2)};\n\n` +
    `/* Si un álbum no tiene portada se muestra un marcador genérico. */\n` +
    `function artFile(albumId) {\n` +
    `  const a = CATALOG.albums.find((x) => x.id === albumId);\n` +
    `  const art = a && a.art ? a.art : "_placeholder.svg";\n` +
    `  return \`../assets/artwork/\${art}\`;\n` +
    `}\n\n` +
    `function audioFile(track) {\n  return \`../assets/music/\${track.file}\`;\n}\n`;

  fs.writeFileSync(CATALOG_FILE, out, "utf8");
  const sinPortada = catalog.albums.filter((a) => !a.art);
  console.log(
    `Catálogo regenerado: ${catalog.albums.length} álbumes, ${tracks.length} canciones → js/catalog.js`
  );
  if (sinPortada.length) {
    console.warn(
      `Sin portada: ${sinPortada.map((a) => a.id).join(", ")} (assets/artwork/<id>.png|jpg|webp|svg)`
    );
  }
}

main();