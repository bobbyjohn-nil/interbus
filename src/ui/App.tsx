import { useCallback, useEffect, useRef, useState } from "react";
import { CITIES } from "../cities";
import { MapView, type DotKinds, type HoveredDot, type MapHit } from "../render/map/MapView";
import { readDotPrefs, writeDotPrefs } from "../platform";
import { PLAY_SPEED, RUNNING_SPEEDS } from "../sim/rules/speed";
import type { BusModelId, LngLatPair, Speed } from "../sim/types";
import { Corner } from "./Corner";
import { AUTOSAVE_OFF_CHIP, AUTOSAVE_OFF_NAME, AUTOSAVE_OFF_TITLE, failedText } from "./copy";
import { DayCard } from "./game/DayCard";
import { FailureCard } from "./game/FailureCard";
import { FoundingCard } from "./game/Founding";
import { ProbeCard } from "./game/ProbeCard";
import { StopCard } from "./game/StopCard";
import { followed, pressSave, RouteEditor, routeOf, saveLanded, type RoutePoint, type Routing } from "./game/RouteEditor";
import { createWaits, DepotCard, DraftCard, draftShows, StopSiteCard, type CreatePress, type Tool } from "./game/Tools";
import { useSim } from "./game/useSim";
import { focusSource } from "./focusSource";
import { onePress } from "./onePress";
import { ReplacedCard } from "./ReplacedCard";
import { Dock, type Panel } from "./shell/Dock";
import { Panels, type PanelFront, type PanelItem } from "./shell/Panels";
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
  // The route editor (D25): its line, its stops as edited, what it last followed and a save on its way (Routing, game/RouteEditor.tsx).
  const [routing, setRouting] = useState<Routing | null>(null);
  // The panels open, in the order they opened (D25: several at once, each movable; shell/Panels.tsx),
  // and the one shown last: showing a panel already open brings it to the front.
  const [open, setOpen] = useState<readonly Exclude<Panel, "none">[]>([]);
  const [front, setFront] = useState<PanelFront | null>(null);
  const show = useCallback((p: Exclude<Panel, "none">) => {
    setOpen((o) => (o.includes(p) ? o : [...o, p]));
    setFront((f) => ({ id: p, n: (f?.n ?? 0) + 1 }));
  }, []);
  const hide = useCallback((p: Exclude<Panel, "none">) => setOpen((o) => o.filter((x) => x !== p)), []);
  const toggle = useCallback((p: Exclude<Panel, "none">) => setOpen((o) => (o.includes(p) ? o.filter((x) => x !== p) : [...o, p])), []);
  const [lineId, setLineId] = useState<number | null>(null);
  // The line Finance opens on, from the line panel's link to its money; null opens the Overview. Each
  // press of the link opens Finance afresh on that line, and Finance closed any way opens next on the Overview.
  const [financeLine, setFinanceLine] = useState<number | null>(null);
  const [financeAsks, setFinanceAsks] = useState(0);
  if (financeLine !== null && !open.includes("finance")) setFinanceLine(null);
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
  // Where the pointer last was over the map, so a site card is asked again there when the game changes.
  const pointerAt = useRef<LngLatPair | null>(null);
  const onPointer = useCallback(
    (at: LngLatPair | null, point: [number, number] | null, dot: HoveredDot | null) => {
      setScreen(point);
      pointerAt.current = at;
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
      // A double-click's second click is the same press again: a tool takes it once.
      if (hit.double && toolRef.current !== "none") return;
      if (toolRef.current === "depot") send({ type: "place-depot", at });
      else if (toolRef.current === "stop") send({ type: "place-stop", at });
      // After the stops the draft shows, in the place of a click the line rule refused (draftShows).
      else if (toolRef.current === "line") setClicks((c) => [...c.slice(0, draftShows(c.length, sim.draftOf === c ? sim.draft : null).kept), at]);
      else if (toolRef.current === "route") {
        // A click on a stop adds that stop; elsewhere, a new one where the click is, at the end.
        const stop = hit.stopId === null ? undefined : stopsRef.current.find((s) => s.id === hit.stopId);
        const point: RoutePoint = stop ? { at: stop.at, stopId: stop.id } : { at, stopId: null };
        setRouting((r) => (r ? { ...r, points: [...r.points, point] } : r));
      } else if (hit.stopId !== null) {
        // A click on a stop opens its card; on a line, the line's inspector.
        setStopId(hit.stopId);
        show("stop");
      } else if (hit.lineId !== null) {
        setLineId(hit.lineId);
        show("lines");
      }
    },
    [send, show, sim.draft, sim.draftOf],
  );
  // Remove last stop and Backspace take off the last thing the draft card shows, never a click it does not.
  const removeLast = useCallback(
    () => setClicks((c) => c.slice(0, Math.max(0, draftShows(c.length, sim.draftOf === c ? sim.draft : null).shown - 1))),
    [sim.draft, sim.draftOf],
  );

  const choose = useCallback(
    (next: Tool) => {
      setTool((now) => (now === next ? "none" : next));
      setClicks([]);
      setRouting(null);
      hoveredRef.current = null;
      probeAt(null);
      depotSiteAt(null);
      stopSiteAt(null);
    },
    [probeAt, depotSiteAt, stopSiteAt],
  );

  // What the tools' cards read from the game besides the pointer and the clicks: the cash, the stops and
  // lines, the depots, the day (its roadworks and snow) and the medals. A card is asked again when they
  // change under it, so it never offers what the click or Create would then refuse (GD-05).
  const game = sim.snapshot;
  const gameKey = game ? `${game.cashCents}|${game.linesVersion}|${game.depots.length}|${game.day}|${JSON.stringify(game.medals)}` : "";
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
  }, [clicks, draftModel, routePoints, routeLine, draftFor, gameKey]);
  // The site card beside a resting pointer: a stop placed there, an undo or the cash changes its verdict.
  useEffect(() => {
    const at = pointerAt.current;
    if (!at) return;
    if (toolRef.current === "depot") depotSiteAt(at);
    else if (toolRef.current === "stop") stopSiteAt(at);
  }, [gameKey, depotSiteAt, stopSiteAt]);
  const startRoute = useCallback(
    (id: number) => {
      const line = sim.snapshot?.lines.find((l) => l.id === id);
      if (!line) return;
      setTool("route");
      setClicks([]);
      // The editor stands in for the line's panel while it is open; Save route and Cancel bring it back.
      hide("lines");
      setRouting({ lineId: id, points: routeOf(line), base: line.stopIds, saved: null });
      hoveredRef.current = null;
      probeAt(null);
    },
    [sim.snapshot, probeAt, hide],
  );
  // Save route lands when the line's stops change: the editor closes and the line shows, as a new
  // line does. A refusal leaves the line as it was and the editor open, its notice saying why.
  const routingLine = routing
    ? (sim.snapshot?.lines.find((l) => l.id === routing.lineId) ?? null)
    : null;
  // During render, as the play speed follows the game (React's pattern for state that follows a prop).
  if (routing && !routingLine) {
    // Its line gone under it (an undo): the editor and its tool go down together, as Cancel puts them down.
    setTool("none");
    setRouting(null);
  } else if (routing && routingLine && saveLanded(routing, routingLine)) {
    setTool("none");
    setRouting(null);
    setLineId(routing.lineId);
    show("lines");
  } else if (routing && routingLine && game) {
    // The list follows the line as the game changes it under the editor, and a save that did not land
    // can be pressed again.
    const next = followed(routing, routingLine, game, sim.routeRefusals, sim.undos);
    if (next !== routing) setRouting(next);
  }
  // Lines with no line left to show (an undo took back the only one) closes, as Escape closes it, so
  // the dock shows it neither open nor pressed.
  if (game && !game.lines.length && open.includes("lines")) setOpen((o) => o.filter((p) => p !== "lines"));
  // A stop's card closes with its stop (taken down, or an undo), so it never opens again by itself on a
  // stop that takes the same id later.
  if (stopId !== null && game && !game.stops.some((s) => s.id === stopId)) {
    setStopId(null);
    hide("stop");
  }

  // Set when Create is pressed: the new line, and only a created one, opens in the inspector (a line
  // that arrives with a loaded save opens no panel). A load lets it go too: a Create refused, or undone
  // with it in one render, brings no line to let it go, and the game loaded later opened Lines on its
  // newest line (the systems audit's fourth round).
  const creating = useRef(false);
  // A tool closes once its purchase lands: a new depot, or a new line.
  const started = sim.snapshot !== null;
  const depots = sim.snapshot?.depots.length ?? 0;
  const lines = sim.snapshot?.lines.length ?? 0;
  const newest = sim.snapshot?.lines.at(-1)?.id ?? null;
  // A Create on its way: until its own answer (a newer line, or a Create refused), a second press sends
  // nothing (createWaits, game/Tools.tsx). Let go during render, as the route editor follows the game.
  const [createPress, setCreatePress] = useState<CreatePress | null>(null);
  const createNow = { tool, newest: newest ?? 0, refusals: sim.createRefusals, undos: sim.undos.sent, undone: sim.undos.done, loadedAt: sim.loaded?.at ?? null };
  if (createPress && !createWaits(createPress, createNow)) setCreatePress(null);
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
    // A new line opens in the inspector, so its headways and forecast are one look away: the newest,
    // as the game keeps its lines in the order they were made.
    if (lines > counts.current.lines && creating.current) {
      creating.current = false;
      setLineId(newest);
      show("lines");
    }
    counts.current = { depots, lines };
  }, [started, depots, lines, newest, depotSiteAt, show]);

  // A game loaded from a slot, a file or Restart this quarter takes this one's place: any tool out
  // goes down with the game it was drawn in, as with a new game, and so do the cards of its stops and
  // lines, which would show the loaded game's of the same id; the new-line card starts on the Sparrow,
  // never on a bus the loaded game has locked.
  const loadedAt = sim.loaded?.at ?? null;
  const loadedSeen = useRef(loadedAt);
  useEffect(() => {
    if (loadedAt === loadedSeen.current) return;
    loadedSeen.current = loadedAt;
    creating.current = false;
    choose("none");
    setOpen((o) => o.filter((p) => p !== "stop" && p !== "lines"));
    setDraftModel("sparrow");
  }, [loadedAt, choose]);

  const ready = sim.status === "ready";
  const atHome = ready && homeAt !== null && !(sim.loaded && sim.loaded.at > homeAt);
  // A game that stopped working (its worker failed and was stopped) shows nothing of itself to press, nor of a tool out: no
  // panel (Saves opened from Home too), no tool's card, tint or draft, no day card and no lender's card, as it shows no dock
  // and no Saves chip. Their buttons would send to a worker that is gone, or close a card over a game that no longer runs,
  // so the card that says it stopped, with Reload, is all that is left. A notice has no button, and "Not autosaving: see
  // Saves" waits for a game that is ready.
  const stopped = sim.status === "failed";
  // While the game is not saving itself (it saves nothing over a save it could not set aside, or the browser refused the
  // autosave and has kept none since), the Saves chip says so, for as long as that lasts, open or not, so it neither changes
  // its name nor jumps under the pointer as Saves opens: no notice of its own, which took the shell at rest past I13's 6%
  // beside a full chip row (the systems audit's third round).
  const autosaveOff = Boolean(sim.unbacked) || sim.autosaveRefused;

  // Whether the keyboard, not the pointer, moved the focus where it is (focusSource.ts), for Space.
  const focus = useRef(focusSource());
  useEffect(() => {
    const f = focus.current;
    const input = (event: PointerEvent | KeyboardEvent) => f.input(event);
    const arrived = (event: FocusEvent) => f.arrived(event.target);
    // The window's own blur (an element's does not bubble to this listener): the focus is handed back on return.
    const left = (event: FocusEvent) => void (event.target === window && f.left(document.activeElement));
    window.addEventListener("pointerdown", input, true);
    window.addEventListener("keydown", input, true);
    window.addEventListener("focusin", arrived, true);
    window.addEventListener("blur", left);
    return () => {
      window.removeEventListener("pointerdown", input, true);
      window.removeEventListener("keydown", input, true);
      window.removeEventListener("focusin", arrived, true);
      window.removeEventListener("blur", left);
    };
  }, []);
  // One press, one command, on every button of the page (onePress.ts): a double-click's second click goes nowhere, and so do a held key's repeats.
  useEffect(() => onePress(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Home stands over a paused game: its keys are Home's (Escape closes Saves), not the game's.
      if (atHome && event.key !== "Escape") return;
      if (
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      // Space pauses and plays; 1 to 5 pick a speed, real time up (D25). A button the keyboard reached
      // keeps Space, so Space still presses it; one pressed with the mouse does not, or Space pressed it
      // again (opening the speed menu, closing Finance, taking back one more command). A held Space
      // pauses or plays once, as a held key presses a button once (onePress.ts) and tilts once (tilt.ts), and a held 1 to 5
      // picks its speed once: their repeats send nothing (each was a command, an autosave and a stalled clock).
      const { now, play, founded } = speedRef.current;
      const keeps = event.target instanceof HTMLButtonElement && focus.current.byKey;
      if (founded && event.key === " " && !keeps) {
        event.preventDefault();
        if (!event.repeat) send({ type: "speed", speed: now === 0 ? play : 0 });
        return;
      }
      const pick = founded && !event.ctrlKey && !event.metaKey && !event.altKey ? RUNNING_SPEEDS[Number(event.key) - 1] : undefined;
      if (pick !== undefined && /^[1-5]$/.test(event.key)) {
        if (!event.repeat) send({ type: "speed", speed: pick });
        return;
      }
      // Ctrl+Z or ⌘Z takes back the newest command taken while paused (I9); with Shift, the usual
      // redo, it does nothing, since there is no redo.
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        send({ type: "undo" });
        return;
      }
      if (event.key === "Escape") {
        choose("none");
        setOpen([]);
      } else if (event.key === "Backspace" && toolRef.current === "line") removeLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, send, atHome, removeLast]);

  // A tool and the panels stay out together, each on the panel layer in a place of its own: they no
  // longer cover each other (the owner's initial playtest: "when you open 2 tabs, they conflict and you
  // can't use it, either make it so that the tabs are moveable ... preferably the former").

  // The panel layer's items: the tool's card first, then each open panel in the order it opened.
  const panelItems: PanelItem[] = [];
  if (tool === "route" && routing && routingLine)
    panelItems.push({
      id: "tool",
      node: (
        <RouteEditor
          sim={sim}
          line={routingLine}
          points={routing.points}
          saving={routing.saved !== null}
          onPoints={(points) => setRouting({ ...routing, points, saved: null })}
          onSave={() => {
            // One press, one command: a second before the first lands (a double-click) sends nothing.
            const next = pressSave(routing, routingLine, sim.routeRefusals, sim.undos);
            if (!next) return;
            setRouting(next);
            send({ type: "set-route", lineId: routing.lineId, points: routing.points.map((p) => p.at) });
          }}
          onCancel={() => {
            const id = routing.lineId;
            choose("none");
            setLineId(id);
            show("lines");
          }}
        />
      ),
    });
  if (tool === "line")
    panelItems.push({
      id: "tool",
      node: (
        <DraftCard
          sim={sim}
          clicks={clicks.length}
          model={draftModel}
          creating={createPress !== null}
          onModel={setDraftModel}
          onCreate={() => {
            // One press, one command: a second before the first has its answer sends nothing.
            if (createPress) return;
            creating.current = true;
            setCreatePress({ newest: createNow.newest, refusals: createNow.refusals, undos: createNow.undos, loadedAt: createNow.loadedAt });
            send({ type: "create-line", clicks, model: draftModel });
          }}
          onUndo={removeLast}
          onCancel={() => choose("none")}
        />
      ),
    });
  for (const p of open) {
    if (p === "lines")
      panelItems.push({
        id: p,
        node: (
          <Inspector
            sim={sim}
            lineId={lineId}
            onLine={setLineId}
            onEditRoute={startRoute}
            onFinance={(id) => {
              setFinanceLine(id);
              setFinanceAsks((n) => n + 1);
              show("finance");
            }}
            onClose={() => hide("lines")}
          />
        ),
      });
    else if (p === "finance")
      panelItems.push({
        id: p,
        node: (
          <Finance
            key={financeAsks}
            sim={sim}
            view={financeLine === null ? "overview" : "lines"}
            lineId={financeLine}
            onClose={() => {
              setFinanceLine(null);
              hide("finance");
            }}
          />
        ),
      });
    else if (p === "saves")
      panelItems.push({
        id: p,
        node: (
          <Saves
            sim={sim}
            onClose={() => hide("saves")}
            onHome={() => {
              // Paused first, which saves the game, so Continue picks up exactly here; the tool goes
              // down, so nothing of it waits unseen behind Home.
              send({ type: "speed", speed: 0 });
              choose("none");
              setOpen([]);
              setHomeAt(Date.now());
            }}
          />
        ),
      });
    else if (p === "contracts") panelItems.push({ id: p, node: <Contracts sim={sim} onClose={() => hide("contracts")} /> });
    else if (p === "stop" && stopId !== null)
      panelItems.push({
        id: p,
        node: (
          <StopCard
            sim={sim}
            stopId={stopId}
            onLine={(id) => {
              setLineId(id);
              show("lines");
            }}
            onClose={() => hide("stop")}
          />
        ),
      });
  }

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
          quiet={stopped}
        />
        <Home
          sim={sim}
          onContinue={() => setHomeAt(null)}
          onNewGame={() => {
            if (sim.snapshot?.company.name) send({ type: "new-game" });
            // A new game starts clean: no tool, draft or route editor, and no day card, of the old one,
            // and its new-line card on the Sparrow, never on a bus the old game had unlocked.
            choose("none");
            setDraftModel("sparrow");
            sim.closeDayCard();
            setHomeAt(null);
          }}
          onSaves={() => show("saves")}
        />
        {open.includes("saves") ? (
          <Saves sim={sim} onClose={() => hide("saves")} />
        ) : null}
        {/* Keyed as in the game's tree, so switching between them keeps them, and a notice shows once
            and a panel dragged opens where it was dragged to again after Continue. */}
        <Panels key="panels" items={[]} front={front} />
        <Notices key="notices" sim={sim} home savesOpen={open.includes("saves")} />
        <Corner key="corner" />
        <ReplacedCard key="replaced" />
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
        tint={tool === "depot" && !stopped}
        depots={sim.snapshot?.depots ?? []}
        tiltGesture={tool === "none"}
        event={sim.snapshot?.event ?? null}
        draft={!stopped && ((tool === "line" && clicks.length) || (tool === "route" && routing)) ? sim.draft : null}
        // A game that stopped working has no clock that runs: its map stands still, asking for no frame (I14), though
        // the last snapshot came while time ran (the systems audit's fourth round).
        clock={
          sim.snapshot
            ? { second: sim.snapshot.secondOfDay, rate: stopped ? 0 : sim.snapshot.rate, day: sim.snapshot.day }
            : null
        }
        // Its card says the game cannot go on, alone: the map adds none of its own beside it (D12).
        quiet={stopped}
        {...(ready ? { onPointer, onClick } : {})}
      />
      <TopBar
        sim={sim}
        playSpeed={playSpeed}
        onContracts={() => show("contracts")}
      />
      {tool === "none" && !stopped ? <ProbeCard sim={sim} screen={screen} /> : null}
      {ready ? <DemandMenu dots={sim.dots} shown={dotKinds} onShown={showDots} /> : null}
      {tool === "depot" && !stopped ? <DepotCard sim={sim} screen={screen} /> : null}
      {tool === "stop" && !stopped ? <StopSiteCard sim={sim} screen={screen} /> : null}
      <Panels key="panels" items={stopped ? [] : panelItems} front={front} />
      {ready && sim.snapshot?.company.name ? (
        <Dock
          tool={tool}
          panels={open}
          hasLines={(sim.snapshot?.lines.length ?? 0) > 0}
          onTool={choose}
          onPanel={toggle}
        />
      ) : null}
      {ready && sim.snapshot?.company.name ? (
        // Saves at the top, out of the dock (D25: "it can be placed at the top or something"); "Autosave off" while the game isn't saving itself.
        <button
          type="button"
          className={autosaveOff ? "chip saves-chip off" : "chip saves-chip"}
          aria-pressed={open.includes("saves")}
          aria-label={autosaveOff ? AUTOSAVE_OFF_NAME : undefined}
          title={autosaveOff ? AUTOSAVE_OFF_TITLE : undefined}
          data-testid="saves-chip"
          data-chrome="rest"
          onClick={() => toggle("saves")}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4h10l2 2v10H4zM7 4v4h6V4M7 16v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          {autosaveOff ? AUTOSAVE_OFF_CHIP : "Saves"}
        </button>
      ) : null}
      <Notices key="notices" sim={sim} home={false} savesOpen={open.includes("saves")} />
      {/* Keyed by the load, so a game loaded with no company yet opens it empty, on the first colour, as a new game does, never
          with the name and colour typed for the company it replaced. Back to Home leaves it as Saves' does; its game has not
          started, so there is no clock to pause. */}
      <FoundingCard
        key={loadedAt ?? "new"}
        sim={sim}
        onHome={() => {
          choose("none");
          setOpen([]);
          setHomeAt(Date.now());
        }}
      />
      {stopped ? null : <DayCard sim={sim} />}
      {stopped ? null : <FailureCard sim={sim} />}
      <Corner key="corner" />
      <ReplacedCard key="replaced" failed={sim.status === "failed" ? failedText(sim.snapshot ? "stopped" : "start", CITIES[0]?.name ?? "The city") : null} />
    </main>
  );
}
