import { Injectable, signal } from '@angular/core';
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '../../environments/environment';

export interface AuthenticatedUser {
  username: string;
}

/**
 * Envoltura sobre el SDK de Cognito (amazon-cognito-identity-js). Ver
 * .kiro/specs/codeguessr-mvp/design.md, "Backend/Frontend: AuthService".
 *
 * Usa el flujo SRP (a través del propio SDK), nunca USER_PASSWORD_AUTH: la
 * contraseña nunca se envía en texto plano al servidor (ver
 * infra/lib/auth-stack.ts).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userPool = new CognitoUserPool({
    UserPoolId: environment.cognito.userPoolId,
    ClientId: environment.cognito.userPoolClientId,
  });

  private readonly currentUserSignal = signal<AuthenticatedUser | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();

  constructor() {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      this.currentUserSignal.set({ username: cognitoUser.getUsername() });
    }
  }

  signUp(email: string, username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const attributes = [new CognitoUserAttribute({ Name: 'email', Value: email })];

      this.userPool.signUp(username, password, attributes, [], (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  confirmSignUp(username: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: username, Pool: this.userPool });
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  login(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({ Username: username, Password: password });
      const cognitoUser = new CognitoUser({ Username: username, Pool: this.userPool });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: () => {
          this.currentUserSignal.set({ username });
          resolve();
        },
        onFailure: (err) => {
          // Requirement 1.4: no se distingue "usuario no existe" de
          // "contraseña incorrecta"; se propaga un mensaje genérico.
          reject(new Error('Email o contraseña incorrectos.'));
        },
      });
    });
  }

  logout(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    cognitoUser?.signOut();
    this.currentUserSignal.set(null);
  }

  /**
   * Devuelve el JWT (ID token) vigente, renovándolo si es necesario. Se usa
   * en el interceptor HTTP para adjuntarlo en las llamadas a la API de juego.
   */
  getIdToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    });
  }
}
