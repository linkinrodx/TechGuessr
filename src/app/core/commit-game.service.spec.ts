import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CommitGameService } from './commit-game.service';
import { environment } from '../../environments/environment';

describe('CommitGameService', () => {
  let service: CommitGameService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CommitGameService],
    });
    service = TestBed.inject(CommitGameService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('startSession pasa a estado "playing" y guarda el sessionId', async () => {
    const promise = service.startSession();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/commit-sessions`);
    expect(req.request.method).toBe('POST');
    req.flush({ SessionId: 'commit-abc-123', TotalRounds: 10 });

    await promise;

    expect(service.sessionId()).toBe('commit-abc-123');
    expect(service.sessionStatus()).toBe('playing');
    expect(service.totalScore()).toBe(0);
  });

  it('loadNextRound guarda la ronda actual', async () => {
    await seedSession();

    const promise = service.loadNextRound();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/commit-rounds/next` && r.params.get('sessionId') === 'commit-abc-123',
    );
    req.flush({
      RoundId: 'round-1',
      RoundIndex: 1,
      Diff: '@@ -1,1 +1,1 @@\n-old\n+new',
      MessageOptions: ['fix: a', 'feat: b', 'refactor: c', 'docs: d'],
      Difficulty: 'easy',
    });

    await promise;

    expect(service.currentRound()?.RoundId).toBe('round-1');
    expect(service.roundIndex()).toBe(1);
  });

  it('submitAnswer actualiza totalScore y marca sessionStatus como finished en la ronda 10', async () => {
    await seedSession();
    await seedRound();

    const promise = service.submitAnswer({ commitType: 'bugfix' });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/commit-rounds/round-1/answer`);
    expect(req.request.method).toBe('POST');
    req.flush({
      Correctness: { CommitType: true, Message: null, EffortEstimate: null, FilesModified: null },
      CorrectAnswers: { CommitType: 'bugfix', Message: 'fix: a', EffortMinutes: 15, FilesModified: 1 },
      Explanation: 'Explicación de prueba.',
      RoundScore: 400,
      TotalScoreSoFar: 400,
      SessionFinished: true,
    });

    const result = await promise;

    expect(result.RoundScore).toBe(400);
    expect(service.totalScore()).toBe(400);
    expect(service.sessionStatus()).toBe('finished');
  });

  it('traduce un error HTTP a lastError sin lanzar puntaje inferido por el cliente', async () => {
    await seedSession();

    const promise = service.loadNextRound().catch(() => undefined);
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/commit-rounds/next`,
    );
    req.flush({ Message: 'Hay una ronda pendiente sin responder.' }, { status: 409, statusText: 'Conflict' });

    await promise;

    expect(service.lastError()?.status).toBe(409);
    expect(service.lastError()?.message).toBe('Hay una ronda pendiente sin responder.');
  });

  it('getLeaderboard devuelve la lista de entradas del shard commitguessr', async () => {
    const promise = service.getLeaderboard();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/commit-leaderboard`,
    );
    req.flush([{ Username: 'testplayer', TotalScore: 5000, AchievedAt: '2026-01-01T00:00:00Z' }]);

    const entries = await promise;

    expect(entries.length).toBe(1);
    expect(entries[0].Username).toBe('testplayer');
  });

  it('getSummary lanza si no hay sesión activa', async () => {
    let threw = false;
    try {
      await service.getSummary();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  async function seedSession(): Promise<void> {
    const promise = service.startSession();
    httpMock.expectOne(`${environment.apiBaseUrl}/commit-sessions`).flush({ SessionId: 'commit-abc-123', TotalRounds: 10 });
    await promise;
  }

  async function seedRound(): Promise<void> {
    const promise = service.loadNextRound();
    httpMock
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/commit-rounds/next`)
      .flush({
        RoundId: 'round-1',
        RoundIndex: 1,
        Diff: '@@ -1,1 +1,1 @@\n-old\n+new',
        MessageOptions: ['fix: a', 'feat: b', 'refactor: c', 'docs: d'],
        Difficulty: 'easy',
      });
    await promise;
  }
});
