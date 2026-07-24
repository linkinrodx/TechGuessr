namespace GameFunction.Domain;

/// <summary>
/// Lógica pura de transición de estado de una sesión. Sin dependencias de
/// AWS/DynamoDB: recibe el estado actual y devuelve el estado siguiente (o
/// lanza una excepción de dominio si la transición no es válida).
///
/// Ver .kiro/specs/codeguessr-mvp/design.md, "Correctness Properties"
/// (Property 4, 5, 6) y Requirements 3, 4, 5.
/// </summary>
public static class SessionTransitions
{
    /// <summary>
    /// Valida que se puede pedir una ronda nueva: la sesión no debe estar
    /// finalizada, y no debe haber una ronda ya entregada sin responder.
    /// </summary>
    public static void EnsureCanRequestNextRound(SessionState session)
    {
        if (session.Status == SessionStatus.Finished)
        {
            throw new SessionAlreadyFinishedException();
        }

        var lastRound = session.RoundsPlayed.LastOrDefault();
        if (lastRound is not null && lastRound.AnsweredAt is null)
        {
            throw new PendingRoundExistsException();
        }
    }

    /// <summary>
    /// Agrega una nueva ronda (sin responder) al estado de la sesión.
    /// Precondición: EnsureCanRequestNextRound ya pasó.
    /// </summary>
    public static SessionState AppendNewRound(SessionState session, RoundRecord newRound) =>
        session with { RoundsPlayed = [..session.RoundsPlayed, newRound] };

    /// <summary>
    /// Aplica la respuesta de una ronda: calcula el nuevo estado de la sesión
    /// (ronda actualizada, totalScore acumulado, y si corresponde, cierre de
    /// sesión al completar la ronda 10). Es la función central de la
    /// Property 4 (consistencia de suma), Property 5 (idempotencia) y
    /// Property 6 (límite de rondas).
    /// </summary>
    public static SessionState ApplyAnswer(
        SessionState session,
        string roundId,
        Guess guess,
        Correctness correctness,
        int roundScore,
        DateTimeOffset answeredAt)
    {
        var roundIndex = session.RoundsPlayed.ToList().FindIndex(r => r.RoundId == roundId);
        if (roundIndex < 0)
        {
            throw new RoundNotFoundException();
        }

        var round = session.RoundsPlayed[roundIndex];
        if (round.AnsweredAt is not null)
        {
            // Idempotencia (Property 5): no se modifica nada, se señaliza al
            // caller para que responda 409 sin efectos secundarios.
            throw new RoundAlreadyAnsweredException();
        }

        var updatedRound = round with
        {
            AnsweredAt = answeredAt,
            Guesses = guess,
            Correctness = correctness,
            Score = roundScore,
        };

        var updatedRounds = session.RoundsPlayed.ToList();
        updatedRounds[roundIndex] = updatedRound;

        var newTotalScore = updatedRounds.Sum(r => r.Score);
        var isLastRound = updatedRounds.Count == SessionState.TotalRounds
            && updatedRounds.All(r => r.AnsweredAt is not null);

        return session with
        {
            RoundsPlayed = updatedRounds,
            TotalScore = newTotalScore,
            Status = isLastRound ? SessionStatus.Finished : session.Status,
            FinishedAt = isLastRound ? answeredAt : session.FinishedAt,
        };
    }
}
