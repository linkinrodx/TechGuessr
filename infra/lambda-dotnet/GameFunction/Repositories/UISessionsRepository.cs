using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GameFunction.Domain;

namespace GameFunction.Repositories;

/// <summary>
/// Acceso a la tabla `techguessr-ui-sessions`. Análogo a
/// CommitSessionsRepository pero para el modo UIGuessr.
/// RoundsPlayed se serializa como un único atributo JSON (string).
/// </summary>
public sealed class UISessionsRepository(IAmazonDynamoDB client, string tableName)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = null };

    public async Task CreateAsync(UISessionState session, CancellationToken ct = default)
    {
        await client.PutItemAsync(new PutItemRequest
        {
            TableName = tableName,
            Item = ToItem(session),
            ConditionExpression = "attribute_not_exists(sessionId)",
        }, ct);
    }

    public async Task<UISessionState?> GetAsync(string sessionId, CancellationToken ct = default)
    {
        var response = await client.GetItemAsync(new GetItemRequest
        {
            TableName = tableName,
            Key = new Dictionary<string, AttributeValue> { ["sessionId"] = new() { S = sessionId } },
        }, ct);

        return response.Item.Count == 0 ? null : FromItem(response.Item);
    }

    /// <summary>
    /// Reemplaza el ítem completo de la sesión UIGuessr, condicionado a que
    /// `version` siga siendo la misma (optimistic locking).
    /// </summary>
    public async Task SaveAsync(UISessionState session, long expectedVersion, CancellationToken ct = default)
    {
        var updated = session with { Version = expectedVersion + 1 };

        try
        {
            await client.PutItemAsync(new PutItemRequest
            {
                TableName = tableName,
                Item = ToItem(updated),
                ConditionExpression = "version = :expectedVersion",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":expectedVersion"] = new() { N = expectedVersion.ToString() },
                },
            }, ct);
        }
        catch (ConditionalCheckFailedException)
        {
            throw new ConcurrentModificationException();
        }
    }

    private static Dictionary<string, AttributeValue> ToItem(UISessionState session) => new()
    {
        ["sessionId"] = new() { S = session.SessionId },
        ["userId"] = new() { S = session.UserId },
        ["status"] = new() { S = session.Status == SessionStatus.Finished ? "finished" : "in_progress" },
        ["roundsPlayed"] = new() { S = JsonSerializer.Serialize(session.RoundsPlayed, JsonOptions) },
        ["totalScore"] = new() { N = session.TotalScore.ToString() },
        ["createdAt"] = new() { S = session.CreatedAt.ToString("O") },
        ["finishedAt"] = session.FinishedAt is null
            ? new AttributeValue { NULL = true }
            : new AttributeValue { S = session.FinishedAt.Value.ToString("O") },
        ["version"] = new() { N = session.Version.ToString() },
    };

    private static UISessionState FromItem(Dictionary<string, AttributeValue> item) => new(
        SessionId: item["sessionId"].S,
        UserId: item["userId"].S,
        Status: item["status"].S == "finished" ? SessionStatus.Finished : SessionStatus.InProgress,
        RoundsPlayed: JsonSerializer.Deserialize<List<UIRoundRecord>>(item["roundsPlayed"].S, JsonOptions) ?? [],
        TotalScore: int.Parse(item["totalScore"].N),
        CreatedAt: DateTimeOffset.Parse(item["createdAt"].S),
        FinishedAt: item.TryGetValue("finishedAt", out var f) && f.NULL != true ? DateTimeOffset.Parse(f.S) : null,
        Version: long.Parse(item["version"].N));
}
