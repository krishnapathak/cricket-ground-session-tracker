# Cricket Practice Tracker

## Project Overview

Cricket Practice Tracker is a responsive web application for managing and scoring structured cricket practice sessions. The product is designed for configurable practice groups where the organizer defines:

- The number of players participating in the session
- The total number of overs for the current practice session

The application must support fast live entry during practice, preserve a complete delivery-by-delivery timeline, and generate a post-session performance summary with rankings and analytics.

## Business Requirements

### Session Structure

- A session supports any practical number of players defined during setup.
- A session has a configurable total overs target defined during setup.
- The app must store the configured player list and overs count as part of the session configuration.
- Bowling and batting opportunities should be tracked against the configured session length rather than a fixed 10-over-per-player format.
- The app must allow an operator to choose the active bowler and active batter during live scoring.
- Every delivery must be recorded as a discrete event for reporting and timeline reconstruction.

### Session Configuration Rules

- Before live scoring begins, the user must be able to:
  - Add any number of players
  - Edit player names
  - Remove players
  - Define the total overs for the current session
- The application should validate that:
  - at least 2 players exist before a session can start
  - the overs count is greater than 0
- The product should not assume equal batting or bowling distribution across all players unless that rule is introduced later.

### Bowling Rules

Bowling performance is scored per ball using line-discipline outcomes.

#### Outcome Types

- `G` (Good Ball): +1 point
- `B` (Bad Ball): +0 points
- `GW` (Wicket on Good Ball): +2 points
- `BW` (Wicket on Bad Ball): +1 point

#### Good Ball Definition

A good ball is one that lands on:

- Off stump line
- Middle stump line
- 4th stump line
- Leg stump line

Any delivery outside the accepted lines is considered a bad ball.

### Batting Rules

Batting score is a cumulative run total.

#### Outcome Types

- `0` to `6`: Add those runs to batting total
- `W` (Dismissal): subtract 5 runs from the player’s current batting total

#### Batting Notes

- The score must remain traceable by delivery in timeline order.
- A dismissal is recorded as a batting event, not as runs.
- The application should support negative batting totals if dismissals exceed runs scored unless business rules are later revised.

### Conduct Rule

- Every argument instance deducts `-2` points from the player’s total session score.
- The penalty must be applicable to any player at any time during the session.
- Argument penalties should be visible in the summary and included in leaderboard calculations.

### Total Session Score

Each player’s total session score should be calculated as:

`totalSessionScore = bowlingPoints + battingNetScore - (argumentCount * 2)`

Where:

- `bowlingPoints` = total points from bowling outcomes
- `battingNetScore` = batting runs minus dismissal penalties
- `argumentCount * 2` = conduct penalty total

## Product Goals

- Minimize taps required during live scoring
- Preserve complete delivery history for both bowlers and batters
- Provide a clear leaderboard at the end of the session
- Make performance patterns easy to understand through timeline and analytics views
- Work smoothly on mobile devices first, while also scaling cleanly to desktop

## Tech Stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Lucide React icons

## Implementation Phases

### Phase 1

Create `project-context.md` with requirements, configurable session rules, models, journeys, and design direction.

### Phase 2

Build the persistence layer using browser `localStorage` as the default storage mechanism.

### Phase 3

Develop the live scoring dashboard with:

- Active bowler selector
- Active batter selector
- One-tap delivery actions
- Argument penalty actions
- Session timeline visualization for both roles

### Phase 4

Build the summary report and leaderboard with ranking and analytics.

## Core Entities and Data Models

The following interfaces define the expected application model in TypeScript.

```ts
export type BowlingOutcome = "G" | "B" | "GW" | "BW";
export type BattingOutcome = 0 | 1 | 2 | 3 | 4 | 5 | 6 | "W";

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

export interface Session {
  id: string;
  title: string;
  status: "setup" | "live" | "completed";
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
}
```

### Data Model Notes

- `players` is dynamic and reflects the exact participant list entered during setup.
- `totalOvers` is session-configurable and drives progress indicators and completion logic.
- `ballsPerOver` should default to `6` in this version to keep over calculations explicit and extensible.
- `currentOverNumber` and `currentBallInOver` support live scoring progress and resume state after refresh.

