import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/game.service';
import { LeaderboardEntryResponse } from '../../shared/types/game.types';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {
  private readonly game = inject(GameService);

  readonly entries = signal<LeaderboardEntryResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const entries = await this.game.getLeaderboard();
      this.entries.set(entries);
    } catch {
      this.errorMessage.set('No se pudo cargar el leaderboard.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
