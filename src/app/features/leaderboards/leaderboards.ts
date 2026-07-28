import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/game.service';
import { CommitGameService } from '../../core/commit-game.service';
import { UIGameService } from '../../core/ui-game.service';
import { AuthService } from '../../core/auth.service';
import { MascotService } from '../../core/mascot.service';
import { LeaderboardEntryResponse } from '../../shared/types/game.types';

interface LeaderboardSection {
  title: string;
  playRoute: string;
  entries: LeaderboardEntryResponse[];
  errorMessage: string | null;
}

/**
 * Página que agrupa los leaderboards de todas las modalidades disponibles
 * (CodeGuessr, CommitGuessr, UIGuessr) en un solo lugar, en vez de tener que
 * navegar a cada uno por separado desde el landing page. AIGuessr queda
 * fuera porque todavía no tiene backend/ranking real (ver AIGameService).
 *
 * El leaderboard individual post-partida (session-summary de cada modalidad)
 * no se toca: sigue enlazando a su propia ruta de leaderboard dedicada.
 */
@Component({
  selector: 'app-leaderboards',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './leaderboards.html',
  styleUrl: './leaderboards.scss',
})
export class Leaderboards implements OnInit {
  private readonly codeGame = inject(GameService);
  private readonly commitGame = inject(CommitGameService);
  private readonly uiGame = inject(UIGameService);
  private readonly auth = inject(AuthService);
  private readonly mascot = inject(MascotService);

  readonly sections = signal<LeaderboardSection[]>([]);
  readonly isLoading = signal(true);

  async ngOnInit(): Promise<void> {
    const configs = [
      { title: 'CodeGuessr', playRoute: '/play', load: () => this.codeGame.getLeaderboard() },
      { title: 'CommitGuessr', playRoute: '/commit', load: () => this.commitGame.getLeaderboard() },
      { title: 'UIGuessr', playRoute: '/ui-play', load: () => this.uiGame.getLeaderboard() },
    ];

    const username = this.auth.currentUser()?.username;

    const results = await Promise.all(
      configs.map(async (config) => {
        try {
          let entries = await config.load();

          // GSI eventual consistency: si el usuario está autenticado y no
          // aparece en los resultados, reintentar tras un breve delay.
          if (username && !entries.some((e) => e.Username === username)) {
            await new Promise((r) => setTimeout(r, 1500));
            entries = await config.load();
          }

          return { title: config.title, playRoute: config.playRoute, entries, errorMessage: null };
        } catch {
          return {
            title: config.title,
            playRoute: config.playRoute,
            entries: [],
            errorMessage: 'No se pudo cargar este leaderboard.',
          };
        }
      }),
    );

    this.sections.set(results);
    this.isLoading.set(false);
    this.setMascotMessageFor(results);
  }

  /**
   * A diferencia de un leaderboard individual, aquí hay 3 tablas a la
   * vez: la mascota destaca la modalidad donde el usuario tiene su mejor
   * puesto (el número de puesto más bajo), o invita a jugar/iniciar
   * sesión si no aparece en ninguna.
   */
  private setMascotMessageFor(results: LeaderboardSection[]): void {
    const username = this.auth.currentUser()?.username;
    if (!username) {
      this.mascot.setMood('idle', 'Inicia sesión para guardar tu puntaje y aparecer en estos rankings.');
      return;
    }

    let bestRank: { title: string; rank: number } | null = null;
    for (const section of results) {
      const index = section.entries.findIndex((entry) => entry.Username === username);
      if (index !== -1 && (bestRank === null || index < bestRank.rank)) {
        bestRank = { title: section.title, rank: index };
      }
    }

    if (bestRank === null) {
      this.mascot.setMood('idle', 'Todavía no apareces en ningún ranking. ¡Juega una partida para entrar!');
      return;
    }

    if (bestRank.rank === 0) {
      this.mascot.setMood('idle', `¡Vas primero en ${bestRank.title}! 🏆`);
    } else {
      this.mascot.setMood('idle', `Tu mejor puesto es #${bestRank.rank + 1} en ${bestRank.title}.`);
    }
  }

  protected isOwnEntry(entry: LeaderboardEntryResponse): boolean {
    const username = this.auth.currentUser()?.username;
    return username !== undefined && username === entry.Username;
  }
}
