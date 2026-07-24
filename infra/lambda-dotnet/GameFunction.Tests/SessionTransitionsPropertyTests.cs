using FsCheck.Xunit;
using GameFunction.Domain;

namespace GameFunction.Tests;

/// <summary>
/// Property-based tests de las transiciones de sesión (tarea 3.6 de tasks.md).
///
/// Cubre las Correctness Properties 4, 5 y 6 definidas en
/// .kiro/specs/codeguessr-mvp/design.md.
/// </summary>
public class SessionTransitionsPropertyTests
{
    /// <summary>
    /// Property 6 (límite de rondas) + Property 4 (consistencia de suma):
    /// para cualquier secuencia de 10 rondas respondidas con puntajes
    /// arbitrarios, roundsPlayed.Length nunca excede 10, status pasa a
    /// Finished si y solo si roundsPlayed.Length == 10, y totalScore siempre
    /// es igual a la suma de los scores de las rondas.
    /// </summary>
    [Property]
    public bool SecuenciaDe10Rondas_TerminaConsistente(int[] rawScores)
    {
        // Se acotan los puntajes a un rango válido y se fuerza que haya
        // exactamente 10 (recortando o repitiendo), para simular cualquier
        // combinación posible de resultados de una partida completa.
        var scores = NormalizeTo10(rawScores);

        var session = CreateEmptySession();

        for (var i = 0; i < SessionState.TotalRounds; i++)
        {
            var roundId = $"round-{i}";
            var newRound = new RoundRecord(
                roundId,
                SnippetId: $"snip-{i}",
                RoundIndex: i + 1,
                StartedAt: DateTimeOffset.UtcNow,
                AnsweredAt: null,
                Guesses: null,
                Correctness: null,
                Score: 0);

            SessionTransitions.EnsureCanRequestNextRound(session);
            session = SessionTransitions.AppendNewRound(session, newRound);

            if (session.RoundsPlayed.Count > SessionState.TotalRounds)
            {
                return false; // Property 6 violada: nunca debe exceder 10.
            }

            var correctness = new Correctness(true, null, null);
            session = SessionTransitions.ApplyAnswer(
                session, roundId, new Guess("x", null, null), correctness, scores[i], DateTimeOffset.UtcNow);
        }

        var finishedCorrectly = session.Status == SessionStatus.Finished
            && session.RoundsPlayed.Count == SessionState.TotalRounds;

        var sumaConsistente = session.TotalScore == session.RoundsPlayed.Sum(r => r.Score);

        return finishedCorrectly && sumaConsistente;
    }

    /// <summary>
    /// Property 5 (idempotencia): responder dos veces la misma ronda lanza
    /// RoundAlreadyAnsweredException sin modificar el estado ya persistido
    /// (el caller nunca llega a construir un nuevo SessionState).
    /// </summary>
    [Property]
    public bool ResponderRondaYaRespondida_LanzaExcepcionSinModificarEstado(int score)
    {
        var boundedScore = Math.Abs(score % (Scoring.MaxRoundScore + 1));

        var session = CreateEmptySession();
        var round = new RoundRecord(
            "round-0", "snip-0", 1, DateTimeOffset.UtcNow, null, null, null, 0);
        session = SessionTransitions.AppendNewRound(session, round);

        var correctness = new Correctness(true, null, null);
        var afterFirstAnswer = SessionTransitions.ApplyAnswer(
            session, "round-0", new Guess("x", null, null), correctness, boundedScore, DateTimeOffset.UtcNow);

        try
        {
            SessionTransitions.ApplyAnswer(
                afterFirstAnswer, "round-0", new Guess("y", null, null), correctness, boundedScore, DateTimeOffset.UtcNow);
            return false; // Debió lanzar.
        }
        catch (RoundAlreadyAnsweredException)
        {
            // El estado ya persistido (afterFirstAnswer) no fue tocado por el
            // intento fallido: se verifica que su score no cambió.
            return afterFirstAnswer.RoundsPlayed[0].Score == boundedScore;
        }
    }

    /// <summary>
    /// Property 6 (sin estado intermedio inconsistente): nunca existe un
    /// SessionState observable con RoundsPlayed.Count == 10 y
    /// Status == InProgress.
    /// </summary>
    [Property]
    public bool NoExisteEstadoIntermedioInconsistente(int[] rawScores)
    {
        var scores = NormalizeTo10(rawScores);
        var session = CreateEmptySession();

        for (var i = 0; i < SessionState.TotalRounds; i++)
        {
            var roundId = $"round-{i}";
            var newRound = new RoundRecord(
                roundId, $"snip-{i}", i + 1, DateTimeOffset.UtcNow, null, null, null, 0);

            session = SessionTransitions.AppendNewRound(session, newRound);
            session = SessionTransitions.ApplyAnswer(
                session, roundId, new Guess("x", null, null), new Correctness(true, null, null), scores[i], DateTimeOffset.UtcNow);

            // Invariante verificada después de CADA respuesta, no solo al final.
            var inconsistente = session.RoundsPlayed.Count == SessionState.TotalRounds
                && session.Status == SessionStatus.InProgress;

            if (inconsistente)
            {
                return false;
            }
        }

        return true;
    }

    private static SessionState CreateEmptySession() => new(
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
            return Enumerable.Repeat(0, SessionState.TotalRounds).ToArray();
        }

        return Enumerable.Range(0, SessionState.TotalRounds)
            .Select(i => Math.Abs(rawScores[i % rawScores.Length] % (Scoring.MaxRoundScore + 1)))
            .ToArray();
    }
}
