import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Adjunta el JWT vigente en las llamadas a la API de juego. Se omite en
 * GET /leaderboard (pública, ver design.md Requirement 7.4). Ante un 401,
 * limpia la sesión local y redirige a login (Requirement 1.6).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (req.url.endsWith('/leaderboard')) {
    return next(req);
  }

  return from(authService.getIdToken()).pipe(
    switchMap((token) => {
      const authorizedReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

      return next(authorizedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            authService.logout();
            router.navigateByUrl('/login');
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};
