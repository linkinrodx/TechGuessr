import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AnswerResultResponse,
  LeaderboardEntryResponse,
  RoundResponse,
  SessionCreatedResponse,
  SessionStatus,
  SessionSummaryResponse,
} from '../shared/types/game.types';

export interface GameError {
  status: number;
  message: string;
}

/**
 * Consume la API de juego (POST /sessions, GET /rounds/next,
 * POST /rounds/{id}/answer, GET /sessions/{id}/summary, GET /leaderboard).
 * Único punto de acceso a esos endpoints: los componentes no llaman
 * HttpClient directamente. Ver design.md, "Frontend: GameService".
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly sessionIdSignal = signal<string | null>(null);
  private readonly currentRoundSignal = signal<RoundResponse | null>(null);
  private readonly roundStartedAtSignal = signal<number | null>(null);
  private readonly totalScoreSignal = signal(0);
  private readonly sessionStatusSignal = signal<SessionStatus>('idle');
  private readonly lastErrorSignal = signal<GameError | null>(null);

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
        this.http.post<SessionCreatedResponse>(`${this.baseUrl}/sessions`, {}),
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
        this.http.get<RoundResponse>(`${this.baseUrl}/rounds/next`, {
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

  async submitAnswer(guess: { language?: string; framework?: string; project?: string }): Promise<AnswerResultResponse> {
    const sessionId = this.sessionIdSignal();
    const round = this.currentRoundSignal();
    if (!sessionId || !round) {
      throw new Error('No hay una ronda activa para responder.');
    }

    const startedAt = this.roundStartedAtSignal() ?? Date.now();
    this.lastErrorSignal.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<AnswerResultResponse>(`${this.baseUrl}/rounds/${round.RoundId}/answer`, {
          sessionId,
          guess,
          clientElapsedMs: Date.now() - startedAt,
        }),
      );

      this.totalScoreSignal.set(result.TotalScoreSoFar);
      if (result.SessionFinished) {
        this.sessionStatusSignal.set('finished');
      }

      return result;
    } catch (err) {
      this.setErrorFrom(err);
      throw err;
    }
  }

  async getSummary(): Promise<SessionSummaryResponse> {
    const sessionId = this.sessionIdSignal();
    if (!sessionId) {
      throw new Error('No hay una sesión para resumir.');
    }

    this.lastErrorSignal.set(null);
    try {
      return await firstValueFrom(
        this.http.get<SessionSummaryResponse>(`${this.baseUrl}/sessions/${sessionId}/summary`),
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
        this.http.get<LeaderboardEntryResponse[]>(`${this.baseUrl}/leaderboard`, {
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

  /**
   * Traduce errores HTTP a un estado observable por la UI, sin inferir
   * puntaje/corrección en el cliente (Requirement 9.3): el mensaje solo
   * refleja lo que la API devolvió.
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
