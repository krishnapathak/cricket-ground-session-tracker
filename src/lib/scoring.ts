import {
  BattingOutcome,
  BowlingOutcome,
  Delivery,
  DeliveryModifier,
  GuidedRoundRobinState,
  OutType,
  Over,
  Player,
  PlayerAnalytics,
  Session,
  SessionMode,
  ShotType,
} from "@/lib/types";

export const BALLS_PER_OVER = 6;

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function playerCanBat(player: Pick<Player, "canBat">) {
  return player.canBat !== false;
}

export function playerCanBowl(player: Pick<Player, "canBowl">) {
  return player.canBowl !== false;
}

function isEligibleBatter(players: Player[], playerId: string | null) {
  return Boolean(playerId && players.some((player) => player.id === playerId && playerCanBat(player)));
}

function isEligibleBowler(players: Player[], playerId: string | null, activeBatterId: string | null) {
  return Boolean(
    playerId &&
      playerId !== activeBatterId &&
      players.some((player) => player.id === playerId && playerCanBowl(player)),
  );
}

function getNextEligiblePlayer(players: Player[], currentPlayerId: string | null, predicate: (player: Player) => boolean) {
  const eligiblePlayers = players.filter(predicate);

  if (eligiblePlayers.length === 0) {
    return null;
  }

  if (!currentPlayerId) {
    return eligiblePlayers[0]?.id ?? null;
  }

  const currentIndex = eligiblePlayers.findIndex((player) => player.id === currentPlayerId);

  if (currentIndex === -1) {
    return eligiblePlayers[0]?.id ?? null;
  }

  return eligiblePlayers[(currentIndex + 1) % eligiblePlayers.length]?.id ?? null;
}

export function createPlayer(input: { name: string; canBat?: boolean; canBowl?: boolean }): Player {
  return {
    id: createId(),
    name: input.name,
    canBat: input.canBat !== false,
    canBowl: input.canBowl !== false,
    battingRuns: 0,
    battingDismissals: 0,
    battingNetScore: 0,
    bowlingPoints: 0,
    goodBalls: 0,
    badBalls: 0,
    wideBalls: 0,
    wicketsOnGoodBalls: 0,
    wicketsOnBadBalls: 0,
    wrongShots: 0,
    ballBeatsFaced: 0,
    ballBeatBonuses: 0,
    argumentsCount: 0,
    conductPenalty: 0,
    totalSessionScore: 0,
  };
}

function getRoundRobinTotalOvers(playerCount: number, oversPerBatter: number) {
  return playerCount * oversPerBatter;
}

function getLegalDeliveriesCount(deliveries: Delivery[]) {
  return deliveries.filter((delivery) => delivery.countsAsLegalBall).length;
}

interface GuidedOverPlanEntry {
  overNumber: number;
  batterId: string | null;
  bowlerId: string | null;
  batterIndex: number;
  batterOver: number;
  nextBatterId: string | null;
  eligibleBowlerIds: string[];
}

function getCircularEligibleBowlers(players: Array<Pick<Player, "id" | "canBowl">>, batterId: string | null) {
  if (players.length === 0) {
    return [];
  }

  const batterIndex = players.findIndex((player) => player.id === batterId);
  const orderedPlayers = batterIndex === -1
    ? players
    : players.map((_, offset) => players[(batterIndex + offset + 1) % players.length] ?? null).filter(Boolean);

  return orderedPlayers
    .filter((player): player is Pick<Player, "id" | "canBowl"> => Boolean(player))
    .filter((player) => player.id !== batterId && playerCanBowl(player))
    .map((player) => player.id);
}

function getGuidedOverPlan(session: Pick<Session, "players" | "roundRobinConfig" | "totalOvers">): GuidedOverPlanEntry[] {
  if (!session.roundRobinConfig || session.roundRobinConfig.battingOrder.length === 0) {
    return [];
  }

  const plan: GuidedOverPlanEntry[] = [];
  const { battingOrder, oversPerBatter } = session.roundRobinConfig;

  battingOrder.forEach((batterId, batterIndex) => {
    const eligibleBowlerIds = getCircularEligibleBowlers(session.players, batterId);
    const nextBatterId = battingOrder[batterIndex + 1] ?? null;

    for (let overOffset = 0; overOffset < oversPerBatter; overOffset += 1) {
      plan.push({
        overNumber: plan.length + 1,
        batterId,
        bowlerId: eligibleBowlerIds.length === 0 ? null : eligibleBowlerIds[overOffset % eligibleBowlerIds.length] ?? null,
        batterIndex,
        batterOver: overOffset + 1,
        nextBatterId,
        eligibleBowlerIds,
      });
    }
  });

  return plan.slice(0, session.totalOvers);
}

