using System.Text.Json;
using System.Text.RegularExpressions;
using Amazon.DynamoDBv2;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using GameFunction.Api;
using GameFunction.Auth;
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
    private static readonly Regex CommitAnswerRoutePattern = new(@"^/commit-rounds/(?<roundId>[^/]+)/answer$");
    private static readonly Regex CommitSummaryRoutePattern = new(@"^/commit-sessions/(?<sessionId>[^/]+)/summary$");
    private static readonly Regex UIAnswerRoutePattern = new(@"^/ui-rounds/(?<roundId>[^/]+)/answer$");
    private static readonly Regex UISummaryRoutePattern = new(@"^/ui-sessions/(?<sessionId>[^/]+)/summary$");
    private static readonly JsonSerializerOptions RequestJsonOptions = new() { PropertyNameCaseInsensitive = true };

    // Cada modalidad de juego tiene su propio shard de leaderboard dentro de
    // la tabla techguessr-scores (ver comentario en ScoresRepository): sin
    // esto, el techo de puntaje mucho más alto de CommitGuessr/UIGuessr
    // (1800 pts/ronda) desplazaría siempre a CodeGuessr (300 pts/ronda) del
    // ranking.
    private const string CodeguessrLeaderboardShard = "codeguessr";
    private const string CommitguessrLeaderboardShard = "commitguessr";
    private const string UIguessrLeaderboardShard = "uiguessr";

    private readonly SnippetsRepository _snippets;
    private readonly SessionsRepository _sessions;
    private readonly ScoresRepository _scores;
    private readonly CommitsRepository _commits;
    private readonly CommitSessionsRepository _commitSessions;
    private readonly UIScreenshotsRepository _uiScreenshots;
    private readonly UISessionsRepository _uiSessions;
    private readonly OptionalJwtValidator _jwtValidator;

    public Function() : this(CreateDefaultClient())
    {
    }

    private Function(IAmazonDynamoDB client)
    {
        var snippetsTable = Environment.GetEnvironmentVariable("SNIPPETS_TABLE_NAME") ?? "techguessr-snippets";
        var sessionsTable = Environment.GetEnvironmentVariable("SESSIONS_TABLE_NAME") ?? "techguessr-sessions";
        var scoresTable = Environment.GetEnvironmentVariable("SCORES_TABLE_NAME") ?? "techguessr-scores";
        var commitsTable = Environment.GetEnvironmentVariable("COMMITS_TABLE_NAME") ?? "techguessr-commits";
        var commitSessionsTable = Environment.GetEnvironmentVariable("COMMIT_SESSIONS_TABLE_NAME") ?? "techguessr-commit-sessions";
        var uiScreenshotsTable = Environment.GetEnvironmentVariable("UI_SCREENSHOTS_TABLE_NAME") ?? "techguessr-ui-screenshots";
        var uiSessionsTable = Environment.GetEnvironmentVariable("UI_SESSIONS_TABLE_NAME") ?? "techguessr-ui-sessions";
        var userPoolId = Environment.GetEnvironmentVariable("USER_POOL_ID")
            ?? throw new InvalidOperationException("Falta la variable de entorno USER_POOL_ID.");
        var userPoolClientId = Environment.GetEnvironmentVariable("USER_POOL_CLIENT_ID")
            ?? throw new InvalidOperationException("Falta la variable de entorno USER_POOL_CLIENT_ID.");
        var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";

        _snippets = new SnippetsRepository(client, snippetsTable);
        _sessions = new SessionsRepository(client, sessionsTable);
        _scores = new ScoresRepository(client, scoresTable);
        _commits = new CommitsRepository(client, commitsTable);
        _commitSessions = new CommitSessionsRepository(client, commitSessionsTable);
        _uiScreenshots = new UIScreenshotsRepository(client, uiScreenshotsTable);
        _uiSessions = new UISessionsRepository(client, uiSessionsTable);
        _jwtValidator = new OptionalJwtValidator(userPoolId, region, userPoolClientId);
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
            // Resuelto una sola vez por invocación: las rutas de sesión ya
            // no tienen JWT authorizer de API Gateway (ver
            // infra/lib/api-stack.ts), así que la Lambda decide aquí si el
            // caller es un usuario autenticado o un invitado. Ver
            // Auth/OptionalJwtValidator.cs.
            var caller = await _jwtValidator.ResolveAsync(GetAuthorizationHeader(request));

            if (method == "POST" && path == "/sessions")
            {
                return await HandleCreateSessionAsync(request, caller);
            }
            if (method == "GET" && path == "/rounds/next")
            {
                return await HandleGetNextRoundAsync(request, caller);
            }

            var answerMatch = AnswerRoutePattern.Match(path);
            if (method == "POST" && answerMatch.Success)
            {
                return await HandleSubmitAnswerAsync(request, answerMatch.Groups["roundId"].Value, caller);
            }

            var summaryMatch = SummaryRoutePattern.Match(path);
            if (method == "GET" && summaryMatch.Success)
            {
                return await HandleGetSessionSummaryAsync(request, summaryMatch.Groups["sessionId"].Value, caller);
            }

            if (method == "GET" && path == "/leaderboard")
            {
                return await HandleGetLeaderboardAsync(request);
            }

            // CommitGuessr routes
            if (method == "POST" && path == "/commit-sessions")
            {
                return await HandleCreateCommitSessionAsync(request, caller);
            }
            if (method == "GET" && path == "/commit-rounds/next")
            {
                return await HandleGetNextCommitRoundAsync(request, caller);
            }

            var commitAnswerMatch = CommitAnswerRoutePattern.Match(path);
            if (method == "POST" && commitAnswerMatch.Success)
            {
                return await HandleSubmitCommitAnswerAsync(request, commitAnswerMatch.Groups["roundId"].Value, caller);
            }

            var commitSummaryMatch = CommitSummaryRoutePattern.Match(path);
            if (method == "GET" && commitSummaryMatch.Success)
            {
                return await HandleGetCommitSessionSummaryAsync(request, commitSummaryMatch.Groups["sessionId"].Value, caller);
            }

            if (method == "GET" && path == "/commit-leaderboard")
            {
                return await HandleGetCommitLeaderboardAsync(request);
            }

            // UIGuessr routes
            if (method == "POST" && path == "/ui-sessions")
            {
                return await HandleCreateUISessionAsync(request, caller);
            }
            if (method == "GET" && path == "/ui-rounds/next")
            {
                return await HandleGetNextUIRoundAsync(request, caller);
            }

            var uiAnswerMatch = UIAnswerRoutePattern.Match(path);
            if (method == "POST" && uiAnswerMatch.Success)
            {
                return await HandleSubmitUIAnswerAsync(request, uiAnswerMatch.Groups["roundId"].Value, caller);
            }

            var uiSummaryMatch = UISummaryRoutePattern.Match(path);
            if (method == "GET" && uiSummaryMatch.Success)
            {
                return await HandleGetUISessionSummaryAsync(request, uiSummaryMatch.Groups["sessionId"].Value, caller);
            }

            if (method == "GET" && path == "/ui-leaderboard")
            {
                return await HandleGetUILeaderboardAsync(request);
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

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleCreateSessionAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;

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

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetNextRoundAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;
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
        APIGatewayHttpApiV2ProxyRequest request, string roundId, CallerIdentity caller)
    {
        var userId = caller.UserId;
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

        if (updatedSession.Status == SessionStatus.Finished && caller.IsAuthenticated)
        {
            // Los invitados terminan la partida y ven su resumen igual,
            // pero no se guarda su puntaje en el leaderboard (Requirement
            // de negocio: "inicia sesión para guardar tu progreso").
            await _scores.RecordScoreAsync(userId, caller.Username!, updatedSession.TotalScore, updatedSession.SessionId, CodeguessrLeaderboardShard);
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
        APIGatewayHttpApiV2ProxyRequest request, string sessionId, CallerIdentity caller)
    {
        var userId = caller.UserId;

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

        var rank = await _scores.GetRankForSessionAsync(session.SessionId, session.TotalScore, CodeguessrLeaderboardShard);

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

        var entries = await _scores.GetTopAsync(limit, CodeguessrLeaderboardShard);

        var response = entries.Select(e => new LeaderboardEntryResponse(
            e.Username, e.TotalScore, e.AchievedAt.ToString("O"))).ToList();

        return JsonResponse(200, response);
    }

    /// <summary>
    /// Header Authorization crudo, buscado case-insensitive: API Gateway
    /// HTTP API normaliza los nombres de headers a minúsculas, pero se
    /// busca sin asumirlo para no depender de ese detalle de
    /// implementación.
    /// </summary>
    private static string? GetAuthorizationHeader(APIGatewayHttpApiV2ProxyRequest request)
    {
        if (request.Headers is null)
        {
            return null;
        }
        foreach (var (key, value) in request.Headers)
        {
            if (string.Equals(key, "Authorization", StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }
        }
        return null;
    }

    /// <summary>
    /// Autorización a nivel de recurso (Requirement 8): verifica que el
    /// usuario autenticado sea el propietario de la sesión antes de leer o
    /// escribir sobre ella.
    ///
    /// Nota de seguridad para invitados: todos comparten el mismo
    /// CallerIdentity.GuestUserId ("guest"), por lo que esta comparación
    /// no aísla a un invitado de otro. Para sesiones de invitado, la
    /// protección real es que SessionId es un GUID generado por el
    /// servidor (128 bits, no adivinable) — el mismo modelo de "capability
    /// token" que ya usaba el cliente para referenciar su sesión. No se
    /// persiste ni expone información sensible en una sesión de invitado
    /// (no hay leaderboard ni datos personales asociados), así que este
    /// nivel de aislamiento es aceptable para ese caso.
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

    // ============================================================================
    // CommitGuessr Handlers
    // ============================================================================

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleCreateCommitSessionAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;

        var usableCount = await _commits.CountUsableAsync();
        if (usableCount < 10)
        {
            return JsonResponse(500, new ErrorResponse("Dataset de commits insuficiente."));
        }

        var session = new CommitSessionState(
            SessionId: Guid.NewGuid().ToString(),
            UserId: userId,
            Status: SessionStatus.InProgress,
            RoundsPlayed: [],
            TotalScore: 0,
            CreatedAt: DateTimeOffset.UtcNow,
            FinishedAt: null,
            Version: 0);

        await _commitSessions.CreateAsync(session);

        return JsonResponse(201, new SessionCreatedResponse(session.SessionId, CommitSessionState.TotalRounds));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetNextCommitRoundAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;
        string? sessionId = null;
        request.QueryStringParameters?.TryGetValue("sessionId", out sessionId);
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            return JsonResponse(400, new ErrorResponse("Falta el parámetro sessionId."));
        }

        var session = await _commitSessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureCommitSessionOwnership(session, userId);

        CommitSessionTransitions.EnsureCanRequestNextRound(session);

        // Excluye los commits ya jugados en esta sesión para evitar
        // repeticiones dentro de la misma partida (ver comentario en
        // CommitsRepository.GetRandomCommitAsync).
        var playedCommitIds = session.RoundsPlayed.Select(r => r.CommitId).ToHashSet();
        var commit = await _commits.GetRandomCommitAsync(playedCommitIds);
        if (commit is null)
        {
            return JsonResponse(500, new ErrorResponse("No hay commits disponibles."));
        }

        var newRound = new CommitRoundRecord(
            RoundId: Guid.NewGuid().ToString(),
            CommitId: commit.CommitId,
            RoundIndex: session.RoundsPlayed.Count + 1,
            StartedAt: DateTimeOffset.UtcNow,
            AnsweredAt: null,
            Guesses: null,
            Correctness: null,
            Score: 0);

        var updatedSession = CommitSessionTransitions.AppendNewRound(session, newRound);
        await _commitSessions.SaveAsync(updatedSession, session.Version);

        // El dataset guarda correctMessage siempre como la primera entrada
        // de MessageOptions; se mezcla el orden antes de responder para que
        // la posición no delate la respuesta correcta (ver Requirement de
        // UX: evitar que "la primera opción siempre es la correcta" sea una
        // ayuda involuntaria).
        var shuffledMessageOptions = ListShuffler.Shuffle(commit.MessageOptions);

        return JsonResponse(200, new CommitRoundResponse(
            newRound.RoundId, newRound.RoundIndex, commit.Diff, shuffledMessageOptions, commit.Difficulty));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleSubmitCommitAnswerAsync(
        APIGatewayHttpApiV2ProxyRequest request, string roundId, CallerIdentity caller)
    {
        var userId = caller.UserId;
        var body = JsonSerializer.Deserialize<CommitAnswerSubmissionRequest>(request.Body ?? "{}", RequestJsonOptions);
        if (body is null || string.IsNullOrWhiteSpace(body.SessionId))
        {
            return JsonResponse(400, new ErrorResponse("Body inválido."));
        }

        var session = await _commitSessions.GetAsync(body.SessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureCommitSessionOwnership(session, userId);

        var round = session.RoundsPlayed.FirstOrDefault(r => r.RoundId == roundId);
        if (round is null)
        {
            return JsonResponse(404, new ErrorResponse("La ronda no existe o no pertenece a la sesión."));
        }

        var commit = await _commits.GetByIdAsync(round.CommitId);
        if (commit is null)
        {
            return JsonResponse(500, new ErrorResponse("Commit referenciado no encontrado."));
        }

        var answeredAt = DateTimeOffset.UtcNow;

        var guess = new CommitGuess(
            body.Guess.CommitType,
            body.Guess.Message,
            body.Guess.EffortMinutes,
            body.Guess.FilesModified);
        
        var correctAnswers = CommitsRepository.ToCorrectAnswers(commit);

        var scoringResult = CommitScoring.CalculateRoundScore(guess, correctAnswers);

        var updatedSession = CommitSessionTransitions.ApplyAnswer(
            session, roundId, guess, scoringResult.Correctness, scoringResult.RoundScore, answeredAt);

        await _commitSessions.SaveAsync(updatedSession, session.Version);

        if (updatedSession.Status == SessionStatus.Finished && caller.IsAuthenticated)
        {
            await _scores.RecordScoreAsync(userId, caller.Username!, updatedSession.TotalScore, updatedSession.SessionId, CommitguessrLeaderboardShard);
        }

        return JsonResponse(200, new CommitAnswerResultResponse(
            new CommitCorrectnessResponse(
                scoringResult.Correctness.CommitType,
                scoringResult.Correctness.Message,
                scoringResult.Correctness.EffortEstimate,
                scoringResult.Correctness.FilesModified),
            new CommitCorrectAnswersResponse(
                correctAnswers.CommitType,
                correctAnswers.Message,
                correctAnswers.EffortMinutes,
                correctAnswers.FilesModified),
            commit.Explanation,
            scoringResult.RoundScore,
            updatedSession.TotalScore,
            updatedSession.Status == SessionStatus.Finished));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetCommitSessionSummaryAsync(
        APIGatewayHttpApiV2ProxyRequest request, string sessionId, CallerIdentity caller)
    {
        var userId = caller.UserId;

        var session = await _commitSessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureCommitSessionOwnership(session, userId);

        if (session.Status != SessionStatus.Finished)
        {
            return JsonResponse(409, new ErrorResponse("La sesión todavía está en progreso."));
        }

        var rank = await _scores.GetRankForSessionAsync(session.SessionId, session.TotalScore, CommitguessrLeaderboardShard);

        var rounds = session.RoundsPlayed.Select(r => new CommitRoundSummaryResponse(
            r.RoundId,
            r.RoundIndex,
            r.Correctness is null ? null : new CommitCorrectnessResponse(
                r.Correctness.CommitType,
                r.Correctness.Message,
                r.Correctness.EffortEstimate,
                r.Correctness.FilesModified),
            r.Score)).ToList();

        return JsonResponse(200, new CommitSessionSummaryResponse(session.SessionId, session.TotalScore, rounds, rank));
    }

    private static void EnsureCommitSessionOwnership(CommitSessionState session, string userId)
    {
        if (session.UserId != userId)
        {
            throw new ForbiddenException();
        }
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetCommitLeaderboardAsync(APIGatewayHttpApiV2ProxyRequest request)
    {
        int? limit = null;
        if (request.QueryStringParameters?.TryGetValue("limit", out var limitRaw) == true
            && int.TryParse(limitRaw, out var parsedLimit))
        {
            limit = parsedLimit;
        }

        var entries = await _scores.GetTopAsync(limit, CommitguessrLeaderboardShard);

        var response = entries.Select(e => new LeaderboardEntryResponse(
            e.Username, e.TotalScore, e.AchievedAt.ToString("O"))).ToList();

        return JsonResponse(200, response);
    }

    // ============================================================================
    // UIGuessr Handlers
    // ============================================================================

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleCreateUISessionAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;

        var usableCount = await _uiScreenshots.CountUsableAsync();
        if (usableCount < 10)
        {
            return JsonResponse(500, new ErrorResponse("Dataset de screenshots insuficiente."));
        }

        var session = new UISessionState(
            SessionId: Guid.NewGuid().ToString(),
            UserId: userId,
            Status: SessionStatus.InProgress,
            RoundsPlayed: [],
            TotalScore: 0,
            CreatedAt: DateTimeOffset.UtcNow,
            FinishedAt: null,
            Version: 0);

        await _uiSessions.CreateAsync(session);

        return JsonResponse(201, new SessionCreatedResponse(session.SessionId, UISessionState.TotalRounds));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetNextUIRoundAsync(APIGatewayHttpApiV2ProxyRequest request, CallerIdentity caller)
    {
        var userId = caller.UserId;
        string? sessionId = null;
        request.QueryStringParameters?.TryGetValue("sessionId", out sessionId);
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            return JsonResponse(400, new ErrorResponse("Falta el parámetro sessionId."));
        }

        var session = await _uiSessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureUISessionOwnership(session, userId);

        UISessionTransitions.EnsureCanRequestNextRound(session);

        // Excluye los screenshots ya jugados en esta sesión para evitar
        // repeticiones dentro de la misma partida (análogo a CommitGuessr).
        var playedScreenshotIds = session.RoundsPlayed.Select(r => r.ScreenshotId).ToHashSet();
        var screenshot = await _uiScreenshots.GetRandomScreenshotAsync(playedScreenshotIds);
        if (screenshot is null)
        {
            return JsonResponse(500, new ErrorResponse("No hay screenshots disponibles."));
        }

        var newRound = new UIRoundRecord(
            RoundId: Guid.NewGuid().ToString(),
            ScreenshotId: screenshot.ScreenshotId,
            RoundIndex: session.RoundsPlayed.Count + 1,
            StartedAt: DateTimeOffset.UtcNow,
            AnsweredAt: null,
            Guesses: null,
            Correctness: null,
            Score: 0);

        var updatedSession = UISessionTransitions.AppendNewRound(session, newRound);
        await _uiSessions.SaveAsync(updatedSession, session.Version);

        return JsonResponse(200, new UIRoundResponse(
            newRound.RoundId, newRound.RoundIndex, screenshot.ImageUrl, screenshot.Difficulty));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleSubmitUIAnswerAsync(
        APIGatewayHttpApiV2ProxyRequest request, string roundId, CallerIdentity caller)
    {
        var userId = caller.UserId;
        var body = JsonSerializer.Deserialize<UIAnswerSubmissionRequest>(request.Body ?? "{}", RequestJsonOptions);
        if (body is null || string.IsNullOrWhiteSpace(body.SessionId))
        {
            return JsonResponse(400, new ErrorResponse("Body inválido."));
        }

        var session = await _uiSessions.GetAsync(body.SessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureUISessionOwnership(session, userId);

        var round = session.RoundsPlayed.FirstOrDefault(r => r.RoundId == roundId);
        if (round is null)
        {
            return JsonResponse(404, new ErrorResponse("La ronda no existe o no pertenece a la sesión."));
        }

        var screenshot = await _uiScreenshots.GetByIdAsync(round.ScreenshotId);
        if (screenshot is null)
        {
            return JsonResponse(500, new ErrorResponse("Screenshot referenciado no encontrado."));
        }

        var answeredAt = DateTimeOffset.UtcNow;

        var guess = new UIGuess(body.Guess.App, body.Guess.Action, body.Guess.Year);
        var correctAnswers = UIScreenshotsRepository.ToCorrectAnswers(screenshot);

        var scoringResult = UIScoring.CalculateRoundScore(guess, correctAnswers);

        var updatedSession = UISessionTransitions.ApplyAnswer(
            session, roundId, guess, scoringResult.Correctness, scoringResult.RoundScore, answeredAt);

        await _uiSessions.SaveAsync(updatedSession, session.Version);

        if (updatedSession.Status == SessionStatus.Finished && caller.IsAuthenticated)
        {
            await _scores.RecordScoreAsync(userId, caller.Username!, updatedSession.TotalScore, updatedSession.SessionId, UIguessrLeaderboardShard);
        }

        return JsonResponse(200, new UIAnswerResultResponse(
            new UICorrectnessResponse(
                scoringResult.Correctness.App,
                scoringResult.Correctness.Action,
                scoringResult.Correctness.Year,
                scoringResult.Correctness.YearDiff),
            new UICorrectAnswersResponse(
                correctAnswers.App,
                correctAnswers.Action,
                correctAnswers.Year),
            screenshot.Explanation,
            scoringResult.RoundScore,
            updatedSession.TotalScore,
            updatedSession.Status == SessionStatus.Finished));
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetUISessionSummaryAsync(
        APIGatewayHttpApiV2ProxyRequest request, string sessionId, CallerIdentity caller)
    {
        var userId = caller.UserId;

        var session = await _uiSessions.GetAsync(sessionId);
        if (session is null)
        {
            return JsonResponse(404, new ErrorResponse("Sesión no encontrada."));
        }
        EnsureUISessionOwnership(session, userId);

        if (session.Status != SessionStatus.Finished)
        {
            return JsonResponse(409, new ErrorResponse("La sesión todavía está en progreso."));
        }

        var rank = await _scores.GetRankForSessionAsync(session.SessionId, session.TotalScore, UIguessrLeaderboardShard);

        var rounds = session.RoundsPlayed.Select(r => new UIRoundSummaryResponse(
            r.RoundId,
            r.RoundIndex,
            r.Correctness is null ? null : new UICorrectnessResponse(
                r.Correctness.App,
                r.Correctness.Action,
                r.Correctness.Year,
                r.Correctness.YearDiff),
            r.Score)).ToList();

        return JsonResponse(200, new UISessionSummaryResponse(session.SessionId, session.TotalScore, rounds, rank));
    }

    private static void EnsureUISessionOwnership(UISessionState session, string userId)
    {
        if (session.UserId != userId)
        {
            throw new ForbiddenException();
        }
    }

    private async Task<APIGatewayHttpApiV2ProxyResponse> HandleGetUILeaderboardAsync(APIGatewayHttpApiV2ProxyRequest request)
    {
        int? limit = null;
        if (request.QueryStringParameters?.TryGetValue("limit", out var limitRaw) == true
            && int.TryParse(limitRaw, out var parsedLimit))
        {
            limit = parsedLimit;
        }

        var entries = await _scores.GetTopAsync(limit, UIguessrLeaderboardShard);

        var response = entries.Select(e => new LeaderboardEntryResponse(
            e.Username, e.TotalScore, e.AchievedAt.ToString("O"))).ToList();

        return JsonResponse(200, response);
    }
}

/// <summary>Usuario autenticado sin permiso sobre el recurso solicitado (403).</summary>
public sealed class ForbiddenException() : Exception("Acceso denegado.");
