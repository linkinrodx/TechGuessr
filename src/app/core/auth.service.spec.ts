import { TestBed } from '@angular/core/testing';
import { AuthService, COGNITO_USER_POOL } from './auth.service';

/**
 * Stub mínimo de CognitoUser: solo implementa lo que AuthService llama
 * en cada flujo (authenticateUser, confirmRegistration, getSession,
 * signOut, getUsername), sin depender del SDK real de Cognito. Los
 * callbacks se guardan como funciones configurables por cada test para
 * simular tanto el camino feliz como el de error.
 */
function createCognitoUserStub(username: string) {
  return {
    getUsername: () => username,
    authenticateUser: vi.fn(),
    confirmRegistration: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  };
}

/**
 * Stub de CognitoUserPool inyectado vía COGNITO_USER_POOL (ver
 * auth.service.ts). Evita crear un User Pool real de AWS solo para
 * ejercitar la lógica de AuthService: signUp, login, logout y
 * getIdToken son wrappers finos sobre callbacks del SDK, que es
 * exactamente lo que este stub controla.
 */
function createUserPoolStub() {
  let currentUser: ReturnType<typeof createCognitoUserStub> | null = null;

  return {
    getCurrentUser: vi.fn(() => currentUser),
    getClientId: () => 'fake-client-id',
    getUserPoolId: () => 'fake-user-pool-id',
    signUp: vi.fn(),
    // Helper de test (no es parte de la interfaz real de CognitoUserPool)
    // para simular que ya hay una sesión persistida al arrancar el
    // servicio (ver test "restaura el usuario actual...").
    __setCurrentUser: (user: ReturnType<typeof createCognitoUserStub> | null) => {
      currentUser = user;
    },
  };
}

describe('AuthService', () => {
  let userPoolStub: ReturnType<typeof createUserPoolStub>;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [{ provide: COGNITO_USER_POOL, useValue: userPoolStub }],
    });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    userPoolStub = createUserPoolStub();
  });

  it('currentUser es null si no hay sesión persistida al construirse', () => {
    const service = setup();
    expect(service.currentUser()).toBeNull();
  });

  it('restaura el usuario actual desde el userPool si ya había una sesión activa', () => {
    userPoolStub.__setCurrentUser(createCognitoUserStub('ya-logueado'));
    const service = setup();
    expect(service.currentUser()?.username).toBe('ya-logueado');
  });

  it('login exitoso actualiza currentUser con el username', async () => {
    const service = setup();

    // amazon-cognito-identity-js construye su propio CognitoUser interno
    // en login() (no pasa por getCurrentUser), así que se intercepta el
    // constructor real solo para este test puntual mediante spyOn.
    const cognitoModule = await import('amazon-cognito-identity-js');
    const authenticateUserSpy = vi
      .spyOn(cognitoModule.CognitoUser.prototype, 'authenticateUser')
      .mockImplementation((_details, callbacks) => {
        callbacks.onSuccess({} as never);
      });

    await service.login('player1', 'correct-password');

    expect(service.currentUser()?.username).toBe('player1');
    authenticateUserSpy.mockRestore();
  });

  it('login fallido rechaza con un mensaje genérico (no distingue causa)', async () => {
    const service = setup();

    const cognitoModule = await import('amazon-cognito-identity-js');
    const authenticateUserSpy = vi
      .spyOn(cognitoModule.CognitoUser.prototype, 'authenticateUser')
      .mockImplementation((_details, callbacks) => {
        callbacks.onFailure(new Error('cualquier causa interna'));
      });

    await expect(service.login('player1', 'wrong-password')).rejects.toThrow(
      'Email o contraseña incorrectos.',
    );
    expect(service.currentUser()).toBeNull();

    authenticateUserSpy.mockRestore();
  });

  it('logout limpia currentUser y llama signOut sobre el usuario del pool', () => {
    const cognitoUser = createCognitoUserStub('player1');
    userPoolStub.__setCurrentUser(cognitoUser);
    const service = setup();

    expect(service.currentUser()?.username).toBe('player1');

    service.logout();

    expect(cognitoUser.signOut).toHaveBeenCalledOnce();
    expect(service.currentUser()).toBeNull();
  });

  it('getIdToken devuelve null si no hay usuario en el pool', async () => {
    const service = setup();
    const token = await service.getIdToken();
    expect(token).toBeNull();
  });

  it('getIdToken devuelve el JWT de la sesión vigente', async () => {
    const cognitoUser = createCognitoUserStub('player1');
    const fakeSession = { getIdToken: () => ({ getJwtToken: () => 'fake.jwt.token' }) };
    cognitoUser.getSession.mockImplementation((callback: (err: null, session: unknown) => void) => {
      callback(null, fakeSession);
    });
    userPoolStub.__setCurrentUser(cognitoUser);
    const service = setup();

    const token = await service.getIdToken();

    expect(token).toBe('fake.jwt.token');
  });

  it('getIdToken devuelve null si getSession falla', async () => {
    const cognitoUser = createCognitoUserStub('player1');
    cognitoUser.getSession.mockImplementation((callback: (err: Error | null, session: unknown) => void) => {
      callback(new Error('sesión expirada'), null);
    });
    userPoolStub.__setCurrentUser(cognitoUser);
    const service = setup();

    const token = await service.getIdToken();

    expect(token).toBeNull();
  });
});
