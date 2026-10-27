/* Monta el chrome común y dibra la vista de la página activa.
   Las tres páginas comparten este archivo entero: solo cambia <body data-page>. */

const App = (() => {
  "use strict";

  const view = () => document.getElementById("view");
  let query = "";
  let mood = "";      // chip de estado de ánimo seleccionado
  let genre = "";     // género elegido en Explorar
  let libTab = "canciones";
  let artistIndex = 0;
  let artistGesture = null;
  let suppressArtistClickUntil = 0;
  const PREF_KEY = "wt:appearance";
  const LYRIC_KEY = "wt:lyrics";
  const appearance = store.get(PREF_KEY, { accent: "#f80000", glass: 72, motion: true });
  let lyricEditId = null;

  function applyAppearance() {
    const root = document.documentElement;
    root.style.setProperty("--accent", appearance.accent);
    root.style.setProperty("--bar", appearance.accent);
    root.style.setProperty("--glass", `${appearance.glass}%`);
    root.style.setProperty("--ambient-opacity", String(appearance.glass / 100));
    document.body.classList.toggle("ambient-motion", appearance.motion !== false);
    document.querySelectorAll("[data-setting]").forEach((input) => {
      const value = appearance[input.dataset.setting];
      if (input.type === "checkbox") input.checked = value !== false;
      else input.value = value;
    });
  }

  function openSettings() {
    let panel = document.querySelector(".settings-backdrop");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "settings-backdrop";
      panel.innerHTML = `<section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><p class="kicker">Personalización</p><h2 id="settings-title">Ajustes de apariencia</h2></div>
          <button class="icon-btn" data-act="settings-close" aria-label="Cerrar ajustes">×</button></header>
        <label class="setting-row"><span><b>Color de acento</b><small>Controles y elementos destacados</small></span><input type="color" data-setting="accent" aria-label="Color de acento"></label>
        <label class="setting-row"><span><b>Efecto de cristal</b><small>Intensidad de las superficies translúcidas</small></span><input type="range" min="20" max="100" data-setting="glass" aria-label="Intensidad del cristal"></label>
        <label class="setting-row"><span><b>Fondo ambiental animado</b><small>Movimiento suave inspirado en la portada actual</small></span><input type="checkbox" data-setting="motion"></label>
        <p class="settings-note">La apariencia se guarda en este dispositivo. El fondo continúa adaptándose a la portada de la canción.</p>
      </section>`;
      document.body.append(panel);
      panel.addEventListener("input", (e) => {
        const input = e.target.closest("[data-setting]");
        if (!input) return;
        appearance[input.dataset.setting] = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
        store.set(PREF_KEY, appearance);
        applyAppearance();
      });
      panel.addEventListener("click", (e) => { if (e.target === panel) panel.hidden = true; });
    }
    panel.hidden = false;
    applyAppearance();
    panel.querySelector("input")?.focus();
  }

  /* ---------- utilidades ---------- */
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]
    );

  /* ---------- menú contextual ---------- */
  /* Un solo popover reutilizado; recibe la lista de acciones al abrirlo. */
  const ctx = {
    node: null,
    open(items, x, y) {
      this.node.innerHTML = items
        .map((it, i) =>
          it === "-"
            ? '<hr class="ctx-sep">'
            : `<button role="menuitem" data-i="${i}">${it.icon ? Layout.svg(it.icon, 18) : ""}<span>${esc(it.label)}</span></button>`
        )
        .join("");
      this.node.hidden = false;
      document.querySelector(".ctx-backdrop").hidden = false;
      /* se recorta si se sale por abajo o por la derecha */
      const r = this.node.getBoundingClientRect();
      this.node.style.left = Math.min(x, innerWidth - r.width - 12) + "px";
      this.node.style.top = Math.min(y, innerHeight - r.height - 12) + "px";
      this.items = items;
    },
    close() {
      this.node.hidden = true;
      document.querySelector(".ctx-backdrop").hidden = true;
    }
  };

  /* ---------- piezas de la vista ---------- */

  /* Portada de álbum: la imagen si existe y, si no, el degradado de Data.js. */
  const coverStyle = (album) =>
    album.art
      ? `background-image:url("${artPath(album)}")`
      : `background-image:linear-gradient(135deg,${album.colors})`;
  const songCoverStyle = (song) => `background-image:url("${songArtPath(song)}")`;
  const artworkImage = (src, alt, loading = "lazy") =>
    `<img class="artwork-image" src="${esc(src)}" alt="${esc(alt)}" loading="${loading}" decoding="async">`;

  const MOODS = [
    { id: "Todo", emoji: "✨" },
    { id: "Energía", emoji: "⚡" },
    { id: "Relax", emoji: "🌙" },
    { id: "Entrenamiento", emoji: "🏋️" },
    { id: "Concentración", emoji: "🎧" },
    { id: "Fiesta", emoji: "🎉" }
  ];

  const MOOD_GRAD = {
    "Energía": "#ff6a00,#ffbe0b",
    "Relax": "#5f2c82,#0f0c29",
    "Entrenamiento": "#c31432,#240b36",
    "Concentración": "#134e5e,#71b280",
    "Fiesta": "#f857a6,#ff5858",
    "Todo": "#8e2de2,#4a00e0"
  };

  /* mood vacío = sin filtro (el chip "Todo") */
  const matchMood = (song) => !mood || song.moods.includes(mood);

  const visibleSongs = () =>
    DB.songs.filter((s) => {
      if (!matchMood(s)) return false;
      if (genre && albumOf(s).genre !== genre) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        artistLabelOf(s).toLowerCase().includes(q) ||
        albumOf(s).title.toLowerCase().includes(q)
      );
    });

  /* Estado de reproducción: barras animadas como en YouTube Music. */
  const nowPlaying = (id) =>
    id === Player.currentId
      ? '<span class="bars" aria-label="Sonando"><i></i><i></i><i></i></span>'
      : '<span class="idx"></span>';

  function card({ title, sub, art, round = false, onPlay, ctxItems, span = "" }) {
    return `
      <article class="card${round ? " artist" : ""}" tabindex="0" role="button"
               aria-label="Reproducir ${esc(title)}" data-play="${esc(onPlay)}" ${span}>
        <div class="cover" ${art ? `style="${coverStyle(art)}"` : ""}>
          ${art?.art ? artworkImage(artPath(art), `Portada de ${title}`) : ""}
          <div class="pb">${Layout.svg("play", 20)}</div>
        </div>
        <b>${esc(title)}</b>
        <span>${esc(sub)}</span>
        <button class="icon-btn dots" type="button" data-menu="${esc(onPlay)}"
                aria-label="Opciones de ${esc(title)}">${Layout.svg("dots", 18)}</button>
      </article>`;
  }

  function artistCarousel(ids) {
    if (!ids.length) return vacio("Ningún artista coincide");
    artistIndex = ((artistIndex % ids.length) + ids.length) % ids.length;
    const gap = Math.min(148, Math.max(82, Math.round(view().clientWidth * 0.16)));
    const items = ids.map((id, index) => {
      let offset = (index - artistIndex + ids.length) % ids.length;
      if (offset > ids.length / 2) offset -= ids.length;
      const distance = Math.abs(offset);
      const scale = [1.22, 0.78, 0.44, 0.2, 0.12][Math.min(distance, 4)];
      const opacity = [1, 0.8, 0.5, 0.28, 0.16][Math.min(distance, 4)];
      const artist = artistById[id];
      return `<button class="artist-stage-item${distance === 0 ? " selected" : ""}" type="button"
          data-artist="${index}" data-artist-id="${id}" aria-pressed="${distance === 0}" aria-label="${distance === 0 ? "Reproducir" : "Centrar"} ${esc(artist.name)}"
          style="--artist-shift:${offset * gap}px;--artist-scale:${scale};--artist-opacity:${opacity};--artist-depth:${10 - distance}">
          <span class="artist-orb" style="background:linear-gradient(145deg,${artist.colors})"></span>
          <b>${esc(artist.name)}</b><span>Artista</span></button>`;
    }).join("");
    return `<div class="artist-carousel">
      <button class="artist-arrow prev" data-act="artist-prev" type="button" aria-label="Artista anterior">${Layout.svg("back", 22)}</button>
      <div class="artist-stage" tabindex="0" aria-label="Carrusel de artistas; usa las flechas izquierda y derecha">
        ${items}
      </div>
      <button class="artist-arrow next" data-act="artist-next" type="button" aria-label="Artista siguiente">${Layout.svg("forward", 22)}</button>
    </div>`;
  }

  function songRow(song, i, { showAlbum = true, playedAt = null } = {}) {
    const album = albumOf(song);
    const fav = Player.isFav(song.id);
    const playedLabel = playedAt
      ? new Date(playedAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";
    return `
      <div class="song" data-play="${song.id}" tabindex="0" role="button"
           aria-label="Reproducir ${esc(song.title)}">
        <span class="song-idx">${nowPlaying(song.id) || `<span class="idx">${i + 1}</span>`}</span>
        <span class="thumb" style="background-image:linear-gradient(135deg,${album.colors})">${artworkImage(songArtPath(song), `Portada de ${song.title}`)}</span>
        <span class="song-text">
          <b class="${fav ? "faved" : ""}">${esc(song.title)}</b>
          <small>${esc(artistLabelOf(song))}${showAlbum ? " · " + esc(album.title) : ""}</small>
          ${playedLabel ? `<small class="history-time">Escuchada: ${esc(playedLabel)}</small>` : ""}
        </span>
        <button class="icon-btn like ${fav ? "on" : ""}" data-fav="${song.id}" type="button"
                aria-pressed="${fav}" aria-label="Favorita">${Layout.svg("heart", 18)}</button>
        <span class="song-dur">${fmtTime(song.duration)}</span>
        <button class="icon-btn dots" data-menu="song:${song.id}" type="button"
                aria-label="Opciones de ${esc(song.title)}">${Layout.svg("dots", 18)}</button>
      </div>`;
  }

  const section = (title, kicker, body, extra = "") => `
    <section class="sec">
      ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ""}
      <div class="sec-head"><h2>${esc(title)}</h2>${extra}</div>
      ${body}
    </section>`;

  /* ---------- acciones del menú contextual ---------- */
  function menuFor(key) {
    const [kind, id] = key.split(":");
    if (kind === "song") {
      const s = songById[id];
      const fav = Player.isFav(id);
      return [
        { label: "Reproducir después", icon: "next", run: () => Player.enqueue(id, { next: true }) },
        { label: "Añadir a la cola", icon: "queue", run: () => Player.enqueue(id) },
        { label: "Ir al álbum", icon: "library", run: () => goAlbum(albumOf(s)) },
        "-",
        { label: fav ? "Quitar de favoritos" : "Añadir a favoritos", icon: "heart", run: () => Player.toggleFav(id) },
        { label: "Añadir a una playlist…", icon: "plus", run: () => pickPlaylist(id) }
      ];
    }
    if (kind === "queue") {
      return [
        { label: "Reproducir ahora", icon: "play", run: () => Player.play(id) },
        { label: "Quitar de la cola", icon: "close", run: () => Player.removeFromQueue(id) }
      ];
    }
    /* álbum o artista: key = id de álbum, "art:" prefija los artistas */
    const isArtist = kind === "art";
    const songs = isArtist ? songsOfArtist(id) : songsOfAlbum(id);
    return [
      { label: "Reproducir", icon: "play", run: () => Player.play(songs[0].id, { from: songs.map((s) => s.id) }) },
      { label: "Añadir a la cola", icon: "queue", run: () => songs.forEach((s) => Player.enqueue(s.id)) },
      "-",
      {
        label: isArtist ? "Ver canciones" : "Ver álbum",
        icon: "library",
        run: () => (isArtist ? showArtist(id) : goAlbum(albumById[id]))
      }
    ];
  }

  function goAlbum(album) {
    if (!album) return;
    libraryAlbum = album;
    libTab = "canciones";
    store.set("wt:goto", { type: "album", id: album.id });
    location.href = ROOT + "biblioteca/Biblioteca.html";
  }

  function showArtist(id) {
    libraryArtist = id;
    libTab = "canciones";
    store.set("wt:goto", { type: "artist", id });
    location.href = ROOT + "biblioteca/Biblioteca.html";
  }

  let libraryAlbum = null;
  let libraryArtist = null;

  /* Diálogo mínimo para elegir playlist y para crear una nueva. */
  function pickPlaylist(trackId) {
    const pls = Player.allPlaylists();
    ctx.open(
      [
        ...pls.map((p) => ({
          label: `${p.name} (${p.ids.length})`,
          icon: "library",
          run: () => Player.addToPlaylist(p.name, trackId)
        })),
        "-",
        { label: "Nueva playlist…", icon: "plus", run: () => askName("Nombre de la playlist", (n) => {
            if (Player.createPlaylist(n)) Player.addToPlaylist(n, trackId);
          }) }
      ],
      innerWidth / 2 - 120,
      120
    );
  }

  function askName(label, run) {
    const name = prompt(label);
    if (name != null) run(name.trim());
  }

  /* ---------- sidebar: playlists ---------- */
  function renderPlaylists() {
    const box = document.querySelector('[data-slot="playlists"]');
    if (!box) return;
    const rows = [
      `<a class="pl ${libraryAlbum === null && libTab === "favoritos" ? "on" : ""}" data-pl="Favoritos">
         ${Layout.svg("heart", 18)}<span>Favoritos</span>
         <em>${DB.songs.filter((s) => Player.isFav(s.id)).length || ""}</em>
       </a>`,
      ...Player.allPlaylists().map(
        (p) => `<a class="pl" data-pl="${esc(p.name)}">
                  ${Layout.svg("library", 18)}<span>${esc(p.name)}</span>
                  <em>${p.ids.length || ""}</em>
                  ${p.fixed ? "" : `<button class="icon-btn xs" data-del-pl="${esc(p.name)}"
                        aria-label="Eliminar ${esc(p.name)}">${Layout.svg("trash", 16)}</button>`}
                </a>`
      )
    ];
    box.innerHTML = rows.join("");
  }

  /* ---------- vista: Inicio ---------- */
  function viewHome() {
    const songs = visibleSongs();
    const lastEntry = ListenHistory.last();
    const lastSong = lastEntry && songById[lastEntry.id];
    const heroSong = lastSong || songs[0] || DB.songs[0];
    const hero = albumOf(heroSong);
    const listeningHistory = ListenHistory.all().filter((entry) => songById[entry.id]);

    const chips = `<button class="chip${!mood ? " on" : ""}" data-mood="" type="button">Todo</button>` +
      MOODS.filter((m) => m.id !== "Todo").map((m) =>
        `<button class="chip${mood === m.id ? " on" : ""}" data-mood="${m.id}" type="button">${esc(m.id)}</button>`
      ).join("");

    const albums = [...new Set(songs.map((s) => s.albumId))]
      .map((id) => albumById[id])
      .filter(Boolean);
    const artists = [...new Set(songs.map((s) => artistOf(s).id))];

    view().innerHTML = `
      ${!query ? `
      <div class="hero" style="--h1:${hero.colors.split(",")[0]};--h2:${hero.colors.split(",")[1]}">
        <div class="hero-text">
          <p class="kicker">${lastSong ? "Última canción escuchada" : "Empieza a escuchar"}</p>
          <h1>${esc(heroSong.title)}</h1>
          <p class="hero-sub">${esc(artistLabelOf(heroSong))} · ${esc(albumOf(heroSong).title)}</p>
          <button class="btn-play" data-play="${heroSong.id}" type="button">
            ${Layout.svg("play", 20)}<span>Reproducir</span>
          </button>
        </div>
        <div class="hero-art" style="${coverStyle(hero)}">${artworkImage(songArtPath(heroSong), `Portada de ${heroSong.title}`, "eager")}</div>
      </div>` : ""}

      <div class="chips">${chips}</div>

      ${!query && !mood ? section("Historial de escucha", "", listeningHistory.length
        ? `<div class="songs">${listeningHistory.slice(0, 12).map((entry, i) => songRow(songById[entry.id], i, { playedAt: entry.playedAt })).join("")}</div>`
        : vacio("Las canciones que reproduzcas aparecerán aquí")) : ""}

      ${section("Álbumes", "DE TU BIBLIOTECA", albums.length ? `
        <div class="grid">
          ${albums.map((al) => card({
            title: al.title,
            sub: artistLabel(al) + " · " + al.year,
            art: al,
            onPlay: songsOfAlbum(al.id)[0]?.id || ""
          })).join("")}
        </div>` : vacio("Ningún álbum coincide"))}

      ${section("Artistas", "", artistCarousel(artists))}

      ${section(query ? `Resultados para “${query}”` : "Canciones", query ? "" : "DE TU BIBLIOTECA",
        songs.length ? `<div class="songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>`
        : vacio("Ninguna canción coincide"))}`;
  }

  const vacio = (msg) => `<p class="empty">${esc(msg)}</p>`;

  /* ---------- vista: Explorar ---------- */
  function viewExplorar() {
    const songs = visibleSongs();
    const genres = [...new Set(DB.albums.map((a) => a.genre))];

    /* un tile por género, teñido con el color de la portada de su álbum */
    const tiles = genres.map((g) => {
      const al = DB.albums.find((a) => a.genre === g);
      const n = DB.songs.filter((s) => albumOf(s).genre === g).length;
      return `<button class="tile${genre === g ? " on" : ""}" data-genre="${esc(g)}" type="button"
                      aria-pressed="${genre === g}" style="--t:${al.colors.split(",")[0]}">
                <b>${esc(g)}</b><span>${n} ${n === 1 ? "canción" : "canciones"}</span>
              </button>`;
    }).join("");

    const moodTiles = MOODS.filter((m) => m.id !== "Todo").map((m) => {
      const n = DB.songs.filter((s) => s.moods.includes(m.id)).length;
      return `<button class="tile mood${mood === m.id ? " on" : ""}" data-mood="${m.id}" type="button"
                      aria-pressed="${mood === m.id}" style="--t:${MOOD_GRAD[m.id].split(",")[0]}">
                <span class="emoji">${m.emoji}</span><b>${esc(m.id)}</b><span>${n}</span>
              </button>`;
    }).join("");

    const filtro = genre || mood;

    view().innerHTML = `
      <p class="kicker">EXPLORAR</p>
      <h1 class="page-title">Explora tu música</h1>
      <div class="chips">
        <button class="chip${!filtro ? " on" : ""}" data-mood="" type="button">Todo</button>
        ${MOODS.filter((m) => m.id !== "Todo").map((m) =>
          `<button class="chip${mood === m.id ? " on" : ""}" data-mood="${m.id}" type="button">${esc(m.id)}</button>`
        ).join("")}
      </div>

      ${section("Géneros", "", `<div class="tiles">${tiles}</div>`)}
      ${section("Estados de ánimo", "", `<div class="tiles">${moodTiles}</div>`)}

      ${section(
        filtro ? (genre ? "Canciones de " + genre : mood) : "Canciones destacadas",
        songs.length ? songs.length + (songs.length === 1 ? " canción" : " canciones") : "",
        songs.length ? `<div class="songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>`
        : vacio("Nada por aquí todavía")
      )}`;
  }

  /* ---------- vista: Biblioteca ---------- */
  function viewBiblioteca() {
    const songs = visibleSongs();

    const destination = store.get("wt:goto", null);
    if (destination) store.set("wt:goto", null);
    if (destination?.type === "album" && albumById[destination.id]) {
      return viewAlbum(albumById[destination.id], songsOfAlbum(destination.id));
    }
    if (destination?.type === "artist" && artistById[destination.id]) {
      return viewArtist(artistById[destination.id], songsOfArtist(destination.id));
    }

    /* ¿Se ha entrado a un álbum o artista concreto desde otra página? */
    if (libraryAlbum) {
      const al = libraryAlbum;
      libraryAlbum = null;
      return viewAlbum(al, songs.filter((s) => s.albumId === al.id));
    }
    if (libraryArtist) {
      const ar = artistById[libraryArtist];
      const songs = songsOfArtist(libraryArtist);
      libraryArtist = null;
      return viewArtist(ar, songs);
    }

    const libPls = Player.allPlaylists();
    const favs = songs.filter((s) => Player.isFav(s.id));

    const tab = (id, label, n) =>
      `<button class="ltab${libTab === id ? " on" : ""}" data-libtab="${id}" type="button">
         ${esc(label)}<em>${n}</em></button>`;

    let body;
    if (libTab === "canciones") {
      body = songs.length
        ? `<div class="songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>`
        : vacio("Tu biblioteca está vacía");
    } else if (libTab === "albumes") {
      const albums = [...new Set(songs.map((s) => s.albumId))].map((id) => albumById[id]);
      body = albums.length
        ? `<div class="grid">${albums.map((al) => card({
            title: al.title, sub: artistLabel(al), art: al,
            onPlay: songsOfAlbum(al.id)[0]?.id || ""
          })).join("")}</div>`
        : vacio("Sin álbumes");
    } else if (libTab === "artistas") {
      const artists = [...new Set(songs.map((s) => artistOf(s).id))];
      body = artists.length
        ? artistCarousel(artists)
        : vacio("Sin artistas");
    } else if (libTab === "playlists") {
      body = libPls.length
        ? `<div class="grid">${libPls.map((p) => {
            const first = p.ids.length ? trackOfSafe(p.ids[0]) : null;
            return card({
              title: p.name,
              sub: p.ids.length + (p.ids.length === 1 ? " canción" : " canciones"),
              art: first ? albumOf(first) : null,
              onPlay: p.ids[0] || ""
            });
          }).join("")}</div>`
        : vacio("Crea tu primera playlist con «+ Nueva playlist»");
    } else {
      body = favs.length
        ? `<div class="songs">${favs.map((s, i) => songRow(s, i)).join("")}</div>`
        : vacio("Marca el corazón de una canción para guardarla aquí");
    }

    view().innerHTML = `
      <p class="kicker">BIBLIOTECA</p>
      <h1 class="page-title">Tus canciones</h1>
      <div class="ltabs">
        ${tab("canciones", "Canciones", songs.length)}
        ${tab("albunes", "Álbumes", new Set(songs.map((s) => s.albumId)).size)}
        ${tab("artistas", "Artistas", new Set(songs.map((s) => artistOf(s).id)).size)}
        ${tab("playlists", "Playlists", libPls.length)}
        ${tab("favoritos", "Favoritos", favs.length)}
      </div>${body}`;
  }

  const trackOfSafe = (id) => songById[id];

  function viewAlbum(al, songs) {
    const all = songsOfAlbum(al.id);
    view().innerHTML = `
      <div class="album-head" style="--h1:${al.colors.split(",")[0]};--h2:${al.colors.split(",")[1]}">
        <div class="album-cover" style="${coverStyle(al)}">${artworkImage(artPath(al), `Portada de ${al.title}`, "eager")}</div>
        <div class="album-info">
          <p class="kicker">ÁLBUM · ${esc(al.genre)}</p>
          <h1 class="page-title">${esc(al.title)}</h1>
          <p class="album-meta">${esc(artistLabel(al))} · ${al.year} · ${all.length} canción${all.length === 1 ? "" : "es"}</p>
          <div class="album-actions">
            <button class="btn-play" data-play="${all[0]?.id || ""}" type="button">
              ${Layout.svg("play", 20)}<span>Reproducir</span>
            </button>
            <button class="icon-btn lg" data-menu="${al.id}" type="button" aria-label="Opciones del álbum">
              ${Layout.svg("dots", 22)}
            </button>
          </div>
        </div>
      </div>
      <div class="songs">${songs.map((s, i) => songRow(s, i, { showAlbum: false })).join("")}</div>`;
  }

  function viewArtist(ar, songs) {
    view().innerHTML = `
      <div class="album-head">
        <div class="album-cover round" style="background-image:linear-gradient(135deg,${ar.colors})"></div>
        <div class="album-info">
          <p class="kicker">ARTISTA</p>
          <h1 class="page-title">${esc(ar.name)}</h1>
          <p class="album-meta">${songs.length} canción${songs.length === 1 ? "" : "es"}</p>
          <div class="album-actions">
            <button class="btn-play" data-play="art:${ar.id}" type="button">
              ${Layout.svg("play", 20)}<span>Reproducir</span>
            </button>
          </div>
        </div>
      </div>
      <div class="songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>`;
  }

  /* ---------- cola ---------- */
  function renderQueue() {
    const q = Player.queue.filter((id) => songById[id]);
    const list = q
      .map((id) => {
        const s = trackOfSafe(id);
        const cur = id === Player.currentId;
        return `
        <li class="q-item${cur ? " current" : ""}" draggable="true" data-id="${id}">
          <span class="q-grip" aria-hidden="true">${Layout.svg("drag", 16)}</span>
          <button class="q-main" data-play="${id}" type="button">
            <span class="q-art" style="background-image:linear-gradient(135deg,${albumOf(s).colors})">${artworkImage(songArtPath(s), `Portada de ${s.title}`)}</span>
            <span class="q-text">
              <span class="q-title">${esc(s.title)}</span>
              <span class="q-artist">${esc(artistLabelOf(s))}</span>
            </span>
          </button>
          ${cur ? '<span class="bars"><i></i><i></i><i></i></span>' : ""}
          <button class="icon-btn xs" data-menu="queue:${id}" type="button" aria-label="Opciones">
            ${Layout.svg("dots", 16)}
          </button>
        </li>`;
      })
      .join("");

    document.querySelector('[data-slot="queue"]').innerHTML = list;
    document.querySelector('[data-slot="xp-queue"]').innerHTML = list;

    const badge = document.querySelector('[data-ctl="queue-count"]');
    if (badge) {
      badge.textContent = q.length;
      badge.hidden = !q.length;
    }
  }

  /* ---------- letra ---------- */
  /* No hay letra en los MP3: se dice con claridad en vez de inventarla. */
  function parseLyrics(text) {
    return String(text || "").split(/\r?\n/).flatMap((line) => {
      const stamps = [...line.matchAll(/\[(\d{1,2}):(\d{2}(?:\.\d{1,2})?)\]/g)];
      const content = line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,2})?\]/g, "").trim();
      return stamps.map((m) => ({ time: Number(m[1]) * 60 + Number(m[2]), text: content }));
    }).sort((a, b) => a.time - b.time);
  }

  function renderLyrics(song, currentTime = 0) {
    const box = document.querySelector('[data-slot="lyrics"]');
    if (!box || !song) return;
    const album = albumOf(song);
    const lyrics = store.get(LYRIC_KEY, {});
    const text = lyrics[song.id] || "";
    if (lyricEditId === song.id) {
      box.dataset.lyricSignature = `editing:${song.id}`;
      box.innerHTML = `<p class="dim">Añade tu letra o pega líneas con marcas de tiempo, por ejemplo [00:12.40] Primera línea.</p>
        <textarea class="lyrics-editor" data-lyrics-input aria-label="Editar letra" placeholder="[00:12.40] Primera línea\n[00:16.00] Segunda línea">${esc(text)}</textarea>
        <div class="lyrics-actions"><button class="btn-play" data-act="lyrics-save" type="button">Guardar letra</button><button class="lyrics-cancel" data-act="lyrics-cancel" type="button">Cancelar</button></div>`;
      return;
    }
    const lines = parseLyrics(text);
    if (!lines.length) {
      if (lyricEditId !== song.id && box.dataset.lyricSignature === `${song.id}:empty`) return;
      box.dataset.lyricSignature = `${song.id}:empty`;
      box.innerHTML = `<p class="lyrics-none">${Layout.svg("lyrics", 32)}</p><p>Aún no hay letra para <b>${esc(song.title)}</b>.</p>
        <p class="dim">Puedes guardar una letra propia o sincronizarla con marcas de tiempo.</p>
        <button class="lyrics-edit" data-act="lyrics-edit" type="button">Añadir letra</button>
        <p class="dim">${esc(artistLabel(album))} · ${esc(album.title)}</p>`;
      return;
    }
    let active = -1;
    lines.forEach((line, index) => { if (line.time <= currentTime) active = index; });
    const signature = `${song.id}:${active}`;
    if (lyricEditId !== song.id && box.dataset.lyricSignature === signature) return;
    box.dataset.lyricSignature = signature;
    box.innerHTML = `<div class="lyrics-heading"><span class="dim">Letra sincronizada</span><button class="lyrics-edit" data-act="lyrics-edit" type="button">Editar</button></div>
      <div class="lyrics-scroll">${lines.map((line, i) => `<p class="lyric-line${i === active ? " active" : ""}" ${i === active ? 'aria-current="true"' : ""}>${esc(line.text || "…")}</p>`).join("")}</div>`;
    box.querySelector(".lyric-line.active")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* ---------- montaje ---------- */
  function mount() {
    document.getElementById("sidebar").innerHTML = Layout.sidebar();
    document.getElementById("topbar").innerHTML = Layout.topbar();
    document.getElementById("player").innerHTML = Layout.player();

    const aside = document.createElement("div");
    aside.innerHTML = Layout.queuePanel() + Layout.expanded() + Layout.menu() +
      '<div class="toast" id="wtToast" role="status" aria-live="polite"></div>';
    document.body.append(...aside.children);

    Player.init();
    ctx.node = document.querySelector('[data-slot="ctx"]');

    render();
    renderPlaylists();
    renderQueue();

    /* el reproductor refleja lo que Player.js haya restaurado */
    Player.subscribe((evt, data) => {
      if (evt === "track") {
        const s = data;
        const album = s ? albumOf(s) : null;
        document.querySelectorAll('[data-ctl="title"]').forEach((n) =>
          (n.textContent = s ? s.title : "Elige una canción")
        );
        document.querySelectorAll('[data-ctl="artist"]').forEach((n) =>
          (n.textContent = s ? artistLabelOf(s) : "Glassy Music")
        );
        const thumb = document.querySelector('[data-ctl="expand"]');
        if (thumb) thumb.style.cssText = s ? songCoverStyle(s) : "";
        lyricEditId = null;
        if (s) renderLyrics(s);
        refreshFavButtons();
      }
      if (evt === "time" && Player.currentId) renderLyrics(songById[Player.currentId], data);
      if (evt === "queue") renderQueue();
      if (evt === "shuffle") {
        document.querySelectorAll('[data-ctl="shuffle"]').forEach((n) => {
          n.classList.toggle("on", Player.shuffle);
          n.setAttribute("aria-pressed", String(Player.shuffle));
        });
      }
      if (evt === "repeat") {
        document.querySelectorAll('[data-ctl="repeat"]').forEach((n) => {
          n.classList.toggle("on", Player.repeat > 0);
          n.classList.toggle("one", Player.repeat === 2);
          n.setAttribute("aria-pressed", String(Player.repeat > 0));
          n.setAttribute("aria-label", "Repetir: " + ["desactivado", "lista", "una canción"][Player.repeat]);
        });
        document.querySelectorAll('[data-ctl="repeat-one"]').forEach((n) => (n.hidden = Player.repeat !== 2));
      }
      if (evt === "volume") {
        const muted = data === 0;
        document.querySelectorAll('[data-ctl="icon-vol"]').forEach((n) => (n.hidden = muted));
        document.querySelectorAll('[data-ctl="icon-mute"]').forEach((n) => (n.hidden = !muted));
      }
      if (evt === "favs") { render(); renderPlaylists(); }
      if (evt === "playlists") { renderPlaylists(); }
      if (evt === "expanded") renderQueue();
    });
    if (Player.currentId) {
      const restored = songById[Player.currentId];
      document.querySelectorAll('[data-ctl="title"]').forEach((n) => (n.textContent = restored.title));
      document.querySelectorAll('[data-ctl="artist"]').forEach((n) => (n.textContent = artistLabelOf(restored)));
      const thumb = document.querySelector('[data-ctl="expand"]');
      if (thumb) thumb.style.cssText = songCoverStyle(restored);
      renderLyrics(restored);
      refreshFavButtons();
    }
  }

  function refreshFavButtons() {
    document.querySelectorAll("[data-fav]").forEach((n) => {
      const on = Player.isFav(n.dataset.fav);
      n.classList.toggle("on", on);
      n.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll('[data-ctl="fav"]').forEach((n) => {
      const on = Player.currentId ? Player.isFav(Player.currentId) : false;
      n.classList.toggle("on", on);
      n.setAttribute("aria-pressed", String(on));
    });
  }

  function render() {
    const page = Layout.current();
    if (page === "explorar") viewExplorar();
    else if (page === "biblioteca") viewBiblioteca();
    else viewHome();
    refreshFavButtons();
  }

  /* ---------- eventos globales ---------- */
  function wire() {
    document.addEventListener("pointerdown", (e) => {
      const stage = e.target.closest(".artist-stage");
      if (!stage || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      artistGesture = { stage, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      if (e.pointerType === "mouse") stage.setPointerCapture(e.pointerId);
    }, { passive: true });

    document.addEventListener("pointermove", (e) => {
      if (!artistGesture || e.pointerId !== artistGesture.pointerId) return;
      const dx = e.clientX - artistGesture.x;
      const dy = e.clientY - artistGesture.y;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) artistGesture.stage.classList.add("dragging");
    }, { passive: true });

    const finishArtistGesture = (e) => {
      if (!artistGesture || e.pointerId !== artistGesture.pointerId) return;
      const { stage, x, y } = artistGesture;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      stage.classList.remove("dragging");
      artistGesture = null;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      artistIndex += dx < 0 ? 1 : -1;
      suppressArtistClickUntil = Date.now() + 450;
      render();
    };
    document.addEventListener("pointerup", finishArtistGesture, { passive: true });
    document.addEventListener("pointercancel", (e) => {
      if (!artistGesture || e.pointerId !== artistGesture.pointerId) return;
      artistGesture.stage.classList.remove("dragging");
      artistGesture = null;
    }, { passive: true });

    /* clic en tarjetas y canciones */
    document.addEventListener("click", (e) => {
      if (Date.now() < suppressArtistClickUntil) {
        e.preventDefault();
        return;
      }
      const artistCard = e.target.closest("[data-artist]");
      if (artistCard) {
        const nextIndex = Number(artistCard.dataset.artist);
        if (nextIndex === artistIndex) {
          const artistId = artistCard.dataset.artistId;
          const songs = songsOfArtist(artistId);
          if (songs.length) Player.play(songs[0].id, { from: songs.map((song) => song.id) });
        } else {
          artistIndex = nextIndex;
          render();
        }
        return;
      }
      const fav = e.target.closest("[data-fav]");
      if (fav) { Player.toggleFav(fav.dataset.fav); return; }

      const menuBtn = e.target.closest("[data-menu]");
      if (menuBtn) {
        const r = menuBtn.getBoundingClientRect();
        ctx.open(menuFor(menuBtn.dataset.menu), r.right - 8, r.bottom + 4);
        return;
      }

      const chip = e.target.closest("[data-mood]");
      if (chip) { moodFilter(chip.dataset.mood); return; }

      const gTile = e.target.closest("[data-genre]");
      if (gTile) { genreFilter(gTile.dataset.genre); return; }

      const libtab = e.target.closest("[data-libtab]");
      if (libtab) { libTab = libtab.dataset.libtab; render(); return; }

      const delPl = e.target.closest("[data-del-pl]");
      if (delPl) {
        e.stopPropagation();
        if (confirm(`¿Eliminar la playlist «${delPl.dataset.delPl}»?`)) Player.deletePlaylist(delPl.dataset.delPl);
        return;
      }

      const pl = e.target.closest("[data-pl]");
      if (pl) {
        location.href = ROOT + "biblioteca/Biblioteca.html";
        store.set("wt:openplaylist", pl.dataset.pl);
        return;
      }

      const play = e.target.closest("[data-play]");
      if (play && play.dataset.play) {
        const key = play.dataset.play;
        if (key.startsWith("art:")) {
          const songs = songsOfArtist(key.slice(4));
          if (songs.length) Player.play(songs[0].id, { from: songs.map((s) => s.id) });
        } else {
          Player.play(key, { from: visibleSongs().map((s) => s.id) });
        }
      }
    });

    /* teclado en tarjetas y canciones */
    document.addEventListener("keydown", (e) => {
      if (e.target.closest(".artist-stage") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        artistIndex += e.key === "ArrowLeft" ? -1 : 1;
        render();
        document.querySelector(".artist-stage")?.focus();
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const t = e.target.closest("[data-play]");
      if (!t) return;
      e.preventDefault();
      t.click();
    });

    /* barra lateral y barra superior */
    document.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "menu") document.body.classList.add("sb-open");
      if (act === "close-ctx") ctx.close();
      if (act === "close-queue") Player.toggleQueue(false);
      if (act === "collapse") Player.closeExpanded();
      if (act === "back") history.back();
      if (act === "forward") history.forward();
      if (act === "new-playlist")
        askName("Nombre de la playlist", (n) => Player.createPlaylist(n));
      if (act === "artist-prev" || act === "artist-next") {
        artistIndex += act === "artist-prev" ? -1 : 1;
        render();
      }
      if (act === "import-music") document.getElementById("music-files")?.click();
      if (act === "settings") openSettings();
      if (act === "settings-close") document.querySelector(".settings-backdrop").hidden = true;
      if (act === "lyrics-edit" && Player.currentId) { lyricEditId = Player.currentId; renderLyrics(songById[lyricEditId]); }
      if (act === "lyrics-cancel") { lyricEditId = null; renderLyrics(songById[Player.currentId]); }
      if (act === "lyrics-save" && Player.currentId) {
        const allLyrics = store.get(LYRIC_KEY, {});
        allLyrics[Player.currentId] = document.querySelector("[data-lyrics-input]")?.value || "";
        store.set(LYRIC_KEY, allLyrics);
        lyricEditId = null;
        renderLyrics(songById[Player.currentId]);
        Player.toast("Letra guardada en este dispositivo");
      }
    });

    /* elegir acción del menú contextual */
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".ctx [data-i]");
      if (!b) return;
      const item = ctx.items[Number(b.dataset.i)];
      ctx.close();
      item && item.run();
    });

    /* buscador */
    let t = null;
    document.getElementById("q").addEventListener("input", (e) => {
      clearTimeout(t);
      const v = e.target.value;
      t = setTimeout(() => { query = v.trim(); render(); }, 180);
    });

    document.getElementById("music-files")?.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files?.length) return;
      try {
        const result = await Player.importMusic(files);
        if (result.imported) {
          Player.toast(`${result.imported} canción${result.imported === 1 ? "" : "es"} importada${result.imported === 1 ? "" : "s"}`);
          if (result.unmatched.length) console.info("Archivos sin coincidencia en el catálogo:", result.unmatched);
        } else {
          Player.toast("No encontré coincidencias. Elige los archivos con los nombres del catálogo.");
        }
      } catch (error) {
        console.error("No se pudo importar la música:", error);
        Player.toast("No se pudo guardar la música local en este navegador");
      } finally {
        e.target.value = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const settings = document.querySelector(".settings-backdrop");
        if (settings && !settings.hidden) settings.hidden = true;
        ctx.close();
        document.body.classList.remove("sb-open");
        Player.toggleQueue(false);
      }
    });

    /* al saltar de pestaña se recogen el cajón y el panel de cola */
    document.querySelector(".nav").addEventListener("click", () => {
      document.body.classList.remove("sb-open");
      Player.toggleQueue(false);
    });

    /* si seAsked abrir una playlist desde la barra lateral */
    const openPl = store.get("wt:openplaylist", null);
    if (openPl) {
      store.set("wt:openplaylist", null);
      const songs = Player.playlistSongs(openPl);
      if (songs.length) {
        Player.play(songs[0].id, { from: songs.map((s) => s.id) });
        Player.toast("Reproduciendo «" + openPl + "»");
      } else {
        Player.toast("La playlist «" + openPl + "» está vacía");
      }
    }
  }

  /* Elegir un género o un estado de ánimo son filtros excluyentes: al pulsar
     uno se limpia el otro, y pulsarlo de nuevo lo desactiva. */
  function genreFilter(g) {
    genre = genre === g ? "" : g;   /* volver a pulsar el mismo lo desactiva */
    mood = "";
    render();
  }

  function moodFilter(m) {
    mood = mood === m ? "" : m;
    genre = "";
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    mount();
    applyAppearance();
    wire();
    registerSW();
  });

  /* PWA: solo cuando se sirve por HTTP/HTTPS (en file:// no hay service worker) */
  function registerSW() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register(ROOT + "sw.js", { scope: ROOT || "./" }).catch(() => {});
  }

  return { render, renderQueue, renderPlaylists, refreshFavButtons };
})();
