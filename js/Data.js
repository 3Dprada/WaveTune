// "Base de datos" de ejemplo: tres tablas relacionadas por id (como en SQL).
// song.albumId -> album.id  |  album.artistId -> artist.id

const DB = {
      artists: [
    { id: "a1", name: "Neon Harbor",  colors: "#ff3d71,#3a0ca3", photo: "" },
    { id: "a2", name: "Alba Ríos",    colors: "#4cc9f0,#1b3a57", photo: "" },
    { id: "a3", name: "Lo-Fi Lab",    colors: "#f9c74f,#8d3b00", photo: "" },
    { id: "a4", name: "Kernel Panic", colors: "#90be6d,#10231a", photo: "" },
    { id: "a5", name: "Retro Wave",   colors: "#ff006e,#ffbe0b", photo: "" }
  ],
  albums: [
    { id: "al1", title: "Midnight Drive", artistId: "a1", year: 2024, colors: "#ff3d71,#3a0ca3", cover: "" },
    { id: "al2", title: "Neón y asfalto", artistId: "a1", year: 2022, colors: "#c77dff,#240046", cover: "" },
    { id: "al3", title: "Lluvia en Toledo", artistId: "a2", year: 2023, colors: "#4cc9f0,#1b3a57", cover: "" },
    { id: "al4", title: "Código y café",  artistId: "a3", year: 2025, colors: "#f9c74f,#8d3b00", cover: "" },
    { id: "al5", title: "Terminal",       artistId: "a4", year: 2021, colors: "#90be6d,#10231a", cover: "" },
    { id: "al6", title: "Pixel Sunset",   artistId: "a5", year: 2024, colors: "#ff006e,#ffbe0b", cover: "" }
  ],
  songs: [
    { id: "s1",  title: "Midnight Drive",   albumId: "al1", duration: 215 },
    { id: "s2",  title: "Autopista 3AM",    albumId: "al1", duration: 198 },
    { id: "s3",  title: "Luces de ciudad",  albumId: "al1", duration: 242 },
    { id: "s4",  title: "Neón",             albumId: "al2", duration: 187 },
    { id: "s5",  title: "Asfalto mojado",   albumId: "al2", duration: 223 },
    { id: "s6",  title: "Lluvia en Toledo", albumId: "al3", duration: 204 },
    { id: "s7",  title: "Calle del Comercio", albumId: "al3", duration: 176 },
    { id: "s8",  title: "Código y café",    albumId: "al4", duration: 165 },
    { id: "s9",  title: "Commit final",     albumId: "al4", duration: 190 },
    { id: "s10", title: "Terminal",         albumId: "al5", duration: 232 },
    { id: "s11", title: "Segfault",         albumId: "al5", duration: 208 },
    { id: "s12", title: "Pixel Sunset",     albumId: "al6", duration: 211 },
    { id: "s13", title: "Cinta VHS",        albumId: "al6", duration: 195 }
  ]
};


/* Si un álbum no tiene portada se muestra un marcador genérico. */
function artFile(albumId) {
  const a = CATALOG.albums.find((x) => x.id === albumId);
  const art = a && a.art ? a.art : "_placeholder.svg";
  return `../assets/artwork/${art}`;
}

function audioFile(track) {
  return `../assets/music/${track.file}`;
}
