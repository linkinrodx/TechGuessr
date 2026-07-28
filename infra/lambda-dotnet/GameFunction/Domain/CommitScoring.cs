namespace GameFunction.Domain;

/// <summary>
/// Lógica de puntaje pura de CommitGuessr. Sin dependencias de AWS/DynamoDB:
/// transforma (CommitGuess, CommitCorrectAnswers) en un resultado de
/// corrección y puntaje.
///
/// Sistema de puntuación CommitGuessr:
/// - Tipo de cambio correcto: 400 puntos (obligatorio)
/// - Mensaje correcto: 600 puntos (opcional, solo si tipo es correcto)
/// - Estimación de esfuerzo ±20%: 500 puntos (opcional)
/// - Archivos modificados exacto: 300 puntos (opcional)
/// 
/// Total máximo por ronda: 1,800 puntos
/// </summary>
public static class CommitScoring
{
    public const int CommitTypePoints = 400;
    public const int MessagePoints = 600;
    public const int EffortEstimatePoints = 500;
    public const int FilesModifiedPoints = 300;
    public const int MaxRoundScore = CommitTypePoints + MessagePoints + EffortEstimatePoints + FilesModifiedPoints;

    /// <summary>
    /// Margen de error aceptable para la estimación de esfuerzo (20%).
    /// </summary>
    public const double EffortMarginPercent = 0.20;

    /// <summary>
    /// Calcula la corrección y el puntaje de una ronda CommitGuessr.
    /// El tipo de cambio (CommitType) es obligatorio. Los demás campos
    /// son opcionales y se evalúan independientemente.
    /// </summary>
    public static CommitScoringResult CalculateRoundScore(CommitGuess guess, CommitCorrectAnswers correct)
    {
        var commitTypeCorrect = AreEqualNormalized(guess.CommitType, correct.CommitType);
        var score = commitTypeCorrect ? CommitTypePoints : 0;

        // Mensaje: solo se evalúa si se proporcionó una respuesta
        bool? messageCorrect = null;
        if (guess.Message is not null)
        {
            messageCorrect = AreEqualNormalized(guess.Message, correct.Message);
            if (messageCorrect.Value)
            {
                score += MessagePoints;
            }
        }

        // Estimación de esfuerzo: solo se evalúa si se proporcionó una respuesta
        bool? effortCorrect = null;
        if (guess.EffortMinutes is not null)
        {
            effortCorrect = IsWithinMargin(guess.EffortMinutes.Value, correct.EffortMinutes, EffortMarginPercent);
            if (effortCorrect.Value)
            {
                score += EffortEstimatePoints;
            }
        }

        // Archivos modificados: solo se evalúa si se proporcionó una respuesta
        bool? filesCorrect = null;
        if (guess.FilesModified is not null)
        {
            filesCorrect = guess.FilesModified.Value == correct.FilesModified;
            if (filesCorrect.Value)
            {
                score += FilesModifiedPoints;
            }
        }

        return new CommitScoringResult(
            new CommitCorrectness(commitTypeCorrect, messageCorrect, effortCorrect, filesCorrect),
            score);
    }

    /// <summary>
    /// Verifica si un valor está dentro del margen de error aceptable.
    /// </summary>
    private static bool IsWithinMargin(int guessed, int correct, double marginPercent)
    {
        var margin = correct * marginPercent;
        var difference = Math.Abs(guessed - correct);
        return difference <= margin;
    }

    /// <summary>
    /// Comparación normalizada (trim + case-insensitive).
    /// </summary>
    private static bool AreEqualNormalized(string? a, string? b)
    {
        if (a is null || b is null)
        {
            return false;
        }

        return string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Resultado del cálculo de puntaje para una ronda CommitGuessr.
/// </summary>
public sealed record CommitScoringResult(CommitCorrectness Correctness, int RoundScore);