function getNextBowlerFromPool(pool: string[], currentBowlerId: string | null) {
  if (pool.length === 0) {
    return null;
  }

  if (!currentBowlerId) {
    return pool[0] ?? null;
  }

  const currentIndex = pool.indexOf(currentBowlerId);

  if (currentIndex === -1) {
    return pool[0] ?? null;
  }

  return pool[(currentIndex + 1) % pool.length] ?? null;
}

function getGuidedAssignmentForDeliveryCount(
  session: Pick<Session, "players" | "roundRobinConfig" | "ballsPerOver" | "totalOvers" | "activeBowlerId" | "currentOverNumber">,
  deliveries: Delivery[],
) {
  const plan = getGuidedOverPlan(session);

  if (plan.length === 0) {
    return { activeBowlerId: null, activeBatterId: null, plannedBowlerId: null, eligibleBowlerIds: [] };
  }

  const progress = getProgressFromDeliveries(deliveries, session.ballsPerOver);
  const currentPlanEntry = plan[Math.min(Math.max(progress.currentOverNumber - 1, 0), plan.length - 1)] ?? null;
  const previousPlanEntry = plan[Math.min(Math.max(progress.currentOverNumber - 2, 0), plan.length - 1)] ?? null;
  const currentOverDeliveries = deliveries.filter((delivery) => delivery.overNumber === progress.currentOverNumber);
  const previousOverDeliveries = deliveries.filter((delivery) => delivery.overNumber === Math.max(progress.currentOverNumber - 1, 0));
  const plannedBowlerId = currentPlanEntry?.bowlerId ?? null;
  const previousOverBowlerId = previousOverDeliveries[0]?.bowlerId ?? null;
  const repeatedPlannedBowlerId =
    currentOverDeliveries.length === 0 &&
    previousOverBowlerId &&
    currentPlanEntry?.batterId === previousPlanEntry?.batterId &&
    previousOverBowlerId === plannedBowlerId
      ? getNextBowlerFromPool(currentPlanEntry?.eligibleBowlerIds ?? [], previousOverBowlerId)
      : plannedBowlerId;
  const preservedBowlerId =
    progress.currentOverNumber === session.currentOverNumber &&
    isEligibleBowler(session.players, session.activeBowlerId, currentPlanEntry?.batterId ?? null) &&
    currentOverDeliveries.length === 0
      ? session.activeBowlerId
      : null;

  return {
    activeBowlerId: currentOverDeliveries[0]?.bowlerId ?? preservedBowlerId ?? repeatedPlannedBowlerId,
    activeBatterId: currentPlanEntry?.batterId ?? null,
    plannedBowlerId: repeatedPlannedBowlerId,
    eligibleBowlerIds: currentPlanEntry?.eligibleBowlerIds ?? [],
  };
}

function getInitialActivePlayers(session: Pick<Session, "players" | "roundRobinConfig" | "mode" | "ballsPerOver" | "totalOvers" | "activeBowlerId" | "currentOverNumber">) {
  if (session.mode === "guided_round_robin") {
    return getGuidedAssignmentForDeliveryCount(session, []);
  }

  const activeBowlerId = getNextEligiblePlayer(session.players, null, (player) => playerCanBowl(player));
  const activeBatterId = getNextEligiblePlayer(
    session.players,
    null,
    (player) => playerCanBat(player) && player.id !== activeBowlerId,
  );

  return {
    activeBowlerId,
    activeBatterId,
  };
}

