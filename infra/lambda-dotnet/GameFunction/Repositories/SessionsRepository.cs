using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GameFunction.Domain;

namespace GameFunction.Repositories;

/// <summary>
/// Excepción lanzada cuando una escritura condicional falla porque otra
/// operación modificó el ítem entre la lectura y la escritura (optimistic
/// locking vía atributo `version`). El caller la trata como 409/reintento.
/// </summary>
public sealed class ConcurrentModificationException() : Exception("La sesión fue modificada concurrentemente.");

/// <summary>
/// Acceso a la tabla `techguessr-sessions`. RoundsPlayed se serializa como
/// un único atributo JSON (string) en vez de una lista nativa de DynamoDB de
/// mapas anidados: simplifica la lectura/escritura completa del ítem y sigue
/// permitiendo la escritura atómica condicional exigida por design.md,
/// porque el ítem entero se reemplaza en una sola operación UpdateItem con
/// condición sobre `version` (optimistic locking), sin necesitar
/// operaciones de "append" parciales sobre una lista de DynamoDB.
/// </summary>
public sealed class SessionsRepository(IAmazonDynamoDB client, string tableName)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = null };

    public async Task CreateAsync(SessionState session, CancellationToken ct = default)
    {
        await client.PutItemAsync(new PutItemRequest
        {
            TableName = tableName,
            Item = ToItem(session),
            ConditionExpression = "attribute_not_exists(sessionId)",
        }, ct);
    }

    public async Task<SessionState?> GetAsync(string sessionId, CancellationToken ct = default)
    {
        var response = await client.GetItemAsync(new GetItemRequest
        {
            TableName = tableName,
            Key = new Dictionary<string, AttributeValue> { ["sessionId"] = new() { S = sessionId } },
        }, ct);

        return response.Item.Count == 0 ? null : FromItem(response.Item);
    }

    /// <summary>
    /// Reemplaza el ítem completo de la sesión, condicionado a que `version`
    /// siga siendo la misma que se leyó (optimistic locking). Si otra
    /// escritura ganó la carrera, lanza ConcurrentModificationException.
    /// </summary>
    public async Task SaveAsync(SessionState session, long expectedVersion, CancellationToken ct = default)
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

    private static Dictionary<string, AttributeValue> ToItem(SessionState session) => new()
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

    private static SessionState FromItem(Dictionary<string, AttributeValue> item) => new(
        SessionId: item["sessionId"].S,
        UserId: item["userId"].S,
        Status: item["status"].S == "finished" ? SessionStatus.Finished : SessionStatus.InProgress,
        RoundsPlayed: JsonSerializer.Deserialize<List<RoundRecord>>(item["roundsPlayed"].S, JsonOptions) ?? [],
        TotalScore: int.Parse(item["totalScore"].N),
        CreatedAt: DateTimeOffset.Parse(item["createdAt"].S),
        FinishedAt: item.TryGetValue("finishedAt", out var f) && f.NULL != true ? DateTimeOffset.Parse(f.S) : null,
        Version: long.Parse(item["version"].N));
}
