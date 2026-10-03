// Índices por id para buscar rápido (equivalente a un JOIN)
const artistById = Object.fromEntries(DB.artists.map(a => [a.id, a]));
const albumById  = Object.fromEntries(DB.albums.map(a => [a.id, a]));
const grad = c => "linear-gradient(135deg," + c + ")";
// Pinta el fondo: la imagen si existe, y si no, el degradado de colores
function paint(el, colors, image) {
  if (image) {
    el.style.background = "center / cover no-repeat url(\"" + image + "\")";
  } else {
    el.style.background = grad(colors);
  }
}
const fmt = s => Math.floor(s / 60) + ":" + ("0" + Math.floor(s % 60)).slice(-2);

// Helpers de relaciones
const albumOf  = song => albumById[song.albumId];
const artistOf = song => artistById[albumOf(song).artistId];
const songIndex = pred => DB.songs.findIndex(pred);

let cur = -1, playing = false, t = 0, timer = null;

function card(o) {
  const e = document.createElement("div");
  e.className = "card" + (o.round ? " artist" : "");
  e.tabIndex = 0;
  e.innerHTML = '<div class="cover"><div class="pb"></div></div><b></b><span></span>';
  const cover = e.querySelector(".cover");
  paint(cover, o.colors, o.image);
  // Sin imagen: se escribe el título y el artista sobre el fondo de colores
  if (!o.image && o.overlay) {
    const ct = document.createElement("div");
    ct.className = "ct";
    ct.innerHTML = "<strong></strong><em></em>";
    ct.querySelector("strong").textContent = o.overlay[0];
    ct.querySelector("em").textContent = o.overlay[1];
    cover.appendChild(ct);
  }
  e.querySelector("b").textContent = o.title;      // textContent: evita inyectar HTML
  e.querySelector("span").textContent = o.sub;
  e.onclick = o.onClick;
  e.onkeydown = k => { if (k.key === "Enter") o.onClick(); };
  return e;
}

// Álbumes -> reproduce su primera canción
const r1 = document.getElementById("r1");
DB.albums.forEach(al => {
  const artist = artistById[al.artistId].name;
  r1.appendChild(card({
    title: al.title, sub: artist + " · " + al.year,
    colors: al.colors, image: al.cover, overlay: [al.title, artist],
    onClick: () => pick(songIndex(s => s.albumId === al.id))
  }));
});

// Artistas -> reproduce su primera canción
const r2 = document.getElementById("r2");
DB.artists.forEach(ar => r2.appendChild(card({
  title: ar.name, sub: "Artista",
  colors: ar.colors, image: ar.photo, round: true,
  onClick: () => pick(songIndex(s => albumOf(s).artistId === ar.id))
})));

// Canciones
const list = document.getElementById("songs");
DB.songs.forEach((s, i) => {
  const al = albumOf(s), el = document.createElement("div");
  el.className = "song";
  el.innerHTML = '<div class="thumb"></div><div><b></b><small></small></div><small></small>';
  paint(el.querySelector(".thumb"), al.colors, al.cover);
  el.querySelector("b").textContent = s.title;
  el.querySelectorAll("small")[0].textContent = artistOf(s).name + " · " + al.title;
  el.querySelectorAll("small")[1].textContent = fmt(s.duration);
  el.onclick = () => pick(i);
  list.appendChild(el);
});

// Reproductor
function draw() {
  const total = cur < 0 ? 0 : DB.songs[cur].duration;
  document.getElementById("bar").style.width = (total ? t / total * 100 : 0) + "%";
  document.getElementById("time").textContent = fmt(t) + " / " + fmt(total);
  document.getElementById("ico").innerHTML = playing ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
}
function tick() {
  clearInterval(timer);
  if (playing) timer = setInterval(() => {
    t += 1;
    if (t >= DB.songs[cur].duration) endOfSong();
    draw();
  }, 1000);
}
function pick(i) {
  cur = i; t = 0; playing = true;
  const s = DB.songs[i];
  document.getElementById("nb").textContent = s.title;
  document.getElementById("ns").textContent = artistOf(s).name;
  paint(document.getElementById("nt"), albumOf(s).colors, albumOf(s).cover);
  tick(); draw();
}
document.getElementById("play").onclick = () => { if (cur < 0) return pick(0); playing = !playing; tick(); draw(); };
document.getElementById("next").onclick = () => pick(nextIndex());
document.getElementById("prev").onclick = () => pick((cur <= 0 ? DB.songs.length : cur) - 1);
document.getElementById("prog").onclick = function (e) {
  if (cur < 0) return;
  const r = this.getBoundingClientRect();
  t = (e.clientX - r.left) / r.width * DB.songs[cur].duration; draw();
};

// Pestañas del menú: cambian la activa sin saltar al inicio de la página
document.querySelectorAll(".nav a").forEach(a => a.addEventListener("click", e => {
  e.preventDefault();
  document.querySelectorAll(".nav a").forEach(x => x.classList.remove("on"));
  a.classList.add("on");
  a.blur();
}));

// Aleatorio y bucle
let shuffle = false;
let repeat = 0; // 0 = desactivado, 1 = repetir todo, 2 = repetir una canción

function nextIndex() {
  if (cur < 0) return 0;
  if (shuffle && DB.songs.length > 1) {
    let n;
    do { n = Math.floor(Math.random() * DB.songs.length); } while (n === cur);
    return n;
  }
  return (cur + 1) % DB.songs.length;
}

function endOfSong() {
  if (repeat === 2) return pick(cur);                                   // bucle de una canción
  if (repeat === 0 && !shuffle && cur === DB.songs.length - 1) {        // fin de la lista
    playing = false; t = 0; tick(); return;
  }
  pick(nextIndex());
}

const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");
const repeatLabels = ["desactivado", "todo", "una canción"];

shuffleBtn.onclick = () => {
  shuffle = !shuffle;
  shuffleBtn.classList.toggle("on", shuffle);
  shuffleBtn.setAttribute("aria-pressed", shuffle);
};
repeatBtn.onclick = () => {
  repeat = (repeat + 1) % 3;
  repeatBtn.classList.toggle("on", repeat > 0);
  repeatBtn.classList.toggle("one", repeat === 2);
  repeatBtn.setAttribute("aria-pressed", repeat > 0);
  repeatBtn.setAttribute("aria-label", "Repetir: " + repeatLabels[repeat]);
};

// Crear PlayList






// Pestañas de la interfaz de Inicio


