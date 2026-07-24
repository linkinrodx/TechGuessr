using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using GameFunction.Domain;

namespace GameFunction.Repositories;

public sealed record SnippetRecord(
    string SnippetId,
    string Code,
    string Language,
    string? Framework,
    string? Project,
    string Difficulty,
    string Explanation);

/// <summary>
/// Acceso a la tabla `techguessr-snippets`. Usa el GSI byRandomBucket para
/// seleccionar un snippet al azar sin Scan (ver design.md, "Consideraciones
/// de Rendimiento" y infra/lib/data-stack.ts).
/// </summary>
public sealed class SnippetsRepository(IAmazonDynamoDB client, string tableName)
{
    private const int RandomBucketCount = 10;

    public async Task<SnippetRecord?> GetRandomSnippetAsync(CancellationToken ct = default)
    {
        // Con un dataset pequeño (ej. 16 snippets en 10 buckets), varios
        // buckets pueden quedar vacíos por azar de la distribución. Se
        // recorren todos los buckets en orden aleatorio hasta encontrar uno
        // con datos, en vez de rendirse tras un solo reintento.
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

            if (response.Items.Count > 0)
            {
                var chosen = response.Items[Random.Shared.Next(response.Items.Count)];
                return MapToRecord(chosen);
            }
        }

        return null;
    }

    public async Task<SnippetRecord?> GetByIdAsync(string snippetId, CancellationToken ct = default)
    {
        var response = await client.GetItemAsync(new GetItemRequest
        {
            TableName = tableName,
            Key = new Dictionary<string, AttributeValue> { ["snippetId"] = new() { S = snippetId } },
        }, ct);

        return response.Item.Count == 0 ? null : MapToRecord(response.Item);
    }

    public async Task<int> CountUsableAsync(CancellationToken ct = default)
    {
        // Scan aceptado aquí porque solo se usa en la creación de sesión
        // (baja frecuencia), no en el flujo caliente de juego. Ver
        // Requirement 2.3.
        var response = await client.ScanAsync(new ScanRequest
        {
            TableName = tableName,
            Select = "COUNT",
        }, ct);

        return response.Count ?? 0;
    }

    public static CorrectAnswers ToCorrectAnswers(SnippetRecord snippet) =>
        new(snippet.Language, snippet.Framework, snippet.Project);

    private static SnippetRecord MapToRecord(Dictionary<string, AttributeValue> item) => new(
        SnippetId: item["snippetId"].S,
        Code: item["code"].S,
        Language: item["language"].S,
        Framework: item.TryGetValue("framework", out var fw) && fw.NULL != true ? fw.S : null,
        Project: item.TryGetValue("project", out var pr) && pr.NULL != true ? pr.S : null,
        Difficulty: item.TryGetValue("difficulty", out var d) ? d.S : "medium",
        Explanation: item.TryGetValue("explanation", out var e) ? e.S : string.Empty);
}
