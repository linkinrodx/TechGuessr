using FsCheck.Xunit;
using GameFunction.Domain;

namespace GameFunction.Tests;

/// <summary>
/// Property-based tests de ListShuffler, usado por CommitGuessr para
/// randomizar MessageOptions antes de responder (ver Function.cs,
/// HandleGetNextCommitRoundAsync) y evitar que la posición de la primera
/// opción delate siempre la respuesta correcta.
/// </summary>
public class ListShufflerPropertyTests
{
    /// <summary>
    /// El resultado siempre tiene el mismo tamaño y el mismo multiset de
    /// elementos que la entrada (ningún item se pierde, duplica o cambia).
    /// </summary>
    [Property]
    public bool Shuffle_PreservaElMismoConjuntoDeElementos(string[] rawItems)
    {
        var items = rawItems.Where(i => i is not null).ToList();
        var shuffled = ListShuffler.Shuffle(items);

        // Ordinal explícito: el comparador por defecto de OrderBy es
        // sensible a cultura y puede tratar caracteres de control como
        // "iguales" en el orden sin serlo estructuralmente, lo que rompe
        // la comparación de multisets vía SequenceEqual (falso negativo).
        return shuffled.Count == items.Count
            && shuffled.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(items.OrderBy(x => x, StringComparer.Ordinal));
    }

    /// <summary>
    /// La lista original no se muta: Shuffle siempre devuelve una copia.
    /// </summary>
    [Property]
    public bool Shuffle_NoMutaLaListaOriginal(string[] rawItems)
    {
        var items = rawItems.Where(i => i is not null).ToList();
        var originalOrder = items.ToList();

        ListShuffler.Shuffle(items);

        return items.SequenceEqual(originalOrder);
    }

    /// <summary>
    /// Con al menos 4 elementos distintos, repetir el shuffle muchas veces
    /// produce más de un orden distinto (no es un no-op disfrazado).
    /// Se usa una lista fija en vez de datos generados para evitar falsos
    /// negativos por colisión de elementos duplicados.
    /// </summary>
    [Fact]
    public void Shuffle_ProduceOrdenesDistintosEnRepeticion()
    {
        var items = new List<string> { "a", "b", "c", "d" };

        var distinctOrders = Enumerable.Range(0, 50)
            .Select(_ => string.Join(",", ListShuffler.Shuffle(items)))
            .Distinct()
            .Count();

        Assert.True(distinctOrders > 1, "Se esperaba más de un orden distinto en 50 repeticiones.");
    }

    [Fact]
    public void Shuffle_ListaVacia_DevuelveListaVacia()
    {
        var result = ListShuffler.Shuffle([]);
        Assert.Empty(result);
    }

    [Fact]
    public void Shuffle_UnSoloElemento_DevuelveMismoElemento()
    {
        var result = ListShuffler.Shuffle(["unico"]);
        Assert.Equal(["unico"], result);
    }
}
