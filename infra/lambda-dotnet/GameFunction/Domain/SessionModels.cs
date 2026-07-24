namespace GameFunction.Domain;

public enum SessionStatus
{
    InProgress,
    Finished,
}

/// <summary>
/// Registro de una ronda dentro de una sesión. Ver design.md, "Data Models"
/// (interface RoundRecord).
/// </summary>
public sealed record RoundRecord(
    string RoundId,
    string SnippetId,
    int RoundIndex,
    DateTimeOffset StartedAt,
    DateTimeOffset? AnsweredAt,
    Guess? Guesses,
    Correctness? Correctness,
    int Score);

/// <summary>
/// Estado completo de una sesión (partida Clásica de 10 rondas), representado
/// como datos puros. La persistencia real en DynamoDB vive en
/// Repositories/SessionsRepository.cs; este tipo no sabe nada de AWS.
/// </summary>
public sealed record SessionState(
    string SessionId,
    string UserId,
    SessionStatus Status,
    IReadOnlyList<RoundRecord> RoundsPlayed,
    int TotalScore,
    DateTimeOffset CreatedAt,
    DateTimeOffset? FinishedAt,
    long Version)
{
    public const int TotalRounds = 10;
}

/// <summary>
/// Errores de dominio para las transiciones de sesión. Se mapean a códigos
/// HTTP específicos en la capa de handlers (ver design.md, "Error Handling").
/// </summary>
public abstract class SessionTransitionException(string message) : Exception(message);

public sealed class SessionAlreadyFinishedException()
    : SessionTransitionException("La sesión ya está finalizada.");

public sealed class PendingRoundExistsException()
    : SessionTransitionException("Ya existe una ronda pendiente sin responder.");

public sealed class RoundNotFoundException()
    : SessionTransitionException("La ronda no existe en esta sesión.");

public sealed class RoundAlreadyAnsweredException()
    : SessionTransitionException("La ronda ya fue respondida previamente.");
