import { Component, input } from '@angular/core';

export type GameIconName =
  | 'code'
  | 'commit'
  | 'ui'
  | 'ai'
  | 'stack'
  | 'terminal';

/**
 * Icono representativo de cada modalidad de juego, dibujado en SVG
 * propio (mismo enfoque que Mascot/AnimatedBackground: sin imágenes de
 * terceros, sin dependencia de una librería de iconos). Se usa en las
 * cards de la landing (home.html) para que cada modo sea reconocible de
 * un vistazo, no solo por el nombre.
 */
@Component({
  selector: 'app-game-icon',
  standalone: true,
  templateUrl: './game-icon.html',
  styleUrl: './game-icon.scss',
})
export class GameIcon {
  readonly name = input.required<GameIconName>();
}
