using FsCheck.Xunit;
using GameFunction.Domain;

namespace GameFunction.Tests;

/// <summary>
/// Property-based tests de las transiciones de sesión de CommitGuessr.
/// Análogo a SessionTransitionsPropertyTests (CodeGuessr), sobre
/// CommitSessionTransitions / CommitSessionState.
/// </summary>
public class CommitSessionTransitionsPropertyTests
{
    /// <summary>
    /// Para cualquier secuencia de 10 rondas respondidas con puntajes
    /// arbitrarios (acotados a [0, MaxRoundScore]), RoundsPlayed.Count nunca
    /// excede 10, Status pasa a Finished si y solo si RoundsPlayed.Count ==
    /// 10, y TotalScore siempre es igual a la suma de los scores de las
    /// rondas.
    /// </summary>
    [Property]
    public bool SecuenciaDe10Rondas_TerminaConsistente(int[] rawScores)
    {
        var scores = NormalizeTo10(rawScores);
        var session = CreateEmptySession();

        for (var i = 0; i < CommitSessionState.TotalRounds; i++)
        {
            var roundId = $"round-{i}";
            var newRound = new CommitRoundRecord(
                roundId,
                CommitId: $"commit-{i}",
                RoundIndex: i + 1,
                StartedAt: DateTimeOffset.UtcNow,
                AnsweredAt: null,
                Guesses: null,
                Correctness: null,
                Score: 0);

            CommitSessionTransitions.EnsureCanRequestNextRound(session);
            session = CommitSessionTransitions.AppendNewRound(session, newRound);

            if (session.RoundsPlayed.Count > CommitSessionState.TotalRounds)
            {
                return false;
            }

            var correctness = new CommitCorrectness(true, null, null, null);
            session = CommitSessionTransitions.ApplyAnswer(
                session, roundId, new CommitGuess("feature", null, null, null), correctness, scores[i], DateTimeOffset.UtcNow);
        }

        var finishedCorrectly = session.Status == SessionStatus.Finished
            && session.RoundsPlayed.Count == CommitSessionState.TotalRounds;

        var sumaConsistente = session.TotalScore == session.RoundsPlayed.Sum(r => r.Score);

        return finishedCorrectly && sumaConsistente;
    }

    /// <summary>
    /// Idempotencia: responder dos veces la misma ronda lanza
    /// RoundAlreadyAnsweredException sin modificar el estado ya persistido.
    /// </summary>
    [Property]
    public bool ResponderRondaYaRespondida_LanzaExcepcionSinModificarEstado(int score)
    {
        var boundedScore = Math.Abs(score % (CommitScoring.MaxRoundScore + 1));

        var session = CreateEmptySession();
        var round = new CommitRoundRecord(
            "round-0", "commit-0", 1, DateTimeOffset.UtcNow, null, null, null, 0);
        session = CommitSessionTransitions.AppendNewRound(session, round);

        var correctness = new CommitCorrectness(true, null, null, null);
        var afterFirstAnswer = CommitSessionTransitions.ApplyAnswer(
            session, "round-0", new CommitGuess("feature", null, null, null), correctness, boundedScore, DateTimeOffset.UtcNow);

        try
        {
            CommitSessionTransitions.ApplyAnswer(
                afterFirstAnswer, "round-0", new CommitGuess("bugfix", null, null, null), correctness, boundedScore, DateTimeOffset.UtcNow);
            return false; // Debió lanzar.
        }
        catch (RoundAlreadyAnsweredException)
        {
            return afterFirstAnswer.RoundsPlayed[0].Score == boundedScore;
        }
    }

    /// <summary>
    /// Nunca existe un CommitSessionState observable con
    /// RoundsPlayed.Count == 10 y Status == InProgress.
    /// </summary>
    [Property]
    public bool NoExisteEstadoIntermedioInconsistente(int[] rawScores)
    {
        var scores = NormalizeTo10(rawScores);
        var session = CreateEmptySession();

        for (var i = 0; i < CommitSessionState.TotalRounds; i++)
        {
            var roundId = $"round-{i}";
            var newRound = new CommitRoundRecord(
                roundId, $"commit-{i}", i + 1, DateTimeOffset.UtcNow, null, null, null, 0);

            session = CommitSessionTransitions.AppendNewRound(session, newRound);
            session = CommitSessionTransitions.ApplyAnswer(
                session, roundId, new CommitGuess("feature", null, null, null),
                new CommitCorrectness(true, null, null, null), scores[i], DateTimeOffset.UtcNow);

            var inconsistente = session.RoundsPlayed.Count == CommitSessionState.TotalRounds
                && session.Status == SessionStatus.InProgress;

            if (inconsistente)
            {
                return false;
            }
        }

        return true;
    }

    private static CommitSessionState CreateEmptySession() => new(
        SessionId: "session-test",
        UserId: "user-test",
        Status: SessionStatus.InProgress,
        RoundsPlayed: [],
        TotalScore: 0,
        CreatedAt: DateTimeOffset.UtcNow,
        FinishedAt: null,
        Version: 0);

    private static int[] NormalizeTo10(int[] rawScores)
    {
        if (rawScores.Length == 0)
        {
            return Enumerable.Repeat(0, CommitSessionState.TotalRounds).ToArray();
        }

        return Enumerable.Range(0, CommitSessionState.TotalRounds)
            .Select(i => Math.Abs(rawScores[i % rawScores.Length] % (CommitScoring.MaxRoundScore + 1)))
            .ToArray();
    }
}
