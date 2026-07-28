import { Injectable, signal } from '@angular/core';

export type MascotMood = 'idle' | 'thinking' | 'happy' | 'sad' | 'celebrating';

/** Tiempo tras el cual un mensaje con auto-dismiss empieza a desaparecer. */
const AUTO_DISMISS_MS = 8000;
/** Duración de la transición de fade-out, debe calzar con mascot.scss (bubble-out). */
const FADE_OUT_MS = 250;

/**
 * Estado de la mascota de la web (guía/reacciones). Servicio simple con
 * signals, sin lógica de negocio: cualquier feature puede llamar
 * setMood() para reflejar resultados sin acoplarse a GameService.
 *
 * La mascota es un SVG propio dibujado en el componente Mascot — no usa
 * ningún asset de imagen de terceros (ver decisión en docs/arquitectura.md
 * sobre los assets de assets/pet, removidos por copyright no verificable).
 */
@Injectable({ providedIn: 'root' })
export class MascotService {
  private readonly moodSignal = signal<MascotMood>('idle');
  private readonly messageSignal = signal<string | null>(null);

  /** true mientras el mensaje está en su transición de salida (fade-out). */
  private readonly dismissingSignal = signal(false);

  readonly mood = this.moodSignal.asReadonly();
  readonly message = this.messageSignal.asReadonly();
  readonly isDismissing = this.dismissingSignal.asReadonly();

  /**
   * Cuando es true, la landing (Home.ngOnInit) NO debe pisar el mood/
   * mensaje actual con su saludo aleatorio. Se usa para que un mensaje de
   * despedida (logout) sobreviva la navegación a '/', que de otro modo
   * lo sobreescribiría de inmediato al montar Home. Se consume una sola
   * vez con consumeHold().
   */
  private readonly holdNextAutoMessageSignal = signal(false);

  /** ID del timeout de auto-dismiss pendiente, si hay uno. */
  private dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param autoDismiss si es true (default), el mensaje desaparece solo
   * tras AUTO_DISMISS_MS. El jugador también puede cerrarlo antes con el
   * botón "×" del globo (ver Mascot.dismissMessage). El mood del
   * personaje (la cara/animación) no se resetea al desaparecer el
   * mensaje: solo se limpia el texto del globo.
   */
  setMood(mood: MascotMood, message: string | null = null, autoDismiss = true): void {
    this.clearDismissTimer();
    this.dismissingSignal.set(false);
    this.moodSignal.set(mood);
    this.messageSignal.set(message);

    if (message && autoDismiss) {
      this.dismissTimeoutId = setTimeout(() => this.dismissMessage(), AUTO_DISMISS_MS);
    }
  }

  /**
   * Cierra solo el globo de mensaje (con un breve fade-out), sin tocar
   * el mood/cara actual. Se puede llamar tanto por el timer de
   * auto-dismiss como por el botón "×" del globo.
   */
  dismissMessage(): void {
    this.clearDismissTimer();
    if (!this.messageSignal()) {
      return;
    }
    this.dismissingSignal.set(true);
    setTimeout(() => {
      this.messageSignal.set(null);
      this.dismissingSignal.set(false);
    }, FADE_OUT_MS);
  }

  private clearDismissTimer(): void {
    if (this.dismissTimeoutId !== null) {
      clearTimeout(this.dismissTimeoutId);
      this.dismissTimeoutId = null;
    }
  }

  reset(): void {
    this.clearDismissTimer();
    this.moodSignal.set('idle');
    this.messageSignal.set(null);
    this.dismissingSignal.set(false);
  }

  holdNextAutoMessage(): void {
    this.holdNextAutoMessageSignal.set(true);
  }

  /** Devuelve true si había un hold pendiente, y lo limpia (uso único). */
  consumeHold(): boolean {
    const held = this.holdNextAutoMessageSignal();
    this.holdNextAutoMessageSignal.set(false);
    return held;
  }
}
