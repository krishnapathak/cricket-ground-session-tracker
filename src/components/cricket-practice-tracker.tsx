"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  BarChart3,
  CircleDot,
  History,
  Play,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Target,
  Trash2,
  Trophy,
  Undo2,
  Users,
  Waypoints,
} from "lucide-react";
import {
  addArgumentPenalty,
  completeSession,
  createSession,
  cycleActivePlayer,
  formatBallLabel,
  getGuidedRoundRobinState,
  getPlayerAnalytics,
  recordDelivery,
  resumeSession,
  rotateOverParticipants,
  swapActiveRoles,
  syncGuidedAssignments,
  undoLastDelivery,
  updateActivePlayers,
} from "@/lib/scoring";
import {
  clearSession,
  deleteSession,
  loadSession,
  loadSessionHistory,
  saveSession,
  setActiveSession,
} from "@/lib/storage";
import {
  BattingOutcome,
  BowlingOutcome,
  PendingDelivery,
  Session,
  SessionMode,
} from "@/lib/types";

const bowlingOptions: BowlingOutcome[] = ["G", "B", "GW", "BW"];
const battingOptions: BattingOutcome[] = [0, 1, 2, 3, 4, 5, 6, "W"];

const buttonTone: Record<string, string> = {
  G: "border-glow/50 bg-glow/20 text-glow",
  B: "border-slate-500 bg-slate-500/15 text-slate-100",
  GW: "border-aqua/50 bg-aqua/20 text-aqua",
  BW: "border-amber/50 bg-amber/20 text-amber",
  W: "border-coral/50 bg-coral/20 text-coral",
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatSessionDate(value: string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CricketPracticeTracker() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("Evening Nets");
  const [mode, setMode] = useState<SessionMode>("manual");
  const [totalOvers, setTotalOvers] = useState("20");
  const [oversPerBatter, setOversPerBatter] = useState("6");
  const [playerNames, setPlayerNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [pendingDelivery, setPendingDelivery] = useState<PendingDelivery>({
    bowlingOutcome: null,
    battingOutcome: null,
  });
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    setSession(loadSession());
    setSessionHistory(loadSessionHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    setSessionHistory(saveSession(session));
  }, [session]);

  const analytics = session ? getPlayerAnalytics(session) : [];
  const guidedState = session ? getGuidedRoundRobinState(session) : null;
  const completedBalls = session
    ? Math.min(session.deliveries.length, session.totalOvers * session.ballsPerOver)
    : 0;
  const sessionProgress = session
    ? Math.min((completedBalls / (session.totalOvers * session.ballsPerOver)) * 100, 100)
    : 0;
  const displayOver = session ? Math.min(session.currentOverNumber, session.totalOvers) : 0;
  const displayBall = session
    ? session.status === "completed"
      ? session.ballsPerOver
      : session.currentBallInOver
    : 0;
  const latestDeliveries = useMemo(
    () => (session ? [...session.deliveries].slice(-10).reverse() : []),
    [session],
  );
  const overRotationReady = Boolean(
    session && session.status !== "completed" && session.mode === "manual" && session.deliveries.length > 0 && session.currentBallInOver === 1,
  );
  const guidedTotalOversPreview =
    mode === "guided_round_robin"
      ? Math.max(playerNames.map((name) => name.trim()).filter(Boolean).length, 0) * Math.max(Number(oversPerBatter) || 0, 0)
      : 0;

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  }

  function addPlayerField() {
    setPlayerNames((current) => [...current, `Player ${current.length + 1}`]);
  }

  function removePlayerField(index: number) {
    setPlayerNames((current) => current.filter((_, nameIndex) => nameIndex !== index));
  }

  function handleCreateSession() {
    const cleanedNames = playerNames.map((name) => name.trim()).filter(Boolean);
    const parsedOvers = Number(totalOvers);
    const parsedOversPerBatter = Number(oversPerBatter);

    if (cleanedNames.length < 2) {
      setSetupError("Add at least two players to start the session.");
      return;
    }

    if (mode === "manual" && (!Number.isFinite(parsedOvers) || parsedOvers <= 0)) {
      setSetupError("Enter a valid number of overs greater than zero.");
      return;
    }

    if (mode === "guided_round_robin" && (!Number.isFinite(parsedOversPerBatter) || parsedOversPerBatter <= 0)) {
      setSetupError("Enter a valid overs-per-batter value greater than zero.");
      return;
    }

    setSetupError("");
    setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
    setSession(
      createSession(title, cleanedNames, parsedOvers, {
        mode,
        oversPerBatter: parsedOversPerBatter,
      }),
    );
  }

  function handleOpenSession(nextSession: Session) {
    setActiveSession(nextSession.id);
    setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
    setSession(nextSession);
  }

  function handleNewSession() {
    clearSession();
    setSession(null);
    setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
  }

  function handleDeleteSession(sessionId: string) {
    const nextHistory = deleteSession(sessionId);
    setSessionHistory(nextHistory);

    if (session?.id === sessionId) {
      setSession(null);
      setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
    }
  }

  function handleSelectPlayers(field: "bowler" | "batter", playerId: string) {
    if (!session) {
      return;
    }

    const nextBowlerId = field === "bowler" ? playerId : session.activeBowlerId;
    const nextBatterId = field === "batter" ? playerId : session.activeBatterId;

    setSession((current) =>
      current ? updateActivePlayers(current, nextBowlerId, nextBatterId) : current,
    );
  }

  function commitDelivery(nextPending: PendingDelivery) {
    if (!session || !session.activeBowlerId || !session.activeBatterId) {
      return;
    }

    if (!nextPending.bowlingOutcome || nextPending.battingOutcome === null) {
      setPendingDelivery(nextPending);
      return;
    }

    const bowlingOutcome = nextPending.bowlingOutcome;
    const battingOutcome = nextPending.battingOutcome;

    setSession((current) => {
      if (!current || !current.activeBowlerId || !current.activeBatterId) {
        return current;
      }

      return recordDelivery(current, {
        bowlerId: current.activeBowlerId,
        batterId: current.activeBatterId,
        bowlingOutcome,
        battingOutcome,
      });
    });
    setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
  }

  function handleBowlingSelect(outcome: BowlingOutcome) {
    commitDelivery({
      ...pendingDelivery,
      bowlingOutcome: outcome,
    });
  }

  function handleBattingSelect(outcome: BattingOutcome) {
    commitDelivery({
      ...pendingDelivery,
      battingOutcome: outcome,
    });
  }

  function handleArgument(playerId: string) {
    setSession((current) => (current ? addArgumentPenalty(current, playerId) : current));
  }

  function handleResume() {
    setSession((current) => (current ? resumeSession(current) : current));
  }

  function handleFinish() {
    setSession((current) => (current ? completeSession(current) : current));
  }

  function handleUndoLastBall() {
    setPendingDelivery({ bowlingOutcome: null, battingOutcome: null });
    setSession((current) => (current ? undoLastDelivery(current) : current));
  }

  function handleRotateOver() {
    setSession((current) => (current ? rotateOverParticipants(current) : current));
  }

  function handleCycleRole(role: "bowler" | "batter") {
    setSession((current) => (current ? cycleActivePlayer(current, role) : current));
  }

  function handleSwapRoles() {
    setSession((current) => (current ? swapActiveRoles(current) : current));
  }

  function handleSyncGuidedPlan() {
    setSession((current) => (current ? syncGuidedAssignments(current) : current));
  }

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-slate-200">
        Loading session...
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <Hero />
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-panel/80 p-5 shadow-glow backdrop-blur sm:p-7">
              <div className="flex items-center gap-3 text-glow">
                <Users className="h-5 w-5" />
                <p className="font-display text-2xl uppercase tracking-[0.22em]">Session Setup</p>
              </div>
              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm uppercase tracking-[0.22em] text-slate-400">Session Title</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-panelAlt px-4 py-3 text-base text-white outline-none transition focus:border-glow/60"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Morning Skills Block"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm uppercase tracking-[0.22em] text-slate-400">Practice Format</span>
                  <select
                    className="rounded-2xl border border-white/10 bg-panelAlt px-4 py-3 text-base text-white outline-none transition focus:border-glow/60"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as SessionMode)}
                  >
                    <option value="manual">Manual Scoring</option>
                    <option value="guided_round_robin">Guided Round Robin</option>
                  </select>
                </label>
                {mode === "manual" ? (
                  <label className="grid gap-2">
                    <span className="text-sm uppercase tracking-[0.22em] text-slate-400">Total Overs</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-panelAlt px-4 py-3 text-base text-white outline-none transition focus:border-glow/60"
                      value={totalOvers}
                      onChange={(event) => setTotalOvers(event.target.value)}
                      inputMode="numeric"
                      placeholder="20"
                    />
                  </label>
                ) : (
                  <>
                    <label className="grid gap-2">
                      <span className="text-sm uppercase tracking-[0.22em] text-slate-400">Overs Per Batter</span>
                      <input
                        className="rounded-2xl border border-white/10 bg-panelAlt px-4 py-3 text-base text-white outline-none transition focus:border-glow/60"
                        value={oversPerBatter}
                        onChange={(event) => setOversPerBatter(event.target.value)}
                        inputMode="numeric"
                        placeholder="6"
                      />
                    </label>
                    <div className="rounded-2xl border border-aqua/20 bg-aqua/10 px-4 py-4 text-sm text-slate-200">
                      <p className="font-semibold text-white">Guided Round Robin Preview</p>
                      <p className="mt-1">Total overs will be auto-calculated as `players × overs per batter`.</p>
                      <p className="mt-2 text-aqua">Current preview: {guidedTotalOversPreview} overs</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <p className="font-display text-2xl uppercase tracking-[0.18em] text-white">Players</p>
                <button
                  className="rounded-full border border-glow/40 bg-glow/15 px-4 py-2 text-sm font-semibold text-glow transition hover:bg-glow/25"
                  onClick={addPlayerField}
                >
                  Add Player
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {playerNames.map((player, index) => (
                  <div
                    key={`player-input-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0d1320] px-3 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/6 font-display text-lg text-aqua">
                      {index + 1}
                    </span>
                    <input
                      className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                      value={player}
                      onChange={(event) => updatePlayerName(index, event.target.value)}
                      placeholder={`Player ${index + 1}`}
                    />
                    <button
                      className="rounded-full border border-coral/25 px-3 py-1.5 text-sm text-coral disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => removePlayerField(index)}
                      disabled={playerNames.length <= 2}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {setupError ? (
                <div className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
                  {setupError}
                </div>
              ) : null}

              <button
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-[22px] bg-glow px-5 py-4 font-display text-2xl uppercase tracking-[0.18em] text-slate-950 transition hover:brightness-105"
                onClick={handleCreateSession}
              >
                <Play className="h-5 w-5" />
                Start Session
              </button>
            </div>

            <div className="grid gap-6">
              <aside className="rounded-[28px] border border-white/10 bg-[#0d1320]/90 p-5 shadow-ring sm:p-7">
                <p className="font-display text-2xl uppercase tracking-[0.18em] text-white">Scoring Model</p>
                <div className="mt-5 grid gap-4">
                  <InfoCard
                    icon={<Target className="h-5 w-5" />}
                    title="Bowling"
                    lines={["G = +1", "B = 0", "GW = +2", "BW = +1"]}
                  />
                  <InfoCard
                    icon={<BadgeIndianRupee className="h-5 w-5" />}
                    title="Batting"
                    lines={["Runs are cumulative", "W = -5 net batting score"]}
                  />
                  <InfoCard
                    icon={<ShieldAlert className="h-5 w-5" />}
                    title="Conduct"
                    lines={["Argument = -2 total session points", "Penalty can be applied any time"]}
                  />
                </div>
              </aside>

              <aside className="rounded-[28px] border border-white/10 bg-panel/80 p-5 shadow-ring backdrop-blur sm:p-7">
                <div className="flex items-center gap-3 text-aqua">
                  <History className="h-5 w-5" />
                  <p className="font-display text-2xl uppercase tracking-[0.18em] text-white">Saved Sessions</p>
                </div>
                <div className="mt-5 grid gap-3">
                  {sessionHistory.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                      Completed and in-progress sessions will appear here for quick reload.
                    </div>
                  ) : (
                    sessionHistory.map((savedSession) => (
                      <div
                        key={savedSession.id}
                        className="rounded-[22px] border border-white/8 bg-[#0c111d] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-2xl uppercase tracking-[0.12em] text-white">
                              {savedSession.title}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              {savedSession.players.length} players • {savedSession.totalOvers} overs • {savedSession.deliveries.length} balls
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                              {savedSession.mode === "guided_round_robin" ? "guided" : "manual"} • {savedSession.status} • updated {formatSessionDate(savedSession.updatedAt)}
                            </p>
                          </div>
                          <button
                            className="rounded-full border border-coral/25 p-2 text-coral transition hover:bg-coral/10"
                            onClick={() => handleDeleteSession(savedSession.id)}
                            aria-label={`Delete ${savedSession.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <button
                            className="rounded-full border border-aqua/30 bg-aqua/15 px-4 py-2 text-sm font-semibold text-aqua"
                            onClick={() => handleOpenSession(savedSession)}
                          >
                            Open Session
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const activeBowler = session.players.find((player) => player.id === session.activeBowlerId) ?? null;
  const activeBatter = session.players.find((player) => player.id === session.activeBatterId) ?? null;
  const livePlayers = session.players;
  const guidedCurrentBatter = guidedState
    ? session.players.find((player) => player.id === guidedState.currentBatterId) ?? null
    : null;
  const guidedCurrentBowler = guidedState
    ? session.players.find((player) => player.id === guidedState.currentBowlerId) ?? null
    : null;
  const guidedNextBatter = guidedState
    ? session.players.find((player) => player.id === guidedState.nextBatterId) ?? null
    : null;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-[28px] border border-white/10 bg-panel/85 p-5 shadow-glow backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.26em] text-aqua">Cricket Practice Tracker</p>
              <h1 className="mt-2 font-display text-4xl uppercase tracking-[0.16em] text-white sm:text-5xl">
                {session.title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {session.players.length} players • {session.totalOvers} overs • {session.deliveries.length} balls recorded • {session.mode === "guided_round_robin" ? "Guided Round Robin" : "Manual"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {session.status === "completed" ? (
                <button
                  className="rounded-full border border-aqua/35 bg-aqua/15 px-4 py-2 text-sm font-semibold text-aqua"
                  onClick={handleResume}
                >
                  Reopen Session
                </button>
              ) : (
                <button
                  className="rounded-full border border-glow/35 bg-glow/15 px-4 py-2 text-sm font-semibold text-glow"
                  onClick={handleFinish}
                >
                  Finish Session
                </button>
              )}
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                onClick={handleNewSession}
              >
                New Session
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/8 bg-[#0c111d] p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400">
              <span>Session Progress</span>
              <span>
                Over {displayOver} of {session.totalOvers} • Ball {displayBall}/{session.ballsPerOver}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-gradient-to-r from-aqua via-glow to-amber transition-all"
                style={{ width: `${sessionProgress}%` }}
              />
            </div>
          </div>
        </section>

        {session.mode === "guided_round_robin" && guidedState ? (
          <section className="rounded-[28px] border border-aqua/20 bg-[#0d1320]/85 p-5 shadow-ring sm:p-6">
            <div className="flex items-center gap-3 text-aqua">
              <Waypoints className="h-5 w-5" />
              <p className="font-display text-2xl uppercase tracking-[0.18em] text-white">Guided Round Robin</p>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <Stat label="Current Batter" value={guidedCurrentBatter?.name ?? "-"} />
              <Stat label="Batter Over" value={`${guidedState.currentBatterOver}/${guidedState.oversPerBatter}`} />
              <Stat label="Planned Bowler" value={guidedCurrentBowler?.name ?? "-"} />
              <Stat label="Next Batter" value={guidedNextBatter?.name ?? "Final block"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-full border border-aqua/30 bg-aqua/15 px-4 py-2 text-sm font-semibold text-aqua"
                onClick={handleSyncGuidedPlan}
              >
                Sync To Guided Plan
              </button>
              <p className="self-center text-sm text-slate-400">
                Batter stays for {guidedState.oversPerBatter} overs while the non-batters rotate automatically over by over.
              </p>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Active Bowler" icon={<Target className="h-5 w-5" />}>
                <PlayerSelector
                  players={livePlayers}
                  activePlayerId={session.activeBowlerId}
                  otherActiveId={session.activeBatterId}
                  onSelect={(playerId) => handleSelectPlayers("bowler", playerId)}
                />
                <PlayerHighlight
                  label="Bowling now"
                  name={activeBowler?.name ?? "Choose bowler"}
                  statLabel="Current timeline"
                  statValue={
                    activeBowler
                      ? session.deliveries
                          .filter((delivery) => delivery.bowlerId === activeBowler.id)
                          .slice(-6)
                          .map((delivery) => delivery.bowlingOutcome)
                          .join(" • ") || "No balls yet"
                      : "No bowler selected"
                  }
                />
              </Panel>

              <Panel title="Active Batter" icon={<CircleDot className="h-5 w-5" />}>
                <PlayerSelector
                  players={livePlayers}
                  activePlayerId={session.activeBatterId}
                  otherActiveId={session.activeBowlerId}
                  onSelect={(playerId) => handleSelectPlayers("batter", playerId)}
                />
                <PlayerHighlight
                  label="Facing now"
                  name={activeBatter?.name ?? "Choose batter"}
                  statLabel="Current timeline"
                  statValue={
                    activeBatter
                      ? session.deliveries
                          .filter((delivery) => delivery.batterId === activeBatter.id)
                          .slice(-6)
                          .map((delivery) => delivery.battingOutcome)
                          .join(" • ") || "No balls yet"
                      : "No batter selected"
                  }
                />
              </Panel>
            </div>

            {session.status !== "completed" ? (
              <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <Panel title="Ball Input" icon={<Play className="h-5 w-5" />}>
                  <p className="text-sm text-slate-400">
                    Tap a bowling outcome and batting outcome in any order. The ball records automatically once both are selected.
                  </p>
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bowling Outcome</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {bowlingOptions.map((option) => (
                        <button
                          key={option}
                          className={cn(
                            "rounded-[22px] border px-4 py-5 font-display text-3xl uppercase tracking-[0.14em] transition hover:-translate-y-0.5",
                            buttonTone[option],
                            pendingDelivery.bowlingOutcome === option && "ring-2 ring-white/70",
                          )}
                          onClick={() => handleBowlingSelect(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Batting Outcome</p>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {battingOptions.map((option) => (
                        <button
                          key={option}
                          className={cn(
                            "rounded-[20px] border px-3 py-4 font-display text-2xl uppercase tracking-[0.14em] transition hover:-translate-y-0.5",
                            buttonTone[String(option)] ?? "border-white/10 bg-white/5 text-white",
                            pendingDelivery.battingOutcome === option && "ring-2 ring-white/70",
                          )}
                          onClick={() => handleBattingSelect(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-[20px] border border-white/8 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    <span className="text-slate-500">Pending ball:</span> {pendingDelivery.bowlingOutcome ?? "?"} / {pendingDelivery.battingOutcome ?? "?"}
                  </div>
                </Panel>

                <div className="grid gap-5">
                  <Panel title="Rotation Helpers" icon={<SkipForward className="h-5 w-5" />}>
                    <p className="text-sm text-slate-400">
                      Manual controls stay available in every session type. Guided round-robin sessions will still snap back to the planned over rotation after each completed over.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        className="rounded-[20px] border border-aqua/25 bg-aqua/10 px-4 py-4 text-left transition hover:bg-aqua/15"
                        onClick={() => handleCycleRole("bowler")}
                      >
                        <span className="block font-semibold text-white">Next Bowler</span>
                        <span className="text-sm text-slate-400">Advance to the next available bowler</span>
                      </button>
                      <button
                        className="rounded-[20px] border border-aqua/25 bg-aqua/10 px-4 py-4 text-left transition hover:bg-aqua/15"
                        onClick={() => handleCycleRole("batter")}
                      >
                        <span className="block font-semibold text-white">Next Batter</span>
                        <span className="text-sm text-slate-400">Advance to the next available batter</span>
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        className="rounded-[20px] border border-amber/25 bg-amber/10 px-4 py-4 text-left transition hover:bg-amber/15"
                        onClick={handleSwapRoles}
                      >
                        <span className="block font-semibold text-white">Swap Roles</span>
                        <span className="text-sm text-slate-400">Useful for 2-player verification and quick manual swaps</span>
                      </button>
                      {session.mode === "manual" ? (
                        <button
                          className={cn(
                            "rounded-[20px] border px-4 py-4 text-left transition",
                            overRotationReady
                              ? "border-glow/30 bg-glow/10 hover:bg-glow/15"
                              : "border-white/10 bg-white/5 opacity-50",
                          )}
                          onClick={handleRotateOver}
                          disabled={!overRotationReady}
                        >
                          <span className="block font-semibold text-white">Rotate Over</span>
                          <span className="text-sm text-slate-400">Move both active roles forward once the previous over is complete.</span>
                        </button>
                      ) : (
                        <button
                          className="rounded-[20px] border border-glow/25 bg-glow/10 px-4 py-4 text-left transition hover:bg-glow/15"
                          onClick={handleSyncGuidedPlan}
                        >
                          <span className="block font-semibold text-white">Resync Guided Plan</span>
                          <span className="text-sm text-slate-400">Restore the scheduled batter and bowler for the current over.</span>
                        </button>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Recovery" icon={<Undo2 className="h-5 w-5" />}>
                    <p className="text-sm text-slate-400">
                      Undo the most recent ball if the scorer tapped the wrong result. Argument penalties remain untouched.
                    </p>
                    <button
                      className="mt-4 flex w-full items-center justify-between rounded-[20px] border border-amber/25 bg-amber/10 px-4 py-4 text-left transition hover:bg-amber/15 disabled:opacity-50"
                      onClick={handleUndoLastBall}
                      disabled={session.deliveries.length === 0}
                    >
                      <span>
                        <span className="block font-semibold text-white">Undo Last Ball</span>
                        <span className="text-sm text-slate-400">
                          {session.deliveries.length === 0
                            ? "No recorded deliveries yet"
                            : `Remove ${formatBallLabel(session.deliveries[session.deliveries.length - 1]!.overNumber, session.deliveries[session.deliveries.length - 1]!.ballInOver)}`}
                        </span>
                      </span>
                      <Undo2 className="h-5 w-5 text-amber" />
                    </button>
                  </Panel>

                  <Panel title="Conduct Control" icon={<AlertTriangle className="h-5 w-5" />}>
                    <p className="text-sm text-slate-400">
                      Apply an argument penalty instantly. Each tap deducts 2 points from the player&apos;s total session score.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {livePlayers.map((player) => (
                        <button
                          key={player.id}
                          className="flex items-center justify-between rounded-[20px] border border-coral/20 bg-coral/10 px-4 py-4 text-left transition hover:bg-coral/15"
                          onClick={() => handleArgument(player.id)}
                        >
                          <span>
                            <span className="block font-semibold text-white">{player.name}</span>
                            <span className="text-sm text-slate-400">{player.argumentsCount} arguments logged</span>
                          </span>
                          <span className="rounded-full border border-coral/30 px-3 py-1 text-sm font-semibold text-coral">
                            -2 points
                          </span>
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>
              </section>
            ) : null}

            <Panel title="Session Timeline" icon={<BarChart3 className="h-5 w-5" />}>
              <div className="grid gap-5 xl:grid-cols-2">
                {analytics.map((player) => (
                  <div key={player.id} className="rounded-[22px] border border-white/8 bg-[#0c111d] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl uppercase tracking-[0.12em] text-white">{player.name}</p>
                        <p className="text-sm text-slate-400">Total score {player.totalSessionScore}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Rank #{analytics.findIndex((entry) => entry.id === player.id) + 1}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <TimelineRow label="Bowler" items={player.bowlerTimeline} emptyLabel="No bowling deliveries yet" />
                      <TimelineRow label="Batter" items={player.batterTimeline} emptyLabel="No batting deliveries yet" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5">
            <Panel title="Leaderboard" icon={<Trophy className="h-5 w-5" />}>
              <div className="grid gap-3">
                {analytics.map((player, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      "rounded-[20px] border px-4 py-4",
                      index === 0 ? "border-glow/35 bg-glow/12" : "border-white/8 bg-white/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl uppercase tracking-[0.12em] text-white">
                          #{index + 1} {player.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          Bowl {player.bowlingPoints} • Bat {player.battingNetScore} • Penalty {player.conductPenalty}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-3xl text-white">{player.totalSessionScore}</p>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Recent Balls" icon={<RotateCcw className="h-5 w-5" />}>
              <div className="grid gap-3">
                {latestDeliveries.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                    Live balls will appear here as you score them.
                  </div>
                ) : (
                  latestDeliveries.map((delivery) => {
                    const bowler = session.players.find((player) => player.id === delivery.bowlerId);
                    const batter = session.players.find((player) => player.id === delivery.batterId);

                    return (
                      <div key={delivery.id} className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-display text-xl uppercase tracking-[0.12em] text-white">
                            {formatBallLabel(delivery.overNumber, delivery.ballInOver)}
                          </p>
                          <div className="flex gap-2">
                            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", buttonTone[delivery.bowlingOutcome])}>
                              {delivery.bowlingOutcome}
                            </span>
                            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", buttonTone[String(delivery.battingOutcome)] ?? "border-white/10 bg-white/5 text-white")}>
                              {delivery.battingOutcome}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {bowler?.name ?? "Bowler"} to {batter?.name ?? "Batter"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#0d1320]/85 p-5 shadow-ring sm:p-6">
          <div className="flex items-center gap-3 text-amber">
            <BarChart3 className="h-5 w-5" />
            <p className="font-display text-2xl uppercase tracking-[0.18em]">Summary Report</p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {analytics.map((player) => (
              <div key={player.id} className="rounded-[22px] border border-white/8 bg-ink/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl uppercase tracking-[0.12em] text-white">{player.name}</p>
                    <p className="text-sm text-slate-400">
                      Net batting {player.battingNetScore} • Bowling {player.bowlingPoints}
                    </p>
                  </div>
                  <span className="rounded-full border border-aqua/25 px-3 py-1 text-sm font-semibold text-aqua">
                    {player.goodBallPercentage.toFixed(0)}% good balls
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Runs" value={player.battingRuns} />
                  <Stat label="Dismissals" value={player.battingDismissals} />
                  <Stat label="Good balls" value={player.goodBalls + player.wicketsOnGoodBalls} />
                  <Stat label="Bad balls" value={player.badBalls + player.wicketsOnBadBalls} />
                  <Stat label="Wickets on good" value={player.wicketsOnGoodBalls} />
                  <Stat label="Wickets on bad" value={player.wicketsOnBadBalls} />
                  <Stat label="Arguments" value={player.argumentsCount} />
                  <Stat label="Session total" value={player.totalSessionScore} emphasis />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-panel/80 p-6 shadow-glow sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-aqua">Sports Pro Dashboard</p>
          <h1 className="mt-3 font-display text-5xl uppercase tracking-[0.12em] text-white sm:text-6xl">
            Score practice ball by ball.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            Track any squad size, define session overs, or let the app guide a round-robin practice block where one batter stays in while the bowlers rotate over by over.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <SplashStat label="Any squad size" value="Flexible" />
          <SplashStat label="Round robin" value="Guided" />
          <SplashStat label="Manual controls" value="Still here" />
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-panel/85 p-5 shadow-ring backdrop-blur sm:p-6">
      <div className="flex items-center gap-3 text-white">
        <span className="text-aqua">{icon}</span>
        <p className="font-display text-2xl uppercase tracking-[0.18em]">{title}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PlayerSelector({
  players,
  activePlayerId,
  otherActiveId,
  onSelect,
}: {
  players: Session["players"];
  activePlayerId: string | null;
  otherActiveId: string | null;
  onSelect: (playerId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((player) => {
        const selected = player.id === activePlayerId;
        const disabled = player.id === otherActiveId;

        return (
          <button
            key={player.id}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              selected
                ? "border-glow/40 bg-glow/15 text-glow"
                : "border-white/10 bg-white/5 text-slate-200",
              disabled && "cursor-not-allowed opacity-40",
            )}
            onClick={() => onSelect(player.id)}
            disabled={disabled}
          >
            {player.name}
          </button>
        );
      })}
    </div>
  );
}

function PlayerHighlight({
  label,
  name,
  statLabel,
  statValue,
}: {
  label: string;
  name: string;
  statLabel: string;
  statValue: string;
}) {
  return (
    <div className="mt-5 rounded-[22px] border border-white/8 bg-[#0c111d] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-white">{name}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">{statLabel}</p>
      <p className="mt-2 text-sm text-slate-300">{statValue}</p>
    </div>
  );
}

function TimelineRow({
  label,
  items,
  emptyLabel,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {items.length === 0 ? (
          <span className="rounded-full border border-dashed border-white/10 px-3 py-2 text-sm text-slate-500">
            {emptyLabel}
          </span>
        ) : (
          items.map((item, index) => (
            <span
              key={`${label}-${item}-${index}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-sm font-semibold",
                buttonTone[item] ?? "border-white/10 bg-white/5 text-white",
              )}
            >
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  lines,
}: {
  icon: ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-ink/70 p-4">
      <div className="flex items-center gap-3 text-white">
        <span className="text-aqua">{icon}</span>
        <p className="font-display text-2xl uppercase tracking-[0.16em]">{title}</p>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-slate-300">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function SplashStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0d1320] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-white">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-3 py-3",
        emphasis ? "border-glow/25 bg-glow/10" : "border-white/8 bg-white/5",
      )}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl uppercase tracking-[0.1em] text-white">{value}</p>
    </div>
  );
}
