import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  email = '';
  password = '';
  confirmationCode = '';

  readonly step = signal<'signup' | 'confirm'>('signup');
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  async onSignUp(): Promise<void> {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      await this.authService.signUp(this.email, this.username, this.password);
      this.step.set('confirm');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async onConfirm(): Promise<void> {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      await this.authService.confirmSignUp(this.username, this.confirmationCode);
      await this.router.navigateByUrl('/login');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Código de confirmación inválido.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
