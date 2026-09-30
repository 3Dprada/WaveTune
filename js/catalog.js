/* Generado automáticamente por tools/generate-catalog.js. No editar a mano. */
const CATALOG = {
  "albums": [
    {
      "id": "baile-inolvidable",
      "title": "Baile Inolvidable",
      "artist": "Bad Bunny",
      "year": 2025,
      "art": "baile-inolvidable.png"
    },
    {
      "id": "diabla",
      "title": "Diabla",
      "artist": "Los Diozes",
      "year": 2025,
      "art": "diabla.png"
    },
    {
      "id": "in-the-end",
      "title": "In the End",
      "artist": "Linkin Park",
      "year": 2025,
      "art": "in-the-end.png"
    }
  ],
  "tracks": [
    {
      "id": 1,
      "title": "Baile Inolvidable",
      "album": "baile-inolvidable",
      "artist": "Bad Bunny",
      "file": "01-baile-inolvidable.mp3"
    },
    {
      "id": 2,
      "title": "Diabla",
      "album": "diabla",
      "artist": "Los Diozes",
      "file": "02-diabla.mp3"
    },
    {
      "id": 3,
      "title": "In the End",
      "album": "in-the-end",
      "artist": "Linkin Park",
      "file": "03-in-the-end.mp3"
    }
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
