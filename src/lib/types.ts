export type SessionStatus = "setup" | "live" | "completed";
export type SessionMode = "manual" | "guided_round_robin";
export type BowlingOutcome = "G" | "B" | "GW" | "BW" | "WD";
export type BattingOutcome = 0 | 1 | 2 | 3 | 4 | 5 | 6 | "W";
export type DeliveryModifier = "wrong_shot" | "ball_beat";
export type ShotType =
  | "drive"
  | "pull"
  | "lofted"
  | "punch"
  | "cut"
  | "flick"
  | "edge"
  | "others";
export type OutType =
  | "bowled"
  | "caught_out"
  | "caught_and_bowled"
  | "stumped"
  | "lbw"
  | "run_out"
  | "hit_wicket"
  | "others";

export interface Player {
  id: string;
  name: string;
  canBat: boolean;
  canBowl: boolean;
  battingRuns: number;
  battingDismissals: number;
  battingNetScore: number;
  bowlingPoints: number;
  goodBalls: number;
  badBalls: number;
  wideBalls: number;
  wicketsOnGoodBalls: number;
  wicketsOnBadBalls: number;
  wrongShots: number;
  ballBeatsFaced: number;
  ballBeatBonuses: number;
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
  modifier: DeliveryModifier | null;
  shotType: ShotType | null;
  outType: OutType | null;
  countsAsLegalBall: boolean;
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
  modifier: DeliveryModifier | null;
  shotType: ShotType | null;
  outType: OutType | null;
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
  plannedBowlerId: string | null;
  eligibleBowlerIds: string[];
  currentBatterIndex: number;
  currentBatterOver: number;
  oversPerBatter: number;
  completedOvers: number;
  remainingOversInBlock: number;
  nextBatterId: string | null;
}
