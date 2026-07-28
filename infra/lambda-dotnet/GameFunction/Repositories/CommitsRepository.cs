using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GameFunction.Domain;

namespace GameFunction.Repositories;

public sealed record CommitRecord(
    string CommitId,
    string Diff,
    string CommitType,
    string CorrectMessage,
    List<string> MessageOptions,
    int EffortMinutes,
    int FilesModified,
    string Difficulty,
    string Explanation);

/// <summary>
/// Acceso a la tabla `techguessr-commits`. Usa el GSI byRandomBucket para
/// seleccionar un commit al azar sin Scan (análogo a SnippetsRepository).
/// </summary>
public sealed class CommitsRepository(IAmazonDynamoDB client, string tableName)
{
    private const int RandomBucketCount = 10;

    /// <summary>
    /// Selecciona un commit al azar, excluyendo los ids en
    /// <paramref name="excludeCommitIds"/> (commits ya jugados en la
    /// sesión actual). Con un dataset pequeño (10 commits para 10 rondas),
    /// sin esta exclusión sería bastante probable repetir un commit dentro
    /// de la misma partida (problema del cumpleaños); a diferencia de la
    /// deduplicación solo-consecutiva de SnippetsRepository, aquí se
    /// filtra contra toda la sesión.
    /// </summary>
    public async Task<CommitRecord?> GetRandomCommitAsync(
        IReadOnlySet<string>? excludeCommitIds = null, CancellationToken ct = default)
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
                .Where(item => excludeCommitIds is null || !excludeCommitIds.Contains(item["commitId"].S))
                .ToList();

            if (candidates.Count > 0)
            {
                var chosen = candidates[Random.Shared.Next(candidates.Count)];
                return MapToRecord(chosen);
            }
        }

        // Todos los buckets con datos tenían únicamente commits ya
        // excluidos (ej. dataset agotado en una sesión larga): se cae a
        // "cualquier commit disponible" en vez de fallar la ronda, misma
        // filosofía que la Opción B anterior (mejor repetir que bloquear).
        // Se evita la recursión si ya se había buscado sin exclusión (el
        // dataset estaría realmente vacío, ver CountUsableAsync).
        if (excludeCommitIds is null)
        {
            return null;
        }
        return await GetRandomCommitAsync(excludeCommitIds: null, ct);
    }

    public async Task<CommitRecord?> GetByIdAsync(string commitId, CancellationToken ct = default)
    {
        var response = await client.GetItemAsync(new GetItemRequest
        {
            TableName = tableName,
            Key = new Dictionary<string, AttributeValue> { ["commitId"] = new() { S = commitId } },
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

    public static CommitCorrectAnswers ToCorrectAnswers(CommitRecord commit) =>
        new(commit.CommitType, commit.CorrectMessage, commit.EffortMinutes, commit.FilesModified);

    private static CommitRecord MapToRecord(Dictionary<string, AttributeValue> item) => new(
        CommitId: item["commitId"].S,
        Diff: item["diff"].S,
        CommitType: item["commitType"].S,
        CorrectMessage: item["correctMessage"].S,
        MessageOptions: item["messageOptions"].L.Select(v => v.S).ToList(),
        EffortMinutes: int.Parse(item["effortMinutes"].N),
        FilesModified: int.Parse(item["filesModified"].N),
        Difficulty: item.TryGetValue("difficulty", out var d) ? d.S : "medium",
        Explanation: item.TryGetValue("explanation", out var e) ? e.S : string.Empty);
}
