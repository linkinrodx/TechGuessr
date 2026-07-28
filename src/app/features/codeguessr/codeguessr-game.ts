import { Component, computed, ElementRef, inject, OnInit, signal, Signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../core/game.service';
import { MascotService } from '../../core/mascot.service';
import { AnswerResultResponse } from '../../shared/types/game.types';
import { HighlightCode } from '../../shared/directives/highlight-code';
import { animateCount } from '../../shared/animate-count';

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
  imports: [FormsModule, HighlightCode],
  templateUrl: './codeguessr-game.html',
  styleUrl: './codeguessr-game.scss',
})
export class CodeguessrGame implements OnInit {
  protected readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly mascot = inject(MascotService);

  @ViewChild('languageInput') languageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('frameworkInput') frameworkInput?: ElementRef<HTMLInputElement>;
  @ViewChild('projectInput') projectInput?: ElementRef<HTMLInputElement>;
  @ViewChild('nextRoundButton') nextRoundButton?: ElementRef<HTMLButtonElement>;

  protected readonly languageGuess = signal('');
  protected readonly frameworkGuess = signal('');
  protected readonly projectGuess = signal('');

  /**
   * Campo con el dropdown de autocompletado abierto actualmente (o null
   * si ninguno). Solo un campo puede mostrar sugerencias a la vez.
   */
  protected readonly openSuggestionsFor = signal<'language' | 'framework' | 'project' | null>(null);

  /**
   * Índice de la opción resaltada actualmente con teclado en el dropdown
   * activo. -1 significa "ninguna seleccionada". Se resetea al abrir un
   * nuevo campo o al cerrar el dropdown.
   */
  protected readonly activeSuggestionIndex = signal(-1);

  /**
   * Timeout ID del blur para poder cancelarlo si el usuario hace focus
   * rápidamente en otro campo antes de que se ejecute.
   */
  private blurTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Opciones de autocompletado (UI únicamente, propio de la app, sin
   * <datalist> nativo para poder controlar el umbral mínimo de caracteres
   * y el ancho del listado). No están ligadas al snippet de la ronda
   * actual ni revelan la respuesta correcta: son solo tecnologías
   * comunes para agilizar la escritura, igual para cualquier ronda.
   */
  private readonly languageOptions = [
    'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Rust',
    'Ruby', 'PHP', 'Kotlin', 'Swift', 'SQL', 'C', 'C++', 'HTML', 'CSS',
  ];
  private readonly frameworkOptions = [
    'Angular', 'React', 'Vue', 'Django', 'Flask', 'Spring', 'ASP.NET Core',
    'Ruby on Rails', 'Laravel', 'Express', 'SwiftUI', 'Next.js', 'Nest.js',
  ];
  private readonly projectOptions = [
    'Angular', 'React', 'Vue.js', 'Django', 'Spring Framework',
    'ASP.NET Core', 'Ruby on Rails', 'SwiftUI', 'Next.js',
  ];

  /** Umbral mínimo de caracteres antes de mostrar sugerencias. */
  private static readonly MIN_CHARS_FOR_SUGGESTIONS = 2;

  protected readonly languageSuggestions = computed(() =>
    this.filterOptions(this.languageOptions, this.languageGuess(), this.openSuggestionsFor() === 'language'),
  );
  protected readonly frameworkSuggestions = computed(() =>
    this.filterOptions(this.frameworkOptions, this.frameworkGuess(), this.openSuggestionsFor() === 'framework'),
  );
  protected readonly projectSuggestions = computed(() =>
    this.filterOptions(this.projectOptions, this.projectGuess(), this.openSuggestionsFor() === 'project'),
  );

