import { Component, inject } from '@angular/core';
import { MascotService } from '../../../core/mascot.service';

/**
 * Mascota guía de TechGuessr: un perrito programador (con lentes)
 * dibujado en SVG propio, sin dependencia de imágenes externas.
 * Reacciona al estado expuesto por MascotService
 * (idle/thinking/happy/sad/celebrating).
 *
 * Se monta una sola vez en app.html (fixed, esquina inferior) para que
 * persista entre rondas y pantallas sin recrearse.
 */
@Component({
  selector: 'app-mascot',
  standalone: true,
  templateUrl: './mascot.html',
  styleUrl: './mascot.scss',
})
export class Mascot {
  protected readonly mascot = inject(MascotService);

  protected dismissMessage(): void {
    this.mascot.dismissMessage();
  }
}
