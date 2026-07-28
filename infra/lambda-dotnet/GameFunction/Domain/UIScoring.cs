namespace GameFunction.Domain;

/// <summary>
/// Lógica de puntaje pura de UIGuessr. Sin dependencias de AWS/DynamoDB:
/// transforma (UIGuess, UICorrectAnswers) en un resultado de corrección y
/// puntaje.
///
/// Sistema de puntuación UIGuessr (en cascada, replica exactamente
/// UIGameService.submitAnswer del frontend original que corría en modo
/// local — ver ui-game.service.ts):
/// - App correcta: 500 puntos (obligatorio)
/// - Acción correcta: 400 puntos (opcional, solo se evalúa si App es correcta)
/// - Año exacto: 900 puntos / Año ±1: 600 puntos (opcional, solo se evalúa
///   si App Y Acción son correctas)
///
/// Total máximo por ronda: 1,800 puntos.
/// </summary>
public static class UIScoring
{
    public const int AppPoints = 500;
    public const int ActionPoints = 400;
    public const int YearExactPoints = 900;
    public const int YearCloseByOnePoints = 600;
    public const int MaxRoundScore = AppPoints + ActionPoints + YearExactPoints;

    public static UIScoringResult CalculateRoundScore(UIGuess guess, UICorrectAnswers correct)
    {
        // Las tres correcciones se calculan de forma independiente entre sí
        // (igual que el UIGameService local original): un campo se marca
        // correcto/incorrecto según lo que el jugador respondió,
        // independientemente de si los campos anteriores de la cascada
        // fueron correctos. Los PUNTOS, en cambio, sí siguen la cascada
        // (solo se otorgan si los pasos previos fueron correctos).
        var appCorrect = AreEqualNormalized(guess.App, correct.App);

        bool? actionCorrect = guess.Action is not null
            ? AreEqualNormalized(guess.Action, correct.Action)
            : null;

        bool? yearCorrect = null;
        var yearDiff = 0;
        if (guess.Year is not null)
        {
            yearDiff = Math.Abs(guess.Year.Value - correct.Year);
            yearCorrect = yearDiff == 0;
        }

        var score = 0;
        if (appCorrect)
        {
            score += AppPoints;

            if (actionCorrect == true)
            {
                score += ActionPoints;

                if (yearCorrect == true)
                {
                    score += YearExactPoints;
                }
                else if (yearCorrect == false && yearDiff == 1)
                {
                    score += YearCloseByOnePoints;
                }
            }
        }

        return new UIScoringResult(
            new UICorrectness(appCorrect, actionCorrect, yearCorrect, yearDiff),
            score);
    }

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
/// Resultado del cálculo de puntaje para una ronda UIGuessr.
/// </summary>
public sealed record UIScoringResult(UICorrectness Correctness, int RoundScore);
