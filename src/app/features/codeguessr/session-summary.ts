import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../../core/game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { SessionSummaryResponse } from '../../shared/types/game.types';

@Component({
  selector: 'app-session-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './session-summary.html',
  styleUrl: './session-summary.scss',
})
export class SessionSummary implements OnInit {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly summary = signal<SessionSummaryResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /**
   * El login ya no es obligatorio para jugar; si la partida se jugó sin
   * cuenta, el backend no la guardó en el leaderboard (ver Function.cs,
   * llamadas a RecordScoreAsync condicionadas a caller.IsAuthenticated).
   * Se invita a iniciar sesión para que el progreso futuro sí se guarde.
   */
  protected readonly isGuest = () => this.auth.currentUser() === null;

  async ngOnInit(): Promise<void> {
    try {
      const summary = await this.game.getSummary();
      this.summary.set(summary);
      this.mascot.setMood('celebrating', `¡${summary.TotalScore} puntos en total!`);
    } catch {
      this.errorMessage.set('No se pudo cargar el resumen de la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async playAgain(): Promise<void> {
    await this.router.navigateByUrl('/play');
  }

  async viewLeaderboard(): Promise<void> {
    await this.router.navigateByUrl('/leaderboard');
  }
}
