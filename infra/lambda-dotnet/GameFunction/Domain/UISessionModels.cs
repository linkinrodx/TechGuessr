namespace GameFunction.Domain;

/// <summary>
/// Registro de una ronda UIGuessr dentro de una sesión.
/// Análogo a CommitRoundRecord pero para el modo UIGuessr.
/// </summary>
public sealed record UIRoundRecord(
    string RoundId,
    string ScreenshotId,
    int RoundIndex,
    DateTimeOffset StartedAt,
    DateTimeOffset? AnsweredAt,
    UIGuess? Guesses,
    UICorrectness? Correctness,
    int Score);

/// <summary>
/// Estado completo de una sesión UIGuessr (partida de 10 rondas).
/// Análogo a CommitSessionState pero para el modo UIGuessr.
/// </summary>
public sealed record UISessionState(
    string SessionId,
    string UserId,
    SessionStatus Status,
    IReadOnlyList<UIRoundRecord> RoundsPlayed,
    int TotalScore,
    DateTimeOffset CreatedAt,
    DateTimeOffset? FinishedAt,
    long Version)
{
    public const int TotalRounds = 10;
}

/// <summary>
/// Adivinanza del jugador para una ronda UIGuessr.
/// </summary>
public sealed record UIGuess(string? App, string? Action, int? Year);

/// <summary>
/// Respuestas correctas para una ronda UIGuessr.
/// </summary>
public sealed record UICorrectAnswers(string App, string Action, int Year);

/// <summary>
/// Resultado de evaluación de corrección para UIGuessr.
/// </summary>
public sealed record UICorrectness(bool App, bool? Action, bool? Year, int YearDiff);
