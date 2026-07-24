import { Routes } from '@angular/router';
import { Login } from './features/auth/login';
import { Register } from './features/auth/register';
import { CodeguessrGame } from './features/codeguessr/codeguessr-game';
import { SessionSummary } from './features/codeguessr/session-summary';
import { Leaderboard } from './features/codeguessr/leaderboard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'play', component: CodeguessrGame },
  { path: 'summary', component: SessionSummary },
  { path: 'leaderboard', component: Leaderboard },
];