export function createSession(
  title: string,
  playerInputs: Array<{ name: string; canBat: boolean; canBowl: boolean }>,
  totalOvers: number,
  options?: {
    mode?: SessionMode;
    oversPerBatter?: number;
  },
): Session {
  const players = playerInputs
    .map((player) => ({
      name: player.name.trim(),
      canBat: player.canBat,
      canBowl: player.canBowl,
    }))
    .filter((player) => player.name)
    .map(createPlayer);
  const timestamp = new Date().toISOString();
  const mode = options?.mode ?? "manual";
  const oversPerBatter = Math.max(1, options?.oversPerBatter ?? 1);
  const battingOrder = players.filter((player) => playerCanBat(player)).map((player) => player.id);
  const roundRobinConfig =
    mode === "guided_round_robin"
      ? {
          oversPerBatter,
          battingOrder,
        }
      : null;
  const nextSession: Session = {
    id: createId(),
    title: title.trim() || `Practice Session ${new Date().toLocaleDateString()}`,
    status: "setup",
    mode,
    createdAt: timestamp,
    updatedAt: timestamp,
    totalOvers:
      mode === "guided_round_robin"
        ? getRoundRobinTotalOvers(battingOrder.length, oversPerBatter)
        : totalOvers,
    ballsPerOver: BALLS_PER_OVER,
    currentOverNumber: 1,
    currentBallInOver: 1,
    players,
    overs: [],
    deliveries: [],
    activeBowlerId: null,
    activeBatterId: null,
    roundRobinConfig,
  };

  const initialActivePlayers = getInitialActivePlayers({
    ...nextSession,
    activeBowlerId: null,
    currentOverNumber: 1,
  });

  return {
    ...nextSession,
    activeBowlerId: initialActivePlayers.activeBowlerId,
    activeBatterId: initialActivePlayers.activeBatterId,
  };
}

export function getBowlingPoints(outcome: BowlingOutcome) {
  switch (outcome) {
    case "G":
      return 1;
    case "B":
      return 0;
    case "GW":
      return 6;
    case "BW":
      return 5;
    case "WD":
      return -1;
  }
}

export function getBattingDeltas(outcome: BattingOutcome, modifier: DeliveryModifier | null) {
  const dismissalPenalty = outcome === "W" ? 5 : 0;
  const wrongShotPenalty = modifier === "wrong_shot" ? 2 : 0;
  const ballBeatPenalty = modifier === "ball_beat" ? 1 : 0;

  return {
    runsDelta: outcome === "W" ? 0 : outcome,
    dismissalsDelta: outcome === "W" ? 1 : 0,
    penaltyDelta: -(dismissalPenalty + wrongShotPenalty + ballBeatPenalty),
  };
}

function recalculatePlayer(player: Player) {
  player.battingNetScore =
    player.battingRuns - player.battingDismissals * 5 - player.wrongShots * 2 - player.ballBeatsFaced;
  player.conductPenalty = player.argumentsCount * 2;
  player.totalSessionScore =
    player.bowlingPoints + player.battingNetScore - player.conductPenalty;
}

function createPlayerStatReset(player: Player): Player {
  const nextPlayer: Player = {
    ...player,
    canBat: playerCanBat(player),
    canBowl: playerCanBowl(player),
    battingRuns: 0,
    battingDismissals: 0,
    battingNetScore: 0,
    bowlingPoints: 0,
    goodBalls: 0,
    badBalls: 0,
    wideBalls: 0,
    wicketsOnGoodBalls: 0,
    wicketsOnBadBalls: 0,
    wrongShots: 0,
    ballBeatsFaced: 0,
    ballBeatBonuses: 0,
    conductPenalty: 0,
    totalSessionScore: 0,
  };

  recalculatePlayer(nextPlayer);
  return nextPlayer;
}

function upsertOver(overs: Over[], delivery: Delivery) {
  const existing = overs.find(
    (over) =>
      over.overNumber === delivery.overNumber &&
      over.bowlerId === delivery.bowlerId &&
      over.batterId === delivery.batterId,
  );

  if (existing) {
    existing.deliveries.push(delivery);
    return overs;
  }

  return [
    ...overs,
    {
      id: createId(),
      overNumber: delivery.overNumber,
      bowlerId: delivery.bowlerId,
      batterId: delivery.batterId,
      deliveries: [delivery],
    },
  ];
}

