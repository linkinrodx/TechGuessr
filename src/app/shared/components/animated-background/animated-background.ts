import { Component } from '@angular/core';

interface FloatingSymbol {
  text: string;
  left: number;
  duration: number;
  delay: number;
  size: number;
}

interface Star {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}

/**
 * Fondo decorativo con movimiento sutil: gradiente base (reemplaza el
 * negro plano), grid tipo "circuito" a la deriva, manchas de aurora, y
 * dos capas de partículas (símbolos de código subiendo + estrellas que
 * titilan). Puramente CSS, sin imágenes ni librerías: costo de
 * performance mínimo y respeta prefers-reduced-motion (ver .scss, igual
 * que el resto de animaciones de la app en styles.scss).
 *
 * Se monta una sola vez en app.html, detrás de todo el contenido
 * (position: fixed, z-index negativo), para no duplicar la animación por
 * cada ruta.
 */
@Component({
  selector: 'app-animated-background',
  standalone: true,
  templateUrl: './animated-background.html',
  styleUrl: './animated-background.scss',
})
export class AnimatedBackground {
  /**
   * Configuración fija (no Math.random) para que el layout sea
   * determinista y no cambie entre renders. Valores elegidos a mano para
   * distribuir símbolos y estrellas por todo el ancho de la pantalla.
   */
  protected readonly floatingSymbols: FloatingSymbol[] = [
    { text: '{ }', left: 4, duration: 16, delay: -2, size: 1.1 },
    { text: '</>', left: 13, duration: 20, delay: -9, size: 1.3 },
    { text: '01', left: 22, duration: 15, delay: -5, size: 0.95 },
    { text: '=>', left: 31, duration: 18, delay: -12, size: 1.2 },
    { text: '[ ]', left: 40, duration: 22, delay: -1, size: 1 },
    { text: '10', left: 49, duration: 14, delay: -7, size: 0.9 },
    { text: '&&', left: 57, duration: 19, delay: -14, size: 1.15 },
    { text: '#', left: 65, duration: 17, delay: -3, size: 1.4 },
    { text: '( )', left: 73, duration: 21, delay: -10, size: 1.05 },
    { text: ';;', left: 81, duration: 16, delay: -6, size: 1.1 },
    { text: '</>', left: 89, duration: 23, delay: -16, size: 1.25 },
    { text: '01', left: 96, duration: 15, delay: -4, size: 0.95 },
  ];

  protected readonly stars: Star[] = [
    { left: 8, top: 12, size: 3, delay: 0, duration: 4 },
    { left: 18, top: 68, size: 2, delay: 0.8, duration: 3.5 },
    { left: 27, top: 30, size: 4, delay: 1.6, duration: 5 },
    { left: 35, top: 82, size: 2, delay: 0.3, duration: 3 },
    { left: 44, top: 15, size: 3, delay: 2.1, duration: 4.5 },
    { left: 53, top: 55, size: 2, delay: 1.1, duration: 3.8 },
    { left: 61, top: 90, size: 3, delay: 0.5, duration: 4.2 },
    { left: 69, top: 22, size: 4, delay: 1.9, duration: 5.2 },
    { left: 77, top: 60, size: 2, delay: 0.9, duration: 3.6 },
    { left: 85, top: 40, size: 3, delay: 2.4, duration: 4.8 },
    { left: 92, top: 75, size: 2, delay: 1.3, duration: 3.4 },
    { left: 12, top: 45, size: 3, delay: 1.7, duration: 4.1 },
    { left: 63, top: 8, size: 2, delay: 0.2, duration: 3.9 },
    { left: 38, top: 50, size: 3, delay: 2.6, duration: 4.6 },
  ];
}
