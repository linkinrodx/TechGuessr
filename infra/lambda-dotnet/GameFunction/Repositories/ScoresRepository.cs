using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace GameFunction.Repositories;

public sealed record LeaderboardEntry(string Username, int TotalScore, DateTimeOffset AchievedAt);

/// <summary>
/// Acceso a la tabla `techguessr-scores`, compartida por todas las
/// modalidades de juego. Cada modalidad usa su propio valor de
/// `leaderboardShard` (partition key del GSI byTotalScore) para mantener
/// rankings independientes dentro de la misma tabla física: sin esta
/// separación, un modo con techo de puntaje más alto (ej. CommitGuessr,
/// 1800 pts/ronda) dominaría siempre el ranking de un modo con techo más
/// bajo (ej. CodeGuessr, 300 pts/ronda). Ver Function.cs, constantes
/// *LeaderboardShard.
/// </summary>
public sealed class ScoresRepository(IAmazonDynamoDB client, string tableName)
{
    private const int DefaultLimit = 20;
    private const int MaxLimit = 50;

    public async Task RecordScoreAsync(
        string userId, string username, int totalScore, string sessionId, string leaderboardShard, CancellationToken ct = default)
    {
        await client.PutItemAsync(new PutItemRequest
        {
            TableName = tableName,
            Item = new Dictionary<string, AttributeValue>
            {
                ["scoreId"] = new() { S = Guid.NewGuid().ToString() },
                ["userId"] = new() { S = userId },
                ["username"] = new() { S = username },
                ["totalScore"] = new() { N = totalScore.ToString() },
                ["sessionId"] = new() { S = sessionId },
                ["achievedAt"] = new() { S = DateTimeOffset.UtcNow.ToString("O") },
                ["leaderboardShard"] = new() { S = leaderboardShard },
            },
        }, ct);
    }

    public async Task<List<LeaderboardEntry>> GetTopAsync(int? limit, string leaderboardShard, CancellationToken ct = default)
    {
        var effectiveLimit = Math.Clamp(limit ?? DefaultLimit, 1, MaxLimit);

        var response = await client.QueryAsync(new QueryRequest
        {
            TableName = tableName,
            IndexName = "byTotalScore",
            KeyConditionExpression = "leaderboardShard = :shard",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":shard"] = new() { S = leaderboardShard },
            },
            ScanIndexForward = false, // descendente: mayor totalScore primero
            Limit = effectiveLimit,
        }, ct);

        return response.Items.Select(item => new LeaderboardEntry(
            item["username"].S,
            int.Parse(item["totalScore"].N),
            DateTimeOffset.Parse(item["achievedAt"].S))).ToList();
    }

    /// <summary>
    /// Posición (1-based) de una sesión en el leaderboard de un shard
    /// específico, calculada best-effort contando cuántas entradas tienen
    /// un totalScore mayor. Devuelve null si no se encuentra la entrada de
    /// la sesión.
    /// </summary>
    public async Task<int?> GetRankForSessionAsync(string sessionId, int totalScore, string leaderboardShard, CancellationToken ct = default)
    {
        var response = await client.QueryAsync(new QueryRequest
        {
            TableName = tableName,
            IndexName = "byTotalScore",
            KeyConditionExpression = "leaderboardShard = :shard AND totalScore >= :score",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":shard"] = new() { S = leaderboardShard },
                [":score"] = new() { N = totalScore.ToString() },
            },
            ScanIndexForward = false,
        }, ct);

        var entries = response.Items
            .Select(item => (SessionId: item["sessionId"].S, Score: int.Parse(item["totalScore"].N)))
            .ToList();

        var index = entries.FindIndex(e => e.SessionId == sessionId);
        return index < 0 ? null : index + 1;
    }
}