## Derived Metrics and Analytics

The summary report must calculate the following values for each player.

### Bowling Analytics

- Total bowling points
- Total balls bowled
- Total good balls
- Total bad balls
- Total wickets on good balls
- Total wickets on bad balls
- Good ball percentage

Suggested formula:

`goodBallPercentage = (goodBalls + wicketsOnGoodBalls) / totalBallsBowled * 100`

Where:

- `totalBallsBowled = goodBalls + badBalls + wicketsOnGoodBalls + wicketsOnBadBalls`
- `wicketsOnGoodBalls` counts as a good-ball-line delivery
- `wicketsOnBadBalls` counts as a bad-ball-line delivery

### Batting Analytics

- Total runs scored
- Total balls played
- Total dismissals
- Net batting score

Suggested formula:

`battingNetScore = battingRuns - (battingDismissals * 5)`

### Conduct Analytics

- Total arguments
- Total conduct penalty

Suggested formula:

`conductPenalty = argumentsCount * 2`

### Leaderboard Metric

- Sort descending by `totalSessionScore`
- Tie-break suggestion:
  1. Higher bowling points
  2. Higher batting net score
  3. Fewer arguments

## Session Timeline Requirements

The application must record and render a chronological session timeline for both bowling and batting.

### Bowler Timeline

Display each delivery using compact bowling codes:

- `G`
- `B`
- `GW`
- `BW`

Example:

`G | G | B | GW | B | G`

### Batter Timeline

Display each batting event in sequence:

- `0`
- `1`
- `2`
- `3`
- `4`
- `5`
- `6`
- `W`

Example:

`1 | 4 | 0 | W | 2 | 6`

### Timeline Behavior

- Every delivery stores both bowling and batting outcomes together.
- Timelines must be filterable or grouped by player in the live view and report view.
- Over and ball numbering should be visible in at least one detailed view.
- Most recent delivery should be easy to identify.

## User Journeys

### 1. Setup Session

- User opens the app
- User enters the session title if desired
- User adds any number of player names
- User sets the total number of overs for the practice session
- User creates a new session
- App validates the setup inputs
- App initializes player stats, session progress state, and empty timelines

### 2. Start Session

- User lands on the live scoring dashboard
- User selects the active bowler
- User selects the active batter
- App shows configured total overs, current over, ball count, and quick scoring controls

### 3. Input Live Data

- User taps bowling outcome button: `G`, `B`, `GW`, or `BW`
- User taps batting outcome button: `0` to `6` or `W`
- App saves the delivery instantly
- App updates:
  - player totals
  - over progress
  - live timelines
  - leaderboard preview
- If an argument occurs, user taps an `Argument` button and assigns the penalty to a player

### 4. View Summary Report

- User completes the session
- App transitions to the report view
- User sees:
  - final leaderboard
  - bowling analytics
  - batting analytics
  - argument penalties
  - player timelines

## Functional Requirements

### Live Scoring Dashboard

- Must support fast mobile-friendly entry
- Must allow changing active bowler and active batter at any time
- Must display session progress against the configured total overs
- Must show current ball and over state
- Must provide one-tap controls for:
  - `G`
  - `B`
  - `GW`
  - `BW`
  - `0` through `6`
  - `W`
  - `Argument`
- Must prevent incomplete delivery records by ensuring bowling and batting events are both captured for each ball

### Session Setup

- Must allow users to add any number of players
- Must allow users to remove players before the session starts
- Must allow users to define the total overs for the session
- Must validate minimum viable setup before entering live mode

### Persistence Layer

- Session data should persist across refresh using `localStorage`
- The app should restore the last active session automatically
- Writes should happen after every scoring event
- Data model should be easy to upgrade later to a server-backed API

### Summary Report

