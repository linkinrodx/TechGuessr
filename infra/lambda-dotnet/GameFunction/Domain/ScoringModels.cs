namespace GameFunction.Domain;

/// <summary>
/// Respuesta del jugador para una ronda. Framework/Project pueden venir vacíos
/// si el jugador no llegó a ese tramo (porque falló uno anterior en la cascada).
/// </summary>
public sealed record Guess(string? Language, string? Framework, string? Project);

/// <summary>
/// Respuestas correctas del snippet, tal como están en `techguessr-snippets`.
/// Framework/Project son null cuando el snippet no tiene ese dato (ver
/// Requirement 10.3: si Framework es null, Project también debe ser null).
/// </summary>
public sealed record CorrectAnswers(string Language, string? Framework, string? Project);

/// <summary>
/// Resultado de corrección por tramo. null significa "no evaluado" (porque
/// el tramo anterior falló, o porque el snippet no define ese dato).
/// </summary>
public sealed record Correctness(bool Language, bool? Framework, bool? Project);

/// <summary>
/// Resultado completo del cálculo de puntaje de una ronda.
/// </summary>
public sealed record ScoringResult(Correctness Correctness, int RoundScore);
