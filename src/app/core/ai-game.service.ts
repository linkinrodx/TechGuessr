import { Injectable, computed, signal } from '@angular/core';
import {
  AIAnswerResultResponse,
  AICorrectnessResponse,
  AIGameMode,
  AIGuessRequest,
  AIRoundResponse,
  AISessionSummaryResponse,
  SessionStatus,
} from '../shared/types/game.types';
import aiContent from '../data/ai-content.json';

export interface AIGameError {
  message: string;
}

interface HumanOrAIItem {
  id: string;
  content: string;
  isHuman: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  hints: string[];
  explanation: string;
}

interface HallucinationStatement {
  text: string;
  isHallucination: boolean;
  explanation: string;
}

interface HallucinationHunterItem {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  statements: HallucinationStatement[];
}

const humanOrAIItems = (aiContent as { humanOrAI: HumanOrAIItem[] }).humanOrAI;
const hallucinationItems = (aiContent as { hallucinationHunter: HallucinationHunterItem[] }).hallucinationHunter;

/**
 * Servicio que maneja la lógica de juego para AIGuessr (modo local, sin
 * backend), igual que UIGameService: administra sesión, rondas, puntaje
 * y validación de respuestas contra el dataset curado en
 * `src/app/data/ai-content.json`.
 *
 * No hay Lambda/API Gateway para AIGuessr todavía (ver
 * docs/aiguessr-implementation.md); por eso corre 100% en el cliente en
 * vez de seguir el patrón de GameService/CommitGameService.
 */
@Injectable({ providedIn: 'root' })
export class AIGameService {
  private readonly totalRoundsCount = 10;

  private readonly sessionIdSignal = signal<string | null>(null);
  private readonly modeSignal = signal<AIGameMode>('human-or-ai');
  private readonly currentRoundIndexSignal = signal(0);
  private readonly sessionHumanOrAIItems = signal<HumanOrAIItem[]>([]);
  private readonly sessionHallucinationItems = signal<HallucinationHunterItem[]>([]);
  private readonly roundAnswers = signal<Map<number, AIAnswerResultResponse>>(new Map());

  readonly currentRound = signal<AIRoundResponse | null>(null);
  readonly totalScore = signal(0);
  readonly sessionStatus = signal<SessionStatus>('idle');
  readonly lastError = signal<AIGameError | null>(null);

  readonly currentMode = this.modeSignal.asReadonly();
  readonly sessionId = this.sessionIdSignal.asReadonly();
  readonly totalRounds = this.totalRoundsCount;
  readonly currentRoundNumber = computed(() => this.currentRoundIndexSignal() + 1);
  readonly isLastRound = computed(() => this.currentRoundNumber() >= this.totalRoundsCount);

  /**
   * Inicia una nueva sesión para la modalidad elegida, con 10 rondas
   * tomadas del dataset (con repetición si el dataset tiene menos de 10
   * items, mezclando el orden para minimizar repeticiones consecutivas).
   */
  startSession(mode: AIGameMode): void {
    this.reset();
    this.modeSignal.set(mode);
    this.sessionIdSignal.set(`ai-session-${Date.now()}`);

    if (mode === 'human-or-ai') {
      this.sessionHumanOrAIItems.set(this.pickItems(humanOrAIItems, this.totalRoundsCount));
    } else {
      this.sessionHallucinationItems.set(this.pickItems(hallucinationItems, this.totalRoundsCount));
    }

    this.sessionStatus.set('playing');
    this.currentRoundIndexSignal.set(0);
  }

