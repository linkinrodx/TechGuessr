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

// ============================================================================
// CommitGuessr Types
// ============================================================================

export type CommitType = 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'perf';

export interface CommitSnippet {
  commitId: string;
  diff: string;
  commitType: CommitType;
  correctMessage: string;
  messageOptions: string[]; // 4 opciones incluyendo la correcta
  effortMinutes: number;
  filesModified: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
}

export interface CommitGuessRequest {
  commitType?: CommitType;
  message?: string;
  effortMinutes?: number;
  filesModified?: number;
}

export interface CommitAnswerSubmissionRequest {
  sessionId: string;
  guess: CommitGuessRequest;
  clientElapsedMs: number;
}

export interface CommitCorrectnessResponse {
  CommitType: boolean;
  Message: boolean | null;
  EffortEstimate: boolean | null;
  FilesModified: boolean | null;
}

export interface CommitCorrectAnswersResponse {
  CommitType: CommitType;
  Message: string;
  EffortMinutes: number;
  FilesModified: number;
}

export interface CommitAnswerResultResponse {
  Correctness: CommitCorrectnessResponse;
  CorrectAnswers: CommitCorrectAnswersResponse;
  Explanation: string;
  RoundScore: number;
  TotalScoreSoFar: number;
  SessionFinished: boolean;
}

export interface CommitRoundResponse {
  RoundId: string;
  RoundIndex: number;
  Diff: string;
  MessageOptions: string[];
  Difficulty: 'easy' | 'medium' | 'hard';
}

export interface CommitRoundSummaryResponse {
  RoundId: string;
  RoundIndex: number;
  Correctness: CommitCorrectnessResponse | null;
  Score: number;
}

export interface CommitSessionSummaryResponse {
  SessionId: string;
  TotalScore: number;
  Rounds: CommitRoundSummaryResponse[];
  Rank: number | null;
}

// ============================================================================
// UIGuessr Types
// ============================================================================

export interface UIRoundResponse {
  RoundId: string;
  RoundIndex: number;
  ImageUrl: string;
  Difficulty: 'easy' | 'medium' | 'hard';
}

export interface UIGuessRequest {
  app?: string;
  action?: string;
  year?: number;
}

export interface UICorrectnessResponse {
  App: boolean;
  Action: boolean | null;
  Year: boolean | null;
  YearDiff: number;
}

export interface UICorrectAnswersResponse {
  App: string;
  Action: string;
  Year: number;
}

export interface UIAnswerResultResponse {
  Correctness: UICorrectnessResponse;
  CorrectAnswers: UICorrectAnswersResponse;
  Explanation: string;
  RoundScore: number;
  TotalScoreSoFar: number;
  SessionFinished: boolean;
}

export interface UIRoundSummaryResponse {
  RoundId: string;
  RoundIndex: number;
  Correctness: UICorrectnessResponse | null;
  Score: number;
}

export interface UISessionSummaryResponse {
  SessionId: string;
  TotalScore: number;
  Rounds: UIRoundSummaryResponse[];
  Rank: number | null;
}

// ============================================================================
// AIGuessr Types
// ============================================================================

export type AIGameMode = 'human-or-ai' | 'hallucination-hunter';

export interface AIRoundResponse {
  RoundId: string;
  RoundIndex: number;
  Mode: AIGameMode;
  Content: string | string[]; // string para human-or-ai, string[] para hallucination-hunter
  Difficulty: 'easy' | 'medium' | 'hard';
}

export interface AIGuessRequest {
  mode: AIGameMode;
  isHuman?: boolean; // para human-or-ai
  hallucinationIndices?: number[]; // para hallucination-hunter: índices de afirmaciones marcadas como alucinaciones
}

export interface AICorrectnessResponse {
  IsCorrect: boolean;
  Details?: {
    // Para human-or-ai
    GuessedCorrectly?: boolean;
    // Para hallucination-hunter
    CorrectlyIdentified?: number;
    FalsePositives?: number;
    Missed?: number;
  };
}

export interface AICorrectAnswersResponse {
  Mode: AIGameMode;
  IsHuman?: boolean; // para human-or-ai
  HallucinationIndices?: number[]; // para hallucination-hunter
  Explanation: string;
}

export interface AIAnswerResultResponse {
  Correctness: AICorrectnessResponse;
  CorrectAnswers: AICorrectAnswersResponse;
  Explanation: string;
  RoundScore: number;
  TotalScoreSoFar: number;
  SessionFinished: boolean;
}

export interface AIRoundSummaryResponse {
  RoundId: string;
  RoundIndex: number;
  Correctness: AICorrectnessResponse | null;
  Score: number;
}

export interface AISessionSummaryResponse {
  SessionId: string;
  TotalScore: number;
  Rounds: AIRoundSummaryResponse[];
  Rank: number | null;
}
