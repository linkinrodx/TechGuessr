import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { GameService } from '../../../core/game.service';
import { AuthService } from '../../../core/auth.service';
import { MascotService } from '../../../core/mascot.service';

/**
 * Encabezado compartido por las 5 pantallas de la app (login, register,
 * juego, resumen de sesión, leaderboard). Se inyecta en app.html envolviendo
 * el <router-outlet>, en lugar de que cada feature defina su propio
 * encabezado (Requirement 5.1).
 *
 * Solo lee signals ya expuestos por GameService/AuthService (no muta
 * estado de ninguno de los dos), por lo que no viola la preservación de
 * lógica de negocio del Requirement 7.2 — ver design.md, sección 5.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly router = inject(Router);
  private readonly game = inject(GameService);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  /**
   * Mensajes de despedida al cerrar sesión; se sortea uno para que no se
   * sienta repetitivo en cada logout.
   */
  private readonly farewellMessages = [
    '¡Hasta la próxima! Aquí estaré cuando vuelvas 👋',
    '¡Nos vemos! No olvides tu racha la próxima vez.',
    'Sesión cerrada. ¡Vuelve pronto a jugar!',
  ];

  protected readonly currentUser = this.auth.currentUser;
  protected readonly totalScore = this.game.totalScore;
  protected readonly roundIndex = this.game.roundIndex;

  /**
   * Ruta actual, actualizada en cada navegación. Se usa para ocultar
   * ronda/puntaje en el landing page ('/') incluso si el jugador dejó una
   * sesión de CodeGuessr en estado 'playing' sin terminarla (ej. volvió al
   * inicio con el logo a mitad de partida) — sin esto, el header seguía
   * mostrando el marcador fuera de la pantalla de juego.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Requirement 5.3/5.4: ronda y puntaje se muestran como una sola unidad.
   * Visibles solo si hay sesión 'playing' Y una ronda actual cargada, y
   * además el jugador no está en el landing page; en cualquier otro caso
   * ambos se ocultan, sin estado intermedio (decisión explícita del
   * usuario sobre visibilidad acoplada, no independiente).
   */
  protected readonly showRoundAndScore = computed(
    () =>
      this.currentUrl() !== '/' &&
      this.game.sessionStatus() === 'playing' &&
      this.game.currentRound() !== null,
  );

  /**
   * Requirement 5.5: navega a /play si el jugador está autenticado o tiene
   * una sesión de partida activa (preservando la sesión aunque no haya
   * auth), sino a /login.
   */
  protected async onLogoActivate(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  protected onLogout(): void {
    this.auth.logout();
    this.game.reset();
    const message = this.farewellMessages[Math.floor(Math.random() * this.farewellMessages.length)];
    this.mascot.setMood('sad', message);
    // Evita que Home.ngOnInit sobreescriba este mensaje de despedida con
    // su saludo aleatorio al aterrizar en '/' justo después del logout.
    this.mascot.holdNextAutoMessage();
    this.router.navigateByUrl('/');
  }
}