- Must display ranked players from best to worst
- Must show total session score
- Must show net batting score
- Must show bowling points
- Must show conduct penalties
- Must show bowling quality metrics and wicket breakdowns
- Must render batting and bowling summaries as separate sections instead of mixing them inside one player card
- Batting summary should include only batting-eligible players and must show total balls played
- Bowling summary should include only bowling-eligible players and must show total balls bowled

## Non-Functional Requirements

- Mobile-first responsive design
- Smooth touch interaction
- Clear visual hierarchy in bright outdoor conditions
- Low-friction state recovery after accidental refresh
- Simple enough for a scorer to operate while watching active practice

## UI/UX Design Direction

### Theme

- Dark-themed "Sports Pro" aesthetic
- Strong contrast for scoring controls
- Bold typography and card-based layout
- Energetic, scoreboard-inspired presentation

### Visual Style

- Deep charcoal or near-black backgrounds
- Accent colors such as electric green, amber, red, and cyan
- Clear distinction between positive, neutral, and penalty actions
- Large tap targets with compact but legible data density

### Layout Priorities

- Mobile-first interface
- Sticky action controls for live scoring
- Horizontally scrollable timeline chips if needed
- Responsive dashboard that expands into panels/cards on desktop
- On small screens, summary cards, leaderboard rows, progress headers, and action groups should stack vertically before they wrap or compress text

### Component Guidance

- Player selector pills or segmented cards
- Configurable setup form for players and overs
- Overs/ball progress indicator
- High-contrast scoring button grid
- Timeline chips for bowler and batter events
- Summary stat cards and leaderboard rows

## Information Architecture

### Primary Screens

- Session setup
- Live scoring dashboard
- Summary report

### Supporting UI Sections

- Session configuration panel
- Active players panel
- Score action pad
- Session timeline
- Player stats snapshot
- Final leaderboard

## Edge Cases and Assumptions

- Assumption: sessions support a variable number of players
- Assumption: total session overs are configured by the user before live scoring begins
- Assumption: players may not all bowl or bat the same number of overs in this version unless the scorer enforces a rotation manually
- Assumption: each delivery stores one bowling outcome and one batting outcome
- Assumption: argument penalties may occur independently of a delivery event
- Assumption: batting totals may go negative after dismissals
- Assumption: no extras model is required in this version
- Assumption: no team-based scoring is required in this version

## Future Enhancements

- Export session report as PDF or CSV
- Cloud sync and authentication
- Charts for bowling discipline and batting tempo
- Coach notes and tags per over

## Build Notes for the Next Phase

When implementation begins, start with:

1. App shell and route structure in Next.js App Router
2. Shared TypeScript domain models
3. Local storage session store and reducers/helpers
4. Live scoring state machine for recording a complete delivery
5. Timeline UI components and summary aggregations

## Feature Updates

### Session History

- The application now persists multiple sessions in local storage instead of overwriting a single active session.
- Users can reopen a previous in-progress or completed session from the setup screen.
- The most recently active session is restored automatically on reload.
- Users can remove saved sessions from history.

### Undo Workflow

- The live scoring experience includes an `Undo Last Ball` action.
- Undo removes only the most recent recorded delivery.
- Undo recalculates bowling points, batting totals, overs, timelines, leaderboard rank, and session progress.
- Undo does not remove argument penalties in this version.

### Rotation Helpers

- The live scoring dashboard includes quick controls for `Next Bowler` and `Next Batter`.
- The dashboard includes a `Rotate Over` helper for advancing both active roles after an over is completed.
- Rotation helpers must prevent the same player from being assigned as both the active bowler and active batter at the same time.

## Persistence Model Update

The local persistence layer now behaves as a simple client-side session registry.

```ts
interface StoredSessionState {
  activeSessionId: string | null;
  sessions: Session[];
}
```

### Persistence Expectations

- Save the current session after each scoring or control action.
- Keep a session history ordered by most recently updated.
- Restore the active session automatically.
- Allow reopening a historical session without data loss.

## Functional Requirement Updates

### Session Setup and Recovery

- Must show previously saved sessions on the setup screen.
- Must allow reopening a saved session.
- Must allow deleting a saved session from local history.

### Live Scoring Recovery

