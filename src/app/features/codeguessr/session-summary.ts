import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../../core/game.service';
import { SessionSummaryResponse } from '../../shared/types/game.types';

@Component({
  selector: 'app-session-summary',
  standalone: true,
  templateUrl: './session-summary.html',
  styleUrl: './session-summary.scss',
})
export class SessionSummary implements OnInit {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly summary = signal<SessionSummaryResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const summary = await this.game.getSummary();
      this.summary.set(summary);
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
