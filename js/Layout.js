/* Chrome común a las tres páginas: barra lateral, barra superior, reproductor,
   panel de cola, reproductor ampliado y menú contextual.

   Se genera desde aquí y no desde el HTML de cada página porque las tres
   páginas ya se habían desincronizado solas (iconos distintos, distinto
   marcado, enlaces que no iban a ningún sitio). Con una sola fuente, el
   <body data-page="…"> de cada HTML decide qué pestaña queda marcada.

   Los controles que aparecen dos veces (reproductor y vista ampliada) llevan
   data-ctl en vez de id: un id repetido es HTML inválido y getElementById
   solo encontraría el primero. Player.js se engancha a todos a la vez. */

const Layout = (() => {
  "use strict";

  const PAGES = [
    { id: "inicio",    label: "Inicio",     href: "index.html",                 icon: "home" },
    { id: "explorar", label: "Explorar",   href: "explorar/Explorar.html",     icon: "explore" },
    { id: "biblioteca", label: "Biblioteca", href: "biblioteca/Biblioteca.html", icon: "library" }
  ];

  const ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    explore: '<path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
    library: '<path d="M3 5h2.5v14H3zm5-2h2.5v16H8zm5 3 6.5.8-1.6 12.4L9.4 18z"/>',
    plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
    search: '<path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zM9.5 14a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>',
    menu: '<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>',
    back: '<path d="M15.5 4 7 12l8.5 8 1.5-1.5L10 12l7-6.5z"/>',
    forward: '<path d="M8.5 4 17 12l-8.5 8L7 18.5l7-6.5-7-6.5z"/>',
    shuffle: '<path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2 1.4-1.4zM14.5 4l2 2L4 18.6 5.4 20 18 7.4l2 2V4zM14.8 13.4l-1.4 1.4 3.1 3.2L14.5 20H20v-5.5l-2 2z"/>',
    prev: '<path d="M6 6h2.5v12H6zm12 0v12l-9.5-6z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/>',
    next: '<path d="M15.5 6v12L6 12zM17 6h2v12h-2z"/>',
    repeat: '<path d="M7 7h10v2.6L21 6l-4-3.6V5H5v6h2zm10 10H7v-2.6L3 18l4 3.6V19h12v-6h-2z"/>',
    repeatOne: '<path d="M12.7 8.4h-1.5v5.2h1.1V9.8l1.4-.5v-.9z"/>',
    heart: '<path d="M12 21s-6.7-4.35-9.33-8.06C.9 10.36 2.4 6.5 5.9 6.5c1.9 0 3.3 1.05 4.1 2.35.8-1.3 2.2-2.35 4.1-2.35 3.5 0 5 3.86 3.23 6.44C18.7 16.65 12 21 12 21z"/>',
    volume: '<path d="M4 9h3l4-4v14l-4-4H4zm11.5 3.5a4 4 0 0 0 0-5v5z"/>',
    mute: '<path d="M4 9h3l4-4v14l-4-4H4zm11.5 3.5L18 10l-2.5 2.5L18 15l-1.5 1.5L14 14l-2.5 2.5L10 15l2.5-2.5L10 10l1.5-1.5L14 11z"/>',
    queue: '<path d="M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm12 1 5-3v10l-5-3z"/>',
    expand: '<path d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM6 15v3h3v2H4v-5zm12 0h2v5h-5v-2h3z"/>',
    collapse: '<path d="M9 4h2v5H6V7h3zm4 0h2v3h3v2h-5zM6 15h5v5H9v-3H6zm7 0h5v5h-5z"/>',
    dots: '<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>',
    lyrics: '<path d="M3 5h11v2H5v12h4v2H3zm13 0h5v2h-3v2h3v2h-3v2h3v2h-5z"/>',
    close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>',
    drag: '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>',
    trash: '<path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/>'
  };

  const svg = (name, size = 22) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;

  const current = () => document.body.dataset.page;

  /* ---------- barra lateral ---------- */
  const sidebar = () => `
    <div class="logo"><i aria-hidden="true"></i><span>Glassy Music</span></div>
    <nav class="nav">
      ${PAGES.map((p) => `
        <a href="${ROOT}${p.href}" class="${current() === p.id ? "on" : ""}"
           ${current() === p.id ? 'aria-current="page"' : ""}>
          ${svg(p.icon)}<span>${p.label}</span>
        </a>`).join("")}
    </nav>
    <div class="sep"></div>
    <button class="newpl" data-act="new-playlist" type="button">${svg("plus", 20)}<span>Nueva playlist</span></button>
    <div class="sep"></div>
    <p class="side-label">Tus playlists</p>
    <div class="pl-list" data-slot="playlists"></div>`;

  /* ---------- barra superior ---------- */
  const topbar = () => `
    <button class="icon-btn burger" data-act="menu" type="button" aria-label="Abrir menú">${svg("menu")}</button>
    <div class="nav-arrows">
      <button class="icon-btn" data-act="back" type="button" aria-label="Atrás">${svg("back", 20)}</button>
      <button class="icon-btn" data-act="forward" type="button" aria-label="Adelante">${svg("forward", 20)}</button>
    </div>
    <label class="search" for="q">
      ${svg("search", 20)}
      <input id="q" type="search" placeholder="Busca canciones, álbumes, artistas"
             autocomplete="off" aria-label="Buscar en tu biblioteca">
    </label>
    <div class="avatar" aria-label="Cuenta de Carlos">C</div>`;

  /* ---------- controles compartidos ---------- */
  /* play/pause */
  const transport = (size = 22, cls = "") => `
    <button class="${cls}" data-ctl="play" type="button" aria-label="Reproducir">
      <span data-ctl="icon-play">${svg("play", size)}</span>
      <span data-ctl="icon-pause" hidden>${svg("pause", size)}</span>
    </button>`;

  const shuffleBtn = `
    <button class="sm" data-ctl="shuffle" type="button" aria-pressed="false" aria-label="Aleatorio">${svg("shuffle", 20)}</button>`;

  const repeatBtn = `
    <button class="sm" data-ctl="repeat" type="button" aria-pressed="false" aria-label="Repetir: desactivado">
      ${svg("repeat", 20)}<span data-ctl="repeat-one" hidden>${svg("repeatOne", 20)}</span>
    </button>`;

  const favBtn = (size = 20, cls = "") => `
    <button class="icon-btn like ${cls}" data-ctl="fav" type="button" aria-pressed="false"
            aria-label="Marcar como favorita">${svg("heart", size)}</button>`;

  const queueBtn = `
    <button class="icon-btn" data-ctl="queue" type="button" aria-label="Cola de reproducción" aria-expanded="false">
      ${svg("queue", 20)}<span class="badge" data-ctl="queue-count" hidden>0</span>
    </button>`;

  const volume = `
    <button class="icon-btn" data-ctl="mute" type="button" aria-label="Silenciar">
      <span data-ctl="icon-vol">${svg("volume", 20)}</span>
      <span data-ctl="icon-mute" hidden>${svg("mute", 20)}</span>
    </button>
    <input class="vol" data-ctl="vol" type="range" min="0" max="100" value="70" aria-label="Volumen">`;

  /* ---------- reproductor ---------- */
  const player = () => `
    <div class="prog">
      <input type="range" data-ctl="seek" min="0" max="100" step="0.1" value="0" aria-label="Posición">
      <i data-ctl="fill"></i>
    </div>

    <div class="now">
      <button class="thumb" data-ctl="expand" type="button" aria-label="Ampliar reproductor"></button>
      <div class="now-text">
        <b data-ctl="title">Elige una canción</b>
        <small data-ctl="artist">WaveTune</small>
      </div>
      ${favBtn()}
    </div>

    <div class="ctrl">
      ${shuffleBtn}
      <button class="sm" data-ctl="prev" type="button" aria-label="Anterior">${svg("prev", 24)}</button>
      ${transport(24, "play")}
      <button class="sm" data-ctl="next" type="button" aria-label="Siguiente">${svg("next", 24)}</button>
      ${repeatBtn}
    </div>

    <div class="right">
      <span class="time"><span data-ctl="cur">0:00</span> / <span data-ctl="dur">0:00</span></span>
      <button class="icon-btn" data-ctl="lyrics" type="button" aria-label="Ver letra">${svg("lyrics", 20)}</button>
      ${queueBtn}
      ${volume}
    </div>`;

  /* ---------- panel de cola ---------- */
  const queuePanel = () => `
    <aside class="queue-panel" data-slot="queue-panel" aria-label="Cola de reproducción">
      <header>
        <h2>Cola</h2>
        <button class="icon-btn" data-act="close-queue" type="button" aria-label="Cerrar la cola">${svg("close", 20)}</button>
      </header>
      <div class="queue-body">
        <p class="queue-label">Siguiente en cola</p>
        <ol class="q-list" data-slot="queue"></ol>
      </div>
    </aside>`;

  /* ---------- reproductor ampliado ---------- */
  const expanded = () => `
    <div class="expanded" aria-label="Reproductor ampliado" aria-modal="true">
      <div class="xp-bg" data-slot="xp-bg"></div>
      <header class="xp-head">
        <button class="icon-btn" data-act="collapse" type="button" aria-label="Reducir reproductor">${svg("collapse", 24)}</button>
        <div class="xp-head-text"><small>Siguiente en cola</small><b>Glassy Music</b></div>
        ${queueBtn}
      </header>
      <div class="xp-art" data-slot="xp-art"></div>
      <div class="xp-meta">
        <div>
          <h1 data-ctl="title"></h1>
          <p data-ctl="artist"></p>
        </div>
        ${favBtn(24, "lg")}
      </div>
      <div class="xp-prog">
        <span data-ctl="cur">0:00</span>
        <i class="xp-bar"><b data-ctl="fill"></b></i>
        <span data-ctl="dur">0:00</span>
      </div>
      <div class="xp-ctrl">
        ${shuffleBtn}
        <button class="sm" data-ctl="prev" type="button" aria-label="Anterior">${svg("prev", 32)}</button>
        ${transport(32, "play lg")}
        <button class="sm" data-ctl="next" type="button" aria-label="Siguiente">${svg("next", 32)}</button>
        ${repeatBtn}
      </div>
      <div class="xp-tabs">
        <button class="xp-tab on" data-ctl="tab-queue" type="button">Siguiente</button>
        <button class="xp-tab" data-ctl="tab-lyrics" type="button">Letra</button>
      </div>
      <div class="xp-pane on" data-slot="pane-queue"><div class="q-list" data-slot="xp-queue"></div></div>
      <div class="xp-pane" data-slot="pane-lyrics"><p class="lyrics" data-slot="lyrics"></p></div>
    </div>`;

  /* ---------- menú contextual ---------- */
  const menu = () => `<div class="ctx" data-slot="ctx" role="menu" hidden></div>
                      <div class="ctx-backdrop" data-act="close-ctx" hidden></div>`;

  return { PAGES, ICONS, svg, sidebar, topbar, player, queuePanel, expanded, menu, current };
})();
