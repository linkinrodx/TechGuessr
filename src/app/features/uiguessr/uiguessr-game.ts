import { Component, computed, ElementRef, inject, OnInit, signal, Signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UIGameService } from '../../core/ui-game.service';
import { MascotService } from '../../core/mascot.service';
import { UIAnswerResultResponse } from '../../shared/types/game.types';
import { animateCount } from '../../shared/animate-count';

type UISuggestField = 'app' | 'action';

/**
 * Pantalla de ronda UIGuessr: muestra un screenshot de una interfaz de
 * usuario y el jugador debe adivinar: app, acción y año aproximado.
 *
 * Sigue el mismo patrón visual e interactivo que CodeguessrGame/
 * CommitguessrGame (tarjeta de contenido con transición de entrada,
 * autocompletado con dropdown propio, y conteo animado del puntaje de la
 * ronda). Consume UIGameService (backend real vía Lambda .NET + DynamoDB,
 * igual que CommitGameService), por lo que muestra su propio encabezado
 * de ronda/puntaje en vez de depender de AppHeader (que solo lee
 * GameService, el de CodeGuessr).
 */
@Component({
  selector: 'app-uiguessr-game',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './uiguessr-game.html',
  styleUrl: './uiguessr-game.scss',
})
export class UIguessrGame implements OnInit {
  protected readonly game = inject(UIGameService);
  private readonly router = inject(Router);
  private readonly mascot = inject(MascotService);

  @ViewChild('appInput') appInput?: ElementRef<HTMLInputElement>;
  @ViewChild('actionInput') actionInput?: ElementRef<HTMLInputElement>;
  @ViewChild('yearInput') yearInput?: ElementRef<HTMLInputElement>;
  @ViewChild('nextRoundButton') nextRoundButton?: ElementRef<HTMLButtonElement>;

  protected readonly appGuess = signal('');
  protected readonly actionGuess = signal('');
  protected readonly yearGuess = signal<number | undefined>(undefined);

  readonly lastResult = signal<UIAnswerResultResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Número de ronda a mostrar en el encabezado. Se fija al cargar cada
   * ronda y NO se recalcula desde game.roundIndex(): ese signal depende
   * de currentRound(), que UIGameService limpia a null justo después de
   * responder (para que loadNextRound() no piense que hay una ronda
   * pendiente) — si el header leyera roundIndex() directamente, mostraría
   * "ronda 0" mientras se ve la pantalla de resultado. Mantener el número
   * en un signal propio del componente evita ese salto.
   */
  protected readonly displayedRoundNumber = signal(1);

  /**
   * Conteo animado del puntaje de la ronda.
   */
  protected animatedRoundScore: Signal<number> = signal(0);

  /**
   * Alterna en cada loadNextRound() para disparar la transición de
   * entrada/salida de la imagen.
   */
  protected readonly imageEntering = signal(false);

  /**
   * Campo con el dropdown de autocompletado abierto actualmente (o null
   * si ninguno). Solo un campo puede mostrar sugerencias a la vez.
   */
  protected readonly openSuggestionsFor = signal<UISuggestField | null>(null);

  /**
   * Índice de la opción resaltada actualmente con teclado en el dropdown
   * activo. -1 significa "ninguna seleccionada".
   */
  protected readonly activeSuggestionIndex = signal(-1);

  /**
   * Timeout ID del blur para poder cancelarlo si el usuario hace focus
   * rápidamente en otro campo antes de que se ejecute.
   */
  private blurTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Opciones de autocompletado para apps y acciones comunes (UI
   * solamente, no ligadas a la ronda actual ni revelan la respuesta).
   */
  private readonly appOptions = [
    'Twitter', 'Facebook', 'YouTube', 'Gmail', 'Instagram', 'Spotify',
    'Reddit', 'Netflix', 'Amazon', 'GitHub', 'LinkedIn', 'Slack',
    'Airbnb', 'WhatsApp', 'Dropbox', 'Pinterest', 'TikTok', 'Twitch',
    'Discord', 'Zoom', 'Microsoft Teams', 'Google Drive', 'OneDrive',
    'Trello', 'Asana', 'Notion', 'Figma', 'Adobe XD', 'Canva',
  ];

  private readonly actionOptions = [
    'Timeline principal', 'Perfil de usuario', 'Reproduciendo video',
    'Bandeja de entrada', 'Feed de fotos', 'Reproduciendo música',
    'Navegando subreddit', 'Catálogo de películas', 'Página de producto',
    'Repositorio de código', 'Perfil profesional', 'Chat de equipo',
    'Búsqueda de alojamiento', 'Lista de chats', 'Explorador de archivos',
    'Tablero de pins', 'Configuración', 'Notificaciones', 'Mensajes directos',
    'Búsqueda', 'Subiendo contenido', 'Editando documento', 'Video llamada',
  ];

  /** Umbral mínimo de caracteres antes de mostrar sugerencias. */
  private static readonly MIN_CHARS_FOR_SUGGESTIONS = 2;

