import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AIGameService } from '../../core/ai-game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { AISessionSummaryResponse } from '../../shared/types/game.types';

/**
 * Resumen de partida de AIGuessr. Análogo a ui-session-summary: lee el
 * resumen sincrónicamente de AIGameService (modo local, sin backend).
 */
@Component({
  selector: 'app-ai-session-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ai-session-summary.html',
  styleUrl: './ai-session-summary.scss',
})
export class AISessionSummary implements OnInit {
  private readonly game = inject(AIGameService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly summary = signal<AISessionSummaryResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Ver comentario análogo en codeguessr/session-summary.ts. AIGuessr no
   * tiene leaderboard real todavía (corre sin backend), pero se muestra
   * el mismo aviso por consistencia con las demás modalidades.
   */
  protected readonly isGuest = () => this.auth.currentUser() === null;

  ngOnInit(): void {
    try {
      const summary = this.game.getSessionSummary();
      this.summary.set(summary);
      this.mascot.setMood('celebrating', `¡${summary.TotalScore} puntos en total!`);
    } catch {
      this.errorMessage.set('No se pudo cargar el resumen de la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async playAgain(): Promise<void> {
    await this.router.navigateByUrl('/ai-play');
  }

  async goHome(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  get correctRounds(): number {
    return (this.summary()?.Rounds ?? []).filter((r) => r.Correctness?.IsCorrect).length;
  }

  get totalRounds(): number {
    return this.summary()?.Rounds.length ?? 0;
  }

  get accuracy(): number {
    if (this.totalRounds === 0) return 0;
    return Math.round((this.correctRounds / this.totalRounds) * 100);
  }
}
