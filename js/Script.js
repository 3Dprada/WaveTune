/* Monta el chrome común y dibra la vista de la página activa.
   Las tres páginas comparten este archivo entero: solo cambia <body data-page>. */

const App = (() => {
  "use strict";

  const view = () => document.getElementById("view");
  let query = "";
  let mood = "";      // chip de estado de ánimo seleccionado
  let genre = "";     // género elegido en Explorar
  let libTab = "canciones";

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
          <div class="pb">${Layout.svg("play", 20)}</div>
        </div>
        <b>${esc(title)}</b>
        <span>${esc(sub)}</span>
        <button class="icon-btn dots" type="button" data-menu="${esc(onPlay)}"
                aria-label="Opciones de ${esc(title)}">${Layout.svg("dots", 18)}</button>
      </article>`;
  }

  function songRow(song, i, { showAlbum = true } = {}) {
    const album = albumOf(song);
    const fav = Player.isFav(song.id);
    return `
      <div class="song" data-play="${song.id}" tabindex="0" role="button"
           aria-label="Reproducir ${esc(song.title)}">
        <span class="song-idx">${nowPlaying(song.id) || `<span class="idx">${i + 1}</span>`}</span>
        <span class="thumb" style="${coverStyle(album)}"></span>
        <span class="song-text">
          <b class="${fav ? "faved" : ""}">${esc(song.title)}</b>
          <small>${esc(artistLabelOf(song))}${showAlbum ? " · " + esc(album.title) : ""}</small>
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
    libraryAlbum = album;
    libTab = "canciones";
    navigate("../biblioteca/Biblioteca.html");
  }

  function showArtist(id) {
    libraryArtist = id;
    libTab = "canciones";
    navigate("../biblioteca/Biblioteca.html");
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
    const hero = albumById[DB.songs[0].albumId];
    const heroSong = songs[0] || DB.songs[0];

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
          <p class="kicker">Siguiente en tu cola</p>
          <h1>${esc(heroSong.title)}</h1>
          <p class="hero-sub">${esc(artistLabelOf(heroSong))} · ${esc(albumOf(heroSong).title)}</p>
          <button class="btn-play" data-play="${heroSong.id}" type="button">
            ${Layout.svg("play", 20)}<span>Reproducir</span>
          </button>
        </div>
        <div class="hero-art" style="${coverStyle(hero)}"></div>
      </div>` : ""}

      <div class="chips">${chips}</div>

      ${!query && !mood ? section("Escuchado recientemente", "", albums.slice(0, 6).map((al) => `
        <div class="grid">
          ${albums.slice(0, 6).map((al) => card({
            title: al.title,
            sub: artistLabel(al),
            art: al,
            onPlay: songsOfAlbum(al.id)[0]?.id || ""
          })).join("")}
        </div>`)) : ""}

      ${section("Álbumes", "DE TU BIBLIOTECA", albums.length ? `
        <div class="grid">
          ${albums.map((al) => card({
            title: al.title,
            sub: artistLabel(al) + " · " + al.year,
            art: al,
            onPlay: songsOfAlbum(al.id)[0]?.id || ""
          })).join("")}
        </div>` : vacio("Ningún álbum coincide"))}

      ${section("Artistas", "", artists.length ? `
        <div class="grid">
          ${artists.map((id) => card({
            title: artistById[id].name,
            sub: "Artista",
            round: true,
            onPlay: "art:" + id
          })).join("")}
        </div>` : vacio("Ningún artista coincide"))}

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
        ? `<div class="grid">${artists.map((id) => card({
            title: artistById[id].name, sub: "Artista", round: true, onPlay: "art:" + id
          })).join("")}</div>`
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
        <div class="album-cover" style="${coverStyle(al)}"></div>
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
            <span class="q-art" style="${coverStyle(albumOf(s))}"></span>
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
  function renderLyrics(song) {
    const box = document.querySelector('[data-slot="lyrics"]');
    if (!box || !song) return;
    const album = albumOf(song);
    box.innerHTML = `
      <p class="lyrics-none">${Layout.svg("lyrics", 32)}</p>
      <p>No hay letra guardada para <b>${esc(song.title)}</b>.</p>
      <p class="dim">WaveTune lee los metadatos de los MP3, y este archivo no incluye
      la letra incrustada (Lyrics3 / USLT).</p>
      <p class="dim">${esc(artistLabel(album))} · ${esc(album.title)}</p>`;
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
        if (thumb) thumb.style.cssText = s ? coverStyle(album) : "";
        if (s) renderLyrics(s);
        refreshFavButtons();
      }
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
    /* clic en tarjetas y canciones */
    document.addEventListener("click", (e) => {
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

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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