function applyDeliveryToPlayers(players: Player[], delivery: Delivery) {
  const bowler = players.find((player) => player.id === delivery.bowlerId);
  const batter = players.find((player) => player.id === delivery.batterId);

  if (!bowler || !batter) {
    return;
  }

  bowler.bowlingPoints += delivery.bowlingPointsAwarded;

  if (delivery.bowlingOutcome === "G") {
    bowler.goodBalls += 1;
  }

  if (delivery.bowlingOutcome === "B") {
    bowler.badBalls += 1;
  }

  if (delivery.bowlingOutcome === "WD") {
    bowler.wideBalls += 1;
  }

  if (delivery.bowlingOutcome === "GW") {
    bowler.wicketsOnGoodBalls += 1;
  }

  if (delivery.bowlingOutcome === "BW") {
    bowler.wicketsOnBadBalls += 1;
  }

  if (delivery.modifier === "ball_beat") {
    bowler.ballBeatBonuses += 1;
  }

  batter.battingRuns += delivery.battingRunsDelta;
  batter.battingDismissals += delivery.battingOutcome === "W" ? 1 : 0;

  if (delivery.modifier === "wrong_shot") {
    batter.wrongShots += 1;
  }

  if (delivery.modifier === "ball_beat") {
    batter.ballBeatsFaced += 1;
  }

  recalculatePlayer(bowler);
  if (batter.id !== bowler.id) {
    recalculatePlayer(batter);
  }
}

function getProgressFromDeliveries(deliveries: Delivery[], ballsPerOver: number) {
  const legalDeliveriesCount = getLegalDeliveriesCount(deliveries);

  return {
    currentOverNumber: Math.floor(legalDeliveriesCount / ballsPerOver) + 1,
    currentBallInOver: (legalDeliveriesCount % ballsPerOver) + 1,
  };
}

function rebuildSession(session: Session, deliveries: Delivery[]) {
  const players = session.players.map(createPlayerStatReset);
  let overs: Over[] = [];

  deliveries.forEach((delivery) => {
    applyDeliveryToPlayers(players, delivery);
    overs = upsertOver(overs, delivery);
  });

  const progress = getProgressFromDeliveries(deliveries, session.ballsPerOver);
  const legalDeliveriesCount = getLegalDeliveriesCount(deliveries);
  const totalBalls = session.totalOvers * session.ballsPerOver;
  const isCompleted = legalDeliveriesCount >= totalBalls;
  const guidedAssignment =
    session.mode === "guided_round_robin"
      ? getGuidedAssignmentForDeliveryCount(session, deliveries)
      : {
          activeBowlerId: session.activeBowlerId,
          activeBatterId: session.activeBatterId,
          plannedBowlerId: session.activeBowlerId,
          eligibleBowlerIds: [],
        };

  return {
    ...session,
    players,
    deliveries,
    overs,
    currentOverNumber: progress.currentOverNumber,
    currentBallInOver: progress.currentBallInOver,
    activeBowlerId: isCompleted ? session.activeBowlerId : guidedAssignment.activeBowlerId,
    activeBatterId: isCompleted ? session.activeBatterId : guidedAssignment.activeBatterId,
    status: isCompleted ? ("completed" as const) : deliveries.length > 0 ? ("live" as const) : ("setup" as const),
    updatedAt: new Date().toISOString(),
  };
}

export function recordDelivery(
  session: Session,
  payload: {
    bowlerId: string;
    batterId: string;
    bowlingOutcome: BowlingOutcome;
    battingOutcome: BattingOutcome;
    modifier: DeliveryModifier | null;
    shotType: ShotType | null;
    outType: OutType | null;
  },
) {
  if (
    !isEligibleBowler(session.players, payload.bowlerId, payload.batterId) ||
    !isEligibleBatter(session.players, payload.batterId)
  ) {
    return session;
  }

  const isWicket = payload.bowlingOutcome === "GW" || payload.bowlingOutcome === "BW";
  const isWide = payload.bowlingOutcome === "WD";
  const battingOutcome = isWicket ? "W" : isWide ? 0 : payload.battingOutcome;
  const modifier = isWide ? null : payload.modifier;
  const shotType = battingOutcome === 4 && !isWide ? payload.shotType : null;
  const outType = isWicket ? payload.outType : null;
  const bowlingPoints = getBowlingPoints(payload.bowlingOutcome) + (modifier === "ball_beat" ? 1 : 0);
  const battingDelta = getBattingDeltas(battingOutcome, modifier);
  const delivery: Delivery = {
    id: createId(),
    overNumber: session.currentOverNumber,
    ballInOver: session.currentBallInOver,
    timestamp: new Date().toISOString(),
    bowlerId: payload.bowlerId,
    batterId: payload.batterId,
    bowlingOutcome: payload.bowlingOutcome,
    battingOutcome,
    modifier,
    shotType,
    outType,
    countsAsLegalBall: !isWide,
    bowlingPointsAwarded: bowlingPoints,
    battingRunsDelta: battingDelta.runsDelta,
    battingPenaltyDelta: battingDelta.penaltyDelta,
    argumentPlayerIds: [],
  };

  return rebuildSession(session, [...session.deliveries, delivery]);
}

