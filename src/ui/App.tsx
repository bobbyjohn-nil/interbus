import { useCallback, useEffect, useRef, useState } from "react";
import { CITIES } from "../cities";
import { MapView, type DotKinds, type HoveredDot, type MapHit } from "../render/map/MapView";
import { readDotPrefs, writeDotPrefs } from "../platform";
import { PLAY_SPEED, RUNNING_SPEEDS } from "../sim/rules/speed";
import type { BusModelId, LngLatPair, Speed } from "../sim/types";
import { Corner } from "./Corner";
import { DayCard } from "./game/DayCard";
import { FailureCard } from "./game/FailureCard";
import { FoundingCard } from "./game/Founding";
import { ProbeCard } from "./game/ProbeCard";
import { StopCard } from "./game/StopCard";
import { RouteEditor, routeOf, type RoutePoint } from "./game/RouteEditor";
import { DepotCard, DraftCard, StopSiteCard, type Tool } from "./game/Tools";
import { useSim } from "./game/useSim";
import { ReplacedCard } from "./ReplacedCard";
import { Dock, type Panel } from "./shell/Dock";
import { Finance } from "./shell/Finance";
import { Contracts } from "./shell/Contracts";
import { DemandMenu } from "./shell/DemandMenu";
import { Home } from "./shell/Home";
import { Saves } from "./shell/Saves";
import { Inspector } from "./shell/Inspector";
import { Notices } from "./shell/Notices";
import { TopBar } from "./shell/TopBar";

