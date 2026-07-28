using System.Text.Json.Serialization;

namespace GameFunction.Api;

public sealed record SessionCreatedResponse(string SessionId, int TotalRounds);

public sealed record RoundResponse(string RoundId, int RoundIndex, string Code, string Difficulty);

public sealed record GuessRequest(string? Language, string? Framework, string? Project);

public sealed record AnswerSubmissionRequest(
    [property: JsonPropertyName("sessionId")] string SessionId,
    [property: JsonPropertyName("guess")] GuessRequest Guess,
    [property: JsonPropertyName("clientElapsedMs")] int ClientElapsedMs);

public sealed record CorrectnessResponse(bool Language, bool? Framework, bool? Project);

public sealed record CorrectAnswersResponse(string Language, string? Framework, string? Project);

public sealed record AnswerResultResponse(
    CorrectnessResponse Correctness,
    CorrectAnswersResponse CorrectAnswers,
    string Explanation,
    int RoundScore,
    int TotalScoreSoFar,
    bool SessionFinished);

public sealed record RoundSummaryResponse(
    string RoundId,
    int RoundIndex,
    CorrectnessResponse? Correctness,
    int Score);

public sealed record SessionSummaryResponse(
    string SessionId,
    int TotalScore,
    List<RoundSummaryResponse> Rounds,
    int? Rank);

public sealed record LeaderboardEntryResponse(string Username, int TotalScore, string AchievedAt);

public sealed record ErrorResponse(string Message);

// ============================================================================
// CommitGuessr API Models
// ============================================================================

public sealed record CommitGuessRequest(
    string? CommitType,
    string? Message,
    int? EffortMinutes,
    int? FilesModified);

public sealed record CommitAnswerSubmissionRequest(
    [property: JsonPropertyName("sessionId")] string SessionId,
    [property: JsonPropertyName("guess")] CommitGuessRequest Guess,
    [property: JsonPropertyName("clientElapsedMs")] int ClientElapsedMs);

public sealed record CommitCorrectnessResponse(
    bool CommitType,
    bool? Message,
    bool? EffortEstimate,
    bool? FilesModified);

public sealed record CommitCorrectAnswersResponse(
    string CommitType,
    string Message,
    int EffortMinutes,
    int FilesModified);

public sealed record CommitAnswerResultResponse(
    CommitCorrectnessResponse Correctness,
    CommitCorrectAnswersResponse CorrectAnswers,
    string Explanation,
    int RoundScore,
    int TotalScoreSoFar,
    bool SessionFinished);

public sealed record CommitRoundResponse(
    string RoundId,
    int RoundIndex,
    string Diff,
    List<string> MessageOptions,
    string Difficulty);

public sealed record CommitRoundSummaryResponse(
    string RoundId,
    int RoundIndex,
    CommitCorrectnessResponse? Correctness,
    int Score);

public sealed record CommitSessionSummaryResponse(
    string SessionId,
    int TotalScore,
    List<CommitRoundSummaryResponse> Rounds,
    int? Rank);

// ============================================================================
// UIGuessr API Models
// ============================================================================

public sealed record UIGuessRequest(string? App, string? Action, int? Year);

public sealed record UIAnswerSubmissionRequest(
    [property: JsonPropertyName("sessionId")] string SessionId,
    [property: JsonPropertyName("guess")] UIGuessRequest Guess,
    [property: JsonPropertyName("clientElapsedMs")] int ClientElapsedMs);

public sealed record UICorrectnessResponse(bool App, bool? Action, bool? Year, int YearDiff);

public sealed record UICorrectAnswersResponse(string App, string Action, int Year);

public sealed record UIAnswerResultResponse(
    UICorrectnessResponse Correctness,
    UICorrectAnswersResponse CorrectAnswers,
    string Explanation,
    int RoundScore,
    int TotalScoreSoFar,
    bool SessionFinished);

public sealed record UIRoundResponse(
    string RoundId,
    int RoundIndex,
    string ImageUrl,
    string Difficulty);

public sealed record UIRoundSummaryResponse(
    string RoundId,
    int RoundIndex,
    UICorrectnessResponse? Correctness,
    int Score);

public sealed record UISessionSummaryResponse(
    string SessionId,
    int TotalScore,
    List<UIRoundSummaryResponse> Rounds,
    int? Rank);