  private pickItems<T>(items: T[], count: number): T[] {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const result: T[] = [];
    while (result.length < count) {
      for (const item of shuffled) {
        if (result.length >= count) break;
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Carga la siguiente ronda de la sesión actual. Avanza el índice si la
   * ronda actual ya fue respondida (igual criterio que UIGameService).
   */
  loadNextRound(): void {
    if (this.sessionStatus() !== 'playing') {
      this.lastError.set({ message: 'No hay sesión activa.' });
      throw new Error('No hay sesión activa.');
    }

    if (this.roundAnswers().has(this.currentRoundIndexSignal())) {
      this.currentRoundIndexSignal.update((i) => i + 1);
    }

    const index = this.currentRoundIndexSignal();
    if (index >= this.totalRoundsCount) {
      this.sessionStatus.set('finished');
      this.lastError.set({ message: 'No hay más rondas.' });
      throw new Error('No hay más rondas.');
    }

    const mode = this.modeSignal();
    const sessionId = this.sessionIdSignal();

    if (mode === 'human-or-ai') {
      const item = this.sessionHumanOrAIItems()[index];
      this.currentRound.set({
        RoundId: `${sessionId}-round-${index}`,
        RoundIndex: index,
        Mode: 'human-or-ai',
        Content: item.content,
        Difficulty: item.difficulty,
      });
    } else {
      const item = this.sessionHallucinationItems()[index];
      this.currentRound.set({
        RoundId: `${sessionId}-round-${index}`,
        RoundIndex: index,
        Mode: 'hallucination-hunter',
        Content: item.statements.map((s) => s.text),
        Difficulty: item.difficulty,
      });
    }

    this.lastError.set(null);
  }

  /**
   * Calcula el puntaje de la ronda actual contra la respuesta correcta
   * del dataset y actualiza el puntaje total.
   *
   * Human or AI: 500 pts si adivina human/IA correctamente, 0 si no.
   * Hallucination Hunter: +400 por alucinación detectada, -200 por
   * falso positivo, -100 por alucinación no detectada; x2 si todo el
   * set fue clasificado perfectamente (ver docs/aiguessr-implementation.md).
   */
  submitAnswer(guess: AIGuessRequest): AIAnswerResultResponse {
    const round = this.currentRound();
    if (!round) {
      this.lastError.set({ message: 'No hay ronda activa.' });
      throw new Error('No hay ronda activa.');
    }

    const index = this.currentRoundIndexSignal();
    const result: AIAnswerResultResponse =
      round.Mode === 'human-or-ai'
        ? this.evaluateHumanOrAI(index, guess)
        : this.evaluateHallucinationHunter(index, guess);

    this.totalScore.set(result.TotalScoreSoFar);

    const answers = this.roundAnswers();
    answers.set(index, result);
    this.roundAnswers.set(new Map(answers));

    if (result.SessionFinished) {
      this.sessionStatus.set('finished');
    }

    return result;
  }

  private evaluateHumanOrAI(index: number, guess: AIGuessRequest): AIAnswerResultResponse {
    const item = this.sessionHumanOrAIItems()[index];
    const guessedCorrectly = guess.isHuman === item.isHuman;
    const roundScore = guessedCorrectly ? 500 : 0;

    const correctness: AICorrectnessResponse = {
      IsCorrect: guessedCorrectly,
      Details: { GuessedCorrectly: guessedCorrectly },
    };

    return {
      Correctness: correctness,
      CorrectAnswers: {
        Mode: 'human-or-ai',
        IsHuman: item.isHuman,
        Explanation: item.explanation,
      },
      Explanation: item.explanation,
      RoundScore: roundScore,
      TotalScoreSoFar: this.totalScore() + roundScore,
      SessionFinished: this.isLastRound(),
    };
  }

  private evaluateHallucinationHunter(index: number, guess: AIGuessRequest): AIAnswerResultResponse {
    const item = this.sessionHallucinationItems()[index];
    const marked = new Set(guess.hallucinationIndices ?? []);

    let correctlyIdentified = 0;
    let falsePositives = 0;
    let missed = 0;
    const hallucinationIndices: number[] = [];

    item.statements.forEach((statement, i) => {
      if (statement.isHallucination) {
        hallucinationIndices.push(i);
        if (marked.has(i)) {
          correctlyIdentified++;
        } else {
          missed++;
        }
      } else if (marked.has(i)) {
        falsePositives++;
      }
    });

    const rawScore = correctlyIdentified * 400 - falsePositives * 200 - missed * 100;
    const isPerfect = falsePositives === 0 && missed === 0;
    const roundScore = Math.max(0, rawScore) * (isPerfect ? 2 : 1);

    const explanation = item.statements
      .map((s, i) => `${i + 1}. ${s.isHallucination ? '❌ Alucinación' : '✅ Verdadero'} — ${s.explanation}`)
      .join(' ');

    const correctness: AICorrectnessResponse = {
      IsCorrect: isPerfect,
      Details: { CorrectlyIdentified: correctlyIdentified, FalsePositives: falsePositives, Missed: missed },
    };

    return {
      Correctness: correctness,
      CorrectAnswers: {
        Mode: 'hallucination-hunter',
        HallucinationIndices: hallucinationIndices,
        Explanation: explanation,
      },
      Explanation: explanation,
      RoundScore: roundScore,
      TotalScoreSoFar: this.totalScore() + roundScore,
      SessionFinished: this.isLastRound(),
    };
  }

  getSessionSummary(): AISessionSummaryResponse {
    const answers = this.roundAnswers();
    const rounds = Array.from(answers.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, result]) => ({
        RoundId: `${this.sessionIdSignal()}-round-${index}`,
        RoundIndex: index,
        Correctness: result.Correctness,
        Score: result.RoundScore,
      }));

    return {
      SessionId: this.sessionIdSignal() ?? '',
      TotalScore: this.totalScore(),
      Rounds: rounds,
      Rank: null, // Sin backend, no hay ranking real (ver docs/aiguessr-implementation.md)
    };
  }

  reset(): void {
    this.sessionIdSignal.set(null);
    this.currentRoundIndexSignal.set(0);
    this.sessionHumanOrAIItems.set([]);
    this.sessionHallucinationItems.set([]);
    this.roundAnswers.set(new Map());
    this.sessionStatus.set('idle');
    this.currentRound.set(null);
    this.lastError.set(null);
    this.totalScore.set(0);
  }
}
