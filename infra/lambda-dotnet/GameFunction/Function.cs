using System.Text.Json;
using System.Text.RegularExpressions;
using Amazon.DynamoDBv2;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using GameFunction.Api;
using GameFunction.Domain;
using GameFunction.Repositories;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace GameFunction;

/// <summary>
/// Lambda única "game function" de TechGuessr.
///
/// Resuelve internamente por (method, path) las 5 rutas del contrato de API
/// (ver .kiro/specs/codeguessr-mvp/design.md, sección "Contrato de API").
/// </summary>
public class Function
{
    private static readonly Regex AnswerRoutePattern = new(@"^/rounds/(?<roundId>[^/]+)/answer$");
    private static readonly Regex SummaryRoutePattern = new(@"^/sessions/(?<sessionId>[^/]+)/summary$");
    private static readonly JsonSerializerOptions RequestJsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly SnippetsRepository _snippets;
    private readonly SessionsRepository _sessions;
    private readonly ScoresRepository _scores;

    public Function() : this(CreateDefaultClient())
    {
    }

    private Function(IAmazonDynamoDB client)
    {
        var snippetsTable = Environment.GetEnvironmentVariable("SNIPPETS_TABLE_NAME") ?? "techguessr-snippets";
        var sessionsTable = Environment.GetEnvironmentVariable("SESSIONS_TABLE_NAME") ?? "techguessr-sessions";
        var scoresTable = Environment.GetEnvironmentVariable("SCORES_TABLE_NAME") ?? "techguessr-scores";

        _snippets = new SnippetsRepository(client, snippetsTable);
        _sessions = new SessionsRepository(client, sessionsTable);
        _scores = new ScoresRepository(client, scoresTable);
    }

    private static IAmazonDynamoDB CreateDefaultClient() => new AmazonDynamoDBClient();

