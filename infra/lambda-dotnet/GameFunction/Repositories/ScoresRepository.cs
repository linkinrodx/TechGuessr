using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace GameFunction.Repositories;

public sealed record LeaderboardEntry(string Username, int TotalScore, DateTimeOffset AchievedAt);

/// <summary>
/// Acceso a la tabla `techguessr-scores`. Todo el leaderboard vive en una
/// sola partición lógica (`leaderboardShard`) para poder ordenar globalmente
/// por totalScore con una sola Query sobre el GSI byTotalScore (ver
/// infra/lib/data-stack.ts).
/// </summary>
public sealed class ScoresRepository(IAmazonDynamoDB client, string tableName)
{
    private const string LeaderboardShardValue = "global";
    private const int DefaultLimit = 20;
    private const int MaxLimit = 50;

    public async Task RecordScoreAsync(string userId, string username, int totalScore, string sessionId, CancellationToken ct = default)
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
                ["leaderboardShard"] = new() { S = LeaderboardShardValue },
            },
        }, ct);
    }

    public async Task<List<LeaderboardEntry>> GetTopAsync(int? limit, CancellationToken ct = default)
    {
        var effectiveLimit = Math.Clamp(limit ?? DefaultLimit, 1, MaxLimit);

        var response = await client.QueryAsync(new QueryRequest
        {
            TableName = tableName,
            IndexName = "byTotalScore",
            KeyConditionExpression = "leaderboardShard = :shard",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":shard"] = new() { S = LeaderboardShardValue },
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
    /// Posición (1-based) de una sesión en el leaderboard, calculada
    /// best-effort contando cuántas entradas tienen un totalScore mayor.
    /// Devuelve null si no se encuentra la entrada de la sesión.
    /// </summary>
    public async Task<int?> GetRankForSessionAsync(string sessionId, int totalScore, CancellationToken ct = default)
    {
        var response = await client.QueryAsync(new QueryRequest
        {
            TableName = tableName,
            IndexName = "byTotalScore",
            KeyConditionExpression = "leaderboardShard = :shard AND totalScore >= :score",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":shard"] = new() { S = LeaderboardShardValue },
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
