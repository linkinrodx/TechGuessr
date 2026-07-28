using FsCheck.Xunit;
using GameFunction.Domain;

namespace GameFunction.Tests;

/// <summary>
/// Property-based tests del módulo de puntaje puro de CommitGuessr.
/// Análogo a ScoringPropertyTests (CodeGuessr), pero para la evaluación
/// independiente (sin cascada) de CommitScoring.
/// </summary>
public class CommitScoringPropertyTests
{
    private static readonly string[] SampleCommitTypes = ["feature", "bugfix", "refactor", "docs", "test", "perf"];
    private static readonly string[] SampleMessages =
    [
        "fix: add error handling to user fetch",
        "feat: implement user query caching",
        "refactor: simplify discount calculation logic",
    ];

    /// <summary>
    /// Análogo a Property 1 de CodeGuessr: para toda combinación de
    /// aciertos/fallos en las 4 preguntas, 0 &lt;= roundScore &lt;= MaxRoundScore.
    /// </summary>
    [Property]
    public bool RoundScore_SiempreEnRangoValido(
        int commitTypeIndex,
        int messageIndex,
        bool commitTypeCorrect,
        bool messageCorrect,
        bool includeMessage,
        bool includeEffort,
        bool includeFiles,
        int effortMinutes,
        int effortGuessOffset,
        int filesModified,
        int filesGuessOffset)
    {
        var commitType = Pick(SampleCommitTypes, commitTypeIndex);
        var message = Pick(SampleMessages, messageIndex);
        var boundedEffort = Math.Abs(effortMinutes % 500) + 1;
        var boundedFiles = Math.Abs(filesModified % 100) + 1;

        var correct = new CommitCorrectAnswers(commitType, message, boundedEffort, boundedFiles);

        var guess = new CommitGuess(
            commitTypeCorrect ? commitType : "wrong-type",
            includeMessage ? (messageCorrect ? message : "wrong-message") : null,
            includeEffort ? boundedEffort + (effortGuessOffset % 1000) : null,
            includeFiles ? boundedFiles + (filesGuessOffset % 200) : null);

        var result = CommitScoring.CalculateRoundScore(guess, correct);

        return result.RoundScore >= 0 && result.RoundScore <= CommitScoring.MaxRoundScore;
    }

    /// <summary>
    /// Evaluación independiente (a diferencia de la cascada de CodeGuessr):
    /// el resultado de CommitType nunca condiciona si Message, Effort o
    /// Files se evalúan. Cada uno es null si y solo si no se envió guess
    /// para ese campo.
    /// </summary>
    [Property]
    public bool Evaluacion_EsIndependienteDeCommitType(
        int commitTypeIndex,
        bool commitTypeCorrect,
        bool includeMessage,
        bool includeEffort,
        bool includeFiles)
    {
        var commitType = Pick(SampleCommitTypes, commitTypeIndex);
        var correct = new CommitCorrectAnswers(commitType, "algun mensaje", 20, 3);

        var guess = new CommitGuess(
            commitTypeCorrect ? commitType : "wrong-type",
            includeMessage ? "algun mensaje" : null,
            includeEffort ? 20 : null,
            includeFiles ? 3 : null);

        var result = CommitScoring.CalculateRoundScore(guess, correct);

        // Un campo es null si y solo si NO se incluyó guess para él, sin
        // importar si commitType fue correcto o no (evaluación
        // independiente, sin cascada).
        var messageConsistent = (result.Correctness.Message is null) == !includeMessage;
        var effortConsistent = (result.Correctness.EffortEstimate is null) == !includeEffort;
        var filesConsistent = (result.Correctness.FilesModified is null) == !includeFiles;

        return messageConsistent && effortConsistent && filesConsistent;
    }

    /// <summary>
    /// La estimación de esfuerzo se acepta como correcta si y solo si está
    /// dentro del margen de ±20% del valor real (bordes inclusive).
    /// </summary>
    [Property]
    public bool EstimacionEsfuerzo_AceptaMargenDelVeinteEnPorciento(int realEffortRaw)
    {
        var realEffort = Math.Abs(realEffortRaw % 500) + 5; // evita valores triviales cerca de 0
        var margin = (int)(realEffort * CommitScoring.EffortMarginPercent);

        var correct = new CommitCorrectAnswers("feature", "msg", realEffort, 1);

        var withinLower = new CommitGuess("feature", null, realEffort - margin, null);
        var withinUpper = new CommitGuess("feature", null, realEffort + margin, null);
        var outsideUpper = new CommitGuess("feature", null, realEffort + margin + Math.Max(1, realEffort / 2), null);

        var resultLower = CommitScoring.CalculateRoundScore(withinLower, correct);
        var resultUpper = CommitScoring.CalculateRoundScore(withinUpper, correct);
        var resultOutside = CommitScoring.CalculateRoundScore(outsideUpper, correct);

        return resultLower.Correctness.EffortEstimate == true
            && resultUpper.Correctness.EffortEstimate == true
            && resultOutside.Correctness.EffortEstimate == false;
    }

    private static string Pick(string[] values, int index) =>
        values[Math.Abs(index) % values.Length];

    [Fact]
    public void CalculateRoundScore_TodoCorrecto_DevuelveMaxRoundScore()
    {
        var correct = new CommitCorrectAnswers("bugfix", "fix: add error handling", 15, 1);
        var guess = new CommitGuess("bugfix", "fix: add error handling", 15, 1);

        var result = CommitScoring.CalculateRoundScore(guess, correct);

        Assert.True(result.Correctness.CommitType);
        Assert.True(result.Correctness.Message);
        Assert.True(result.Correctness.EffortEstimate);
        Assert.True(result.Correctness.FilesModified);
        Assert.Equal(CommitScoring.MaxRoundScore, result.RoundScore);
    }

    [Fact]
    public void CalculateRoundScore_SoloTipoCorrecto_DevuelveSoloEsosPuntos()
    {
        var correct = new CommitCorrectAnswers("refactor", "refactor: algo", 10, 2);
        var guess = new CommitGuess("refactor", null, null, null);

        var result = CommitScoring.CalculateRoundScore(guess, correct);

        Assert.True(result.Correctness.CommitType);
        Assert.Null(result.Correctness.Message);
        Assert.Null(result.Correctness.EffortEstimate);
        Assert.Null(result.Correctness.FilesModified);
        Assert.Equal(CommitScoring.CommitTypePoints, result.RoundScore);
    }

    [Fact]
    public void CalculateRoundScore_NormalizaTextoConEspaciosYMayusculas()
    {
        var correct = new CommitCorrectAnswers("Docs", "Some Message", 10, 1);
        var guess = new CommitGuess("  docs  ", "  some message  ", 10, 1);

        var result = CommitScoring.CalculateRoundScore(guess, correct);

        Assert.True(result.Correctness.CommitType);
        Assert.True(result.Correctness.Message);
    }
}