    public async Task<APIGatewayHttpApiV2ProxyResponse> FunctionHandler(
        APIGatewayHttpApiV2ProxyRequest request,
        ILambdaContext context)
    {
        var method = request.RequestContext.Http.Method;
        var path = request.RequestContext.Http.Path;

        try
        {
            if (method == "POST" && path == "/sessions")
            {
                return await HandleCreateSessionAsync(request);
            }
            if (method == "GET" && path == "/rounds/next")
            {
                return await HandleGetNextRoundAsync(request);
            }

            var answerMatch = AnswerRoutePattern.Match(path);
            if (method == "POST" && answerMatch.Success)
            {
                return await HandleSubmitAnswerAsync(request, answerMatch.Groups["roundId"].Value);
            }

            var summaryMatch = SummaryRoutePattern.Match(path);
            if (method == "GET" && summaryMatch.Success)
            {
                return await HandleGetSessionSummaryAsync(request, summaryMatch.Groups["sessionId"].Value);
            }

            if (method == "GET" && path == "/leaderboard")
            {
                return await HandleGetLeaderboardAsync(request);
            }

            return JsonResponse(404, new ErrorResponse("Route not found"));
        }
        catch (SessionAlreadyFinishedException)
        {
            return JsonResponse(409, new ErrorResponse("La sesión ya está finalizada."));
        }
        catch (PendingRoundExistsException)
        {
            return JsonResponse(409, new ErrorResponse("Hay una ronda pendiente sin responder."));
        }
        catch (RoundNotFoundException)
        {
            return JsonResponse(404, new ErrorResponse("La ronda no existe."));
        }
        catch (RoundAlreadyAnsweredException)
        {
            return JsonResponse(409, new ErrorResponse("La ronda ya fue respondida."));
        }
        catch (ConcurrentModificationException)
        {
            // Ver design.md, "Consideraciones de Seguridad" / atomicidad: una
            // colisión de escritura concurrente se trata como conflicto, no
            // como error de servidor.
            return JsonResponse(409, new ErrorResponse("La sesión fue modificada concurrentemente, reintenta."));
        }
        catch (ForbiddenException)
        {
            return JsonResponse(403, new ErrorResponse("No tienes acceso a este recurso."));
        }
        catch (Amazon.DynamoDBv2.AmazonDynamoDBException ex)
        {
            context.Logger.LogError($"DynamoDB error: {ex.Message}");
            return JsonResponse(503, new ErrorResponse("Servicio no disponible, reintenta en unos segundos."));
        }
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleCreateSessionAsync(APIGatewayHttpApiV2ProxyRequest request)
    {
        var userId = GetUserId(request);

        var usableCount = await _snippets.CountUsableAsync();
        if (usableCount < 10)
        {
            return JsonResponse(500, new ErrorResponse("Dataset de snippets insuficiente."));
        }

        var session = new SessionState(
            SessionId: Guid.NewGuid().ToString(),
            UserId: userId,
            Status: SessionStatus.InProgress,
            RoundsPlayed: [],
            TotalScore: 0,
            CreatedAt: DateTimeOffset.UtcNow,
            FinishedAt: null,
            Version: 0);

        await _sessions.CreateAsync(session);

        return JsonResponse(201, new SessionCreatedResponse(session.SessionId, SessionState.TotalRounds));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetNextRoundAsync(APIGatewayHttpApiV2ProxyRequest request)
    {
        var userId = GetUserId(request);
        string? sessionId = null;
        request.QueryStringParameters?.TryGetValue("sessionId", out sessionId);
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            return JsonResponse(400, new ErrorResponse("Falta el parámetro sessionId."));
        }

        var session = await _sessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureOwnership(session, userId);

        SessionTransitions.EnsureCanRequestNextRound(session);

        var snippet = await _snippets.GetRandomSnippetAsync();
        if (snippet is null)
        {
            return JsonResponse(500, new ErrorResponse("No hay snippets disponibles."));
        }

        var newRound = new RoundRecord(
            RoundId: Guid.NewGuid().ToString(),
            SnippetId: snippet.SnippetId,
            RoundIndex: session.RoundsPlayed.Count + 1,
            StartedAt: DateTimeOffset.UtcNow,
            AnsweredAt: null,
            Guesses: null,
            Correctness: null,
            Score: 0);

        var updatedSession = SessionTransitions.AppendNewRound(session, newRound);
        await _sessions.SaveAsync(updatedSession, session.Version);

        return JsonResponse(200, new RoundResponse(
            newRound.RoundId, newRound.RoundIndex, snippet.Code, snippet.Difficulty));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleSubmitAnswerAsync(
        APIGatewayHttpApiV2ProxyRequest request, string roundId)
    {
        var userId = GetUserId(request);
        var body = JsonSerializer.Deserialize<AnswerSubmissionRequest>(request.Body ?? "{}", RequestJsonOptions);
        if (body is null || string.IsNullOrWhiteSpace(body.SessionId))
        {
            return JsonResponse(400, new ErrorResponse("Body inválido."));
        }

        var session = await _sessions.GetAsync(body.SessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureOwnership(session, userId);

        var round = session.RoundsPlayed.FirstOrDefault(r => r.RoundId == roundId);
        if (round is null)
        {
            return JsonResponse(404, new ErrorResponse("La ronda no existe o no pertenece a la sesión."));
        }

        var snippet = await _snippets.GetByIdAsync(round.SnippetId);
        if (snippet is null)
        {
            // snippetId referenciado por la ronda no existe en la tabla de
            // snippets (dataset corrupto). Ver design.md, "Error Handling".
            return JsonResponse(500, new ErrorResponse("Snippet referenciado no encontrado."));
        }

        var answeredAt = DateTimeOffset.UtcNow;
        var elapsedMsServer = (int)Math.Max(0, (answeredAt - round.StartedAt).TotalMilliseconds);

        var guess = new Guess(body.Guess.Language, body.Guess.Framework, body.Guess.Project);
        var correctAnswers = SnippetsRepository.ToCorrectAnswers(snippet);

        var scoringResult = Scoring.CalculateRoundScore(guess, correctAnswers, elapsedMsServer);

        var updatedSession = SessionTransitions.ApplyAnswer(
            session, roundId, guess, scoringResult.Correctness, scoringResult.RoundScore, answeredAt);

        await _sessions.SaveAsync(updatedSession, session.Version);

        if (updatedSession.Status == SessionStatus.Finished)
        {
            var username = GetUsername(request);
            await _scores.RecordScoreAsync(userId, username, updatedSession.TotalScore, updatedSession.SessionId);
        }

        return JsonResponse(200, new AnswerResultResponse(
            new CorrectnessResponse(scoringResult.Correctness.Language, scoringResult.Correctness.Framework, scoringResult.Correctness.Project),
            new CorrectAnswersResponse(correctAnswers.Language, correctAnswers.Framework, correctAnswers.Project),
            snippet.Explanation,
            scoringResult.RoundScore,
            updatedSession.TotalScore,
            updatedSession.Status == SessionStatus.Finished));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetSessionSummaryAsync(
        APIGatewayHttpApiV2ProxyRequest request, string sessionId)
    {
        var userId = GetUserId(request);

        var session = await _sessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureOwnership(session, userId);

        if (session.Status != SessionStatus.Finished)
        {
            return JsonResponse(409, new ErrorResponse("La sesión todavía está en progreso."));
        }

        var rank = await _scores.GetRankForSessionAsync(session.SessionId, session.TotalScore);

        var rounds = session.RoundsPlayed.Select(r => new RoundSummaryResponse(
            r.RoundId,
            r.RoundIndex,
            r.Correctness is null ? null : new CorrectnessResponse(r.Correctness.Language, r.Correctness.Framework, r.Correctness.Project),
            r.Score)).ToList();

        return JsonResponse(200, new SessionSummaryResponse(session.SessionId, session.TotalScore, rounds, rank));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetLeaderboardAsync(APIGatewayHttpApiV2ProxyRequest request)
    {
        int? limit = null;
        if (request.QueryStringParameters?.TryGetValue("limit", out var limitRaw) == true
            && int.TryParse(limitRaw, out var parsedLimit))
        {
            limit = parsedLimit;
        }

        var entries = await _scores.GetTopAsync(limit);

        var response = entries.Select(e => new LeaderboardEntryResponse(
            e.Username, e.TotalScore, e.AchievedAt.ToString("O"))).ToList();

        return JsonResponse(200, response);
    }

    private static string GetUserId(APIGatewayHttpApiV2ProxyRequest request)
    {
        var claims = request.RequestContext.Authorizer?.Jwt?.Claims;
        if (claims is null || !claims.TryGetValue("sub", out var sub) || string.IsNullOrWhiteSpace(sub))
        {
            throw new ForbiddenException();
        }
        return sub;
    }

    private static string GetUsername(APIGatewayHttpApiV2ProxyRequest request)
    {
        var claims = request.RequestContext.Authorizer?.Jwt?.Claims;
        if (claims is not null && claims.TryGetValue("cognito:username", out var username) && !string.IsNullOrWhiteSpace(username))
        {
            return username;
        }
        return GetUserId(request);
    }

    /// <summary>
    /// Autorización a nivel de recurso (Requirement 8): verifica que el
    /// usuario autenticado sea el propietario de la sesión antes de leer o
    /// escribir sobre ella.
    /// </summary>
    private static void EnsureOwnership(SessionState session, string userId)
    {
        if (session.UserId != userId)
        {
            throw new ForbiddenException();
        }
    }

    private static APIGatewayHttpApiV2ProxyResponse JsonResponse(int statusCode, object body) => new()
    {
        StatusCode = statusCode,
        Body = JsonSerializer.Serialize(body),
        Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
    };
}

/// <summary>Usuario autenticado sin permiso sobre el recurso solicitado (403).</summary>
public sealed class ForbiddenException() : Exception("Acceso denegado.");
