/* Motor de reproducción: <audio> real, cola, favoritos y playlists.
   Se apoya solo en Data.js (DB, albumOf, artPath, audioPath, fmtTime, store, KEY).
   Los controles selocalizan con data-ctl porque los mismos botones aparecen
   dos veces (reproductor y vista ampliada). */

const Player = (() => {
  "use strict";

  const audio = document.getElementById("audio");
  const preload = document.getElementById("preload");

  /* Cada ctl es el array de nodos que comparten ese data-ctl. */
  const ctl = {};
  function bindCtl() {
    document.querySelectorAll("[data-ctl]").forEach((n) => {
      (ctl[n.dataset.ctl] ||= []).push(n);
    });
  }
  const setText = (key, text) => (ctl[key] || []).forEach((n) => (n.textContent = text));
  const toggle = (key, on) => (ctl[key] || []).forEach((n) => (n.hidden = !on));
  const each = (key, fn) => (ctl[key] || []).forEach(fn);

  const slot = {};
  function bindSlots() {
    document.querySelectorAll("[data-slot]").forEach((n) => (slot[n.dataset.slot] = n));
  }

  /* ---------- estado ---------- */
  let queue = store.get(KEY.queue, []).filter((id) => songById[id]);
  let currentId = null;
  let shuffleOn = store.get(KEY.shuffle, false);
  let repeatMode = store.get(KEY.repeat, 0); // 0 off · 1 lista · 2 una canción
  let favs = new Set(store.get(KEY.favs, []));
  let userPlaylists = store.get(KEY.playlists, {});
  const listeners = [];
  const emit = (evt, data) => listeners.forEach((fn) => fn(evt, data));

  /* ---------- avisos ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = slot.toast || document.getElementById("wtToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- fondo ambiental con el color de la portada ---------- */
  /* YouTube Music tiñe la página con el color de la carátula. Se muestrean
     los píxeles y se vuelcan en --glow / --glow2 para que los use el CSS. */
  function tintFor(src) {
    const root = document.documentElement.style;
    const fallback = () => {
      root.setProperty("--glow", "rgba(122,54,72,.75)");
      root.setProperty("--glow2", "rgba(18,1,1,1)");
    };
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue; // los transparentes ensucian la media
          r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
        }
        if (!n) return fallback();
        r /= n; g /= n; b /= n;
        /* las carátulas reales salen apagadas: se realza la saturación */
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), mid = (mx + mn) / 2;
        const lift = (c) => Math.max(0, Math.min(255, Math.round(mid + (c - mid) * 1.5)));
        root.setProperty("--glow", `rgb(${lift(r)},${lift(g)},${lift(b)})`);
        root.setProperty("--glow2", `rgb(${Math.round(r * .28)},${Math.round(g * .28)},${Math.round(b * .28)})`);
      } catch { fallback(); }
    };
    img.onerror = fallback;
    img.src = src;
  }

  /* ---------- cola ---------- */
  const trackOf = (id) => songById[id];
  const saveQueue = () => store.set(KEY.queue, queue);

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Al pulsar una canción la cola se arma con lo que haya visible; si el
     aleatorio ya está activo se entrega directamente barajado. */
  function queueFrom(ids, startId) {
    const rest = ids.filter((id) => id !== startId);
    queue = [startId, ...(shuffleOn ? shuffle(rest) : rest)];
    saveQueue();
  }

  function play(id, { from = null } = {}) {
    const s = trackOf(id);
    if (!s) return;
    if (from) queueFrom(from, id);
    if (!queue.includes(id)) { queue.push(id); saveQueue(); }
    currentId = id;
    audio.src = audioPath(s);
    audio.play().catch(() => {});
    store.set(KEY.track, { id, time: 0 });
    tintFor(artPath(albumOf(s)));
    emit("track", s);
    emit("queue");
    preloadNext();
  }

  function enqueue(id, { next = false } = {}) {
    const s = trackOf(id);
    if (!s) return;
    if (queue.includes(id)) return toast(s.title + " ya está en la cola");
    const at = currentId ? queue.indexOf(currentId) : -1;
    if (next && at >= 0) {
      queue.splice(at + 1, 0, id);
      toast("Se reproducirá a continuación: " + s.title);
    } else {
      queue.push(id);
      toast("Añadida a la cola: " + s.title);
    }
    saveQueue();
    emit("queue");
  }

  function step(delta) {
    if (!queue.length) return;
    const at = currentId ? queue.indexOf(currentId) : -1;
    let next;
    if (shuffleOn && queue.length > 1) {
      do { next = Math.floor(Math.random() * queue.length); } while (next === at);
    } else {
      const base = at >= 0 ? at : delta > 0 ? -1 : queue.length;
      next = (base + delta + queue.length) % queue.length;
    }
    play(queue[next]);
  }

  /* Precarga la siguiente para que el corte entre canciones no se note. */
  function preloadNext() {
    if (!currentId) return;
    const at = queue.indexOf(currentId);
    let id = null;
    if (repeatMode === 2) id = currentId;
    else if (at >= 0 && at < queue.length - 1) id = queue[at + 1];
    else if (repeatMode === 1 && queue.length) id = queue[0];
    const s = id && trackOf(id);
    if (s) { preload.src = audioPath(s); preload.load(); }
    else preload.removeAttribute("src");
  }

  function removeFromQueue(id) {
    queue = queue.filter((x) => x !== id);
    if (currentId === id) {
      currentId = null;
      audio.pause();
      audio.removeAttribute("src");
      setText("title", "Elige una canción");
      setText("artist", "Glassy Music");
      emit("track", null);
    }
    saveQueue();
    emit("queue");
  }

  function moveInQueue(from, to, after) {
    if (from === to) return;
    const arr = queue.filter((x) => x !== from);
    const i = arr.indexOf(to);
    arr.splice(after ? i + 1 : i, 0, from);
    queue = arr;
    saveQueue();
    emit("queue");
  }

  /* ---------- favoritos ---------- */
  function toggleFav(id) {
    const had = favs.has(id);
    had ? favs.delete(id) : favs.add(id);
    store.set(KEY.favs, [...favs]);
    emit("favs", { id, on: !had });
    toast(had ? "Quitada de favoritos" : "Añadida a favoritos");
  }

  const isFav = (id) => favs.has(id);

  /* ---------- playlists ---------- */
  /* Une las playlists fijas de Data.js con las que crea el usuario. */
  function allPlaylists() {
    const fixed = DB.playlists
      .filter((p) => !p.system)
      .map((p) => ({ name: p.name, ids: [...p.ids], fixed: true }));
    const mine = Object.entries(userPlaylists).map(([name, ids]) => ({ name, ids: [...ids] }));
    return [...fixed, ...mine];
  }

  function playlistSongs(name) {
    if (name === "Favoritos") return DB.songs.filter((s) => favs.has(s.id));
    const pl = allPlaylists().find((p) => p.name === name);
    return pl ? pl.ids.map(trackOf).filter(Boolean) : [];
  }

  function createPlaylist(name) {
    const clean = String(name || "").trim();
    if (!clean) return false;
    if (allPlaylists().some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      toast("Ya existe una playlist llamada «" + clean + "»");
      return false;
    }
    userPlaylists[clean] = [];
    store.set(KEY.playlists, userPlaylists);
    emit("playlists");
    toast("Playlist «" + clean + "» creada");
    return true;
  }

  function deletePlaylist(name) {
    delete userPlaylists[name];
    store.set(KEY.playlists, userPlaylists);
    emit("playlists");
    toast("Playlist «" + name + "» eliminada");
  }

  function addToPlaylist(name, id) {
    const fixed = DB.playlists.find((p) => p.name === name && !p.system);
    if (fixed) return toast("«" + name + "» es una playlist fija del proyecto");
    if (!userPlaylists[name]) return;
    if (userPlaylists[name].includes(id)) return toast("Ya está en esa playlist");
    userPlaylists[name].push(id);
    store.set(KEY.playlists, userPlaylists);
    emit("playlists");
    toast("«" + trackOf(id).title + "» → " + name);
  }

  /* ---------- ajustes ---------- */
  function setShuffle(on_) {
    shuffleOn = on_;
    store.set(KEY.shuffle, on_);
    if (on_ && queue.length > 1) {
      const rest = currentId ? queue.filter((id) => id !== currentId) : [...queue];
      queue = currentId ? [currentId, ...shuffle(rest)] : shuffle(rest);
      saveQueue();
      emit("queue");
    }
    emit("shuffle");
    toast(on_ ? "Aleatorio activado" : "Aleatorio desactivado");
  }

  function cycleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    store.set(KEY.repeat, repeatMode);
    preloadNext();
    emit("repeat");
    toast(["Repetición desactivada", "Repetir lista", "Repetir una canción"][repeatMode]);
  }

  function setVolume(v) {
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    audio.volume = pct / 100;
    if (pct > 0) audio.muted = false;
    store.set(KEY.volume, pct);
    emit("volume", pct);
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    emit("volume", Math.round(audio.volume * 100));
  }

  const togglePlay = () => {
    if (!currentId) return play(DB.songs[0].id, { from: DB.songs.map((s) => s.id) });
    if (audio.src) audio.paused ? audio.play() : audio.pause();
  };

  /* ---------- vista ampliada ---------- */
  const expanded = () => document.querySelector(".expanded");

  function openExpanded() {
    if (!currentId) return toast("Elige una canción primero");
    const s = trackOf(currentId);
    const art = artPath(albumOf(s));
    expanded().classList.add("open");
    document.body.classList.add("expanded-open");
    slot["xp-art"].style.backgroundImage = `url("${art}")`;
    slot["xp-bg"].style.backgroundImage = `url("${art}")`;
    emit("expanded", s);
  }

  const closeExpanded = () => {
    expanded().classList.remove("open");
    document.body.classList.remove("expanded-open");
  };

  const isExpanded = () => expanded().classList.contains("open");

  function toggleQueue(force) {
    const open = force ?? !slot["queue-panel"].classList.contains("open");
    slot["queue-panel"].classList.toggle("open", open);
    document.body.classList.toggle("queue-open", open);
    each("queue", (n) => n.setAttribute("aria-expanded", String(open)));
  }

  /* ---------- init ---------- */
  function init() {
    bindCtl();
    bindSlots();

    /* volumen restaurado */
    audio.volume = Math.max(0, Math.min(1, store.get(KEY.volume, 70) / 100));
    each("vol", (n) => (n.value = Math.round(audio.volume * 100)));

    /* transporte */
    each("play", (n) => n.addEventListener("click", togglePlay));
    each("next", (n) => n.addEventListener("click", () => step(1)));
    each("prev", (n) =>
      n.addEventListener("click", () => {
        /* como en YouTube Music: los primeros 3 s retroceden, luego pasa a la anterior */
        if (audio.currentTime > 3) audio.currentTime = 0;
        else step(-1);
      })
    );
    each("shuffle", (n) => n.addEventListener("click", () => setShuffle(!shuffleOn)));
    each("repeat", (n) => n.addEventListener("click", cycleRepeat));
    each("fav", (n) => n.addEventListener("click", () => currentId && toggleFav(currentId)));
    each("vol", (n) => n.addEventListener("input", () => setVolume(n.value)));
    each("mute", (n) => n.addEventListener("click", toggleMute));
    each("seek", (n) =>
      n.addEventListener("input", () => {
        if (audio.duration) audio.currentTime = (n.value / 100) * audio.duration;
      })
    );
    each("expand", (n) => n.addEventListener("click", openExpanded));
    each("collapse", (n) => n.addEventListener("click", closeExpanded));
    each("queue", (n) => n.addEventListener("click", () => toggleQueue()));
    each("lyrics", (n) => n.addEventListener("click", () => { openExpanded(); showXpTab("lyrics"); }));

    /* pestañas de la vista ampliada */
    each("tab-queue", (n) => n.addEventListener("click", () => showXpTab("queue")));
    each("tab-lyrics", (n) => n.addEventListener("click", () => showXpTab("lyrics")));

    /* eventos del elemento de audio */
    audio.addEventListener("play", () => {
      toggle("icon-play", false);
      toggle("icon-pause", true);
      document.body.classList.add("is-playing");
      emit("playstate", true);
    });
    audio.addEventListener("pause", () => {
      toggle("icon-play", true);
      toggle("icon-pause", false);
      document.body.classList.remove("is-playing");
      emit("playstate", false);
    });
    audio.addEventListener("timeupdate", () => {
      const d = audio.duration || 0;
      setText("cur", fmtTime(audio.currentTime));
      setText("dur", fmtTime(d));
      const pct = d ? (audio.currentTime / d) * 100 : 0;
      each("seek", (n) => (n.value = pct));
      each("fill", (n) => (n.style.width = pct + "%"));
    });
    audio.addEventListener("loadedmetadata", () => setText("dur", fmtTime(audio.duration)));
    audio.addEventListener("ended", () => {
      if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      const at = currentId ? queue.indexOf(currentId) : -1;
      if (repeatMode === 1 || (at >= 0 && at < queue.length - 1)) step(1);
      else { audio.currentTime = 0; emit("playstate", false); }
    });
    audio.addEventListener("error", () => {
      if (audio.src) toast("No se pudo cargar el audio de esta pista");
    });

    /* atajos */
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      if (e.key === "Escape" && isExpanded()) { closeExpanded(); return; }
      if (e.key === "/" && !e.shiftKey) { e.preventDefault(); document.getElementById("q")?.focus(); return; }
      if (e.code === "Space" && tag !== "button") { e.preventDefault(); togglePlay(); }
      else if (e.code === "ArrowRight" && e.shiftKey) { e.preventDefault(); step(1); }
      else if (e.code === "ArrowLeft" && e.shiftKey) { e.preventDefault(); step(-1); }
    });

    /* cola arrastrando */
    let dragId = null;
    const list = slot.queue;
    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest(".q-item");
      if (!li) return;
      dragId = li.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    list.addEventListener("dragend", () => {
      dragId = null;
      list.querySelectorAll(".q-item").forEach((n) =>
        n.classList.remove("dragging", "drop-before", "drop-after")
      );
    });
    list.addEventListener("dragover", (e) => {
      const li = e.target.closest(".q-item");
      if (!li || dragId == null) return;
      e.preventDefault();
      list.querySelectorAll(".drop-before,.drop-after").forEach((n) =>
        n.classList.remove("drop-before", "drop-after")
      );
      li.classList.add(e.offsetY > li.offsetHeight / 2 ? "drop-after" : "drop-before");
    });
    list.addEventListener("drop", (e) => {
      const li = e.target.closest(".q-item");
      if (!li || dragId == null) return;
      e.preventDefault();
      moveInQueue(dragId, li.dataset.id, e.offsetY > li.offsetHeight / 2);
      dragId = null;
    });

    /* restaurar la última canción */
    const saved = store.get(KEY.track, null);
    if (saved && trackOf(saved.id)) {
      const s = trackOf(saved.id);
      currentId = s.id;
      audio.src = audioPath(s);
      audio.addEventListener("loadedmetadata", () => {
        if (saved.time) audio.currentTime = Math.min(saved.time, audio.duration || saved.time);
      }, { once: true });
      tintFor(artPath(albumOf(s)));
      emit("track", s);
    }
    if (!queue.length) queue = DB.songs.map((s) => s.id);
    saveQueue();
    emit("queue");
    emit("shuffle");
    emit("repeat");
    emit("volume", Math.round(audio.volume * 100));
  }

  function showXpTab(which) {
    each("tab-queue", (n) => n.classList.toggle("on", which === "queue"));
    each("tab-lyrics", (n) => n.classList.toggle("on", which === "lyrics"));
    slot["pane-queue"].classList.toggle("on", which === "queue");
    slot["pane-lyrics"].classList.toggle("on", which === "lyrics");
  }

  return {
    init, subscribe: (fn) => listeners.push(fn), emit, toast,
    play, togglePlay, step, enqueue, removeFromQueue, moveInQueue, queueFrom,
    toggleFav, isFav, allPlaylists, playlistSongs, createPlaylist, deletePlaylist, addToPlaylist,
    setShuffle, cycleRepeat, setVolume,
    openExpanded, closeExpanded, isExpanded, toggleQueue, showXpTab,
    get currentId() { return currentId; },
    get queue() { return [...queue]; },
    get shuffle() { return shuffleOn; },
    get repeat() { return repeatMode; }
  };
})();
