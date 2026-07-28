import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UIAnswerResultResponse,
  UIGuessRequest,
  UIRoundResponse,
  UISessionSummaryResponse,
  LeaderboardEntryResponse,
  SessionCreatedResponse,
  SessionStatus,
} from '../shared/types/game.types';

export interface UIGameError {
  status: number;
  message: string;
}

/**
 * Servicio para el modo UIGuessr. Consume la API de juego específica para
 * screenshots de UI: POST /ui-sessions, GET /ui-rounds/next,
 * POST /ui-rounds/{id}/answer, GET /ui-sessions/{id}/summary,
 * GET /ui-leaderboard.
 *
 * Análogo a CommitGameService pero para la modalidad UIGuessr. Antes corría
 * 100% local (sin backend, sin leaderboard); se migró al mismo patrón de
 * CommitGameService/GameService para tener leaderboard real respaldado por
 * DynamoDB (shard "uiguessr" en techguessr-scores).
 */
@Injectable({ providedIn: 'root' })
export class UIGameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly sessionIdSignal = signal<string | null>(null);
  private readonly currentRoundSignal = signal<UIRoundResponse | null>(null);
  private readonly roundStartedAtSignal = signal<number | null>(null);
  private readonly totalScoreSignal = signal(0);
  private readonly sessionStatusSignal = signal<SessionStatus>('idle');
  private readonly lastErrorSignal = signal<UIGameError | null>(null);

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
        this.http.post<SessionCreatedResponse>(`${this.baseUrl}/ui-sessions`, {}),
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
        this.http.get<UIRoundResponse>(`${this.baseUrl}/ui-rounds/next`, {
          params: { sessionId },
        }),
      );

      this.currentRoundSignal.set(round);
      this.roundStartedAtSignal.set(Date.now());
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async submitAnswer(guess: UIGuessRequest): Promise<UIAnswerResultResponse> {
    const sessionId = this.sessionIdSignal();
    const round = this.currentRoundSignal();
    if (!sessionId || !round) {
      throw new Error('No hay una ronda activa para responder.');
    }

    const startedAt = this.roundStartedAtSignal() ?? Date.now();
    this.lastErrorSignal.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<UIAnswerResultResponse>(`${this.baseUrl}/ui-rounds/${round.RoundId}/answer`, {
          sessionId,
          guess,
          clientElapsedMs: Date.now() - startedAt,
        }),
      );

      this.totalScoreSignal.set(result.TotalScoreSoFar);
      if (result.SessionFinished) {
        this.sessionStatusSignal.set('finished');
      }

      // Limpiar la ronda actual después de responder exitosamente para
      // evitar que loadNextRound() piense que hay una ronda pendiente.
      this.currentRoundSignal.set(null);
      this.roundStartedAtSignal.set(null);

      return result;
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async getSummary(): Promise<UISessionSummaryResponse> {
    const sessionId = this.sessionIdSignal();
    if (!sessionId) {
      throw new Error('No hay una sesión para resumir.');
    }

    this.lastErrorSignal.set(null);
    try {
      return await firstValueFrom(
        this.http.get<UISessionSummaryResponse>(`${this.baseUrl}/ui-sessions/${sessionId}/summary`),
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
        this.http.get<LeaderboardEntryResponse[]>(`${this.baseUrl}/ui-leaderboard`, {
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
  }

  private setErrorFrom(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const message = (err.error as { Message?: string } | null)?.Message ?? err.message;
      this.lastErrorSignal.set({ status: err.status, message });
    } else {
      this.lastErrorSignal.set({ status: 0, message: 'Error desconocido.' });
    }
  }
}
