using FsCheck.Xunit;
using GameFunction.Domain;

namespace GameFunction.Tests;

/// <summary>
/// Property-based tests del módulo de puntaje puro (tarea 3.2 de tasks.md).
///
/// Cubre las Correctness Properties 1, 2 y 3 definidas en
/// .kiro/specs/codeguessr-mvp/design.md.
/// </summary>
public class ScoringPropertyTests
{
    private static readonly string[] SampleLanguages = ["TypeScript", "Python", "Go", "Rust"];
    private static readonly string[] SampleFrameworks = ["Angular", "Django", "Spring", "Vue"];
    private static readonly string[] SampleProjects = ["Angular", "Django", "Spring Framework", "Vue.js"];

    /// <summary>
    /// Property 1: para toda combinación válida de aciertos/fallos en los 3
    /// tramos y todo tiempo de respuesta dentro del rango permitido,
    /// 0 &lt;= roundScore &lt;= MAX_ROUND_SCORE.
    /// </summary>
    [Property]
    public bool RoundScore_SiempreEnRangoValido(
        int languageIndex,
        int frameworkIndex,
        int projectIndex,
        bool guessLanguageCorrect,
        bool guessFrameworkCorrect,
        bool guessProjectCorrect,
        bool hasFramework,
        bool hasProjectRaw,
        int elapsedMs)
    {
        var language = Pick(SampleLanguages, languageIndex);
        var framework = Pick(SampleFrameworks, frameworkIndex);
        var project = Pick(SampleProjects, projectIndex);
        var boundedElapsedMs = Math.Abs(elapsedMs % 30_000);

        // Si no hay framework, tampoco puede haber project (Requirement 10.3).
        var hasProject = hasFramework && hasProjectRaw;

        var correct = new CorrectAnswers(
            language,
            hasFramework ? framework : null,
            hasProject ? project : null);

        var guess = new Guess(
            guessLanguageCorrect ? language : "wrong-language",
            hasFramework ? (guessFrameworkCorrect ? framework : "wrong-framework") : null,
            hasProject ? (guessProjectCorrect ? project : "wrong-project") : null);

        var result = Scoring.CalculateRoundScore(guess, correct, boundedElapsedMs);

        return result.RoundScore >= 0 && result.RoundScore <= Scoring.MaxRoundScore;
    }

    /// <summary>
    /// Property 2: si correctness.language es false, entonces
    /// correctness.framework y correctness.project son null (cascada).
    /// </summary>
    [Property]
    public bool CascadaDeCorrecion_SiFallaLanguage_NoEvaluaElResto(int languageIndex, int elapsedMs)
    {
        var language = Pick(SampleLanguages, languageIndex);
        var boundedElapsedMs = Math.Abs(elapsedMs % 30_000);

        var correct = new CorrectAnswers(language, "AlgunFramework", "AlgunProyecto");
        var guess = new Guess("DefinitivamenteIncorrecto", "AlgunFramework", "AlgunProyecto");

        var result = Scoring.CalculateRoundScore(guess, correct, boundedElapsedMs);

        return !result.Correctness.Language
            && result.Correctness.Framework == null
            && result.Correctness.Project == null;
    }

    /// <summary>
    /// Property 3: si el snippet tiene framework == null, ese tramo (y
    /// project) nunca contribuye puntaje, sin importar qué envíe el jugador.
    /// </summary>
    [Property]
    public bool OmisionPorDatasetIncompleto_FrameworkNulo_NuncaContribuyePuntaje(
        int languageIndex,
        bool languageCorrect,
        int elapsedMs)
    {
        var language = Pick(SampleLanguages, languageIndex);
        var boundedElapsedMs = Math.Abs(elapsedMs % 30_000);

        var correct = new CorrectAnswers(language, null, null);
        var guess = new Guess(languageCorrect ? language : "incorrecto", "framework-inventado", "proyecto-inventado");

        var result = Scoring.CalculateRoundScore(guess, correct, boundedElapsedMs);

        // Puntaje máximo posible cuando solo el tramo language puede
        // contribuir: BasePointsPerTramo + MaxSpeedBonus == TramoMaxScore.
        var maxPosibleConSoloLanguage = Scoring.TramoMaxScore;

        return result.Correctness.Framework == null
            && result.Correctness.Project == null
            && result.RoundScore <= maxPosibleConSoloLanguage;
    }

    private static string Pick(string[] values, int index) =>
        values[Math.Abs(index) % values.Length];

    /// <summary>
    /// Caso concreto (no propiedad) que documenta el comportamiento exacto
    /// esperado para servir de referencia rápida además de las propiedades.
    /// </summary>
    [Fact]
    public void CalculateRoundScore_TodoCorrectoYRapido_DevuelveMaxRoundScore()
    {
        var correct = new CorrectAnswers("TypeScript", "Angular", "Angular");
        var guess = new Guess("TypeScript", "Angular", "Angular");

        var result = Scoring.CalculateRoundScore(guess, correct, elapsedMsServer: 0);

        Assert.True(result.Correctness.Language);
        Assert.True(result.Correctness.Framework);
        Assert.True(result.Correctness.Project);
        Assert.Equal(Scoring.MaxRoundScore, result.RoundScore);
    }

    [Fact]
    public void CalculateRoundScore_NormalizaTextoConEspaciosYMayusculas()
    {
        var correct = new CorrectAnswers("TypeScript", null, null);
        var guess = new Guess("  typescript  ", null, null);

        var result = Scoring.CalculateRoundScore(guess, correct, elapsedMsServer: 0);

        Assert.True(result.Correctness.Language);
    }
}
