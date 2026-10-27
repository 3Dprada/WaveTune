<*!-----------------  Glassy Study Music -----------------!*>

<img width="1918" height="875" alt="imagen" src="https://github.com/user-attachments/assets/40ad36e9-63dc-4d3a-ad1a-d124c537f8e1" />

<img width="1912" height="1070" alt="imagen" src="https://github.com/user-attachments/assets/ff2c73fc-5e0c-479d-83ab-9ceba5393985" />

<img width="1920" height="1076" alt="imagen" src="https://github.com/user-attachments/assets/c0569425-2c83-45b2-ab8c-b7f5d7b79f5a" />

<img width="1920" height="1077" alt="imagen" src="https://github.com/user-attachments/assets/be1c2ef5-36af-4bde-8a20-8de47f803a53" />


Es un pequeño proyecto de estudio de un reproductor de musica web inspirada en la interfaz de Youtube Music con una estetica "glassy"(cristal). Catalogo local de caciones, albunes y artistas, con cola de reproducción, favoritos, playList y login de demostración.

<--- Ha un sigue en desarrollo --->

El proyecto empezo unicamente para mejorar la intefaz visual en cara al usuario, para otorgarle una meyor personalización 
en el momento de navegar utilizando herramientas fluidas que reducen la acumulacion de cache.


<------ Indice ------>
1. Características
2. Tecnologías
3. Estructura del proyecto
4. Cómo ejecutarlo
5. Modelo de datos
6. Cronología de avances
7. Errores corregidos
8. Pendiente y proximos pasos
9. Créditos y referencias


<------ Características ------>

 .- Interfaz tipo YouTube Music: menú lateral, buscador, chips de filtro, secciones de álbumes, 
 artistas y canciones, y reproductor fijo abajo.
 .- Tres páginas: Inicio, Explorar (géneros y estados de ánimo) y Biblioteca.
 .- Reproductor con audio real: reproducir/pausa, anterior/siguiente, aleatorio, 
 bucle (desactivado / lista / una canción), volumen, barra de progreso, cola y vista ampliada.
 .- Importación local de las canciones del catálogo desde «Añadir música»; se guardan en el navegador mediante IndexedDB.
 .- Favoritos y playlists (las del usuario se guardan en localStorage).
 .- Carrusel circular de artistas con foco central, escala y opacidad de profundidad; navegable con flechas y teclado.
 .- Fondo que cambia con los colores de la portada de la canción que suena.
 .- Letras añadidas por el usuario con soporte para marcas de tiempo LRC y resaltado sincronizado.
 .- Ajustes de apariencia persistentes: color de acento, intensidad de cristal y movimiento ambiental.
 .- Última canción reproducida e historial local de escucha con fecha y hora.
 .- Portadas asignadas por canción y álbum desde `assets/artwork/`, incluidas en listas, cola y reproductor.
 .- Login de demostración con "Recordarme".
 .- PWA: manifest.webmanifest y service worker (sw.js).


<------ Tecnologías ------>








<------ Estructura del proyecto ------>







<------ Cómo ejecutarlo ------>

Los archivos de audio no se incluyen en el repositorio. En la aplicación, pulsa «Añadir música» y selecciona tus archivos; el nombre de cada archivo debe coincidir con el nombre de la canción del catálogo `js/Data.js` (por ejemplo, `01-baile-inolvidable.mp3` o `Baile Inolvidable.mp3`). Los archivos quedan guardados en este navegador y no se suben a un servidor.








<------ Modelo de datos ------>






<------ Cronología de avances ------>








<------ Errores corregidos ------>







<------ Pendiente y proximos pasos ------>








<------ Créditos y referencias ------>





