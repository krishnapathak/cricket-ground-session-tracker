export type SessionStatus = "setup" | "live" | "completed";
export type SessionMode = "manual" | "guided_round_robin";
export type BowlingOutcome = "G" | "B" | "GW" | "BW";
export type BattingOutcome = 0 | 1 | 2 | 3 | 4 | 5 | 6 | "W";

export interface Player {
  id: string;
  name: string;
  battingRuns: number;
  battingDismissals: number;
  battingNetScore: number;
  bowlingPoints: number;
  goodBalls: number;
  badBalls: number;
  wicketsOnGoodBalls: number;
  wicketsOnBadBalls: number;
  argumentsCount: number;
  conductPenalty: number;
  totalSessionScore: number;
}

export interface Delivery {
  id: string;
  overNumber: number;
  ballInOver: number;
  timestamp: string;
  bowlerId: string;
  batterId: string;
  bowlingOutcome: BowlingOutcome;
  battingOutcome: BattingOutcome;
  bowlingPointsAwarded: number;
  battingRunsDelta: number;
  battingPenaltyDelta: number;
  argumentPlayerIds: string[];
}

export interface Over {
  id: string;
  overNumber: number;
  bowlerId: string;
  batterId: string;
  deliveries: Delivery[];
}

export interface RoundRobinConfig {
  oversPerBatter: number;
  battingOrder: string[];
}

export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  mode: SessionMode;
  createdAt: string;
  updatedAt: string;
  totalOvers: number;
  ballsPerOver: number;
  currentOverNumber: number;
  currentBallInOver: number;
  players: Player[];
  overs: Over[];
  deliveries: Delivery[];
  activeBowlerId: string | null;
  activeBatterId: string | null;
  roundRobinConfig: RoundRobinConfig | null;
}

export interface PendingDelivery {
  bowlingOutcome: BowlingOutcome | null;
  battingOutcome: BattingOutcome | null;
}

export interface PlayerAnalytics extends Player {
  totalBallsBowled: number;
  goodBallPercentage: number;
  bowlerTimeline: string[];
  batterTimeline: string[];
}

export interface GuidedRoundRobinState {
  currentBatterId: string | null;
  currentBowlerId: string | null;
  currentBatterIndex: number;
  currentBatterOver: number;
  oversPerBatter: number;
  completedOvers: number;
  remainingOversInBlock: number;
  nextBatterId: string | null;
}
