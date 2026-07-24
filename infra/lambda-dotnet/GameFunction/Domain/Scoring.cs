namespace GameFunction.Domain;

/// <summary>
/// Lógica de puntaje pura de CodeGuessr. Sin dependencias de AWS/DynamoDB:
/// solo transforma (Guess, CorrectAnswers, tiempo de respuesta) en un resultado
/// de corrección y puntaje.
///
/// Ver .kiro/specs/codeguessr-mvp/design.md, sección "Lógica de Puntaje" y
/// "Correctness Properties" (Property 1, 2, 3).
/// </summary>
public static class Scoring
{
    /// <summary>Puntaje máximo posible de una ronda (3 tramos x 100 puntos).</summary>
    public const int MaxRoundScore = 300;

    /// <summary>Puntaje máximo de un tramo individual (language, framework o project).</summary>
    public const int TramoMaxScore = 100;

    /// <summary>Puntos garantizados por tramo acertado, independientemente de la velocidad.</summary>
    public const int BasePointsPerTramo = 60;

    /// <summary>Bonus máximo por velocidad, otorgado si se responde en FastThresholdMs o menos.</summary>
    public const int MaxSpeedBonus = TramoMaxScore - BasePointsPerTramo;

    /// <summary>Por debajo de este tiempo (ms) se otorga el bonus de velocidad completo.</summary>
    public const int FastThresholdMs = 3_000;

    /// <summary>En este tiempo (ms) o más, el bonus de velocidad es cero.</summary>
    public const int SlowThresholdMs = 15_000;

    /// <summary>
    /// Calcula la corrección y el puntaje de una ronda completa, aplicando la
    /// cascada de evaluación (language -> framework -> project) y la omisión
    /// de tramos cuando el snippet no define framework/project.
    /// </summary>
    public static ScoringResult CalculateRoundScore(Guess guess, CorrectAnswers correct, int elapsedMsServer)
    {
        var speedBonus = CalculateSpeedBonus(elapsedMsServer);

        var languageCorrect = AreEqualNormalized(guess.Language, correct.Language);
        var score = languageCorrect ? BasePointsPerTramo + speedBonus : 0;

        if (!languageCorrect)
        {
            // Cascada: si falla language, framework/project no se evalúan (Property 2).
            return new ScoringResult(new Correctness(false, null, null), score);
        }

        if (correct.Framework is null)
        {
            // Omisión por dataset incompleto: framework no aplica a este snippet,
            // por lo tanto tampoco project (Property 3).
            return new ScoringResult(new Correctness(true, null, null), score);
        }

        var frameworkCorrect = AreEqualNormalized(guess.Framework, correct.Framework);
        score += frameworkCorrect ? BasePointsPerTramo + speedBonus : 0;

        if (!frameworkCorrect)
        {
            // Cascada: si falla framework, project no se evalúa.
            return new ScoringResult(new Correctness(true, false, null), score);
        }

        if (correct.Project is null)
        {
            // El snippet no define project aunque sí framework: se omite ese tramo.
            return new ScoringResult(new Correctness(true, true, null), score);
        }

        var projectCorrect = AreEqualNormalized(guess.Project, correct.Project);
        score += projectCorrect ? BasePointsPerTramo + speedBonus : 0;

        return new ScoringResult(new Correctness(true, true, projectCorrect), score);
    }

    /// <summary>
    /// Bonus de velocidad, decreciente linealmente entre FastThresholdMs (bonus
    /// máximo) y SlowThresholdMs (bonus cero). Tiempos fuera de ese rango se
    /// recortan (clamp) a los extremos.
    /// </summary>
    private static int CalculateSpeedBonus(int elapsedMsServer)
    {
        var clamped = Math.Clamp(elapsedMsServer, 0, SlowThresholdMs);

        if (clamped <= FastThresholdMs)
        {
            return MaxSpeedBonus;
        }

        var range = SlowThresholdMs - FastThresholdMs;
        var progressIntoSlowZone = clamped - FastThresholdMs;
        var remainingFraction = 1.0 - (double)progressIntoSlowZone / range;

        return (int)Math.Round(MaxSpeedBonus * remainingFraction, MidpointRounding.AwayFromZero);
    }

    /// <summary>Comparación normalizada (trim + case-insensitive), ver Requirement 4.1.</summary>
    private static bool AreEqualNormalized(string? a, string? b)
    {
        if (a is null || b is null)
        {
            return false;
        }

        return string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