export function App() {
  const sim = useSim(CITIES[0]);
  const [screen, setScreen] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [clicks, setClicks] = useState<LngLatPair[]>([]);
  const [draftModel, setDraftModel] = useState<BusModelId>("sparrow");
  // The route editor's line and its stops as edited (D25); `saved` holds the line's stops as they were
  // when Save route was pressed, so the editor closes once the line's stops change.
  const [routing, setRouting] = useState<{
    readonly lineId: number;
    readonly points: RoutePoint[];
    readonly saved: string | null;
  } | null>(null);
  // One panel at a time on the right: the line tool's draft card, the lines' inspector, or a stop's card.
  const [panel, setPanel] = useState<Panel>("none");
  const [lineId, setLineId] = useState<number | null>(null);
  // The line Finance opens on, from the line panel's link to its money; null opens the Overview.
  const [financeLine, setFinanceLine] = useState<number | null>(null);
  const [stopId, setStopId] = useState<number | null>(null);
  // When Home last opened, or null once the game is under way (the M5 spec, item 3): it is the first
  // screen, Saves' Back to Home returns to it, and a slot or a file loaded from it goes into that game.
  const [homeAt, setHomeAt] = useState<number | null>(0);
  const { probeAt, depotSiteAt, stopSiteAt, draftFor, send } = sim;
  // Play resumes the speed last played at, 600x the first time (D25).
  const [playSpeed, setPlaySpeed] = useState<Exclude<Speed, 0>>(PLAY_SPEED);
  const speedNow = sim.snapshot?.speed ?? 0;
  // Kept as the game runs, during render (React's pattern for state that follows a prop).
  if (speedNow !== 0 && speedNow !== playSpeed) setPlaySpeed(speedNow);
  const speedRef = useRef({ now: speedNow, play: playSpeed, founded: false });
  useEffect(() => {
    speedRef.current = { now: speedNow, play: playSpeed, founded: Boolean(sim.snapshot?.company.name) };
  }, [speedNow, playSpeed, sim.snapshot?.company.name]);

  // Which kinds of demand dot show, as this viewer last chose (D25); never part of a save.
  const [dotKinds, setDotKinds] = useState<DotKinds>(() => readDotPrefs());
  const hoveredRef = useRef<string | null>(null);
  const showDots = useCallback(
    (next: DotKinds) => {
      setDotKinds(next);
      writeDotPrefs(next);
      hoveredRef.current = null;
      probeAt(null);
    },
    [probeAt],
  );

  // A tool's pointer: the depot card while placing a depot; with no tool, a dot's card while the
  // pointer is on a demand dot, and nothing elsewhere (D25). The sim is asked once per dot.
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  // The dots as the sim sent them: the card reads a dot's place and count from here, not from the
  // map's tiles, which round its place.
  const dotsRef = useRef(sim.dots);
  useEffect(() => {
    dotsRef.current = sim.dots;
  }, [sim.dots]);
  // The stops as the sim sent them: a click on one while editing a route adds that stop exactly.
  const stopsRef = useRef(sim.snapshot?.stops ?? []);
  useEffect(() => {
    stopsRef.current = sim.snapshot?.stops ?? [];
  }, [sim.snapshot?.stops]);
  const onPointer = useCallback(
    (at: LngLatPair | null, point: [number, number] | null, dot: HoveredDot | null) => {
      setScreen(point);
      if (toolRef.current === "depot") depotSiteAt(at);
      else if (toolRef.current === "stop") stopSiteAt(at);
      else if (toolRef.current === "none") {
        const exact = dot ? (dot.kind === "home" ? dotsRef.current?.homes : dotsRef.current?.jobs)?.[dot.i] : undefined;
        const key = dot && exact ? `${dot.kind}:${dot.i}` : null;
        if (key === hoveredRef.current) return;
        hoveredRef.current = key;
        probeAt(dot && exact ? { kind: dot.kind, at: [exact[0], exact[1]], here: exact[2] } : null);
      }
    },
    [probeAt, depotSiteAt, stopSiteAt],
  );
  const onClick = useCallback(
    (at: LngLatPair, hit: MapHit) => {
      if (toolRef.current === "depot") send({ type: "place-depot", at });
      else if (toolRef.current === "stop") send({ type: "place-stop", at });
      else if (toolRef.current === "line") setClicks((c) => [...c, at]);
      else if (toolRef.current === "route") {
        // A click on a stop adds that stop; elsewhere, a new one where the click is, at the end.
        const stop = hit.stopId === null ? undefined : stopsRef.current.find((s) => s.id === hit.stopId);
        const point: RoutePoint = stop ? { at: stop.at, stopId: stop.id } : { at, stopId: null };
        setRouting((r) => (r ? { ...r, points: [...r.points, point] } : r));
      } else if (hit.stopId !== null) {
        // A click on a stop opens its card; on a line, the line's inspector.
        setStopId(hit.stopId);
        setPanel("stop");
      } else if (hit.lineId !== null) {
        setLineId(hit.lineId);
        setPanel("lines");
      }
    },
    [send],
  );

  const choose = useCallback(
    (next: Tool) => {
      setTool((now) => (now === next ? "none" : next));
      setClicks([]);
      setRouting(null);
      if (next !== "none") setPanel("none");
      hoveredRef.current = null;
      probeAt(null);
      depotSiteAt(null);
      stopSiteAt(null);
    },
    [probeAt, depotSiteAt, stopSiteAt],
  );

  // The draft card: a new line's clicks, or the route editor's whole route (D25).
  const routePoints = routing?.points;
  const routeLine = routing?.lineId;
  useEffect(() => {
    if (routePoints && routeLine !== undefined)
      draftFor(
        routePoints.map((p) => p.at),
        "sparrow",
        undefined,
        routeLine,
      );
    else draftFor(clicks, draftModel);
  }, [clicks, draftModel, routePoints, routeLine, draftFor]);
  const startRoute = useCallback(
    (id: number) => {
      const line = sim.snapshot?.lines.find((l) => l.id === id);
      if (!line) return;
      setTool("route");
      setClicks([]);
      setPanel("none");
      setRouting({ lineId: id, points: routeOf(line), saved: null });
      hoveredRef.current = null;
      probeAt(null);
    },
    [sim.snapshot, probeAt],
  );
  // Save route lands when the line's stops change: the editor closes and the line shows, as a new
  // line does. A refusal leaves the line as it was and the editor open, its notice saying why.
  const routingLine = routing
    ? (sim.snapshot?.lines.find((l) => l.id === routing.lineId) ?? null)
    : null;
  const routingStops = routingLine ? routingLine.stopIds.join(",") : null;
  // During render, as the play speed follows the game (React's pattern for state that follows a prop).
  if (routing && routing.saved !== null && routingStops !== null && routingStops !== routing.saved) {
    setTool("none");
    setRouting(null);
    setLineId(routing.lineId);
    setPanel("lines");
  }

  // A tool closes once its purchase lands: a new depot, or a new line.
  const started = sim.snapshot !== null;
  const depots = sim.snapshot?.depots.length ?? 0;
  const lines = sim.snapshot?.lines.length ?? 0;
  // Counted from the game as it starts, so a reloaded game's lines are not new ones.
  const counts = useRef<{ depots: number; lines: number } | null>(null);
  useEffect(() => {
    if (!started) return;
    if (!counts.current) {
      counts.current = { depots, lines };
      return;
    }
    if (depots > counts.current.depots || lines > counts.current.lines) {
      setTool("none");
      setClicks([]);
      depotSiteAt(null);
    }
    // A new line opens in the inspector, so its headways and forecast are one look away.
    if (lines > counts.current.lines) {
      setLineId(null);
      setPanel("lines");
    }
    counts.current = { depots, lines };
  }, [started, depots, lines, depotSiteAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      // Space pauses and plays; 1 to 5 pick a speed, real time up (D25). A focused button keeps Space.
      const { now, play, founded } = speedRef.current;
      if (founded && event.key === " " && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        send({ type: "speed", speed: now === 0 ? play : 0 });
        return;
      }
      const pick = founded && !event.ctrlKey && !event.metaKey && !event.altKey ? RUNNING_SPEEDS[Number(event.key) - 1] : undefined;
      if (pick !== undefined && /^[1-5]$/.test(event.key)) {
        send({ type: "speed", speed: pick });
        return;
      }
      // Ctrl+Z or ⌘Z takes back the newest command taken while paused (I9).
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        send({ type: "undo" });
        return;
      }
      if (event.key === "Escape") {
        choose("none");
        setPanel("none");
      } else if (event.key === "Backspace" && toolRef.current === "line")
        setClicks((c) => c.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, send]);

  // A panel shows only while no tool is in use, so opening one puts the tool down: with a tool still
  // active, the panel opened unseen and the two blocked each other (the owner's initial playtest: "when
  // you open 2 tabs, they conflict and you can't use it").
  const openPanel = (next: Panel) => {
    if (next !== "none") choose("none");
    setPanel(next);
  };

  const ready = sim.status === "ready";
  const atHome = ready && homeAt !== null && !(sim.loaded && sim.loaded.at > homeAt);
  if (atHome)
    return (
      <main className="app">
        <MapView
          dots={sim.dots}
          dotKinds={dotKinds}
          lines={sim.snapshot?.lines ?? []}
          stops={sim.snapshot?.stops ?? []}
          linesVersion={sim.snapshot?.linesVersion ?? 0}
          depotLand={sim.depotLand}
          tint={false}
          depots={sim.snapshot?.depots ?? []}
          event={sim.snapshot?.event ?? null}
          draft={null}
          clock={
            sim.snapshot
              ? { second: sim.snapshot.secondOfDay, rate: sim.snapshot.rate, day: sim.snapshot.day }
              : null
          }
        />
        <Home
          sim={sim}
          onContinue={() => setHomeAt(null)}
          onNewGame={() => {
            if (sim.snapshot?.company.name) send({ type: "new-game" });
            setHomeAt(null);
          }}
          onSaves={() => setPanel("saves")}
        />
        {panel === "saves" ? (
          <Saves sim={sim} onClose={() => setPanel("none")} />
        ) : null}
        <Notices sim={sim} />
        <Corner />
        <ReplacedCard />
      </main>
    );
  return (
    <main className="app">
      <MapView
        dots={sim.dots}
        dotKinds={dotKinds}
        lines={sim.snapshot?.lines ?? []}
        stops={sim.snapshot?.stops ?? []}
        linesVersion={sim.snapshot?.linesVersion ?? 0}
        depotLand={sim.depotLand}
        tint={tool === "depot"}
        depots={sim.snapshot?.depots ?? []}
        tiltGesture={tool === "none"}
        event={sim.snapshot?.event ?? null}
        draft={(tool === "line" && clicks.length) || (tool === "route" && routing) ? sim.draft : null}
        clock={
          sim.snapshot
            ? { second: sim.snapshot.secondOfDay, rate: sim.snapshot.rate, day: sim.snapshot.day }
            : null
        }
        {...(ready ? { onPointer, onClick } : {})}
      />
      <TopBar
        sim={sim}
        playSpeed={playSpeed}
        onContracts={() => {
          choose("none");
          setPanel("contracts");
        }}
      />
      {tool === "none" ? <ProbeCard sim={sim} screen={screen} /> : null}
      {ready ? <DemandMenu dots={sim.dots} shown={dotKinds} onShown={showDots} /> : null}
      {tool === "depot" ? <DepotCard sim={sim} screen={screen} /> : null}
      {tool === "stop" ? <StopSiteCard sim={sim} screen={screen} /> : null}
      {tool === "route" && routing && routingLine ? (
        <RouteEditor
          sim={sim}
          line={routingLine}
          points={routing.points}
          onPoints={(points) => setRouting({ ...routing, points, saved: null })}
          onSave={() => {
            setRouting({ ...routing, saved: routingLine.stopIds.join(",") });
            send({ type: "set-route", lineId: routing.lineId, points: routing.points.map((p) => p.at) });
          }}
          onCancel={() => {
            const id = routing.lineId;
            choose("none");
            setLineId(id);
            setPanel("lines");
          }}
        />
      ) : null}
      {tool === "line" ? (
        <DraftCard
          sim={sim}
          clicks={clicks.length}
          model={draftModel}
          onModel={setDraftModel}
          onCreate={() => send({ type: "create-line", clicks, model: draftModel })}
          onUndo={() => setClicks((c) => c.slice(0, -1))}
          onCancel={() => choose("none")}
        />
      ) : null}
      {tool === "none" && panel === "lines" ? (
        <Inspector
          sim={sim}
          lineId={lineId}
          onLine={setLineId}
          onEditRoute={startRoute}
          onFinance={(id) => {
            setFinanceLine(id);
            setPanel("finance");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}
      {tool === "none" && panel === "finance" ? (
        <Finance
          key={financeLine ?? "all"}
          sim={sim}
          view={financeLine === null ? "overview" : "lines"}
          lineId={financeLine}
          onClose={() => {
            setFinanceLine(null);
            setPanel("none");
          }}
        />
      ) : null}
      {tool === "none" && panel === "saves" ? (
        <Saves
          sim={sim}
          onClose={() => setPanel("none")}
          onHome={() => {
            // Paused first, which saves the game, so Continue picks up exactly here.
            send({ type: "speed", speed: 0 });
            setPanel("none");
            setHomeAt(Date.now());
          }}
        />
      ) : null}
      {tool === "none" && panel === "contracts" ? (
        <Contracts sim={sim} onClose={() => setPanel("none")} />
      ) : null}
      {tool === "none" && panel === "stop" && stopId !== null ? (
        <StopCard
          sim={sim}
          stopId={stopId}
          onLine={(id) => {
            setLineId(id);
            setPanel("lines");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}
      {ready && sim.snapshot?.company.name ? (
        <Dock
          tool={tool}
          panel={panel}
          hasLines={(sim.snapshot?.lines.length ?? 0) > 0}
          onTool={choose}
          onPanel={openPanel}
        />
      ) : null}
      {ready && sim.snapshot?.company.name ? (
        // Saves at the top, out of the dock (D25: "it can be placed at the top or something").
        <button
          type="button"
          className="chip saves-chip"
          aria-pressed={panel === "saves"}
          data-testid="saves-chip"
          data-chrome="rest"
          onClick={() => openPanel(panel === "saves" ? "none" : "saves")}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4h10l2 2v10H4zM7 4v4h6V4M7 16v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          Saves
        </button>
      ) : null}
      <Notices sim={sim} />
      <FoundingCard sim={sim} />
      <DayCard sim={sim} />
      <FailureCard sim={sim} />
      <Corner />
      <ReplacedCard />
    </main>
  );
}
