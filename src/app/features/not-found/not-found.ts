import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página 404 (ruta wildcard '**' en app.routes.ts). Sin esto, cualquier
 * URL inválida caía en una pantalla en blanco (router sin componente que
 * renderizar, ninguna de las rutas hace match).
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
