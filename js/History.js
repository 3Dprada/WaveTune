/* Historial local de reproducción. Guarda solo IDs y fechas, nunca los MP3. */
const ListenHistory = (() => {
  "use strict";

  const KEY = "wt:listen-history";
  const LIMIT = 60;
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value)
        ? value.filter((entry) => entry && typeof entry.id === "string" && Number.isFinite(entry.playedAt))
        : [];
    } catch {
      return [];
    }
  };
  const write = (entries) => {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT))); }
    catch { /* almacenamiento desactivado o sin espacio */ }
  };

  function record(songId) {
    if (!songId) return;
    const entries = read();
    const now = Date.now();
    /* Reanudar la misma canción no crea una entrada duplicada inmediata. */
    if (entries[0]?.id === songId && now - entries[0].playedAt < 120000) {
      entries[0].playedAt = now;
    } else {
      entries.unshift({ id: songId, playedAt: now });
    }
    write(entries);
  }

  return {
    record,
    last: () => read()[0] || null,
    all: () => read(),
    clear: () => write([])
  };
})();
