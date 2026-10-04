// "Base de datos" de WaveTune: tres tablas relacionadas por id (como en SQL).
//   song.albumId  -> album.id
//   album.artistId -> artist.id
//   album.feat     -> [artist.id]   (colaboradores, no cambian el artista principal)
//
// Los títulos y artistas salen de las etiquetas ID3 de cada MP3 y las duraciones
// de ffprobe; los colores son la media de cada portada y solo se usan como
// respaldo cuando una imagen no está disponible.

const DB = {
  artists: [
    { id: "a1", name: "Bad Bunny",      colors: "#4d5640,#20241b" },
    { id: "a2", name: "Los Diozes",     colors: "#834655,#371d24" },
    { id: "a3", name: "Linkin Park",    colors: "#837b75,#373434" },
    { id: "a4", name: "Ozuna",          colors: "#dfdcd8,#5e5c5b" },
    { id: "a5", name: "Romeo Santos",   colors: "#799c45,#45462a" },
    { id: "a6", name: "KPOP",           colors: "#d2a053,#584323" },
    { id: "a7", name: "Eladio Carrión", colors: "#1a2121,#0b0d0e" },
    { id: "a8", name: "Myke Towers",    colors: "#544f40,#23211c" }
  ],

  albums: [
    { id: "baile-inolvidable",    title: "Baile Inolvidable",           artistId: "a1", year: 2025, genre: "Reggaetón", colors: "#4d5640,#20241b", art: "baile-inolvidable.png" },
    { id: "diabla",              title: "Diabla",                      artistId: "a2", year: 2025, genre: "Reggaetón", colors: "#834655,#371d24", art: "diabla.png" },
    { id: "in-the-end",          title: "In the End",                  artistId: "a3", year: 2025, genre: "Rock",       colors: "#837b75,#373434", art: "in-the-end.png" },
    { id: "el-farsante",         title: "El Farsante",                 artistId: "a4", year: 2025, genre: "Bachata",    colors: "#79898c,#333a3b", art: "el-farsante.png", feat: ["a5"] },
    { id: "golden",              title: "Golden",                      artistId: "a6", year: 2025, genre: "Electropop", colors: "#d2a053,#584323", art: "golden.png" },
    { id: "mbappe",              title: "Mbappé",                      artistId: "a7", year: 2025, genre: "Reggaetón", colors: "#1a2121,#0b0d0e", art: "mbappe.png" },
    { id: "se-preparo",          title: "Se Preparó",                  artistId: "a4", year: 2025, genre: "Reggaetón", colors: "#dfdcd8,#5e5c5b", art: "se-preparo.png" },
    { id: "si-la-calle-llama",   title: "Si La Calle Llama",           artistId: "a7", year: 2025, genre: "Reggaetón", colors: "#4e6c45,#2d452a", art: "si-la-calle-llama.png" },
    { id: "si-la-calle-llama-remix", title: "Si La Calle Llama (Remix)", artistId: "a7", year: 2025, genre: "Reggaetón", colors: "#544f40,#23211c", art: "si-la-calle-llama-remix.png", feat: ["a8"] },
    { id: "tu-foto",             title: "Tu Foto",                     artistId: "a4", year: 2025, genre: "Reggaetón", colors: "#dfdcd8,#5e5c5b", art: "tu-foto.png" }
  ],

  songs: [
    { id: "s01", title: "Baile Inolvidable",           albumId: "baile-inolvidable",         duration: 367, file: "01-baile-inolvidable.mp3",        moods: ["Fiesta", "Energía"] },
    { id: "s02", title: "Diabla",                      albumId: "diabla",                     duration: 217, file: "02-diabla.mp3",                     moods: ["Fiesta", "Energía"] },
    { id: "s03", title: "In the End",                  albumId: "in-the-end",                 duration: 216, file: "03-in-the-end.mp3",                 moods: ["Energía", "Concentración"] },
    { id: "s04", title: "El Farsante",                 albumId: "el-farsante",                duration: 301, file: "04-el-farsante.mp3",                moods: ["Relax", "Fiesta"] },
    { id: "s05", title: "Golden",                      albumId: "golden",                     duration: 198, file: "05-golden.mp3",                     moods: ["Energía", "Fiesta"] },
    { id: "s06", title: "Mbappé",                      albumId: "mbappe",                     duration: 149, file: "06-mbappe.mp3",                     moods: ["Energía", "Fiesta"] },
    { id: "s07", title: "Se Preparó",                  albumId: "se-preparo",                 duration: 189, file: "07-se-preparo.mp3",                 moods: ["Fiesta", "Energía"] },
    { id: "s08", title: "Si La Calle Llama",           albumId: "si-la-calle-llama",          duration: 240, file: "08-si-la-calle-llama.mp3",          moods: ["Fiesta", "Energía"] },
    { id: "s09", title: "Si La Calle Llama (Remix)",   albumId: "si-la-calle-llama-remix",    duration: 240, file: "09-si-la-calle-llama-remix.mp3",    moods: ["Fiesta", "Energía"] },
    { id: "s10", title: "Tu Foto",                     albumId: "tu-foto",                    duration: 193, file: "10-tu-foto.mp3",                    moods: ["Relax", "Concentración"] }
  ],

  // Las playlists del menú lateral. "ids" son song.id; las de usuario se
  // guardan en localStorage y se mezclan con estas al pintar.
  playlists: [
    { name: "Favoritos",        system: true },
    { name: "Para programar",   ids: ["s03", "s10"] },
    { name: "Noche de Hyprland", ids: ["s04", "s08", "s09"] },
    { name: "Gym",              ids: ["s05", "s06", "s02"] }
  ]
};

