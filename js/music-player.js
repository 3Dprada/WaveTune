(() => {
  "use strict";

  const audio = document.getElementById("audio");
  const player = document.getElementById("player");
  const pArt = document.getElementById("pArt");
  const pTitle = document.getElementById("pTitle");
  const pArtist = document.getElementById("pArtist");
  const pPlay = document.getElementById("pPlay");
  const pPrev = document.getElementById("pPrev");
  const pNext = document.getElementById("pNext");
  const pSeek = document.getElementById("pSeek");
  const pCurrent = document.getElementById("pCurrent");
  const pDuration = document.getElementById("pDuration");
  const pMute = document.getElementById("pMute");
  const iPlay = document.getElementById("iPlay");
  const iPause = document.getElementById("iPause");
  const iVol = document.getElementById("iVol");
  const iMute = document.getElementById("iMute");
  const buscar = document.getElementById("buscar");
  const albumGrid = document.getElementById("albumGrid");
  const trackList = document.getElementById("trackList");

  let queue = CATALOG.tracks.map((t) => t.id);
  let current = -1;
  let exportedPlayer = null;

  /* ---------- renderizado del catálogo ---------- */

  function renderAlbums(filteredAlbums) {
    albumGrid.innerHTML = filteredAlbums
      .map((a) => {
        const t = CATALOG.tracks.find((x) => x.album === a.id);
        return `
          <div class="col">
            <div class="card album-card h-100" data-album="${a.id}" role="button" tabindex="0"
                 data-title="${a.title}" data-artist="${a.artist}" data-file="${t ? t.file : ""}">
              <img src="${artFile(a.id)}" class="card-img-top" alt="${a.title}" loading="lazy" />
              <div class="card-body">
                <h5 class="card-title mb-0">${a.title}</h5>
                <p class="card-text text-body-secondary mb-1">${a.artist}</p>
                <small class="text-body-tertiary">${a.year}</small>
              </div>
            </div>
          </div>`;
      })
      .join("");
  }

  function renderTracks(filteredTracks) {
    trackList.innerHTML = filteredTracks
      .map(
        (t, i) => `
        <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-3
                        track-item ${i === current ? "active" : ""}" data-id="${t.id}">
          <img src="${artFile(t.album)}" width="48" height="48" class="rounded" alt="" loading="lazy" />
          <span class="flex-grow-1 text-start">
            <span class="d-block fw-semibold">${t.title}</span>
            <span class="d-block text-body-secondary small">${t.artist}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>`
      )
      .join("");
  }

  function applyFilter() {
    const q = buscar.value.trim().toLowerCase();
    const albums = q
      ? CATALOG.albums.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.artist.toLowerCase().includes(q)
        )
      : CATALOG.albums;
    const tracks = q
      ? CATALOG.tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        )
      : CATALOG.tracks;
    renderAlbums(albums);
    renderTracks(tracks);
  }

  /* ---------- reproductor ---------- */

  function playTrack(id, start = true) {
    const t = CATALOG.tracks.find((x) => x.id === id);
    if (!t) return;
    current = CATALOG.tracks.findIndex((x) => x.id === id);
    queue = CATALOG.tracks.map((x) => x.id);
    audio.src = audioFile(t);
    pTitle.textContent = t.title;
    pArtist.textContent = t.artist;
    pArt.src = artFile(t.album);
    player.classList.add("glass-player--active");
    paintGlass(artFile(t.album));
    updateActiveTrack();
    if (start) {
      audio.play().catch(() => {});
    }
  }

  function playFromQueue(step) {
    if (queue.length === 0) return;
    const idx = queue.indexOf(current >= 0 ? CATALOG.tracks[current].id : -1);
    const next = (idx + step + queue.length) % queue.length;
    playTrack(queue[next], true);
  }

  function updateActiveTrack() {
    document.querySelectorAll(".track-item").forEach((el) => {
      el.classList.toggle(
        "active",
        Number(el.dataset.id) === (current >= 0 ? CATALOG.tracks[current].id : -1)
      );
    });
  }

  /* Color dominante de la portada -> variables CSS del player */
  function paintGlass(src) {
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
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        player.style.setProperty("--glow", `rgb(${r},${g},${b})`);
        player.style.setProperty(
          "--glow2",
          `rgb(${Math.max(0, r - 90)},${Math.max(0, g - 90)},${Math.max(0, b - 90)})`
        );
      } catch (e) {
        player.style.setProperty("--glow", "rgba(60,60,80,0.9)");
      }
    };
    img.src = src;
  }

  /* ---------- eventos ---------- */

  albumGrid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-album]");
    if (!card) return;
    const t = CATALOG.tracks.find((x) => x.album === card.dataset.album);
    if (t) playTrack(t.id, true);
  });

  albumGrid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      e.target.closest("[data-album]")?.click();
    }
  });

  trackList.addEventListener("click", (e) => {
    const btn = e.target.closest(".track-item");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (id === current) {
      audio.paused ? audio.play() : audio.pause();
    } else {
      playTrack(id, true);
    }
  });

  pPlay.addEventListener("click", () => {
    if (audio.src && current >= 0) audio.paused ? audio.play() : audio.pause();
  });

  pNext.addEventListener("click", () => playFromQueue(1));

  pPrev.addEventListener("click", () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      playFromQueue(-1);
    }
  });

  pMute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    iVol.style.display = audio.muted ? "none" : "";
    iMute.style.display = audio.muted ? "" : "none";
  });

  audio.addEventListener("play", () => {
    iPlay.style.display = "none";
    iPause.style.display = "";
  });
  audio.addEventListener("pause", () => {
    iPlay.style.display = "";
    iPause.style.display = "none";
  });

  audio.addEventListener("timeupdate", () => {
    pCurrent.textContent = fmt(audio.currentTime);
    pDuration.textContent = fmt(audio.duration || 0);
    pSeek.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  });

  audio.addEventListener("loadedmetadata", () => {
    pDuration.textContent = fmt(audio.duration || 0);
  });

  audio.addEventListener("ended", () => playFromQueue(1));

  pSeek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (pSeek.value / 100) * audio.duration;
  });

  buscar.addEventListener("input", applyFilter);

  function fmt(s) {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  /* ---------- API pública ---------- */

  exportedPlayer = { playTrack, pause: () => audio.pause(), resume: () => audio.play() };

  /* init */
  applyFilter();
  window.musicPlayer = exportedPlayer;
})();