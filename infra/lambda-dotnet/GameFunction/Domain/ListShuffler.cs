namespace GameFunction.Domain;

/// <summary>
/// Utilidad pura de mezclado de listas (Fisher-Yates). Se usa en
/// CommitGuessr para randomizar el orden de MessageOptions antes de
/// responder: el dataset guarda correctMessage siempre como la primera
/// entrada, y sin este mezclado la posición delataría la respuesta
/// correcta (ayuda involuntaria para el jugador).
/// </summary>
public static class ListShuffler
{
    /// <summary>
    /// Devuelve una copia de <paramref name="items"/> en orden aleatorio,
    /// sin mutar la lista original.
    /// </summary>
    public static List<string> Shuffle(List<string> items)
    {
        var shuffled = new List<string>(items);
        for (var i = shuffled.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }
        return shuffled;
    }
}
