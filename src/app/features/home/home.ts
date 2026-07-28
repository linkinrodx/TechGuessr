import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GameService } from '../../core/game.service';
import { MascotService } from '../../core/mascot.service';
import { GameIcon } from '../../shared/components/game-icon/game-icon';

/**
 * Página principal de la app. Es la primera pantalla que ve cualquier
 * visitante (ruta ''), autenticado o no: presenta el juego, un mensaje
 * corto y accesos a jugar / leaderboard / autenticación opcional.
 *
 * El login es completamente opcional: se puede jugar cualquier modalidad
 * sin cuenta. Solo afecta si la partida se guarda en el leaderboard al
 * terminar (ver aviso en session-summary de cada modalidad).
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, GameIcon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly mascot = inject(MascotService);

  protected readonly currentUser = this.auth.currentUser;
  protected readonly currentYear = new Date().getFullYear();

  /**
   * Tips de gameplay para las distintas modalidades. Contenido genérico
   * (no revela respuestas de ninguna ronda concreta): solo estrategia
   * general de cómo leer las pistas de cada juego.
   */
  private readonly tips = [
    'Tip: en CodeGuessr fíjate primero en la sintaxis de imports, suele delatar el lenguaje antes que nada.',
    'Tip: en CommitGuessr, la cantidad de líneas cambiadas es una buena pista del esfuerzo estimado.',
    'Tip: en UIGuessr, revisa la tipografía y los iconos: casi ninguna app usa exactamente los mismos.',
    'Tip: en AIGuessr, el texto generado por IA suele ser demasiado "perfecto" o repetir estructuras.',
    'Tip: no necesitas llenar los 3 campos en CodeGuessr, el lenguaje ya suma puntos por sí solo.',
  ];

  /** Retos cortos para motivar una partida, sin acoplarse al estado real de ninguna sesión. */
  private readonly challenges = [
    'Reto de hoy: saca 8/10 en CodeGuessr sin usar el autocompletado.',
    'Reto de hoy: intenta adivinar framework y proyecto en al menos 3 rondas seguidas.',
    'Reto de hoy: juega una partida completa de CommitGuessr en menos de 5 minutos.',
    'Reto de hoy: supera tu puntaje anterior en cualquier modalidad.',
  ];

  /**
   * Saluda con el nombre de usuario si hay sesión iniciada, y ajusta el
   * saludo a la hora del día. Sin cuenta, usa un saludo genérico.
   */
  private buildGreeting(): string {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const user = this.currentUser();
    return user
      ? `${timeGreeting}, ${user.username}! ¿List@ para tu próxima partida?`
      : `${timeGreeting}! Soy Byte, tu guía en TechGuessr 🐶`;
  }

  /**
   * Al llegar al landing, la mascota saluda con un mensaje que rota entre
   * saludo, tip o reto del día — variedad para que no se sienta repetitivo
   * en cada visita. setMood() ya reemplaza cualquier mood/mensaje que
   * hubiera quedado de una partida anterior (ej. "celebrating"), así que
   * no hace falta un reset() previo.
   */
  ngOnInit(): void {
    // Si acabamos de llegar aquí tras un logout, ese mensaje de
    // despedida ya está mostrado y no debe pisarse con el saludo.
    if (this.mascot.consumeHold()) {
      return;
    }

    const messagePool = [this.buildGreeting(), this.buildGreeting(), ...this.tips, ...this.challenges];
    const message = messagePool[Math.floor(Math.random() * messagePool.length)];
    this.mascot.setMood('happy', message);
  }

  /**
   * Navega a /play. El login ya no es obligatorio para jugar (el backend
   * acepta invitados, ver Auth/OptionalJwtValidator.cs); solo se guarda
   * el puntaje en el leaderboard si hay usuario autenticado, aviso que se
   * muestra en session-summary al terminar la partida.
   *
   * IMPORTANTE: siempre resetea la sesión anterior antes de navegar para
   * que CodeguessrGame.ngOnInit() inicie un juego limpio y no muestre
   * datos residuales de partidas anteriores.
   */
  protected async onPlayCodeguessr(isAvailable: boolean = true): Promise<void> {
    if (!isAvailable) {
      return; // No hacer nada si el juego no está disponible aún
    }

    this.game.reset();
    await this.router.navigateByUrl('/play');
  }

  /**
   * Navega a /commit para jugar CommitGuessr. Login opcional, ver
   * comentario de onPlayCodeguessr.
   */
  protected async onPlayCommitguessr(): Promise<void> {
    await this.router.navigateByUrl('/commit');
  }

  /**
   * Navega a /ui-play para jugar UIGuessr. Login opcional, ver
   * comentario de onPlayCodeguessr.
   */
  protected async onPlayUIguessr(): Promise<void> {
    await this.router.navigateByUrl('/ui-play');
  }

  /**
   * Navega a /ai-play para jugar AIGuessr. Corre 100% en el cliente, sin
   * backend, así que nunca dependió de login.
   */
  protected async onPlayAIguessr(): Promise<void> {
    await this.router.navigateByUrl('/ai-play');
  }
}
