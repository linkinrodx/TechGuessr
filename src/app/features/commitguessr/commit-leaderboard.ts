import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommitGameService } from '../../core/commit-game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { LeaderboardEntryResponse } from '../../shared/types/game.types';
import { buildLeaderboardMascotMessage } from '../../shared/leaderboard-mascot-message';

/**
 * Leaderboard específico de CommitGuessr. Análogo a codeguessr/leaderboard,
 * pero consulta /commit-leaderboard (shard "commitguessr"): el techo de
 * puntaje de CommitGuessr (1800 pts/ronda) es mucho más alto que el de
 * CodeGuessr (300 pts/ronda), por lo que mezclarlos en un solo ranking
 * haría que CommitGuessr domine siempre la tabla.
 */
@Component({
  selector: 'app-commit-leaderboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './commit-leaderboard.html',
  styleUrl: './commit-leaderboard.scss',
})
export class CommitLeaderboard implements OnInit {
  private readonly game = inject(CommitGameService);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly entries = signal<LeaderboardEntryResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      let entries = await this.game.getLeaderboard();
      const username = this.auth.currentUser()?.username;

      // GSI eventual consistency: si el usuario acaba de jugar y no aparece
      // aún en los resultados, reintentar tras un breve delay.
      if (username && !entries.some((e) => e.Username === username)) {
        await new Promise((r) => setTimeout(r, 1500));
        entries = await this.game.getLeaderboard();
      }

      this.entries.set(entries);
      const message = buildLeaderboardMascotMessage(entries, username);
      this.mascot.setMood('idle', message);
    } catch {
      this.errorMessage.set('No se pudo cargar el leaderboard.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected isOwnEntry(entry: LeaderboardEntryResponse): boolean {
    const username = this.auth.currentUser()?.username;
    return username !== undefined && username === entry.Username;
  }
}
