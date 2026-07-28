import { Component, inject, OnInit, signal, Signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AIGameService } from '../../core/ai-game.service';
import { MascotService } from '../../core/mascot.service';
import { AIAnswerResultResponse, AIGameMode } from '../../shared/types/game.types';
import { animateCount } from '../../shared/animate-count';

/**
 * Pantalla de AIGuessr: selector de modalidad (Human or AI / Hallucination
 * Hunter) seguido de las rondas correspondientes. Corre en modo local
 * (AIGameService, sin backend), igual que UIguessrGame, por lo que
 * expone su propio encabezado de ronda/puntaje.
 */
@Component({
  selector: 'app-aiguessr-game',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './aiguessr-game.html',
  styleUrl: './aiguessr-game.scss',
})
export class AIGuessrGame implements OnInit {
  protected readonly game = inject(AIGameService);
  private readonly router = inject(Router);
  private readonly mascot = inject(MascotService);

  protected readonly selectedMode = signal<AIGameMode | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly lastResult = signal<AIAnswerResultResponse | null>(null);

  // Para Human or AI
  protected readonly humanOrAIGuess = signal<boolean | null>(null);

  // Para Hallucination Hunter
  protected readonly hallucinationToggles = signal<boolean[]>([]);

  protected animatedRoundScore: Signal<number> = signal(0);
  protected readonly contentEntering = signal(false);

  async ngOnInit(): Promise<void> {
    // El login ya no es obligatorio para jugar (ver comentario análogo en
    // CodeguessrGame.ngOnInit). AIGuessr no depende de auth para su
    // lógica interna (corre 100% en el cliente, sin backend).
  }

  selectMode(mode: AIGameMode): void {
    this.mascot.reset();
    this.selectedMode.set(mode);
    this.errorMessage.set(null);
    this.lastResult.set(null);

    try {
      this.game.startSession(mode);
      this.game.loadNextRound();
      this.initializeRoundUI();
      this.triggerContentEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo iniciar la partida.');
    }
  }

  private initializeRoundUI(): void {
    const round = this.game.currentRound();
    if (!round) return;

    if (round.Mode === 'human-or-ai') {
      this.humanOrAIGuess.set(null);
    } else {
      const statements = Array.isArray(round.Content) ? round.Content : [];
      this.hallucinationToggles.set(statements.map(() => false));
    }
  }

  private triggerContentEntering(): void {
    this.contentEntering.set(false);
    requestAnimationFrame(() => {
      this.contentEntering.set(true);
    });
  }

  submitAnswer(): void {
    const round = this.game.currentRound();
    if (!round) return;

    this.errorMessage.set(null);

    try {
      let result: AIAnswerResultResponse;

      if (round.Mode === 'human-or-ai') {
        const guess = this.humanOrAIGuess();
        if (guess === null) {
          this.errorMessage.set('Debes seleccionar una opción.');
          return;
        }
        result = this.game.submitAnswer({ mode: 'human-or-ai', isHuman: guess });
      } else {
        const hallucinationIndices = this.hallucinationToggles()
          .map((isChecked, index) => (isChecked ? index : -1))
          .filter((index) => index !== -1);

        result = this.game.submitAnswer({ mode: 'hallucination-hunter', hallucinationIndices });
      }

      this.lastResult.set(result);
      const duration = this.prefersReducedMotion() ? 0 : 600;
      this.animatedRoundScore = animateCount(result.RoundScore, duration);
      this.reactMascotTo(result);
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo enviar la respuesta.');
    }
  }

  /** Ver comentario análogo en CodeguessrGame.reactMascotTo. */
  private reactMascotTo(result: AIAnswerResultResponse): void {
    if (this.game.sessionStatus() === 'finished') {
      this.mascot.setMood('celebrating', '¡Partida terminada! 🎉');
      return;
    }
    if (result.Correctness.IsCorrect) {
      this.mascot.setMood('happy', '¡Bien hecho!');
    } else {
      this.mascot.setMood('sad', 'La próxima le achuntas');
    }
  }

  async nextRoundOrFinish(): Promise<void> {
    this.lastResult.set(null);
    this.errorMessage.set(null);
    this.mascot.setMood('thinking');

    if (this.game.sessionStatus() === 'finished') {
      await this.router.navigateByUrl('/ai-summary');
      return;
    }

    try {
      this.game.loadNextRound();
      this.initializeRoundUI();
      this.triggerContentEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo cargar la siguiente ronda.');
    }
  }

  toggleHallucination(index: number): void {
    const current = this.hallucinationToggles();
    const updated = [...current];
    updated[index] = !updated[index];
    this.hallucinationToggles.set(updated);
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