/* ---------- índices y relaciones (equivalente a JOIN) ---------- */

const artistById = Object.fromEntries(DB.artists.map((a) => [a.id, a]));
const albumById  = Object.fromEntries(DB.albums.map((a) => [a.id, a]));
const songById   = Object.fromEntries(DB.songs.map((s) => [s.id, s]));

const albumOf  = (song) => albumById[song.albumId];
const artistOf = (song) => artistById[albumOf(song).artistId];

const songsOfAlbum  = (albumId) => DB.songs.filter((s) => s.albumId === albumId);
const songsOfArtist = (artistId) => DB.songs.filter((s) => albumOf(s).artistId === artistId);

/* "Ozuna feat. Romeo Santos": el artista principal y los colaboradores. */
function artistLabel(album) {
  const feat = (album.feat || []).map((id) => artistById[id] && artistById[id].name).filter(Boolean);
  return feat.length
    ? artistById[album.artistId].name + " feat. " + feat.join(", ")
    : artistById[album.artistId].name;
}

const artistLabelOf = (song) => artistLabel(albumOf(song));

/* ---------- rutas ---------- */

/* Las páginas viven a distinta profundidad (raíz, explorar/, biblioteca/), así
   que la raíz del proyecto se deduce de la URL en vez de fijarla a mano. */
const ROOT = (() => {
  const depth = location.pathname.split("/").length - 2; // -2 por el barra final
  return depth > 0 ? "../".repeat(depth) : "";
})();

const artPath   = (album) => ROOT + "assets/artwork/" + (album.art || "_placeholder.svg");
const audioPath = (song)  => ROOT + "assets/music/" + song.file;

/* ---------- formato ---------- */

const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return m + ":" + String(Math.floor(s % 60)).padStart(2, "0");
};

/* -----------storage ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sin almacenamiento (file:// bloqueado, modo privado) */
    }
  }
};

const KEY = {
  queue:     "wt:queue",
  favs:      "wt:favs",
  playlists: "wt:playlists",
  volume:    "wt:volume",
  shuffle:   "wt:shuffle",
  repeat:    "wt:repeat",
  track:     "wt:track"
};
