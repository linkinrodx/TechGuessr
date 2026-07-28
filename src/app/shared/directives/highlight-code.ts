import { Directive, ElementRef, inject, input, effect } from '@angular/core';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import diff from 'highlight.js/lib/languages/diff';

/**
 * Registro de lenguajes: se hace una sola vez a nivel de módulo (no por
 * instancia de directiva) para no repetirlo en cada ronda. Subset elegido
 * para no inflar el presupuesto de 500kB de angular.json (Requirement 3,
 * design.md sección 3).
 */
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('diff', diff);

/**
 * Resalta el contenido de un elemento con highlight.js usando detección
 * automática de lenguaje (Requirement 3.2: no recibe el lenguaje real de
 * la ronda como parámetro explícito).
 *
 * Se implementa como directiva (no como pipe) para tener acceso directo
 * al ElementRef y reaccionar a cambios del input vía `effect()`, sin
 * depender de que Angular reevalúe una expresión de plantilla en cada
 * ciclo de detección de cambios (ver design.md, sección 3).
 *
 * Seguridad (Requirement 3.4): `hljs.highlightAuto(code).value` escapa
 * internamente `<`, `>` y `&` del texto de entrada antes de envolver
 * fragmentos en spans de clase fija (`hljs-*`, sin atributos de evento ni
 * URLs). Por eso es seguro asignar ese HTML directamente a
 * `nativeElement.innerHTML`: no se recibe HTML arbitrario del usuario, sino
 * el resultado ya escapado/tokenizado de highlight.js.
 *
 * No se usa `DomSanitizer.bypassSecurityTrustHtml` aquí porque ese API solo
 * tiene efecto dentro de un binding de plantilla gestionado por Angular
 * (p. ej. `[innerHTML]="valor"`); al asignar directo a la propiedad DOM
 * nativa vía ElementRef, el objeto `SafeHtml` se convierte a su
 * representación de depuración («SafeValue must use [property]=binding:
 * ...») en vez del HTML real, mostrando ese texto en pantalla en lugar del
 * código resaltado.
 */
@Directive({
  selector: '[appHighlightCode]',
  standalone: true,
})
export class HighlightCode {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly appHighlightCode = input<string>('');
  readonly language = input<string | undefined>(undefined);

  constructor() {
    const el = this.elementRef.nativeElement;
    // El tema de highlight.js (atom-one-dark.css) define color/fondo base
    // en el selector `.hljs`, no en los spans de token individuales. Sin
    // esta clase, el texto que no cae dentro de un span (espacios,
    // delimitadores, etc.) hereda el color de texto por defecto del
    // navegador, quedando casi invisible sobre el fondo oscuro de
    // .snippet-card. Se agrega una sola vez, fuera del effect.
    el.classList.add('hljs');

    effect(() => {
      const code = this.appHighlightCode();
      const lang = this.language();
      try {
        let result;
        if (lang && hljs.getLanguage(lang)) {
          // Si se especifica un lenguaje y está registrado, usarlo
          result = hljs.highlight(code, { language: lang });
        } else {
          // Si no, usar detección automática
          result = hljs.highlightAuto(code);
        }
        el.innerHTML = result.value;
      } catch {
        // Requirement 3.3: fallback a texto plano sin resaltado, sin
        // producir un error visible para el jugador. textContent preserva
        // el contenido íntegro del snippet sin normalizar espacios/tabs.
        el.textContent = code;
      }
    });
  }
}
