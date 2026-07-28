import { Component, computed, ElementRef, inject, OnInit, signal, Signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommitGameService } from '../../core/commit-game.service';
import { MascotService } from '../../core/mascot.service';
import { CommitAnswerResultResponse, CommitType } from '../../shared/types/game.types';
import { HighlightCode } from '../../shared/directives/highlight-code';
import { animateCount } from '../../shared/animate-count';

/**
 * Pantalla de ronda CommitGuessr: muestra un diff anonimizado y el jugador
 * debe adivinar:
 * - Ronda 1: Tipo de cambio (feature, bugfix, refactor, docs, test, perf)
 * - Ronda 2: Mensaje de commit correcto entre 4 opciones
 * - Ronda 3: Estimación de esfuerzo (minutos)
 * - Bonus: Cantidad de archivos modificados
 */
@Component({
  selector: 'app-commitguessr-game',
  standalone: true,
  imports: [FormsModule, HighlightCode],
  templateUrl: './commitguessr-game.html',
  styleUrl: './commitguessr-game.scss',
})
export class CommitguessrGame implements OnInit {
  protected readonly commitGame = inject(CommitGameService);
  private readonly router = inject(Router);
  private readonly mascot = inject(MascotService);

  @ViewChild('nextRoundButton') nextRoundButton?: ElementRef<HTMLButtonElement>;

  // Respuestas del jugador
  protected readonly commitTypeGuess = signal<CommitType | null>(null);
  protected readonly messageGuess = signal<string | null>(null);
  protected readonly effortGuess = signal<number | null>(null);
  protected readonly filesGuess = signal<number | null>(null);

  // Tipos de commit disponibles
  protected readonly commitTypes: CommitType[] = ['feature', 'bugfix', 'refactor', 'docs', 'test', 'perf'];

  // Resultado de la ronda
  readonly lastResult = signal<CommitAnswerResultResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Número de ronda a mostrar en el header (1-based, igual que
   * CommitGameService.roundIndex()). Se captura explícitamente al cargar
   * cada ronda en vez de leerse directo de commitGame.roundIndex(): ese
   * valor depende de currentRound(), que submitAnswer() pone en null tras
   * responder, así que caería a 0 mientras se muestra la pantalla de
   * resultado. Este signal conserva el número correcto durante esa
   * pantalla.
   */
  protected readonly displayRoundIndex = signal(0);

  /**
   * Conteo animado del puntaje de la ronda.
   */
  protected animatedRoundScore: Signal<number> = signal(0);

  /**
   * Alterna para disparar la transición de entrada/salida del diff.
   */
  protected readonly diffEntering = signal(false);

  async ngOnInit(): Promise<void> {
    // El login ya no es obligatorio para jugar (ver comentario análogo en
    // CodeguessrGame.ngOnInit).
    await this.startNewGame();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async startNewGame(): Promise<void> {
    this.commitGame.reset();
    this.mascot.reset();
    this.lastResult.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      await this.commitGame.startSession();
      await this.commitGame.loadNextRound();
      this.displayRoundIndex.set(this.commitGame.roundIndex());
      this.triggerDiffEntering();
    } catch {
      this.errorMessage.set(this.commitGame.lastError()?.message ?? 'No se pudo iniciar la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private resetRoundAnswers(): void {
    this.commitTypeGuess.set(null);
    this.messageGuess.set(null);
    this.effortGuess.set(null);
    this.filesGuess.set(null);
  }

  private triggerDiffEntering(): void {
    this.diffEntering.set(false);
    requestAnimationFrame(() => {
      this.diffEntering.set(true);
    });
  }

  protected selectCommitType(type: CommitType): void {
    this.commitTypeGuess.set(type);
  }

  protected selectMessage(message: string): void {
    this.messageGuess.set(message);
  }

  protected canSubmit(): boolean {
    return this.commitTypeGuess() !== null && !this.isLoading();
  }

  async submitAnswer(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    
    this.errorMessage.set(null);
    this.isLoading.set(true);
    
    try {
      const result = await this.commitGame.submitAnswer({
        commitType: this.commitTypeGuess() ?? undefined,
        message: this.messageGuess() ?? undefined,
        effortMinutes: this.effortGuess() ?? undefined,
        filesModified: this.filesGuess() ?? undefined,
      });

      this.lastResult.set(result);
      const duration = this.prefersReducedMotion() ? 0 : 600;
      this.animatedRoundScore = animateCount(result.RoundScore, duration);
      this.reactMascotTo(result);
      
      setTimeout(() => this.nextRoundButton?.nativeElement.focus(), 100);
    } catch {
      this.errorMessage.set(this.commitGame.lastError()?.message ?? 'No se pudo enviar la respuesta.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Ver comentario análogo en CodeguessrGame.reactMascotTo. */
  private reactMascotTo(result: CommitAnswerResultResponse): void {
    if (this.commitGame.sessionStatus() === 'finished') {
      this.mascot.setMood('celebrating', '¡Partida terminada! 🎉');
      return;
    }
    if (result.Correctness.CommitType) {
      this.mascot.setMood('happy', '¡Bien hecho!');
    } else {
      this.mascot.setMood('sad', 'La próxima le achuntas');
    }
  }

  async nextRoundOrFinish(): Promise<void> {
    if (this.isLoading()) {
      return;
    }
    
    this.lastResult.set(null);
    this.resetRoundAnswers();
    this.errorMessage.set(null);
    this.mascot.setMood('thinking');

    if (this.commitGame.sessionStatus() === 'finished') {
      await this.router.navigateByUrl('/commit-summary');
      return;
    }

    this.isLoading.set(true);
    
    try {
      await this.commitGame.loadNextRound();
      this.displayRoundIndex.set(this.commitGame.roundIndex());
      this.triggerDiffEntering();
    } catch {
      this.errorMessage.set(this.commitGame.lastError()?.message ?? 'No se pudo cargar la siguiente ronda.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected getCommitTypeLabel(type: CommitType): string {
    const labels: Record<CommitType, string> = {
      feature: '🚀 Feature',
      bugfix: '🐛 Bug Fix',
      refactor: '🔧 Refactor',
      docs: '📚 Docs',
      test: '✅ Test',
      perf: '⚡ Performance',
    };
    return labels[type];
  }
}
