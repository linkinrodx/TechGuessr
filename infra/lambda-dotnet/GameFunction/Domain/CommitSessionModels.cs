namespace GameFunction.Domain;

/// <summary>
/// Registro de una ronda CommitGuessr dentro de una sesión.
/// Análogo a RoundRecord pero para el modo CommitGuessr.
/// </summary>
public sealed record CommitRoundRecord(
    string RoundId,
    string CommitId,
    int RoundIndex,
    DateTimeOffset StartedAt,
    DateTimeOffset? AnsweredAt,
    CommitGuess? Guesses,
    CommitCorrectness? Correctness,
    int Score);

/// <summary>
/// Estado completo de una sesión CommitGuessr (partida de 10 rondas).
/// Análogo a SessionState pero para el modo CommitGuessr.
/// </summary>
public sealed record CommitSessionState(
    string SessionId,
    string UserId,
    SessionStatus Status,
    IReadOnlyList<CommitRoundRecord> RoundsPlayed,
    int TotalScore,
    DateTimeOffset CreatedAt,
    DateTimeOffset? FinishedAt,
    long Version)
{
    public const int TotalRounds = 10;
}

/// <summary>
/// Adivinanza del jugador para una ronda CommitGuessr.
/// </summary>
public sealed record CommitGuess(
    string? CommitType,
    string? Message,
    int? EffortMinutes,
    int? FilesModified);

/// <summary>
/// Respuestas correctas para una ronda CommitGuessr.
/// </summary>
public sealed record CommitCorrectAnswers(
    string CommitType,
    string Message,
    int EffortMinutes,
    int FilesModified);

/// <summary>
/// Resultado de evaluación de corrección para CommitGuessr.
/// </summary>
public sealed record CommitCorrectness(
    bool CommitType,
    bool? Message,
    bool? EffortEstimate,
    bool? FilesModified);
