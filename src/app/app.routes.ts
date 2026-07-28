import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Login } from './features/auth/login';
import { Register } from './features/auth/register';
import { CodeguessrGame } from './features/codeguessr/codeguessr-game';
import { SessionSummary } from './features/codeguessr/session-summary';
import { Leaderboard } from './features/codeguessr/leaderboard';
import { CommitguessrGame } from './features/commitguessr/commitguessr-game';
import { CommitSessionSummary } from './features/commitguessr/commit-session-summary';
import { CommitLeaderboard } from './features/commitguessr/commit-leaderboard';
import { UIguessrGame } from './features/uiguessr/uiguessr-game';
import { UISessionSummary } from './features/uiguessr/ui-session-summary';
import { UILeaderboard } from './features/uiguessr/ui-leaderboard';
import { AIGuessrGame } from './features/aiguessr/aiguessr-game';
import { AISessionSummary } from './features/aiguessr/ai-session-summary';
import { Leaderboards } from './features/leaderboards/leaderboards';
import { NotFound } from './features/not-found/not-found';

/**
 * `title` en cada ruta alimenta AppTitleStrategy (ver app.config.ts), que
 * lo combina con el nombre del sitio para el <title> de la pestaña del
 * navegador (ej. "CodeGuessr · TechGuessr"). Sin esto, la pestaña siempre
 * mostraba "TechGuessr" sin importar en qué pantalla estuviera el jugador.
 */
export const routes: Routes = [
  { path: '', component: Home, title: 'TechGuessr' },
  { path: 'login', component: Login, title: 'Iniciar sesión' },
  { path: 'register', component: Register, title: 'Crear cuenta' },
  { path: 'play', component: CodeguessrGame, title: 'CodeGuessr' },
  { path: 'commit', component: CommitguessrGame, title: 'CommitGuessr' },
  { path: 'ui-play', component: UIguessrGame, title: 'UIGuessr' },
  { path: 'ai-play', component: AIGuessrGame, title: 'AIGuessr' },
  { path: 'summary', component: SessionSummary, title: 'Resumen · CodeGuessr' },
  { path: 'commit-summary', component: CommitSessionSummary, title: 'Resumen · CommitGuessr' },
  { path: 'ui-summary', component: UISessionSummary, title: 'Resumen · UIGuessr' },
  { path: 'ai-summary', component: AISessionSummary, title: 'Resumen · AIGuessr' },
  { path: 'leaderboard', component: Leaderboard, title: 'Leaderboard · CodeGuessr' },
  { path: 'commit-leaderboard', component: CommitLeaderboard, title: 'Leaderboard · CommitGuessr' },
  { path: 'ui-leaderboard', component: UILeaderboard, title: 'Leaderboard · UIGuessr' },
  { path: 'leaderboards', component: Leaderboards, title: 'Leaderboards' },
  { path: '**', component: NotFound, title: 'Página no encontrada' },
];
