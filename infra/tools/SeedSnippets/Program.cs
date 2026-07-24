using System.Text.Json;
using System.Text.Json.Serialization;
using Amazon;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

// Script de carga del dataset curado de snippets a la tabla `techguessr-snippets`.
// Ver .kiro/specs/codeguessr-mvp/tasks.md, tarea 2.2, y design.md (Data Models).
//
// Uso:
//   $env:AWS_PROFILE = "techguessr"   (credenciales ya configuradas con `aws configure`)
//   dotnet run -- [ruta-json] [nombre-tabla] [region]
//
// Todos los argumentos son opcionales:
//   ruta-json    default: ../../../src/app/data/snippets.json (relativa a este proyecto)
//   nombre-tabla default: techguessr-snippets
//   region       default: variable de entorno AWS_REGION, o us-east-1

const int MinUsableSnippets = 10;
const int RandomBucketCount = 10; // buckets 0..9, ver GSI byRandomBucket en data-stack.ts
const int DynamoBatchLimit = 25;  // límite de AWS para BatchWriteItem

var jsonPath = args.Length > 0 ? args[0] : "../../../src/app/data/snippets.json";
var tableName = args.Length > 1 ? args[1] : "techguessr-snippets";
var region = args.Length > 2 ? args[2] : Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";

var fullJsonPath = Path.GetFullPath(jsonPath);
if (!File.Exists(fullJsonPath))
{
    Console.Error.WriteLine($"No se encontró el archivo de dataset: {fullJsonPath}");
    return 1;
}

var json = await File.ReadAllTextAsync(fullJsonPath);
var snippets = JsonSerializer.Deserialize<List<SnippetSeed>>(json, new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
});

if (snippets is null || snippets.Count == 0)
{
    Console.Error.WriteLine("El dataset está vacío o no se pudo deserializar.");
    return 1;
}

// Validaciones (ver Requirement 10 en requirements.md):
var usable = snippets.Where(IsUsable).ToList();
if (usable.Count < MinUsableSnippets)
{
    Console.Error.WriteLine(
        $"El dataset tiene {usable.Count} snippets utilizables; se requieren al menos {MinUsableSnippets}.");
    return 1;
}

var invalidFrameworkProject = snippets.Where(s => s.Framework is null && s.Project is not null).ToList();
if (invalidFrameworkProject.Count > 0)
{
    Console.Error.WriteLine(
        $"Regla violada: {invalidFrameworkProject.Count} snippet(s) tienen framework=null pero project!=null. IDs: " +
        string.Join(", ", invalidFrameworkProject.Select(s => s.SnippetId)));
    return 1;
}

var duplicateIds = snippets.GroupBy(s => s.SnippetId).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
if (duplicateIds.Count > 0)
{
    Console.Error.WriteLine($"snippetId duplicados: {string.Join(", ", duplicateIds)}");
    return 1;
}

Console.WriteLine($"Dataset válido: {snippets.Count} snippets ({usable.Count} utilizables). Cargando a '{tableName}' en {region}...");

using var client = new AmazonDynamoDBClient(RegionEndpoint.GetBySystemName(region));
var random = Random.Shared;

var writeRequests = snippets.Select(s => new WriteRequest
{
    PutRequest = new PutRequest
    {
        Item = new Dictionary<string, AttributeValue>
        {
            ["snippetId"] = new() { S = s.SnippetId },
            ["code"] = new() { S = s.Code },
            ["language"] = new() { S = s.Language },
            ["framework"] = s.Framework is null ? new AttributeValue { NULL = true } : new AttributeValue { S = s.Framework },
            ["project"] = s.Project is null ? new AttributeValue { NULL = true } : new AttributeValue { S = s.Project },
            ["difficulty"] = new() { S = s.Difficulty },
            ["explanation"] = new() { S = s.Explanation },
            ["randomBucket"] = new() { N = random.Next(0, RandomBucketCount).ToString() },
        },
    },
}).ToList();

var loaded = 0;
foreach (var chunk in Chunk(writeRequests, DynamoBatchLimit))
{
    var request = new BatchWriteItemRequest
    {
        RequestItems = new Dictionary<string, List<WriteRequest>> { [tableName] = chunk },
    };

    BatchWriteItemResponse response;
    do
    {
        response = await client.BatchWriteItemAsync(request);
        loaded += chunk.Count - (response.UnprocessedItems.TryGetValue(tableName, out var unprocessed) ? unprocessed.Count : 0);

        if (response.UnprocessedItems.Count > 0)
        {
            request = new BatchWriteItemRequest { RequestItems = response.UnprocessedItems };
            await Task.Delay(200); // backoff simple ante throttling
        }
    } while (response.UnprocessedItems.Count > 0);
}

Console.WriteLine($"Carga completa: {loaded} snippets escritos en '{tableName}'.");
return 0;

static bool IsUsable(SnippetSeed s) =>
    !string.IsNullOrWhiteSpace(s.Code) &&
    !string.IsNullOrWhiteSpace(s.Language) &&
    !string.IsNullOrWhiteSpace(s.Explanation);

static IEnumerable<List<T>> Chunk<T>(List<T> source, int size)
{
    for (var i = 0; i < source.Count; i += size)
    {
        yield return source.GetRange(i, Math.Min(size, source.Count - i));
    }
}

internal sealed record SnippetSeed(
    [property: JsonPropertyName("snippetId")] string SnippetId,
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("language")] string Language,
    [property: JsonPropertyName("framework")] string? Framework,
    [property: JsonPropertyName("project")] string? Project,
    [property: JsonPropertyName("difficulty")] string Difficulty,
    [property: JsonPropertyName("explanation")] string Explanation
);
