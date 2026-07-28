import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CommitAnswerResultResponse,
  CommitGuessRequest,
  CommitRoundResponse,
  CommitSessionSummaryResponse,
  LeaderboardEntryResponse,
  SessionCreatedResponse,
  SessionStatus,
} from '../shared/types/game.types';

export interface GameError {
  status: number;
  message: string;
}

/**
 * Servicio para el modo CommitGuessr. Consume la API de juego específica
 * para diffs de commits: POST /commit-sessions, GET /commit-rounds/next,
 * POST /commit-rounds/{id}/answer, GET /commit-sessions/{id}/summary.
 * 
 * Análogo a GameService pero para la modalidad CommitGuessr.
 */
@Injectable({ providedIn: 'root' })
export class CommitGameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly sessionIdSignal = signal<string | null>(null);
  private readonly currentRoundSignal = signal<CommitRoundResponse | null>(null);
  private readonly roundStartedAtSignal = signal<number | null>(null);
  private readonly totalScoreSignal = signal(0);
  private readonly sessionStatusSignal = signal<SessionStatus>('idle');
  private readonly lastErrorSignal = signal<GameError | null>(null);

  /**
   * ID del diff de la ronda anterior, usado para deduplicación
   * client-side entre rondas consecutivas (Opción B, análogo a GameService).
   */
  private lastDiffId: string | null = null;

  readonly currentRound = this.currentRoundSignal.asReadonly();
  readonly totalScore = this.totalScoreSignal.asReadonly();
  readonly sessionStatus = this.sessionStatusSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();
  readonly roundIndex = computed(() => this.currentRoundSignal()?.RoundIndex ?? 0);
  readonly sessionId = this.sessionIdSignal.asReadonly();

  async startSession(): Promise<void> {
    this.lastErrorSignal.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<SessionCreatedResponse>(`${this.baseUrl}/commit-sessions`, {}),
      );
      this.sessionIdSignal.set(response.SessionId);
      this.totalScoreSignal.set(0);
      this.sessionStatusSignal.set('playing');
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async loadNextRound(): Promise<void> {
    const sessionId = this.sessionIdSignal();
    if (!sessionId) {
      throw new Error('No hay una sesión activa.');
    }

    this.lastErrorSignal.set(null);
    try {
      const round = await firstValueFrom(
        this.http.get<CommitRoundResponse>(`${this.baseUrl}/commit-rounds/next`, {
          params: { sessionId },
        }),
      );

      // Opción B de deduplicación: si el servidor devuelve el mismo diff
      // que la ronda anterior, se solicita una segunda vez. Se limita a 1
      // reintento para no bloquear si el dataset es muy pequeño.
      if (this.lastDiffId !== null && round.Diff === this.lastDiffId) {
        const retry = await firstValueFrom(
          this.http.get<CommitRoundResponse>(`${this.baseUrl}/commit-rounds/next`, {
            params: { sessionId },
          }),
        );
        this.currentRoundSignal.set(retry);
        this.lastDiffId = retry.Diff;
      } else {
        this.currentRoundSignal.set(round);
        this.lastDiffId = round.Diff;
      }

      this.roundStartedAtSignal.set(Date.now());
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async submitAnswer(guess: CommitGuessRequest): Promise<CommitAnswerResultResponse> {
    const sessionId = this.sessionIdSignal();
    const round = this.currentRoundSignal();
    if (!sessionId || !round) {
      throw new Error('No hay una ronda activa para responder.');
    }

    const startedAt = this.roundStartedAtSignal() ?? Date.now();
    this.lastErrorSignal.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<CommitAnswerResultResponse>(`${this.baseUrl}/commit-rounds/${round.RoundId}/answer`, {
          sessionId,
          guess,
          clientElapsedMs: Date.now() - startedAt,
        }),
      );

      this.totalScoreSignal.set(result.TotalScoreSoFar);
      if (result.SessionFinished) {
        this.sessionStatusSignal.set('finished');
      }

      // Limpiar la ronda actual después de responder exitosamente
      this.currentRoundSignal.set(null);
      this.roundStartedAtSignal.set(null);

      return result;
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async getSummary(): Promise<CommitSessionSummaryResponse> {
    const sessionId = this.sessionIdSignal();
    if (!sessionId) {
      throw new Error('No hay una sesión para resumir.');
    }

    this.lastErrorSignal.set(null);
    try {
      return await firstValueFrom(
        this.http.get<CommitSessionSummaryResponse>(`${this.baseUrl}/commit-sessions/${sessionId}/summary`),
      );
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async getLeaderboard(limit = 20): Promise<LeaderboardEntryResponse[]> {
    this.lastErrorSignal.set(null);
    try {
      return await firstValueFrom(
        this.http.get<LeaderboardEntryResponse[]>(`${this.baseUrl}/commit-leaderboard`, {
          params: { limit },
        }),
      );
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  reset(): void {
    this.sessionIdSignal.set(null);
    this.currentRoundSignal.set(null);
    this.roundStartedAtSignal.set(null);
    this.totalScoreSignal.set(0);
    this.sessionStatusSignal.set('idle');
    this.lastErrorSignal.set(null);
    this.lastDiffId = null;
  }

  /**
   * Traduce errores HTTP a un estado observable por la UI.
   */
  private setErrorFrom(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const message = (err.error as { Message?: string } | null)?.Message ?? err.message;
      this.lastErrorSignal.set({ status: err.status, message });
    } else {
      this.lastErrorSignal.set({ status: 0, message: 'Error desconocido.' });
    }
  }
}
