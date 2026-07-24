import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../core/game.service';
import { AuthService } from '../../core/auth.service';
import { AnswerResultResponse } from '../../shared/types/game.types';

/**
 * Pantalla de ronda: muestra el snippet y un formulario con los 3 tramos de
 * adivinanza (lenguaje, framework, proyecto). El jugador llena los campos
 * que sabe y envía una sola vez; el servidor aplica la cascada de
 * evaluación (si falla lenguaje, framework/project no se evalúan) — ver
 * design.md, "Lógica de Puntaje" y GameFunction/Domain/Scoring.cs.
 */
@Component({
  selector: 'app-codeguessr-game',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './codeguessr-game.html',
  styleUrl: './codeguessr-game.scss',
})
export class CodeguessrGame implements OnInit {
  protected readonly game = inject(GameService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  languageGuess = '';
  frameworkGuess = '';
  projectGuess = '';

  readonly lastResult = signal<AnswerResultResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!this.auth.currentUser()) {
      await this.router.navigateByUrl('/login');
      return;
    }
    await this.startNewGame();
  }

  async startNewGame(): Promise<void> {
    this.game.reset();
    this.lastResult.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      await this.game.startSession();
      await this.game.loadNextRound();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo iniciar la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitAnswer(): Promise<void> {
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      const result = await this.game.submitAnswer({
        language: this.languageGuess || undefined,
        framework: this.frameworkGuess || undefined,
        project: this.projectGuess || undefined,
      });
      this.lastResult.set(result);
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo enviar la respuesta.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async nextRoundOrFinish(): Promise<void> {
    this.lastResult.set(null);
    this.languageGuess = '';
    this.frameworkGuess = '';
    this.projectGuess = '';
    this.errorMessage.set(null);

    if (this.game.sessionStatus() === 'finished') {
      await this.router.navigateByUrl('/summary');
      return;
    }

    this.isLoading.set(true);
    try {
      await this.game.loadNextRound();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo cargar la siguiente ronda.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
