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