export function addArgumentPenalty(session: Session, playerId: string) {
  const nextSession: Session = {
    ...session,
    players: session.players.map((player) => ({ ...player })),
    updatedAt: new Date().toISOString(),
  };

  const player = nextSession.players.find((entry) => entry.id === playerId);

  if (!player) {
    return session;
  }

  player.argumentsCount += 1;
  recalculatePlayer(player);

  return nextSession;
}

export function undoLastDelivery(session: Session) {
  if (session.deliveries.length === 0) {
    return session;
  }

  return rebuildSession(session, session.deliveries.slice(0, -1));
}

export function updateActivePlayers(
  session: Session,
  activeBowlerId: string | null,
  activeBatterId: string | null,
) {
  if (!isEligibleBatter(session.players, activeBatterId) || !isEligibleBowler(session.players, activeBowlerId, activeBatterId)) {
    return session;
  }

  return {
    ...session,
    activeBowlerId,
    activeBatterId,
    updatedAt: new Date().toISOString(),
  };
}

export function getNextPlayerId(
  session: Pick<Session, "players">,
  currentPlayerId: string | null,
  excludedPlayerIds: string[] = [],
) {
  return getNextEligiblePlayer(
    session.players,
    currentPlayerId,
    (player) => !excludedPlayerIds.includes(player.id),
  );
}

export function cycleActivePlayer(session: Session, role: "bowler" | "batter") {
  if (role === "bowler") {
    const nextBowlerId = getNextEligiblePlayer(
      session.players,
      session.activeBowlerId,
      (player) => playerCanBowl(player) && player.id !== session.activeBatterId,
    );

    return updateActivePlayers(session, nextBowlerId, session.activeBatterId);
  }

  const nextBatterId = getNextEligiblePlayer(
    session.players,
    session.activeBatterId,
    (player) => playerCanBat(player) && player.id !== session.activeBowlerId,
  );

  return updateActivePlayers(session, session.activeBowlerId, nextBatterId);
}

export function swapActiveRoles(session: Session) {
  if (!session.activeBowlerId || !session.activeBatterId) {
    return session;
  }

  if (!isEligibleBowler(session.players, session.activeBatterId, session.activeBowlerId) || !isEligibleBatter(session.players, session.activeBowlerId)) {
    return session;
  }

  return updateActivePlayers(session, session.activeBatterId, session.activeBowlerId);
}

export function rotateOverParticipants(session: Session) {
  const nextBowlerId = getNextEligiblePlayer(
    session.players,
    session.activeBowlerId,
    (player) => playerCanBowl(player) && player.id !== session.activeBatterId,
  );
  const nextBatterId = getNextEligiblePlayer(
    session.players,
    session.activeBatterId,
    (player) => playerCanBat(player) && player.id !== nextBowlerId,
  );

  return updateActivePlayers(session, nextBowlerId, nextBatterId);
}

export function syncGuidedAssignments(session: Session) {
  if (session.mode !== "guided_round_robin") {
    return session;
  }

  const assignment = getGuidedAssignmentForDeliveryCount(session, session.deliveries);

  return updateActivePlayers(session, assignment.activeBowlerId, assignment.activeBatterId);
}

export function getGuidedRoundRobinState(session: Session): GuidedRoundRobinState | null {
  if (session.mode !== "guided_round_robin" || !session.roundRobinConfig) {
    return null;
  }

  const plan = getGuidedOverPlan(session);

  if (plan.length === 0) {
    return null;
  }

  const legalDeliveriesCount = getLegalDeliveriesCount(session.deliveries);
  const totalCompletedOvers = Math.floor(legalDeliveriesCount / session.ballsPerOver);
  const referenceOver = Math.min(totalCompletedOvers, Math.max(plan.length - 1, 0));
  const currentPlanEntry = plan[referenceOver] ?? plan[plan.length - 1] ?? null;
  const assignment = getGuidedAssignmentForDeliveryCount(session, session.deliveries);

  if (!currentPlanEntry) {
    return null;
  }

  const remainingOversInBlock = session.status === "completed"
    ? 0
    : Math.max(
        session.roundRobinConfig.oversPerBatter - currentPlanEntry.batterOver - (session.currentBallInOver === 1 && legalDeliveriesCount > 0 ? 0 : 1),
        0,
      );

  return {
    currentBatterId: currentPlanEntry.batterId,
    currentBowlerId: assignment.activeBowlerId,
    plannedBowlerId: currentPlanEntry.bowlerId,
    eligibleBowlerIds: currentPlanEntry.eligibleBowlerIds,
    currentBatterIndex: currentPlanEntry.batterIndex,
    currentBatterOver: session.status === "completed" ? session.roundRobinConfig.oversPerBatter : currentPlanEntry.batterOver,
    oversPerBatter: session.roundRobinConfig.oversPerBatter,
    completedOvers: totalCompletedOvers,
    remainingOversInBlock,
    nextBatterId: currentPlanEntry.nextBatterId,
  };
}

