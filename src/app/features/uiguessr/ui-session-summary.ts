import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UIGameService } from '../../core/ui-game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { UISessionSummaryResponse } from '../../shared/types/game.types';

/**
 * Resumen de partida de UIGuessr. Análogo a
 * commitguessr/commit-session-summary, pero consume UIGameService: cada
 * modalidad mantiene su propia sesión y su propio shard de leaderboard
 * (ver Function.cs, UIguessrLeaderboardShard).
 */
@Component({
  selector: 'app-ui-session-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ui-session-summary.html',
  styleUrl: './ui-session-summary.scss',
})
export class UISessionSummary implements OnInit {
  private readonly game = inject(UIGameService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly summary = signal<UISessionSummaryResponse | null>(null);
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
    await this.router.navigateByUrl('/ui-play');
  }

  async viewLeaderboard(): Promise<void> {
    await this.router.navigateByUrl('/ui-leaderboard');
  }

  /**
   * Formatea la diferencia de años para mostrar en la tabla.
   */
  protected formatYearDiff(diff: number): string {
    if (diff === 0) return 'Exacto';
    if (diff === 1) return '±1';
    return `±${diff}`;
  }
}
