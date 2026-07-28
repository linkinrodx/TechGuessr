import { LeaderboardEntryResponse } from './types/game.types';

/**
 * Construye el mensaje de la mascota para una pantalla de leaderboard,
 * según la posición del usuario actual en esa tabla. Función pura (sin
 * inyección de servicios) para poder reutilizarla desde los 4
 * componentes de leaderboard sin duplicar la lógica de "en qué puesto
 * estoy" en cada uno.
 */
export function buildLeaderboardMascotMessage(
  entries: LeaderboardEntryResponse[],
  currentUsername: string | undefined,
): string {
  if (entries.length === 0) {
    return 'Todavía no hay nadie en esta tabla. ¡Sé l@ primer@ en aparecer aquí!';
  }

  if (!currentUsername) {
    return 'Inicia sesión para guardar tu puntaje y aparecer en este ranking.';
  }

  const rankIndex = entries.findIndex((entry) => entry.Username === currentUsername);

  if (rankIndex === -1) {
    return '¡Tu puntaje se está registrando! Recarga en unos segundos para verte en la tabla.';
  }
  if (rankIndex === 0) {
    return '¡Estás en la cima de esta tabla! 🏆';
  }
  if (rankIndex <= 2) {
    return `¡Estás en el podio! Puesto #${rankIndex + 1} 🥉`;
  }
  if (rankIndex <= 9) {
    return `Vas en el puesto #${rankIndex + 1}, dentro del top 10. ¡Sigue así!`;
  }
  return `Estás en el puesto #${rankIndex + 1}. ¡A subir de posición!`;
}