export function completeSession(session: Session) {
  return {
    ...session,
    status: "completed" as const,
    updatedAt: new Date().toISOString(),
  };
}

export function resumeSession(session: Session) {
  const resumed = {
    ...session,
    status: session.deliveries.length > 0 ? ("live" as const) : ("setup" as const),
    updatedAt: new Date().toISOString(),
  };

  return resumed.mode === "guided_round_robin" ? syncGuidedAssignments(resumed) : resumed;
}

function formatShotType(shotType: ShotType | null) {
  if (!shotType) {
    return null;
  }

  return {
    drive: "Drive",
    pull: "Pull",
    lofted: "Lofted",
    punch: "Punch",
    cut: "Cut",
    flick: "Flick",
    edge: "Edge",
    others: "Others",
  }[shotType];
}

function formatOutType(outType: OutType | null) {
  if (!outType) {
    return null;
  }

  return {
    bowled: "Bowled",
    caught_out: "Caught",
    caught_and_bowled: "C&B",
    stumped: "Stumped",
    lbw: "LBW",
    run_out: "Run Out",
    hit_wicket: "Hit Wicket",
    others: "Others",
  }[outType];
}

export function formatBowlerTimelineItem(delivery: Delivery) {
  const parts: string[] = [delivery.bowlingOutcome];

  if (delivery.modifier === "ball_beat") {
    parts.push("BB");
  }

  if (delivery.bowlingOutcome === "GW" || delivery.bowlingOutcome === "BW") {
    const outType = formatOutType(delivery.outType);

    if (outType) {
      parts.push(outType);
    }
  }

  return parts.join("+");
}

export function formatBatterTimelineItem(delivery: Delivery) {
  const parts: string[] = [String(delivery.battingOutcome)];

  if (delivery.modifier === "wrong_shot") {
    parts.push("WS");
  }

  if (delivery.modifier === "ball_beat") {
    parts.push("BB");
  }

  const shotType = formatShotType(delivery.shotType);

  if (shotType) {
    parts.push(shotType);
  }

  if (delivery.battingOutcome === "W") {
    const outType = formatOutType(delivery.outType);

    if (outType) {
      parts.push(outType);
    }
  }

  return parts.join("+");
}

export function getPlayerAnalytics(session: Session): PlayerAnalytics[] {
  const enriched = session.players.map((player) => {
    const totalBallsBowled =
      player.goodBalls + player.badBalls + player.wicketsOnGoodBalls + player.wicketsOnBadBalls;
    const goodBallDeliveries = player.goodBalls + player.wicketsOnGoodBalls;
    const bowlerTimeline = session.deliveries
      .filter((delivery) => delivery.bowlerId === player.id)
      .map(formatBowlerTimelineItem);
    const batterTimeline = session.deliveries
      .filter((delivery) => delivery.batterId === player.id)
      .map(formatBatterTimelineItem);

    return {
      ...player,
      totalBallsBowled,
      goodBallPercentage: totalBallsBowled === 0 ? 0 : (goodBallDeliveries / totalBallsBowled) * 100,
      bowlerTimeline,
      batterTimeline,
    };
  });

  return enriched.sort((left, right) => {
    if (right.totalSessionScore !== left.totalSessionScore) {
      return right.totalSessionScore - left.totalSessionScore;
    }

    if (right.bowlingPoints !== left.bowlingPoints) {
      return right.bowlingPoints - left.bowlingPoints;
    }

    if (right.battingNetScore !== left.battingNetScore) {
      return right.battingNetScore - left.battingNetScore;
    }

    return left.argumentsCount - right.argumentsCount;
  });
}

export function formatBallLabel(overNumber: number, ballInOver: number) {
  return `${overNumber}.${ballInOver}`;
}
