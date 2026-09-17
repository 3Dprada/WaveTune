const CATALOG = {
  albums: [
    { id: "electric-dreams", title: "Electric Dreams", artist: "Nova Hertz", year: 2024 },
    { id: "midnight-run", title: "Midnight Run", artist: "Luna Vectors", year: 2023 },
    { id: "neon-skies", title: "Neon Skies", artist: "Akira Nord", year: 2024 },
    { id: "velvet-moon", title: "Velvet Moon", artist: "Sable", year: 2022 },
    { id: "golden-hour", title: "Golden Hour", artist: "Mira Sol", year: 2025 },
    { id: "quantum-soul", title: "Quantum Soul", artist: "Datalynx", year: 2025 }
  ],
  tracks: [
    { id: 1, title: "Electric Dreams",  album: "electric-dreams", artist: "Nova Hertz",  file: "01-electric-dreams.mp3" },
    { id: 2, title: "Midnight Run",     album: "midnight-run",    artist: "Luna Vectors", file: "02-midnight-run.mp3" },
    { id: 3, title: "Neon Skies",       album: "neon-skies",      artist: "Akira Nord",   file: "03-neon-skies.mp3" },
    { id: 4, title: "Velvet Moon",      album: "velvet-moon",     artist: "Sable",        file: "04-velvet-moon.mp3" },
    { id: 5, title: "Golden Hour",      album: "golden-hour",     artist: "Mira Sol",     file: "05-golden-hour.mp3" },
    { id: 6, title: "Quantum Soul",     album: "quantum-soul",    artist: "Datalynx",     file: "06-quantum-soul.mp3" }
  ]
};

function artFile(albumId) {
  return `../assets/artwork/${albumId}.svg`;
}

function audioFile(track) {
  return `../assets/music/${track.file}`;
}