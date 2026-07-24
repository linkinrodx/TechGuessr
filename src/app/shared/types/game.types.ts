/**
 * Tipos compartidos del contrato de API de CodeGuessr.
 *
 * Alineados 1:1 con .kiro/specs/codeguessr-mvp/design.md (sección
 * "Contrato de API") y con infra/lambda-dotnet/GameFunction/Api/ApiModels.cs.
 *
 * Nota: los nombres de propiedad en las respuestas del backend .NET usan
 * PascalCase (comportamiento por defecto de System.Text.Json en la Lambda),
 * por eso las interfaces de "Response" usan PascalCase también, en vez del
 * camelCase típico de TypeScript/JSON. Los tipos de "Request" (lo que
 * enviamos nosotros) sí usan camelCase, tal como los espera el backend
 * (ver AnswerSubmissionRequest con [JsonPropertyName] en el backend).
 */

export interface SessionCreatedResponse {
  SessionId: string;
  TotalRounds: number;
}

export interface RoundResponse {
  RoundId: string;
  RoundIndex: number;
  Code: string;
  Difficulty: 'easy' | 'medium' | 'hard';
}

export interface GuessRequest {
  language?: string;
  framework?: string;
  project?: string;
}

export interface AnswerSubmissionRequest {
  sessionId: string;
  guess: GuessRequest;
  clientElapsedMs: number;
}

export interface CorrectnessResponse {
  Language: boolean;
  Framework: boolean | null;
  Project: boolean | null;
}

export interface CorrectAnswersResponse {
  Language: string;
  Framework: string | null;
  Project: string | null;
}

export interface AnswerResultResponse {
  Correctness: CorrectnessResponse;
  CorrectAnswers: CorrectAnswersResponse;
  Explanation: string;
  RoundScore: number;
  TotalScoreSoFar: number;
  SessionFinished: boolean;
}

export interface RoundSummaryResponse {
  RoundId: string;
  RoundIndex: number;
  Correctness: CorrectnessResponse | null;
  Score: number;
}

export interface SessionSummaryResponse {
  SessionId: string;
  TotalScore: number;
  Rounds: RoundSummaryResponse[];
  Rank: number | null;
}

export interface LeaderboardEntryResponse {
  Username: string;
  TotalScore: number;
  AchievedAt: string;
}

export type SessionStatus = 'idle' | 'playing' | 'finished';
