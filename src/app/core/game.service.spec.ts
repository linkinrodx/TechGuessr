import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameService } from './game.service';
import { environment } from '../../environments/environment';

describe('GameService', () => {
  let service: GameService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), GameService],
    });
    service = TestBed.inject(GameService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('startSession pasa a estado "playing" y guarda el sessionId', async () => {
    const promise = service.startSession();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/sessions`);
    expect(req.request.method).toBe('POST');
    req.flush({ SessionId: 'abc-123', TotalRounds: 10 });

    await promise;

    expect(service.sessionId()).toBe('abc-123');
    expect(service.sessionStatus()).toBe('playing');
    expect(service.totalScore()).toBe(0);
  });

  it('loadNextRound guarda la ronda actual', async () => {
    await seedSession();

    const promise = service.loadNextRound();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/rounds/next` && r.params.get('sessionId') === 'abc-123',
    );
    req.flush({ RoundId: 'round-1', RoundIndex: 1, Code: 'const x = 1;', Difficulty: 'easy' });

    await promise;

    expect(service.currentRound()?.RoundId).toBe('round-1');
    expect(service.roundIndex()).toBe(1);
  });

  it('submitAnswer actualiza totalScore y marca sessionStatus como finished en la ronda 10', async () => {
    await seedSession();
    await seedRound();

    const promise = service.submitAnswer({ language: 'TypeScript' });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/rounds/round-1/answer`);
    expect(req.request.method).toBe('POST');
    req.flush({
      Correctness: { Language: true, Framework: null, Project: null },
      CorrectAnswers: { Language: 'TypeScript', Framework: null, Project: null },
      Explanation: 'Explicación de prueba.',
      RoundScore: 100,
      TotalScoreSoFar: 100,
      SessionFinished: true,
    });

    const result = await promise;

    expect(result.RoundScore).toBe(100);
    expect(service.totalScore()).toBe(100);
    expect(service.sessionStatus()).toBe('finished');
  });

  it('traduce un error HTTP a lastError sin lanzar puntaje inferido por el cliente', async () => {
    await seedSession();

    const promise = service.loadNextRound().catch(() => undefined);
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/rounds/next`,
    );
    req.flush({ Message: 'Hay una ronda pendiente sin responder.' }, { status: 409, statusText: 'Conflict' });

    await promise;

    expect(service.lastError()?.status).toBe(409);
    expect(service.lastError()?.message).toBe('Hay una ronda pendiente sin responder.');
  });

  it('getLeaderboard devuelve la lista de entradas', async () => {
    const promise = service.getLeaderboard();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/leaderboard`,
    );
    req.flush([{ Username: 'testplayer', TotalScore: 500, AchievedAt: '2026-01-01T00:00:00Z' }]);

    const entries = await promise;

    expect(entries.length).toBe(1);
    expect(entries[0].Username).toBe('testplayer');
  });

  async function seedSession(): Promise<void> {
    const promise = service.startSession();
    httpMock.expectOne(`${environment.apiBaseUrl}/sessions`).flush({ SessionId: 'abc-123', TotalRounds: 10 });
    await promise;
  }

  async function seedRound(): Promise<void> {
    const promise = service.loadNextRound();
    httpMock
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/rounds/next`)
      .flush({ RoundId: 'round-1', RoundIndex: 1, Code: 'const x = 1;', Difficulty: 'easy' });
    await promise;
  }
});
