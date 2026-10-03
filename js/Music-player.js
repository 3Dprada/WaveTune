(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- referencias DOM ---------- */
  const audio = $("audio");
  const preload = $("preload");
  const player = $("player");
  const pArt = $("pArt");
  const pTitle = $("pTitle");
  const pArtist = $("pArtist");
  const pPlay = $("pPlay");
  const pPrev = $("pPrev");
  const pNext = $("pNext");
  const pSeek = $("pSeek");
  const pCurrent = $("pCurrent");
  const pDuration = $("pDuration");
  const pMute = $("pMute");
  const iPlay = $("iPlay");
  const iPause = $("iPause");
  const iVol = $("iVol");
  const iMute = $("iMute");
  const pVol = $("pVol");
  const pShuffle = $("pShuffle");
  const pRepeat = $("pRepeat");
  const pRepeatOne = $("pRepeatOne");
  const pLive = $("pLive");
  const buscar = $("buscar");
  const albumGrid = $("albumGrid");
  const trackList = $("trackList");
  const fSort = $("fSort");
  const fArtist = $("fArtist");
  const fYear = $("fYear");
  const btnQueue = $("btnQueue");
  const queueBadge = $("queueBadge");
  const queueList = $("queueList");
  const offcanvasQueue = $("offcanvasQueue");
  const offcanvasPlaylists = $("offcanvasPlaylists");
  const plName = $("plName");
  const plCreate = $("plCreate");
  const plPending = $("plPending");
  const plList = $("plList");
  const btnTheme = $("btnTheme");
  const iSun = $("iSun");
  const iMoon = $("iMoon");
  const navFavs = $("navFavs");
  const sidebar = $("sidebar");
  const btnSidebar = $("btnSidebar");
  const btnSidebarFab = $("btnSidebarFab");
  const sbBackdrop = $("sbBackdrop");
  const btnSearchMini = $("btnSearchMini");
  const wtToast = $("wtToast");
  const pExpandToggle = $("pExpandToggle");
  const iExpand = $("iExpand");
  const iCollapse = $("iCollapse");
  const pQueueList = $("pQueueList");

  if (typeof CATALOG === "undefined") return;

  /* ---------- estado ---------- */
  let queue = [];
  let playingId = null;
  let shuffleOn = false;
  let repeatMode = 0; // 0 = desactivado, 1 = lista, 2 = una canción
  let favs = new Set();
  let favsOnly = false;
  let playlists = {};
  let pendingTrack = null;
  let searchTimer = null;
  let lastSave = 0;
  let theme = "dark";
  let toastTimer = null;

  const ST = {
    state: "wt:state",
    settings: "wt:settings",
    queue: "wt:queue",
    favs: "wt:favs",
    playlists: "wt:playlists",
    theme: "wt:theme",
    sidebar: "wt:sidebar",
    catalog: "wt:catalog",
  };

  /* ---------- helpers ---------- */
  function trackById(id) {
    return CATALOG.tracks.find((t) => t.id === id);
  }
  function albumOf(track) {
    return CATALOG.albums.find((a) => a.id === track.album);
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]
    );
  }
  function fmt(s) {
    if (!Number.isFinite(s) || s < 0 || s === Infinity) return "—";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  /* ---------- persistencia ---------- */
  const store = {
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? def : JSON.parse(v);
      } catch {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        /* sin almacenamiento (p. ej. file:// bloqueado) */
      }
    },
  };

  function persistState() {
    store.set(ST.state, { id: playingId, time: audio.currentTime });
  }
  function persistSettings() {
    store.set(ST.settings, {
      volume: audio.volume,
      muted: audio.muted,
      shuffle: shuffleOn,
      repeat: repeatMode,
    });
  }
  function persistQueue() {
    store.set(ST.queue, queue);
  }
  function persistFavs() {
    store.set(ST.favs, [...favs]);
  }
  function persistPlaylists() {
    store.set(ST.playlists, playlists);
  }

  /* ---------- selección/filtrado ---------- */
  function baseFilteredTracks() {
    const q = buscar.value.trim().toLowerCase();
    let list = CATALOG.tracks.filter((t) => {
      if (favsOnly && !favs.has(t.id)) return false;
      if (
        q &&
        !(
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (albumOf(t) && albumOf(t).title.toLowerCase().includes(q))
        )
      )
        return false;
      const artist = fArtist.value;
      if (artist && t.artist !== artist) return false;
      const year = fYear.value;
      if (year && albumOf(t) && albumOf(t).year !== Number(year)) return false;
      return true;
    });
    return list;
  }

  function baseFilteredAlbums() {
    const q = buscar.value.trim().toLowerCase();
    let list = CATALOG.albums.filter((a) => {
      if (
        q &&
        !(a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
      )
        return false;
      if (fArtist.value && a.artist !== fArtist.value) return false;
      if (fYear.value && a.year !== Number(fYear.value)) return false;
      if (favsOnly) {
        const ids = CATALOG.tracks.filter((t) => t.album === a.id).map((t) => t.id);
        if (!ids.some((id) => favs.has(id))) return false;
      }
      return true;
    });
    return list;
  }

  function sortedTracks() {
    const sort = fSort.value;
    const list = baseFilteredTracks();
    if (sort === "title") return list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "artist")
      return list.sort(
        (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
      );
    if (sort === "year-desc")
      return list.sort((a, b) => (albumOf(b).year || 0) - (albumOf(a).year || 0));
    if (sort === "year-asc")
      return list.sort((a, b) => (albumOf(a).year || 0) - (albumOf(b).year || 0));
    if (sort === "duration")
      return list.sort(
        (a, b) => (a.duration ?? Infinity) - (b.duration ?? Infinity)
      );
    return list;
  }

  function sortedAlbums() {
    const sort = fSort.value;
    const list = baseFilteredAlbums();
    if (sort === "title") return list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "artist")
      return list.sort((a, b) => a.artist.localeCompare(b.artist));
    if (sort === "year-desc") return list.sort((a, b) => b.year - a.year);
    if (sort === "year-asc") return list.sort((a, b) => a.year - b.year);
    return list;
  }

  /* ---------- renderizado ---------- */
  function renderAlbums(albums) {
    albumGrid.innerHTML = albums
      .map((a) => {
        const favAll = CATALOG.tracks
          .filter((t) => t.album === a.id)
          .every((t) => favs.has(t.id));
        return `
          <div class="col">
            <div class="card album-card h-100" data-album="${esc(a.id)}" role="button" tabindex="0"
                 aria-label="Reproducir álbum ${esc(a.title)}">
              <div class="album-card__menu">
                <div class="dropdown">
                  <button type="button" class="icon-btn" data-bs-toggle="dropdown" aria-label="Opciones de ${esc(a.title)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
                    </svg>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end shadow">
                    <li><button class="dropdown-item" data-action="queue-album" data-album="${esc(a.id)}">Añadir a la cola</button></li>
                    <li><button class="dropdown-item" data-action="playnext-album" data-album="${esc(a.id)}">Reproducir después</button></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button class="dropdown-item" data-action="fav-album" data-album="${esc(a.id)}">${favAll ? "Quitar de favoritos" : "Añadir a favoritos"}</button></li>
                  </ul>
                </div>
              </div>
              <img src="${artFile(a.id)}" class="card-img-top" alt="Portada de ${esc(a.title)}" loading="lazy" />
              <div class="card-body">
                <h5 class="card-title mb-0">${esc(a.title)}</h5>
                <p class="card-text text-body-secondary mb-1">${esc(a.artist)}</p>
                <small class="text-body-tertiary">${a.year}</small>
              </div>
            </div>
          </div>`;
      })
      .join("");
  }

  function renderTracks(tracks) {
    trackList.innerHTML = tracks
      .map((t) => {
        const active = playingId === t.id;
        return `
        <div class="list-group-item list-group-item-action track-item d-flex align-items-center gap-2 ${active ? "active" : ""}"
             data-id="${t.id}">
          <button type="button" class="track-play d-flex align-items-center gap-3 flex-grow-1 text-start"
                  data-id="${t.id}" aria-label="Reproducir ${esc(t.title)}">
            <img src="${artFile(t.album)}" width="48" height="48" class="track-thumb" alt="" loading="lazy" />
            <span class="flex-grow-1 text-start min-w-0">
              <span class="d-block fw-semibold text-truncate">${esc(t.title)}</span>
              <span class="d-block text-body-secondary small">${esc(t.artist)}</span>
            </span>
            <span class="track-dur small text-body-tertiary">${fmt(t.duration)}</span>
            <svg class="track-play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <button type="button" class="icon-btn" data-action="fav-track" data-id="${t.id}"
                  aria-pressed="${favs.has(t.id)}" title="${favs.has(t.id) ? "Quitar de favoritos" : "Añadir a favoritos"}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${favs.has(t.id) ? "currentColor" : "none"}"
                 stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M12 21s-6.7-4.35-9.33-8.06C.9 10.36 2.4 6.5 5.9 6.5c1.9 0 3.3 1.05 4.1 2.35.8-1.3 2.2-2.35 4.1-2.35 3.5 0 5 3.86 3.23 6.44C18.7 16.65 12 21 12 21z"/>
            </svg>
          </button>
          <div class="dropdown">
            <button type="button" class="icon-btn" data-bs-toggle="dropdown" aria-label="Más opciones de ${esc(t.title)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
              </svg>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow">
              <li><button class="dropdown-item" data-action="playnext-track" data-id="${t.id}">Reproducir después</button></li>
              <li><button class="dropdown-item" data-action="queue-track" data-id="${t.id}">Añadir a la cola</button></li>
              <li><button class="dropdown-item" data-action="fav-track" data-id="${t.id}">${favs.has(t.id) ? "Quitar de favoritos" : "Añadir a favoritos"}</button></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item" data-action="pl-track" data-id="${t.id}">Añadir a una playlist…</button></li>
            </ul>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderQueue() {
    queueList.innerHTML = queue
      .map((id) => {
        const t = trackById(id);
        if (!t) return "";
        const current = playingId === id;
        return `
        <li class="queue-item d-flex align-items-center gap-2 ${current ? "is-current" : ""}" draggable="true" data-id="${t.id}">
          <span class="queue-grip" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5" r="1.4"/><circle cx="9" cy="12" r="1.4"/>
              <circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="19" r="1.4"/>
            </svg>
          </span>
          <img src="${artFile(t.album)}" width="40" height="40" class="track-thumb queue-art" alt="" loading="lazy" />
          <span class="queue-info flex-grow-1 text-start">
            <span class="d-block queue-title text-truncate">${esc(t.title)}</span>
            <span class="d-block text-body-secondary small">${esc(t.artist)}</span>
          </span>
          ${current ? '<span class="queue-now small text-primary">Sonando</span>' : ""}
          <button type="button" class="icon-btn" data-action="queue-play" data-id="${t.id}"
                  title="Reproducir ahora" aria-label="Reproducir ahora">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button type="button" class="icon-btn" data-action="queue-remove" data-id="${t.id}"
                  title="Quitar de la cola" aria-label="Quitar de la cola">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10.6 12 6 7.4 7.4 6 12 10.6 16.6 6 18 7.4 13.4 12 18 16.6 16.6 18 12 13.4 7.4 18 6 16.6z"/>
            </svg>
          </button>
        </li>`;
      })
      .join("");
    updateQueueBadge();
    if (isExpanded()) renderQueuePanel();
  }

  function updateQueueBadge() {
    queueBadge.textContent = queue.length;
    queueBadge.style.display = queue.length ? "" : "none";
  }

  function renderPlaylists() {
    const entries = Object.entries(playlists);
    plList.innerHTML = entries.length
      ? entries
          .map(
            ([name, ids]) => `
        <div class="pl-item d-flex align-items-center gap-2">
          <span class="pl-info flex-grow-1 text-start min-w-0">
            <span class="d-block fw-semibold text-truncate">${esc(name)}</span>
            <small class="text-body-secondary">${ids.length} ${ids.length === 1 ? "canción" : "canciones"}</small>
          </span>
          <button type="button" class="icon-btn" data-action="pl-play" data-pl="${esc(name)}" title="Reproducir playlist" aria-label="Reproducir ${esc(name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button type="button" class="icon-btn" data-action="pl-add" data-pl="${esc(name)}" title="Añadir aquí la canción pendiente" aria-label="Añadir canción a ${esc(name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
          </button>
          <button type="button" class="icon-btn icon-btn--danger" data-action="pl-del" data-pl="${esc(name)}" title="Eliminar playlist" aria-label="Eliminar ${esc(name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10.6 12 6 7.4 7.4 6 12 10.6 16.6 6 18 7.4 13.4 12 18 16.6 16.6 18 12 13.4 7.4 18 6 16.6z"/>
            </svg>
          </button>
        </div>`
          )
          .join("")
      : '<p class="text-body-secondary mb-4">Aún no tienes playlists. Crea una arriba.</p>';
  }

  function updateActiveTrack() {
    document.querySelectorAll(".track-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.id) === playingId);
    });
  }

  function updateShuffleUI() {
    pShuffle.classList.toggle("is-on", shuffleOn);
    pShuffle.setAttribute("aria-pressed", String(shuffleOn));
    pShuffle.title = shuffleOn ? "Aleatorio activado" : "Aleatorio desactivado";
  }

  function updateRepeatUI() {
    pRepeat.classList.toggle("is-on", repeatMode !== 0);
    pRepeat.setAttribute("aria-pressed", String(repeatMode !== 0));
    pRepeatOne.style.display = repeatMode === 2 ? "" : "none";
    pRepeat.title =
      repeatMode === 0
        ? "Repetición desactivada"
        : repeatMode === 1
          ? "Repetir lista"
          : "Repetir una canción";
  }

  /* ---------- cola ---------- */
  function shuffleArray(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Al pulsar una canción se genera la lista con las pistas visibles; si el
     aleatorio ya está activo se entregan directamente barajadas. */
  function buildDefaultQueue(id) {
    const rest = baseFilteredTracks()
      .map((t) => t.id)
      .filter((x) => x !== id);
    return [id, ...(shuffleOn ? shuffleArray(rest) : rest)];
  }

  /* Regenera el orden de la cola conservando la canción en reproducción. */
  function reshuffleQueue() {
    if (queue.length < 2) return false;
    const rest = playingId != null ? queue.filter((id) => id !== playingId) : [...queue];
    const shuffled = shuffleArray(rest);
    queue = playingId != null ? [playingId, ...shuffled] : shuffled;
    renderQueue();
    persistQueue();
    return true;
  }

  function enqueueTrack(id, { next = false } = {}) {
    const t = trackById(id);
    if (!t) return;
    const at = playingId != null ? queue.indexOf(playingId) : -1;
    if (queue.includes(id)) {
      if (next && at >= 0 && queue.indexOf(id) !== at + 1 && queue.indexOf(id) !== at) {
        queue.splice(queue.indexOf(id), 1);
        queue.splice(at + 1, 0, id);
        showToast("Mueve " + t.title + " para reproducirla después");
      } else {
        showToast(t.title + " ya está en la cola");
      }
    } else if (next && at >= 0) {
      queue.splice(at + 1, 0, id);
      showToast("Se reproducirá a continuación: " + t.title);
    } else {
      queue.push(id);
      showToast("Añadida a la cola: " + t.title);
    }
    renderQueue();
    persistQueue();
  }

  function playTrack(id, { autoplay = true, clearQueue = false } = {}) {
    const t = trackById(id);
    if (!t) return;
    if (clearQueue) queue = buildDefaultQueue(id);
    if (!queue.includes(id)) queue.push(id);
    playingId = id;
    audio.src = audioFile(t);
    pTitle.textContent = t.title;
    pArtist.textContent = t.artist;
    pArt.src = artFile(t.album);
    player.classList.add("glass-player--active");
    paintGlass(artFile(t.album));
    pLive.textContent = `Reproduciendo: ${t.title} de ${t.artist}`;
    renderQueue();
    applyFilter();
    preloadNextTrack();
    persistState();
    if (autoplay) audio.play().catch(() => {});
  }

  function playFromQueue(step) {
    if (!queue.length) return;
    const qi = playingId != null ? queue.indexOf(playingId) : -1;
    let next;
    if (shuffleOn && queue.length > 1) {
      do {
        next = Math.floor(Math.random() * queue.length);
      } while (next === qi);
    } else {
      const base = qi >= 0 ? qi : step > 0 ? -1 : queue.length;
      next = ((base + step) % queue.length + queue.length) % queue.length;
    }
    if (queue[next] !== undefined) playTrack(queue[next]);
  }

  function preloadNextTrack() {
    if (playingId == null) return;
    const qi = queue.indexOf(playingId);
    let nid = null;
    if (repeatMode === 2) {
      nid = playingId;
    } else if (qi >= 0 && qi < queue.length - 1) {
      nid = queue[qi + 1];
    } else if (repeatMode === 1) {
      nid = queue[0];
    }
    if (nid != null && trackById(nid)) {
      preload.src = audioFile(trackById(nid));
      preload.load();
    } else {
      preload.removeAttribute("src");
    }
  }

  /* ---------- favoritos ---------- */
  function toggleFavorite(id) {
    if (favs.has(id)) favs.delete(id);
    else favs.add(id);
    persistFavs();
    applyFilter();
    renderQueue();
  }

  function toggleAlbumFavorite(albumId) {
    const ids = CATALOG.tracks.filter((t) => t.album === albumId).map((t) => t.id);
    const allFav = ids.every((id) => favs.has(id));
    ids.forEach((id) => (allFav ? favs.delete(id) : favs.add(id)));
    persistFavs();
    applyFilter();
  }

  function toggleFavsFilter() {
    favsOnly = !favsOnly;
    navFavs.setAttribute("aria-pressed", String(favsOnly));
    navFavs.classList.toggle("is-on", favsOnly);
    applyFilter();
    showToast(favsOnly ? "Mostrando solo favoritos" : "Mostrando todo el catálogo");
  }

  /* ---------- playlists ---------- */
  function openPlaylistAdd(id) {
    pendingTrack = id;
    const t = trackById(id);
    plPending.textContent = `Canción a añadir: ${t ? t.title : ""}`;
    plPending.classList.remove("d-none");
    bootstrap.Offcanvas.getOrCreateInstance(offcanvasPlaylists).show();
  }

  function createPlaylist(name) {
    const n = name.trim();
    if (!n) return;
    if (playlists[n]) {
      showToast("Ya existe una playlist llamada «" + n + "»");
      return;
    }
    playlists[n] = [];
    persistPlaylists();
    renderPlaylists();
    plName.value = "";
    showToast("Playlist «" + n + "» creada");
  }

  function deletePlaylist(name) {
    delete playlists[name];
    persistPlaylists();
    renderPlaylists();
  }

  function addPendingToPlaylist(name) {
    if (pendingTrack == null) {
      showToast("Elige «Añadir a una playlist…» en una canción primero");
      return;
    }
    if (playlists[name].includes(pendingTrack)) {
      showToast("La canción ya está en esa playlist");
      return;
    }
    playlists[name].push(pendingTrack);
    persistPlaylists();
    renderPlaylists();
    showToast("Añadida a «" + name + "»");
    pendingTrack = null;
    plPending.classList.add("d-none");
  }

  function playPlaylist(name) {
    const ids = playlists[name] || [];
    if (!ids.length) {
      showToast("La playlist «" + name + "» está vacía");
      return;
    }
    queue = [...ids];
    renderQueue();
    persistQueue();
    playFromQueue(1);
    bootstrap.Offcanvas.getInstance(offcanvasPlaylists)?.hide();
    const hidden = bootstrap.Offcanvas.getInstance(offcanvasQueue);
    if (hidden) hidden.hide();
  }

  /* ---------- tema ---------- */
  function applyTheme(t) {
    theme = t;
    document.documentElement.dataset.bsTheme = t;
    iSun.style.display = t === "dark" ? "" : "none";
    iMoon.style.display = t === "light" ? "" : "none";
    store.set(ST.theme, t);
  }

  /* ---------- barra lateral ---------- */
  const DESKTOP = window.matchMedia("(min-width: 992px)");

  function setSidebarCollapsed(collapsed) {
    document.documentElement.classList.toggle("sb-collapsed", collapsed);
    btnSidebar.setAttribute("aria-expanded", String(!collapsed));
    btnSidebar.setAttribute(
      "aria-label",
      collapsed ? "Desplegar la barra lateral" : "Plegar la barra lateral"
    );
    btnSidebar.title = collapsed
      ? "Desplegar la barra lateral"
      : "Plegar la barra lateral";
    store.set(ST.sidebar, collapsed ? "collapsed" : "open");
  }

  function setSidebarDrawer(open) {
    document.documentElement.classList.toggle("sb-open", open);
    btnSidebarFab.setAttribute("aria-expanded", String(open));
    sbBackdrop.hidden = !open;
    requestAnimationFrame(() => sbBackdrop.classList.toggle("show", open));
  }

  function toggleSidebar() {
    if (DESKTOP.matches) {
      setSidebarCollapsed(!document.documentElement.classList.contains("sb-collapsed"));
    } else {
      setSidebarDrawer(!document.documentElement.classList.contains("sb-open"));
    }
  }

  /* Al plegar, el buscador mini y los enlaces solo muestran icono */
  function initSidebar() {
    if (!sidebar || !btnSidebar) return;

    if (store.get(ST.sidebar, "open") === "collapsed") {
      setSidebarCollapsed(true);
    }

    btnSidebar.addEventListener("click", toggleSidebar);
    btnSidebarFab.addEventListener("click", () => setSidebarDrawer(true));
    sbBackdrop.addEventListener("click", () => setSidebarDrawer(false));

    btnSearchMini.addEventListener("click", () => {
      setSidebarCollapsed(false);
      buscar.focus();
    });

    /* Navegar a una sección cierra el cajón en móvil */
    sidebar.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", () => {
        if (!DESKTOP.matches) setSidebarDrawer(false);
      });
    });

    /* Al pasar a móvil el estado plegado deja de aplicar */
    DESKTOP.addEventListener("change", () => {
      if (DESKTOP.matches) setSidebarDrawer(false);
    });
  }

  /* ---------- volumen ---------- */
  function setVolume(v) {
    v = Math.max(0, Math.min(100, Number(v) || 0));
    audio.volume = v / 100;
    pVol.value = v;
    updateMuteIcon();
    persistSettings();
  }

  function updateMuteIcon() {
    const muted = audio.muted || audio.volume === 0;
    iVol.style.display = muted ? "none" : "";
    iMute.style.display = muted ? "" : "none";
  }

  /* ---------- color dominante de la portada ---------- */
  /* Color dominante de la portada -> variables CSS. Van en :root para que las
     compartan el fondo ambiental del body y el reproductor glassy. */
  function paintGlass(src) {
    const rootStyle = document.documentElement.style;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 16) {
          /* los píxeles transparentes valen 0,0,0 y ensuciarían la media */
          if (data[i + 3] < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (n) {
          r = Math.round(r / n);
          g = Math.round(g / n);
          b = Math.round(b / n);
          /* se realza la saturación: las carátulas reales salen apagadas */
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const boost = 1.45;
          const lift = (c) => {
            const mid = (max + min) / 2;
            const v = mid + (c - mid) * boost;
            return Math.max(0, Math.min(255, Math.round(v)));
          };
          r = lift(r);
          g = lift(g);
          b = lift(b);
        }
        rootStyle.setProperty("--glow", `rgb(${r},${g},${b})`);
        rootStyle.setProperty(
          "--glow2",
          `rgb(${Math.max(0, r - 90)},${Math.max(0, g - 90)},${Math.max(0, b - 90)})`
        );
      } catch (e) {
        rootStyle.setProperty("--glow", "rgba(60,60,80,0.9)");
        rootStyle.setProperty("--glow2", "rgba(30,30,45,0.95)");
      }
    };
    img.onerror = () => {
      rootStyle.setProperty("--glow", "rgba(60,60,80,0.9)");
      rootStyle.setProperty("--glow2", "rgba(30,30,45,0.95)");
    };
    img.src = src;
  }

  /* ---------- toast ---------- */
  function showToast(msg) {
    wtToast.textContent = msg;
    wtToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => wtToast.classList.remove("show"), 2000);
  }

  /* ---------- layout ampliado del reproductor ---------- */
  function renderQueuePanel() {
    pQueueList.innerHTML = queue
      .map((id, i) => {
        const t = trackById(id);
        if (!t) return "";
        const current = playingId === id;
        return `
          <button type="button" class="queue-item--next${current ? " is-current" : ""}"
                  data-id="${t.id}" ${current ? 'aria-current="true"' : ""}>
            <span class="queue-item__num">${current ? bars() : i + 1}</span>
            <img src="${artFile(t.album)}" alt="" loading="lazy" />
            <span class="min-w-0">
              <span class="queue-item__title">${esc(t.title)}</span>
              <span class="queue-item__artist">${current ? "Sonando ahora" : esc(t.artist)}</span>
            </span>
          </button>`;
      })
      .join("");
    scrollCurrentIntoView();
  }

  /* Indicador animado de la canción en reproducción */
  function bars() {
    return (
      '<span class="queue-item__bars" aria-hidden="true">' +
      "<i></i><i></i><i></i></span>"
    );
  }

  /* Mantiene a la vista la canción en reproducción al cambiar de tema.
     Se desplaza el contenedor a mano en vez de usar scrollIntoView para no
     mover la página ni depender del comportamiento suave. */
  function scrollCurrentIntoView() {
    const item = pQueueList.querySelector(".queue-item--next.is-current");
    if (!item) return;
    const top = item.offsetTop - pQueueList.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < pQueueList.scrollTop) {
      pQueueList.scrollTop = top;
    } else if (bottom > pQueueList.scrollTop + pQueueList.clientHeight) {
      pQueueList.scrollTop = bottom - pQueueList.clientHeight;
    }
  }

  function isExpanded() {
    return player.classList.contains("glass-player--expanded");
  }

  function setExpanded(expanded) {
    player.classList.toggle("glass-player--expanded", expanded);
    pExpandToggle.setAttribute("aria-expanded", String(expanded));
    const label = expanded ? "Reducir reproductor" : "Ampliar reproductor";
    pExpandToggle.setAttribute("aria-label", label);
    pExpandToggle.title = label;
    pArt.setAttribute("aria-label", label);
    iExpand.style.display = expanded ? "none" : "";
    iCollapse.style.display = expanded ? "" : "none";
    document.body.classList.toggle("player-expanded", expanded);
    if (expanded) renderQueuePanel();
  }

  pExpandToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setExpanded(!isExpanded());
  });

  pQueueList.addEventListener("click", (e) => {
    const btn = e.target.closest(".queue-item--next");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    /* Pulsar la canción en reproducción solo alterna pausa/reproducción */
    if (id === playingId && audio.src) {
      audio.paused ? audio.play() : audio.pause();
      return;
    }
    playTrack(id);
  });

  /* Clic en la portada, el título o el fondo: abre el layout ampliado */
  player.addEventListener("click", (e) => {
    if (isExpanded()) return;
    if (playingId == null && !audio.src) return;
    if (e.target.closest(".gbtn, input, #pExpandToggle, .glass-player__queue")) return;
    setExpanded(true);
  });

  pArt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded(true);
    }
  });

  /* ---------- filtros y render ---------- */
  function applyFilter() {
    const albums = sortedAlbums();
    const tracks = sortedTracks();
    renderAlbums(albums);
    renderTracks(tracks);
  }

  function populateFilters() {
    const artists = [...new Set(CATALOG.albums.map((a) => a.artist))].sort();
    fArtist.innerHTML = '<option value="">Todos los artistas</option>' + artists
      .map((a) => `<option value="${esc(a)}">${esc(a)}</option>`)
      .join("");
    const years = [...new Set(CATALOG.albums.map((a) => a.year))].sort((x, y) => y - x);
    fYear.innerHTML = '<option value="">Todos los años</option>' + years
      .map((y) => `<option value="${y}">${y}</option>`)
      .join("");
  }

  /* ---------- duraciones (para ordenar por duración) ---------- */
  function loadDurations() {
    CATALOG.tracks.forEach((t) => {
      const a = new Audio();
      a.preload = "metadata";
      a.src = audioFile(t);
      a.addEventListener("loadedmetadata", () => {
        t.duration = a.duration;
        renderTracks(sortedTracks());
      }, { once: true });
    });
  }

  /* ---------- eventos ---------- */
  buscar.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 200);
  });

  fSort.addEventListener("change", applyFilter);
  fArtist.addEventListener("change", applyFilter);
  fYear.addEventListener("change", applyFilter);

  albumGrid.addEventListener("click", (e) => {
    if (e.target.closest(".dropdown") || e.target.closest("[data-bs-toggle]")) return;
    const card = e.target.closest("[data-album]");
    if (!card) return;
    const t = CATALOG.tracks.find((x) => x.album === card.dataset.album);
    if (t) playTrack(t.id, { clearQueue: true });
  });

  albumGrid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      e.target.closest("[data-album]")?.click();
    }
  });

  trackList.addEventListener("click", (e) => {
    if (e.target.closest(".dropdown") || e.target.closest("[data-action]")) return;
    const play = e.target.closest(".track-play");
    if (!play) return;
    const id = Number(play.dataset.id);
    if (id === playingId && audio.src) {
      audio.paused ? audio.play() : audio.pause();
    } else {
      playTrack(id, { clearQueue: true });
    }
  });

  /* acciones de contexto / desplegables / cola / playlists */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.id !== undefined ? Number(el.dataset.id) : null;
    const album = el.dataset.album;
    const pl = el.dataset.pl;
    switch (el.dataset.action) {
      case "fav-track":
        toggleFavorite(id);
        break;
      case "queue-track":
        enqueueTrack(id, { next: false });
        break;
      case "playnext-track":
        enqueueTrack(id, { next: true });
        break;
      case "pl-track":
        openPlaylistAdd(id);
        break;
      case "fav-album":
        toggleAlbumFavorite(album);
        break;
      case "queue-album":
        CATALOG.tracks.filter((t) => t.album === album).forEach((t) =>
          enqueueTrack(t.id, { next: false })
        );
        break;
      case "playnext-album": {
        const ts = CATALOG.tracks.filter((t) => t.album === album);
        ts.forEach((t, i) => enqueueTrack(t.id, { next: true }));
        break;
      }
      case "queue-play":
        if (id === playingId && audio.src) {
          audio.paused ? audio.play() : audio.pause();
        } else {
          playTrack(id);
        }
        break;
      case "queue-remove": {
        queue = queue.filter((x) => x !== id);
        if (playingId === id) playingId = null;
        renderQueue();
        persistQueue();
        applyFilter();
        break;
      }
      case "pl-play":
        playPlaylist(pl);
        break;
      case "pl-add":
        addPendingToPlaylist(pl);
        break;
      case "pl-del":
        deletePlaylist(pl);
        break;
    }
    e.preventDefault();
  });

  pPlay.addEventListener("click", () => {
    if (audio.src && playingId != null) audio.paused ? audio.play() : audio.pause();
  });

  pNext.addEventListener("click", () => playFromQueue(1));

  pPrev.addEventListener("click", () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      playFromQueue(-1);
    }
  });

  pShuffle.addEventListener("click", () => {
    shuffleOn = !shuffleOn;
    updateShuffleUI();
    persistSettings();
    if (shuffleOn) {
      const ok = reshuffleQueue();
      showToast(
        ok
          ? "Aleatorio activado: nueva lista generada"
          : queue.length
            ? "Aleatorio activado"
            : "Aleatorio activado: reproduce una canción para generar la lista"
      );
    } else {
      showToast("Aleatorio desactivado");
    }
  });

  pRepeat.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    updateRepeatUI();
    persistSettings();
    preloadNextTrack();
    showToast(
      repeatMode === 0
        ? "Repetición desactivada"
        : repeatMode === 1
          ? "Repetir lista"
          : "Repetir una canción"
    );
  });

  pMute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    updateMuteIcon();
    persistSettings();
  });

  pVol.addEventListener("input", () => setVolume(pVol.value));
  pVol.addEventListener("input", () => {
    if (audio.muted && Number(pVol.value) > 0) audio.muted = false;
  });

  pSeek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (pSeek.value / 100) * audio.duration;
  });

  navFavs.addEventListener("click", (e) => {
    e.preventDefault();
    toggleFavsFilter();
  });

  btnTheme.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isExpanded()) {
      setExpanded(false);
      return;
    }
    if (!DESKTOP.matches) setSidebarDrawer(false);
  });

  plCreate.addEventListener("click", () => createPlaylist(plName.value));
  plName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createPlaylist(plName.value);
  });

  audio.addEventListener("play", () => {
    iPlay.style.display = "none";
    iPause.style.display = "";
    player.classList.add("glass-player--playing");
  });
  audio.addEventListener("pause", () => {
    iPlay.style.display = "";
    iPause.style.display = "none";
    player.classList.remove("glass-player--playing");
  });

  audio.addEventListener("timeupdate", () => {
    pCurrent.textContent = fmt(audio.currentTime);
    pDuration.textContent = fmt(audio.duration || 0);
    pSeek.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    const s = Math.floor(audio.currentTime);
    if (s % 5 === 0 && s !== lastSave) {
      lastSave = s;
      persistState();
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    pDuration.textContent = fmt(audio.duration || 0);
  });

  audio.addEventListener("ended", () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    const qi = playingId != null ? queue.indexOf(playingId) : -1;
    if (shuffleOn) {
      playFromQueue(1);
    } else if (qi < queue.length - 1 || repeatMode === 1) {
      playFromQueue(1);
    } else {
      audio.currentTime = 0;
      persistState();
    }
  });

  /* atajos de teclado */
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
    switch (e.code) {
      case "Space":
        if (
          typing ||
          tag === "button" ||
          (e.target instanceof Element && e.target.closest("[data-album]"))
        )
          return;
        e.preventDefault();
        if (audio.src) audio.paused ? audio.play() : audio.pause();
        break;
      case "ArrowRight":
        if (typing) return;
        e.preventDefault();
        playFromQueue(1);
        break;
      case "ArrowLeft":
        if (typing) return;
        e.preventDefault();
        if (audio.currentTime > 3) audio.currentTime = 0;
        else playFromQueue(-1);
        break;
      case "ArrowUp":
      case "ArrowDown":
        if (typing) return;
        e.preventDefault();
        setVolume(audio.volume * 100 + (e.code === "ArrowUp" ? 5 : -5));
        break;
    }
  });

  /* reordenar cola arrastrando */
  let dragId = null;
  queueList.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".queue-item");
    if (!li) return;
    dragId = Number(li.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    li.classList.add("dragging");
  });

  queueList.addEventListener("dragend", () => {
    dragId = null;
    queueList.querySelectorAll(".queue-item").forEach((el) =>
      el.classList.remove("dragging", "drag-before", "drag-after")
    );
  });

  queueList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const li = e.target.closest(".queue-item");
    if (!li || dragId == null) return;
    e.dataTransfer.dropEffect = "move";
    queueList.querySelectorAll(".drag-before,.drag-after").forEach((el) =>
      el.classList.remove("drag-before", "drag-after")
    );
    li.classList.add(e.offsetY > li.offsetHeight / 2 ? "drag-after" : "drag-before");
  });

  queueList.addEventListener("drop", (e) => {
    e.preventDefault();
    const li = e.target.closest(".queue-item");
    if (!li || dragId == null) return;
    const after = e.offsetY > li.offsetHeight / 2;
    const targetId = Number(li.dataset.id);
    if (dragId !== targetId) {
      const arr = queue.filter((x) => x !== dragId);
      const ti = arr.indexOf(targetId);
      arr.splice(after ? ti + 1 : ti, 0, dragId);
      queue = arr;
      if (playingId != null && !queue.includes(playingId)) playingId = null;
      renderQueue();
      persistQueue();
      updateActiveTrack();
    }
    dragId = null;
  });

  /* guardar estado al cerrar */
  window.addEventListener("beforeunload", persistState);

  /* ---------- restauración ---------- */
  function restore() {
    theme = store.get(ST.theme, "dark");
    applyTheme(theme);

    const settings = store.get(ST.settings, null);
    if (settings) {
      audio.muted = !!settings.muted;
      audio.volume = Math.max(0, Math.min(1, Number(settings.volume) || 0));
      shuffleOn = !!settings.shuffle;
      repeatMode = [0, 1, 2].includes(settings.repeat) ? settings.repeat : 0;
    }
    pVol.value = Math.round(audio.volume * 100);
    updateMuteIcon();
    updateShuffleUI();
    updateRepeatUI();

    favs = new Set(store.get(ST.favs, []));
    playlists = store.get(ST.playlists, {});

    /* Si el catálogo ha cambiado, los ids guardados apuntarían a canciones
       distintas: se descarta el estado, la cola, favoritos y playlists. */
    const sig = CATALOG.tracks.map((t) => `${t.id}:${t.file}`).join("|");
    if (store.get(ST.catalog, null) !== sig) {
      store.set(ST.catalog, sig);
      store.set(ST.state, null);
      store.set(ST.queue, []);
      store.set(ST.favs, []);
      store.set(ST.playlists, {});
      favs = new Set();
      playlists = {};
    }

    const st = store.get(ST.state, null);
    if (st && st.id && trackById(st.id)) {
      const t = trackById(st.id);
      playingId = t.id;
      queue = store.get(ST.queue, buildDefaultQueue(t.id));
      audio.src = audioFile(t);
      pTitle.textContent = t.title;
      pArtist.textContent = t.artist;
      pArt.src = artFile(t.album);
      pLive.textContent = `Reproduciendo: ${t.title} de ${t.artist}`;
      player.classList.add("glass-player--active");
      paintGlass(artFile(t.album));
      audio.addEventListener("loadedmetadata", () => {
        if (st.time && Number.isFinite(st.time)) {
          audio.currentTime = Math.min(st.time, audio.duration || st.time);
          pCurrent.textContent = fmt(audio.currentTime);
        }
      }, { once: true });
    } else {
      queue = store.get(ST.queue, []);
    }
  }

  /* ---------- API pública ---------- */
  let exportedPlayer = {
    playTrack: (id) => playTrack(id, { clearQueue: true }),
    addToQueue: (id) => enqueueTrack(id, { next: false }),
    playNext: (id) => enqueueTrack(id, { next: true }),
    next: () => playFromQueue(1),
    prev: () => playFromQueue(-1),
    pause: () => audio.pause(),
    resume: () => audio.play(),
    toggleShuffle: () => pShuffle.click(),
    cycleRepeat: () => pRepeat.click(),
    getQueue: () => [...queue],
    getFavorites: () => [...favs],
  };

  /* ---------- init ---------- */
  initSidebar();
  restore();
  populateFilters();
  loadDurations();
  applyFilter();
  renderQueue();
  updateQueueBadge();
  renderPlaylists();

  window.musicPlayer = exportedPlayer;

  /* PWA: service worker (solo cuando se sirve por HTTP/HTTPS) */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  }
})();