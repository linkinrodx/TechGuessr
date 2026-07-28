import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { LeaderboardEntryResponse } from '../../shared/types/game.types';
import { buildLeaderboardMascotMessage } from '../../shared/leaderboard-mascot-message';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {
  private readonly game = inject(GameService);
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

  /**
   * Requirement 6.5: identifica la fila del jugador actual para
   * resaltarla visualmente en la lista del leaderboard.
   */
  protected isOwnEntry(entry: LeaderboardEntryResponse): boolean {
    const username = this.auth.currentUser()?.username;
    return username !== undefined && username === entry.Username;
  }
}