  protected readonly appSuggestions = computed(() =>
    this.filterOptions(this.appOptions, this.appGuess(), this.openSuggestionsFor() === 'app'),
  );
  protected readonly actionSuggestions = computed(() =>
    this.filterOptions(this.actionOptions, this.actionGuess(), this.openSuggestionsFor() === 'action'),
  );

  private filterOptions(options: string[], query: string, fieldIsOpen: boolean): string[] {
    if (!fieldIsOpen || query.trim().length < UIguessrGame.MIN_CHARS_FOR_SUGGESTIONS) {
      return [];
    }
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(normalized));
  }

  protected onSuggestionsFocus(field: UISuggestField): void {
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }
    this.openSuggestionsFor.set(field);
    this.activeSuggestionIndex.set(-1);
  }

  protected onSuggestionsBlur(): void {
    // Pequeño retraso para permitir que el click sobre una opción del
    // listado (mousedown) se procese antes de cerrar el dropdown por blur.
    this.blurTimeoutId = setTimeout(() => {
      this.openSuggestionsFor.set(null);
      this.activeSuggestionIndex.set(-1);
      this.blurTimeoutId = null;
    }, 150);
  }

  /**
   * Maneja ↑ ↓ Tab y Enter sobre un input de autocompletado, igual que en
   * CodeguessrGame.onSuggestionsKeydown.
   */
  protected onSuggestionsKeydown(event: KeyboardEvent, field: UISuggestField, suggestions: string[]): void {
    if (suggestions.length === 0) return;

    const current = this.activeSuggestionIndex();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex.set((current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex.set(current <= 0 ? suggestions.length - 1 : current - 1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const idx = current >= 0 ? current : 0;
      this.selectSuggestion(field, suggestions[idx]);
      this.focusNextField(field);
    } else if (event.key === 'Enter') {
      const idx = this.activeSuggestionIndex();
      if (idx >= 0 && idx < suggestions.length) {
        event.preventDefault();
        this.selectSuggestion(field, suggestions[idx]);
        this.focusNextField(field);
      }
    }
  }

  /**
   * Mueve el foco al siguiente campo tras seleccionar una sugerencia:
   * app → acción → año.
   */
  private focusNextField(currentField: UISuggestField): void {
    setTimeout(() => {
      if (currentField === 'app') {
        this.actionInput?.nativeElement.focus();
      } else {
        this.yearInput?.nativeElement.focus();
      }
    }, 50);
  }

  protected selectSuggestion(field: UISuggestField, value: string): void {
    if (field === 'app') {
      this.appGuess.set(value);
    } else {
      this.actionGuess.set(value);
    }
    this.openSuggestionsFor.set(null);
    this.activeSuggestionIndex.set(-1);
  }

  async ngOnInit(): Promise<void> {
    // El login ya no es obligatorio para jugar (ver comentario análogo en
    // CodeguessrGame.ngOnInit).
    await this.startNewGame();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async startNewGame(): Promise<void> {
    this.game.reset();
    this.mascot.reset();
    this.lastResult.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      await this.game.startSession();
      await this.game.loadNextRound();
      this.displayedRoundNumber.set(this.game.currentRound()?.RoundIndex ?? 1);
      this.triggerImageEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo iniciar la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reinicia el signal para disparar la animación de entrada de la imagen.
   */
  private triggerImageEntering(): void {
    this.imageEntering.set(false);
    requestAnimationFrame(() => {
      this.imageEntering.set(true);
      setTimeout(() => this.appInput?.nativeElement.focus(), 350);
    });
  }

  async submitAnswer(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      const result = await this.game.submitAnswer({
        app: this.appGuess() || undefined,
        action: this.actionGuess() || undefined,
        year: this.yearGuess(),
      });
      this.lastResult.set(result);
      const duration = this.prefersReducedMotion() ? 0 : 600;
      this.animatedRoundScore = animateCount(result.RoundScore, duration);
      this.reactMascotTo(result);

      setTimeout(() => this.nextRoundButton?.nativeElement.focus(), 100);
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo enviar la respuesta.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Ver comentario análogo en CodeguessrGame.reactMascotTo. */
  private reactMascotTo(result: UIAnswerResultResponse): void {
    if (this.game.sessionStatus() === 'finished') {
      this.mascot.setMood('celebrating', '¡Partida terminada! 🎉');
      return;
    }
    if (result.Correctness.App) {
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
    this.appGuess.set('');
    this.actionGuess.set('');
    this.yearGuess.set(undefined);
    this.errorMessage.set(null);
    this.mascot.setMood('thinking');

    if (this.game.sessionStatus() === 'finished') {
      await this.router.navigateByUrl('/ui-summary');
      return;
    }

    this.isLoading.set(true);
    try {
      await this.game.loadNextRound();
      this.displayedRoundNumber.set(this.game.currentRound()?.RoundIndex ?? this.displayedRoundNumber() + 1);
      this.triggerImageEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo cargar la siguiente ronda.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Formatea la diferencia de años para mostrar en el resultado.
   */
  protected formatYearDiff(diff: number): string {
    if (diff === 0) return 'Exacto';
    if (diff === 1) return '±1 año';
    return `±${diff} años`;
  }
}
