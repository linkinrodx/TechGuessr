using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GameFunction.Domain;

namespace GameFunction.Repositories;

public sealed record UIScreenshotRecord(
    string ScreenshotId,
    string ImageUrl,
    string App,
    string Action,
    int Year,
    string Difficulty,
    string Explanation);

/// <summary>
/// Acceso a la tabla `techguessr-ui-screenshots`. Usa el GSI byRandomBucket
/// para seleccionar un screenshot al azar sin Scan. Análoga a
/// CommitsRepository (excluye los ya jugados en la sesión actual para
/// evitar repeticiones dentro de la misma partida).
/// </summary>
public sealed class UIScreenshotsRepository(IAmazonDynamoDB client, string tableName)
{
    private const int RandomBucketCount = 10;

    public async Task<UIScreenshotRecord?> GetRandomScreenshotAsync(
        IReadOnlySet<string>? excludeScreenshotIds = null, CancellationToken ct = default)
    {
        var bucketOrder = Enumerable.Range(0, RandomBucketCount)
            .OrderBy(_ => Random.Shared.Next())
            .ToList();

        foreach (var bucket in bucketOrder)
        {
            var response = await client.QueryAsync(new QueryRequest
            {
                TableName = tableName,
                IndexName = "byRandomBucket",
                KeyConditionExpression = "randomBucket = :bucket",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":bucket"] = new() { N = bucket.ToString() },
                },
                Limit = 25,
            }, ct);

            var candidates = response.Items
                .Where(item => excludeScreenshotIds is null || !excludeScreenshotIds.Contains(item["screenshotId"].S))
                .ToList();

            if (candidates.Count > 0)
            {
                var chosen = candidates[Random.Shared.Next(candidates.Count)];
                return MapToRecord(chosen);
            }
        }

        // Todos los buckets con datos tenían únicamente screenshots ya
        // excluidos: se cae a "cualquier screenshot disponible" en vez de
        // fallar la ronda (misma filosofía que CommitsRepository).
        if (excludeScreenshotIds is null)
        {
            return null;
        }
        return await GetRandomScreenshotAsync(excludeScreenshotIds: null, ct);
    }

    public async Task<UIScreenshotRecord?> GetByIdAsync(string screenshotId, CancellationToken ct = default)
    {
        var response = await client.GetItemAsync(new GetItemRequest
        {
            TableName = tableName,
            Key = new Dictionary<string, AttributeValue> { ["screenshotId"] = new() { S = screenshotId } },
        }, ct);

        return response.Item.Count == 0 ? null : MapToRecord(response.Item);
    }

    public async Task<int> CountUsableAsync(CancellationToken ct = default)
    {
        var response = await client.ScanAsync(new ScanRequest
        {
            TableName = tableName,
            Select = "COUNT",
        }, ct);

        return response.Count ?? 0;
    }

    public static UICorrectAnswers ToCorrectAnswers(UIScreenshotRecord screenshot) =>
        new(screenshot.App, screenshot.Action, screenshot.Year);

    private static UIScreenshotRecord MapToRecord(Dictionary<string, AttributeValue> item) => new(
        ScreenshotId: item["screenshotId"].S,
        ImageUrl: item["imageUrl"].S,
        App: item["app"].S,
        Action: item["action"].S,
        Year: int.Parse(item["year"].N),
        Difficulty: item.TryGetValue("difficulty", out var d) ? d.S : "medium",
        Explanation: item.TryGetValue("explanation", out var e) ? e.S : string.Empty);
}
