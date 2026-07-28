import { Injectable } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Combina el `title` declarado en cada ruta (ver app.routes.ts) con el
 * nombre del sitio, para que la pestaña del navegador refleje en qué
 * pantalla está el jugador (ej. "CodeGuessr · TechGuessr") en vez de
 * mostrar siempre el mismo "TechGuessr" sin importar la ruta.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    document.title = routeTitle && routeTitle !== 'TechGuessr' ? `${routeTitle} · TechGuessr` : 'TechGuessr';
  }
}