  private filterOptions(options: string[], query: string, fieldIsOpen: boolean): string[] {
    if (!fieldIsOpen || query.trim().length < CodeguessrGame.MIN_CHARS_FOR_SUGGESTIONS) {
      return [];
    }
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(normalized));
  }

  protected onSuggestionsFocus(field: 'language' | 'framework' | 'project'): void {
    // Cancelar cualquier timeout de blur pendiente para evitar que cierre
    // el dropdown justo cuando estamos abriendo uno nuevo
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }
    this.openSuggestionsFor.set(field);
    this.activeSuggestionIndex.set(-1);
    
    // Scroll suave para que el input activo y su dropdown sean visibles
    this.scrollToActiveInput(field);
  }

  /**
   * Hace scroll automático para centrar visualmente el input activo y
   * darle espacio suficiente para mostrar el dropdown de sugerencias sin
   * que quede fuera de la pantalla.
   */
  private scrollToActiveInput(field: 'language' | 'framework' | 'project'): void {
    let inputElement: HTMLInputElement | undefined;
    
    if (field === 'language') {
      inputElement = this.languageInput?.nativeElement;
    } else if (field === 'framework') {
      inputElement = this.frameworkInput?.nativeElement;
    } else {
      inputElement = this.projectInput?.nativeElement;
    }

    if (inputElement) {
      // Pequeño delay para asegurar que el DOM está estable
      setTimeout(() => {
        inputElement!.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 50);
    }
  }

  protected onSuggestionsBlur(): void {
    // Pequeño retraso para permitir que el click sobre una opción del
    // listado (mousedown) se procese antes de cerrar el dropdown por blur.
    // Guardamos el ID para poder cancelarlo en onSuggestionsFocus si es necesario.
    this.blurTimeoutId = setTimeout(() => {
      this.openSuggestionsFor.set(null);
      this.activeSuggestionIndex.set(-1);
      this.blurTimeoutId = null;
    }, 150);
  }

  /**
   * Maneja las teclas ↑ ↓ Tab y Enter sobre un input de autocompletado:
   * - ArrowDown/Up mueven el índice activo dentro de las sugerencias visibles.
   * - Tab: si hay una opción activa la selecciona, si no, selecciona la primera
   *   opción disponible y mueve el foco al siguiente input.
   * - Enter: si hay una opción activa la selecciona y mueve el foco al siguiente
   *   input. Sin opción activa delega al submit del formulario.
   */
  protected onSuggestionsKeydown(
    event: KeyboardEvent,
    field: 'language' | 'framework' | 'project',
    suggestions: string[],
  ): void {
    if (suggestions.length === 0) return;

    const current = this.activeSuggestionIndex();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex.set((current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex.set(current <= 0 ? suggestions.length - 1 : current - 1);
    } else if (event.key === 'Tab') {
      // Tab siempre selecciona: si hay índice activo usa ese, si no, usa el primero
      event.preventDefault();
      const idx = current >= 0 ? current : 0;
      this.selectSuggestion(field, suggestions[idx]);
      this.focusNextInput(field);
    } else if (event.key === 'Enter') {
      const idx = this.activeSuggestionIndex();
      if (idx >= 0 && idx < suggestions.length) {
        // Hay una opción resaltada: seleccionarla, cerrar dropdown y mover
        // foco al siguiente input.
        event.preventDefault();
        this.selectSuggestion(field, suggestions[idx]);
        this.focusNextInput(field);
      }
      // Si idx === -1 y es Enter, dejar que el form capture Enter para submit
    }
  }

  /**
   * Mueve el foco al siguiente input después de seleccionar una opción.
   * Secuencia: language → framework → project.
   */
  private focusNextInput(currentField: 'language' | 'framework' | 'project'): void {
    // Pequeño delay para que Angular procese el cierre del dropdown primero
    setTimeout(() => {
      if (currentField === 'language') {
        this.frameworkInput?.nativeElement.focus();
      } else if (currentField === 'framework') {
        this.projectInput?.nativeElement.focus();
      }
      // Si es 'project', no hay siguiente input, el foco se queda ahí
    }, 50);
  }

  protected selectSuggestion(field: 'language' | 'framework' | 'project', value: string): void {
    if (field === 'language') {
      this.languageGuess.set(value);
    } else if (field === 'framework') {
      this.frameworkGuess.set(value);
    } else {
      this.projectGuess.set(value);
    }
    this.openSuggestionsFor.set(null);
    this.activeSuggestionIndex.set(-1);
  }

  readonly lastResult = signal<AnswerResultResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Requirement 6.2: conteo animado del puntaje de la ronda. Se
   * reasigna cada vez que llega un nuevo resultado.
   */
  protected animatedRoundScore: Signal<number> = signal(0);

  /**
   * Requirement 6.3: alterna en cada loadNextRound() para disparar la
   * transición de entrada/salida del snippet vía [class.entering].
   */
  protected readonly snippetEntering = signal(false);

  async ngOnInit(): Promise<void> {
    // El login ya no es obligatorio para jugar: si no hay usuario, la
    // sesión se crea igual como invitado (el backend no la guarda en el
    // leaderboard). El mensaje "inicia sesión para guardar tu progreso"
    // se muestra en session-summary al terminar la partida.
    await this.startNewGame();
  }

  /**
   * Requirement 6.6: detecta la preferencia de accesibilidad una sola vez
   * por invocación para decidir si las animaciones JS (no cubiertas por la
   * media query CSS global) deben mostrarse instantáneas.
   */
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
      this.triggerSnippetEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo iniciar la partida.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Requirement 6.3: reinicia brevemente el signal para que la clase
   * [class.entering] se vuelva a aplicar en cada ronda nueva (incluso si
   * ya estaba en true), disparando la animación de entrada del snippet.
   * Después de la animación, hace foco en el primer input.
   */
  private triggerSnippetEntering(): void {
    this.snippetEntering.set(false);
    requestAnimationFrame(() => {
      this.snippetEntering.set(true);
      // Focus en el primer input después de que la transición termine
      setTimeout(() => this.languageInput?.nativeElement.focus(), 350);
    });
  }

  async submitAnswer(): Promise<void> {
    // Guard: prevenir múltiples envíos simultáneos
    if (this.isLoading()) {
      return;
    }
    
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      const result = await this.game.submitAnswer({
        language: this.languageGuess() || undefined,
        framework: this.frameworkGuess() || undefined,
        project: this.projectGuess() || undefined,
      });
      this.lastResult.set(result);
      const duration = this.prefersReducedMotion() ? 0 : 600;
      this.animatedRoundScore = animateCount(result.RoundScore, duration);
      this.reactMascotTo(result);
      
      // Focus en el botón "Siguiente ronda" después de mostrar el resultado
      // para que el usuario pueda presionar Enter inmediatamente
      setTimeout(() => this.nextRoundButton?.nativeElement.focus(), 100);
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo enviar la respuesta.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Refleja el resultado de la ronda en la mascota: feliz si acertó el
   * lenguaje (el tramo obligatorio), triste si no. Si además la partida
   * terminó, prioriza el mood de celebración sobre el de la ronda.
   */
  private reactMascotTo(result: AnswerResultResponse): void {
    if (this.game.sessionStatus() === 'finished') {
      this.mascot.setMood('celebrating', '¡Partida terminada! 🎉');
      return;
    }
    if (result.Correctness.Language) {
      this.mascot.setMood('happy', '¡Bien hecho!');
    } else {
      this.mascot.setMood('sad', 'La próxima le achuntas');
    }
  }

  async nextRoundOrFinish(): Promise<void> {
    // Guard: prevenir múltiples llamadas simultáneas
    if (this.isLoading()) {
      return;
    }
    
    this.lastResult.set(null);
    this.languageGuess.set('');
    this.frameworkGuess.set('');
    this.projectGuess.set('');
    this.errorMessage.set(null);
    this.mascot.setMood('thinking');

    if (this.game.sessionStatus() === 'finished') {
      await this.router.navigateByUrl('/summary');
      return;
    }

    this.isLoading.set(true);
    try {
      await this.game.loadNextRound();
      this.triggerSnippetEntering();
    } catch {
      this.errorMessage.set(this.game.lastError()?.message ?? 'No se pudo cargar la siguiente ronda.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
