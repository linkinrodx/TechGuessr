namespace GameFunction.Domain;

/// <summary>
/// Lógica pura de transición de estado de una sesión CommitGuessr.
/// Análoga a SessionTransitions pero para el modo CommitGuessr.
/// </summary>
public static class CommitSessionTransitions
{
    /// <summary>
    /// Valida que se puede pedir una ronda nueva: la sesión no debe estar
    /// finalizada, y no debe haber una ronda ya entregada sin responder.
    /// </summary>
    public static void EnsureCanRequestNextRound(CommitSessionState session)
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
    /// </summary>
    public static CommitSessionState AppendNewRound(CommitSessionState session, CommitRoundRecord newRound) =>
        session with { RoundsPlayed = [..session.RoundsPlayed, newRound] };

    /// <summary>
    /// Aplica la respuesta de una ronda CommitGuessr: calcula el nuevo estado
    /// de la sesión (ronda actualizada, totalScore acumulado, y si corresponde,
    /// cierre de sesión al completar la ronda 10).
    /// </summary>
    public static CommitSessionState ApplyAnswer(
        CommitSessionState session,
        string roundId,
        CommitGuess guess,
        CommitCorrectness correctness,
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
        var isLastRound = updatedRounds.Count == CommitSessionState.TotalRounds
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