- Must provide an `Undo Last Ball` action.
- Must recalculate all derived metrics after undo.

### Rotation Assistance

- Must provide quick actions for rotating the active bowler and active batter.
- Must provide an over-complete helper for rotating both roles together.

## Current Version Notes

- Multiple saved sessions are supported through browser local storage.
- Undo currently applies to deliveries only, not argument penalties.
- Rotation helpers are scorer-assist tools and do not enforce a formal cricket rotation policy beyond keeping active roles distinct.

## Guided Round Robin Update

### Supported Structured Format

The application now supports an optional `Guided Round Robin` session mode in addition to manual scoring.

#### Guided Round Robin Rules

- The user defines `overs per batter` during setup.
- Each player can be configured independently as `Can Bat` and `Can Bowl`.
- Guided batting order is built only from players with `Can Bat = true`, in the same order they were entered during setup.
- One batter remains active for the full `overs per batter` block.
- The bowling pool for a batter block is built from every player with `Can Bowl = true`, excluding the current batter.
- Bowler rotation must follow the circular full player order around the current batter, not a re-sorted or re-filtered player list.
- The first bowler for a batter block is the next eligible bowler after that batter in full session order.
- This keeps later batting blocks stable, so a sequence like `X -> Y -> Z` produces bowling blocks of `Y, Z, Y, Z...`, then `Z, X, Z, X...`, then `X, Y, X, Y...`.
- In formats where `overs per batter` is an exact multiple of the available bowler count, the incoming next batter should naturally get the previous over free to prepare.
- Bowler-only players are supported by setting `Can Bat = false` and `Can Bowl = true`.
- Total session overs are auto-calculated as:

`totalOvers = battingEligiblePlayerCount * oversPerBatter`

#### Example

For 4 players and `6` overs per batter:

- Batter 1 faces 6 overs
- The other 3 players rotate as bowlers over those 6 overs
- Then Batter 2 faces 6 overs with the remaining 3 rotating as bowlers
- This continues until all players complete their batting block

### Manual Mode Preservation

- Manual scoring remains available as a separate session mode.
- Users can still manually select the active bowler and batter.
- Manual selectors respect player eligibility, so only batting-eligible players can be chosen as batter and only bowling-eligible players can be chosen as bowler.
- Manual helper controls such as `Next Bowler`, `Next Batter`, and `Swap Roles` remain available.

### Role Swap Support

- A `Swap Roles` helper is available to support quick manual role inversion.
- This is especially useful for 2-player testing and simplified drills.

## Data Model Update

The `Session` model now supports both manual and guided formats.

```ts
export type SessionMode = "manual" | "guided_round_robin";

export interface RoundRobinConfig {
  oversPerBatter: number;
  battingOrder: string[];
}

export interface Session {
  mode: SessionMode;
  roundRobinConfig: RoundRobinConfig | null;
}

export interface GuidedRoundRobinState {
  currentBatterId: string | null;
  currentBowlerId: string | null;
  plannedBowlerId: string | null;
  eligibleBowlerIds: string[];
}
```

## Functional Requirement Updates

### Setup Flow

- Must allow the user to choose between `Manual Scoring` and `Guided Round Robin`.
- Must allow each player row to toggle `Bat` and `Bowl` eligibility independently.
- In guided mode, must allow the user to define `overs per batter`.
- In guided mode, total session overs must be auto-calculated from batting-eligible players only.
- Guided mode must validate that at least two batting-eligible players exist and that every batting-eligible player has at least one other bowling-eligible player available.

### Guided Live Scoring

- Must display the current guided batter block.
- Must display both the planned bowler for the over and the current over bowler actually in use.
- Must allow the scorer to manually choose a different bowler from the current eligible bowling pool.
- Once any ball of an over has been recorded, the chosen bowler for that over must remain locked for the rest of the over.
- The app may predict the next bowler only after the over is completed.
- If the just-completed over used a manual bowler override, the next predicted bowler in the same batting block must not repeat that same bowler for a consecutive over.
- Must automatically restore the guided over-by-over rotation after completed overs.
- Must preserve the same circular bowler order across batting-block boundaries so the first over of later batters does not flip unexpectedly.
- Must still allow manual intervention without removing the guided plan.

