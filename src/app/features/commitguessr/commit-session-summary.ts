import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommitGameService } from '../../core/commit-game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { CommitSessionSummaryResponse } from '../../shared/types/game.types';

/**
 * Resumen de partida de CommitGuessr. Análogo a codeguessr/session-summary,
 * pero consume CommitGameService en vez de GameService: cada modalidad
 * mantiene su propia sesión y su propio shard de leaderboard (ver
 * Function.cs, CommitguessrLeaderboardShard).
 */
@Component({
  selector: 'app-commit-session-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './commit-session-summary.html',
  styleUrl: './commit-session-summary.scss',
})
export class CommitSessionSummary implements OnInit {
  private readonly game = inject(CommitGameService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly summary = signal<CommitSessionSummaryResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /** Ver comentario análogo en codeguessr/session-summary.ts. */
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
    await this.router.navigateByUrl('/commit');
  }

  async viewLeaderboard(): Promise<void> {
    await this.router.navigateByUrl('/commit-leaderboard');
  }
}