### Rotation and Verification

- Must support a `Swap Roles` helper for manual verification workflows.
- Must keep the existing manual scorer intact for ad hoc or non-structured practice sessions.

## Delivery Rules Update

### Revised Wicket Scoring

The wicket scoring model is now:

- `GW` (Wicket on Good Ball): `+6` to bowler
- `BW` (Wicket on Bad Ball): `+5` to bowler
- Every dismissal still applies `-5` to the batter

#### Wicket Input Rule

- Selecting `GW` or `BW` must automatically set the batting outcome to `W`
- In the live scoring UI, wicket deliveries keep batting locked to dismissal for that ball

### Wrong Shot Rule

- `Wrong Shot` applies `-2` points to the batter
- Wrong shot can occur on a scoring shot or on a dismissal ball

### Ball Beat Rule

- `Ball Beat` applies `-1` point to the batter
- `Ball Beat` applies `+1` point to the bowler

### Modifier Exclusivity

- `Wrong Shot` and `Ball Beat` are mutually exclusive on the same delivery
- A delivery may have zero or one modifier only

## Delivery Model Update

Each delivery now supports one optional modifier.

```ts
export type DeliveryModifier = "wrong_shot" | "ball_beat";

export interface Delivery {
  modifier: DeliveryModifier | null;
}
```

## Live Scoring UX Update

### Ball Composer

The live scorer now uses an explicit record step instead of auto-saving a ball immediately after two selections.

#### Ball Entry Flow

1. Select bowling outcome
2. Select batting outcome
3. Optionally select one modifier
4. Tap `Record Ball`

### Input Rules

- `GW` and `BW` auto-fill the batting result as dismissal
- `Wrong Shot` and `Ball Beat` behave as toggle buttons
- Selecting one modifier replaces the other because they are mutually exclusive
- A `Clear Selection` action resets the pending ball

## Analytics Update

The summary report now includes:

- Wrong shots per batter
- Ball beats faced per batter
- Ball beat bonuses earned per bowler

## Wide Ball Update

### Wide Ball Rule

- `WD` (Wide Ball) deducts `-1` point from the bowler
- Wide ball gives `0` runs to the batter in this product version
- Wide ball is recorded in the session timeline
- Wide ball does not count as a legal ball in the over

### Wide Ball Input Rule

- Selecting `WD` auto-sets batting outcome to `0`
- Wide ball disables wrong shot, ball beat, shot type, and out type selection
- Wide ball can be recorded immediately once selected

## Legal Ball Counting Update

The app now distinguishes between recorded events and legal deliveries.

### Counting Rules

- `G`, `B`, `GW`, and `BW` count as legal balls
- `WD` does not count as a legal ball
- Over progression, ball number, guided round robin flow, and session completion must all use legal-ball count

## Shot Type Update

When batting outcome is `4`, the scorer can optionally record the shot type.

### Supported Shot Types

- `Drive`
- `Pull`
- `Lofted`
- `Punch`
- `Cut`
- `Flick`
- `Edge`
- `Others`

### Shot Type Rule

- Shot type is only available when batting outcome is `4`
- If the batting outcome changes away from `4`, shot type is cleared

## Wicket Out Type Update

When `GW` or `BW` is selected, the scorer must also choose the dismissal type.

### Supported Out Types

- `Bowled`
- `Caught Out`
- `Caught & Bowled`
- `Stumped`
- `LBW`
- `Run Out`
- `Hit Wicket`
- `Others`

### Wicket Input Rule

- `GW` and `BW` automatically force batting outcome to `W`
- A wicket delivery cannot be recorded until an out type is selected

## Delivery Model Additions

```ts
export interface Delivery {
  shotType: ShotType | null;
  outType: OutType | null;
  countsAsLegalBall: boolean;
}
```

## Reporting Update

The summary report now includes:

- Wide ball count per bowler
- Timeline detail for wicket out types
- Timeline detail for four-shot types
