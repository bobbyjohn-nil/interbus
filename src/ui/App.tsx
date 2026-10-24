import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CITIES } from "../cities";
import { MapView, type DotKinds, type HoveredDot, type MapHit } from "../render/map/MapView";
import { inOpenList } from "../render/map/tilt";
import { readDotPrefs, readPlaySpeed, writeDotPrefs, writePlaySpeed } from "../platform";
import { PLAY_SPEED, RUNNING_SPEEDS } from "../sim/rules/speed";
import type { BusModelId, LngLatPair, Speed } from "../sim/types";
import { Corner } from "./Corner";
import { AUTOSAVE_OFF_CHIP, AUTOSAVE_OFF_NAME, AUTOSAVE_OFF_TITLE, failedText, MAP_UNSAVED_COPY } from "./copy";
import { DayCard } from "./game/DayCard";
import { FailureCard } from "./game/FailureCard";
import { runOver } from "./game/runOver";
import { FoundingCard } from "./game/Founding";
import { ProbeCard } from "./game/ProbeCard";
import { StopCard } from "./game/StopCard";
import { useFocusBack } from "./focusBack";
import { focusLost } from "./focusLost";
import { LinesHere, linesHere } from "./game/LinesHere";
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
import { Help, type HelpView } from "./shell/Help";
import { Home } from "./shell/Home";
import { Saves } from "./shell/Saves";
import { Inspector } from "./shell/Inspector";
import { Notices } from "./shell/Notices";
import { TopBar } from "./shell/TopBar";
import { endBoot, hearHeldKeys } from "./brand/boot";

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
  // Whether the keyboard, not the pointer, moved the focus where it is (focusSource.ts), for Space and for the panels.
  const focus = useRef(focusSource());
  // The panel (or the tool's card) the player opened or showed last, which takes the focus once placed when the keyboard
  // did it (Panels, takesFocus), so the next Tab is its first control. It stayed on what opened it: from the dock, the
  // panel's first control was 11 Tabs on, past the dock's other buttons, the Saves chip, the map's credits, the map and
  // the chips (the systems audit's ninth round).
  const [focusAt, setFocusAt] = useState<PanelFront | null>(null);
  const focusOn = useCallback((id: string) => setFocusAt((f) => ({ id, n: (f?.n ?? 0) + 1 })), []);
  /** Opens a panel, or brings one open to the front, taking no focus: what the game does by itself. */
  const bring = useCallback((p: Exclude<Panel, "none">) => {
    setOpen((o) => (o.includes(p) ? o : [...o, p]));
    setFront((f) => ({ id: p, n: (f?.n ?? 0) + 1 }));
  }, []);
  /** The player's own opening of a panel, as bring, with the focus. */
  const show = useCallback(
    (p: Exclude<Panel, "none">) => {
      bring(p);
      focusOn(p);
    },
    [bring, focusOn],
  );
  const hide = useCallback((p: Exclude<Panel, "none">) => setOpen((o) => o.filter((x) => x !== p)), []);
  // A panel closed this way takes no focus: Panels finds no panel by that id.
  const toggle = useCallback(
    (p: Exclude<Panel, "none">) => {
      setOpen((o) => (o.includes(p) ? o.filter((x) => x !== p) : [...o, p]));
      focusOn(p);
    },
    [focusOn],
  );
  const [lineId, setLineId] = useState<number | null>(null);
  // The line Finance opens on, from the line panel's link to its money; null opens the Overview. Each
  // press of the link opens Finance afresh on that line, and Finance closed any way opens next on the Overview.
  const [financeLine, setFinanceLine] = useState<number | null>(null);
  const [financeAsks, setFinanceAsks] = useState(0);
  if (financeLine !== null && !open.includes("finance")) setFinanceLine(null);
  // The view Help was asked for, its keys or its credits, and each asking, so Help opens afresh on it, as Finance does.
  const [helpAsked, setHelpAsked] = useState<{ view: HelpView; n: number }>({ view: "keys", n: 0 });
  const askHelp = useCallback((view: HelpView) => setHelpAsked((h) => ({ view, n: h.n + 1 })), []);
  const [stopId, setStopId] = useState<number | null>(null);
  // The stops of the line card a stop's card was opened from, none for a press on the map: the focus goes back to them as
  // the stop comes down, or to Build.
  const [stopRow, setStopRow] = useState<Element | null>(null);
  // The lines a click found on the same streets, the topmost first (LinesHere).
  const [hereIds, setHereIds] = useState<readonly number[]>([]);
  // When Home last opened, or null once the game is under way (the M5 spec, item 3): it is the first
  // screen, Saves' Back to Home returns to it, and a slot or a file loaded from it goes into that game.
  const [homeAt, setHomeAt] = useState<number | null>(0);
  // Start a new game leaves Home once the worker's unnamed company has come, which it always sends (worker/host.ts): left at
  // once, the old company's game drew a frame of its chips and dock before the founding card (round 11). During render, as
  // state that follows the game. Leaving Home closes Help, as Continue and New game do: ? pressed while the new game was on its
  // way carried Help onto the founding card, the two at 31.6% of 1152×720 (I13; the systems audit's twelfth round).
  const [starting, setStarting] = useState(false);
  if (starting && sim.snapshot && !sim.snapshot.company.name) {
    setStarting(false);
    setHomeAt(null);
    hide("help");
  }
  const { probeAt, depotSiteAt, stopSiteAt, draftFor, send } = sim;
  // Play resumes the speed last played at, 600x the first time (D25), kept in this browser: kept in the page alone, a reload
  // brought back 600x (the systems audit's fourteenth round).
  const [playSpeed, setPlaySpeed] = useState<Exclude<Speed, 0>>(() => RUNNING_SPEEDS.find((s) => s === readPlaySpeed()) ?? PLAY_SPEED);
  const speedNow = sim.snapshot?.speed ?? 0;
  // Kept as the game runs, during render (React's pattern for state that follows a prop).
  if (speedNow !== 0 && speedNow !== playSpeed) setPlaySpeed(speedNow);
  useEffect(() => writePlaySpeed(playSpeed), [playSpeed]);
  const over = runOver(sim);
  const speedRef = useRef({ now: speedNow, play: playSpeed, founded: false, over: false });
  useEffect(() => {
    speedRef.current = { now: speedNow, play: playSpeed, founded: Boolean(sim.snapshot?.company.name), over };
  }, [speedNow, playSpeed, sim.snapshot?.company.name, over]);

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
        setStopRow(null);
        setStopId(hit.stopId);
        show("stop");
      } else if (hit.lineIds.length > 1) {
        // On streets that several lines share, each is listed to open, not only the one drawn on top.
        setHereIds(hit.lineIds);
        show("here");
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
  // A tool picked from the Build menu. The line's card is a panel, and takes the keyboard's focus as every panel the keyboard
  // opens does (Panels' takesFocus): Enter on Draw a line took the menu away, and the focus fell to the page with it (round 11).
  const pickTool = useCallback(
    (next: Tool) => {
      choose(next);
      if (next === "line") focusOn("tool");
    },
    [choose, focusOn],
  );
  // The run ended with a tool out (the route editor, a line half drawn): it is put down, as the tools are locked (runOver),
  // and the route editor's line shows again in the panel the editor stood in for, as after Cancel.
  if (over && tool !== "none") {
    if (tool === "route" && routing) {
      setLineId(routing.lineId);
      bring("lines");
    }
    setTool("none");
    setClicks([]);
    setRouting(null);
  }

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
      // The editor stands in for the line's panel while it is open; Save route and Cancel bring it back. Opened from the
      // keyboard, it takes the focus the panel had.
      hide("lines");
      focusOn("route");
      setRouting({ lineId: id, points: routeOf(line), base: line.stopIds, saved: null });
      hoveredRef.current = null;
      probeAt(null);
    },
    [sim.snapshot, probeAt, hide, focusOn],
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
  // The focus of a button whose card closes with it, held here as the card goes (useFocusBack): Close it's, once its line has
  // gone, to the line shown in its place or to Build when none is left; the day card's Continue's, to where the focus came
  // from; a stop card's, as its stop goes or leaves a line. An undo that takes the only line leaves the focus where it was,
  // so Space still plays (the review of the hand-back: it opened Build).
  const handBack = useFocusBack();
  // Where Panels hands the focus back to as a panel closes, for Continue to hand it back to the same place (Panels' backToRef).
  const panelsBack = useRef<(panel: string) => Element | null>(() => null);
  const openStop = useCallback(
    (id: number, from: HTMLElement) => {
      setStopRow(from.closest("[data-testid='line-stops']"));
      setStopId(id);
      show("stop");
    },
    [show],
  );
  // A stop's card closes with its stop (taken down, or an undo), so it never opens again by itself on a
  // stop that takes the same id later.
  if (stopId !== null && game && !game.stops.some((s) => s.id === stopId)) {
    setStopId(null);
    hide("stop");
  }
  // Lines here closes with any line it lists, for the same reason: a line created later takes a freed id, and the card
  // would list it as running where the click was.
  if (hereIds.length && game && !linesHere(hereIds, game.lines)) {
    setHereIds([]);
    hide("here");
  }

  // Set when Create is pressed, to the undos sent by then: the new line, and only a created one, opens in the inspector (a line
  // that arrives with a loaded save opens no panel). A load lets it go, as does a Create refused, which brings no line, and an
  // undo sent after the press that the sim did, which took the Create back (createWaits, game/Tools.tsx). A Create undone with
  // it in one render brings no line to let it go: the game loaded later opened Lines on its newest line (the systems audit's
  // fourth round), and an undo bringing back a closed line put the tool down (round 10 and its review).
  const creating = useRef<number | null>(null);
  useEffect(() => {
    creating.current = null;
  }, [sim.createRefusals]);
  const undone = sim.undos.done;
  // A tool closes once its purchase lands: a new depot, or a new line from Create. A line an undo brings back is no purchase:
  // since Close line, an undo grows the count too, and it put down the line half drawn, or the route editor another line had
  // out, Lines with it (round 10).
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
    if (creating.current !== null && undone > creating.current) creating.current = null;
    if (!started) return;
    if (!counts.current) {
      counts.current = { depots, lines };
      return;
    }
    const created = lines > counts.current.lines && creating.current !== null;
    if (depots > counts.current.depots || created) {
      setTool("none");
      setClicks([]);
      depotSiteAt(null);
    }
    // A new line opens in the inspector, so its headways and forecast are one look away: the newest,
    // as the game keeps its lines in the order they were made.
    if (created) {
      creating.current = null;
      setLineId(newest);
      show("lines");
    }
    counts.current = { depots, lines };
  }, [started, depots, lines, newest, undone, depotSiteAt, show]);

  // A game loaded from a slot, a file or Restart this quarter takes this one's place: any tool out
  // goes down with the game it was drawn in, as with a new game, and so do the cards of its stops and
  // lines, which would show the loaded game's of the same id; the new-line card starts on the Sparrow,
  // never on a bus the loaded game has locked.
  const loadedAt = sim.loaded?.at ?? null;
  const loadedSeen = useRef(loadedAt);
  useEffect(() => {
    if (loadedAt === loadedSeen.current) return;
    loadedSeen.current = loadedAt;
    creating.current = null;
    choose("none");
    setOpen((o) => o.filter((p) => p !== "stop" && p !== "lines" && p !== "here"));
    setDraftModel("sparrow");
  }, [loadedAt, choose]);

  const ready = sim.status === "ready";
  // The page's boot splash goes once the game has a screen to show: Home or a game, towed away by its bus, or a card saying
  // why there is none, at once. Before the paint that shows it, so no moment shows that screen with the splash still speaking
  // over it (endBoot).
  useLayoutEffect(() => {
    if (sim.status !== "loading") endBoot(sim.status === "ready");
  }, [sim.status]);
  const atHome = ready && homeAt !== null && !(sim.loaded && sim.loaded.at > homeAt);
  // On Home, Saves and Help stand beside Home's card, off the panel layer, so Panels' hand-back never reaches them. One that
  // goes with the focus in it hands the focus to Home's button for it (Credits for Help asked on its credits), or to the Close
  // of the one that takes its place: Escape or Close left the focus on the page (the review of #157).
  const homeSide = atHome ? (open.includes("saves") ? "saves" : open.includes("help") ? (helpAsked.view === "credits" ? "credits" : "help") : null) : null;
  const sideWas = useRef(homeSide);
  useEffect(() => {
    const was = sideWas.current;
    sideWas.current = homeSide;
    if (!was || was === homeSide || !focusLost()) return;
    document.querySelector<HTMLElement>(homeSide ? `[data-testid="${homeSide === "saves" ? "saves" : "help"}"] .close` : `[data-testid="home-${was}"]`)?.focus();
  });
  // Back to Home, from Saves or the founding card, takes the button pressed with the game's screen, and the focus fell to the
  // page: its next Tab went to the map's credits, and Home's Continue was the sixth (round 10). Home's first button takes it
  // as the game gives way to Home, when the keyboard pressed it: a press of the mouse hands Space no button (focusSource), and
  // never on the page's first Home, where the focus is the browser's.
  const homeWas = useRef({ atHome, inGame: false });
  useEffect(() => {
    const was = homeWas.current;
    homeWas.current = { atHome, inGame: ready && !atHome };
    if (!atHome || was.atHome || !was.inGame || !focus.current.byKey || !focusLost()) return;
    document.querySelector<HTMLElement>('[data-testid="home"] button')?.focus();
  });
  // Help asked for again while it shows opens afresh on the view asked for, keyed by the asking. A press that leaves the focus
  // in it, as Safari's and Firefox's on macOS do (they focus no button they click), would leave it on the page as Help
  // remounts: Help's Close takes it, at Home and in the game (the review of the credits).
  const helpOpen = open.includes("help");
  const helpWas = useRef({ open: helpOpen, n: helpAsked.n });
  useEffect(() => {
    const was = helpWas.current;
    helpWas.current = { open: helpOpen, n: helpAsked.n };
    if (!was.open || !helpOpen || was.n === helpAsked.n || !focusLost()) return;
    document.querySelector<HTMLElement>('[data-testid="help"] .close')?.focus();
  });
  // A game that stopped working (its worker failed and was stopped) shows nothing of itself to press, nor of a tool out: no
  // panel (Saves opened from Home too), no tool's card, tint or draft, no day card and no lender's card, as it shows no dock
  // and no Saves chip. Their buttons would send to a worker that is gone, or close a card over a game that no longer runs,
  // so the card that says it stopped, with Reload, is all that is left. A notice has no button, and "Not autosaving: see
  // Saves" waits for a game that is ready.
  const stopped = sim.status === "failed";
  // While the game is not saving itself (it saves nothing over a save it could not set aside, or the browser refused the
  // autosave and has kept none since, or another tab changed the autosave since this one last read or wrote it), the Saves chip
  // says so, for as long as that lasts, open or not, so it neither changes its name nor jumps under the pointer as Saves
  // opens: no notice of its own, which took the shell at rest past I13's 6% beside a full chip row (the systems audit's third
  // round).
  const autosaveOff = Boolean(sim.unbacked) || sim.autosaveRefused || sim.newer;
  // The map's GPU cards say the game is saved only while it is (the systems audit's fifth round): while it isn't saving itself,
  // or the browser keeps nothing at all (before a company is founded too), they say so and offer Export this game, which keeps it.
  const mapUnsaved = autosaveOff || sim.storeRefused === "blocked" ? { ...MAP_UNSAVED_COPY, onKeep: () => send({ type: "export" }) } : null;

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
    // The keys the splash's hold stops before this listener hears them, Tab among what it leaves in sight among them (boot.ts).
    const unhear = hearHeldKeys(input);
    return () => {
      unhear();
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
      const typing =
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;
      // ? opens Help and closes it again (PLAN §8's keyboard shortcuts, which it lists), on Home too, where it takes Saves'
      // place beside Home's card. Typed into a field, it is the field's (a radio or a checkbox is no field); held, it opens
      // once; with AltGr, as some keyboards type it, it still counts. An open list or menu keeps its keys: ? left it open
      // behind Help, its arrows and Enter going to Help (the review of #157).
      const chosen = event.target instanceof HTMLInputElement && (event.target.type === "radio" || event.target.type === "checkbox");
      const inList = inOpenList(event.target);
      const plain = event.getModifierState?.("AltGraph") || (!event.ctrlKey && !event.altKey);
      if (event.key === "?" && (!typing || chosen) && !inList && !event.metaKey && plain) {
        event.preventDefault();
        if (event.repeat) return;
        if (atHome) hide("saves");
        askHelp("keys");
        toggle("help");
        return;
      }
      // An open list or menu keeps every key, as it keeps ?: T tilted the map behind the speed list, and 2 picked 60× under it,
      // its Enter then picking the old speed again (round 10). It takes Escape, Tab and its own keys itself. But Space on a button
      // the mouse pressed is the page's still, as below: a Build tool the mouse pressed without a click (a press dragged off it,
      // or a right-click) took Space from play once the Build menu kept its keys (the review of round 11).
      if (inList && !(event.key === " " && event.target instanceof HTMLButtonElement && !focus.current.byKey)) return;
      // Home stands over a paused game: its keys are Home's (Escape closes Saves and Help), not the game's.
      if (atHome && event.key !== "Escape") return;
      // Typed into a field, a key is the field's, but for Escape: in the company's name, which has the focus whenever the
      // founding card shows, Escape closed nothing, not even Saves left open beside the card (round 10).
      if (typing && event.key !== "Escape") return;
      // Space pauses and plays; 1 to 5 pick a speed, real time up (D25). A button the keyboard reached
      // keeps Space, so Space still presses it; one pressed with the mouse does not, or Space pressed it
      // again (opening the speed menu, closing Finance, taking back one more command). A held Space
      // pauses or plays once, as a held key presses a button once (onePress.ts) and tilts once (tilt.ts), and a held 1 to 5
      // picks its speed once: their repeats send nothing (each was a command, an autosave and a stalled clock).
      // An ended run takes no play, speed or undo from the keys either (runOver), and Space still presses no button the mouse
      // pressed: the review of the systems audit's eighth round let it through, so it closed Finance or exported again.
      const { now, play, founded, over: ended } = speedRef.current;
      const keeps = event.target instanceof HTMLButtonElement && focus.current.byKey;
      if (founded && event.key === " " && !keeps) {
        event.preventDefault();
        if (!event.repeat && !ended) send({ type: "speed", speed: now === 0 ? play : 0 });
        return;
      }
      const pick = founded && !ended && !event.ctrlKey && !event.metaKey && !event.altKey ? RUNNING_SPEEDS[Number(event.key) - 1] : undefined;
      if (pick !== undefined && /^[1-5]$/.test(event.key)) {
        if (!event.repeat) send({ type: "speed", speed: pick });
        return;
      }
      // Ctrl+Z or ⌘Z takes back the newest command taken while paused (I9); with Shift, the usual
      // redo, it does nothing, since there is no redo.
      if (!ended && (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
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
  }, [choose, send, atHome, removeLast, toggle, hide, askHelp]);

  // A tool and the panels stay out together, each on the panel layer in a place of its own: they no
  // longer cover each other (the owner's initial playtest: "when you open 2 tabs, they conflict and you
  // can't use it, either make it so that the tabs are moveable ... preferably the former").

  // The panel layer's items: the tool's card first, then each open panel in the order it opened.
  const panelItems: PanelItem[] = [];
  // The route editor and the line being drawn are two panels: as one, Build's Draw a line took the editor's place in its box,
  // so the editor never closed and Escape from the line's card handed the focus back through the editor's (the review of
  // round 10).
  if (tool === "route" && routing && routingLine)
    panelItems.push({
      id: "route",
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
            creating.current = createNow.undos;
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
            closeHandBack={handBack}
            onStop={openStop}
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
            onHelp={() => {
              // Help takes Saves' place, as on Home: the two together took 35.5% of 1152×720 (I13; the review of #157).
              // The Saves chip, which opened Saves, takes the focus first, so a Help the keyboard opened hands it back there.
              if (document.activeElement?.closest('[data-testid="saves"]')) document.querySelector<HTMLElement>('[data-testid="saves-chip"]')?.focus();
              hide("saves");
              askHelp("keys");
              show("help");
            }}
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
    else if (p === "help") panelItems.push({ id: p, node: <Help key={helpAsked.n} view={helpAsked.view} onClose={() => hide("help")} /> });
    else if (p === "here")
      panelItems.push({
        id: p,
        node: (
          <LinesHere
            sim={sim}
            lineIds={hereIds}
            onLine={(id) => {
              setLineId(id);
              show("lines");
            }}
            onClose={() => hide("here")}
          />
        ),
      });
    else if (p === "stop" && stopId !== null)
      panelItems.push({
        id: p,
        node: (
          <StopCard
            sim={sim}
            stopId={stopId}
            handBack={handBack}
            backTo={() => (stopRow?.isConnected ? stopRow.querySelector<HTMLElement>("button") : null)}
            onLine={(id) => {
              setLineId(id);
              show("lines");
            }}
            onClose={() => hide("stop")}
          />
        ),
      });
  }
  // The lender's card, which stays until Restart this quarter, takes a free place on the panel layer as the panels do, so it
  // covers none open beside it and they open beside it: at the window's top centre, it hid the Close and views of a panel
  // opened third (the review of #142). No panel opened after it covers it, even with no free place left (clear), as it holds
  // the run's one way on. It shows once the closing day's card is read (FailureCard).
  if (over && !sim.dayCard) panelItems.push({ id: "lender", node: <FailureCard sim={sim} />, clear: true });

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
          unsaved={mapUnsaved}
        />
        <Home
          sim={sim}
          byKey={() => focus.current.byKey}
          waiting={starting}
          // Leaving Home closes Help: carried onto the founding card, the two took 31.6% of 1152×720 (I13; the review of #157).
          // Saves stays, where a game not yet founded loads a slot or a file instead (saves.spec).
          onContinue={() => {
            hide("help");
            setHomeAt(null);
          }}
          onNewGame={() => {
            hide("help");
            // A new game starts clean: no tool, draft or route editor, and no day card, of the old one,
            // and its new-line card on the Sparrow, never on a bus the old game had unlocked.
            choose("none");
            setDraftModel("sparrow");
            sim.closeDayCard();
            if (!sim.snapshot?.company.name) setHomeAt(null);
            else if (!starting) {
              send({ type: "new-game" });
              setStarting(true);
            }
          }}
          onSaves={() => {
            hide("help");
            show("saves");
          }}
          onHelp={() => {
            hide("saves");
            askHelp("keys");
            show("help");
          }}
          onCredits={() => {
            hide("saves");
            askHelp("credits");
            show("help");
          }}
        />
        {/* Saves and Help take turns beside Home's card, the one place there is for either (I13). */}
        {open.includes("saves") ? (
          <Saves sim={sim} onClose={() => hide("saves")} />
        ) : open.includes("help") ? (
          <Help key={helpAsked.n} view={helpAsked.view} onClose={() => hide("help")} />
        ) : null}
        {/* Keyed as in the game's tree, so switching between them keeps them, and a notice shows once
            and a panel dragged opens where it was dragged to again after Continue. */}
        <Panels key="panels" items={[]} front={front} backToRef={panelsBack} />
        <Notices key="notices" sim={sim} home savesOpen={open.includes("saves")} />
        <Corner key="corner" />
        <ReplacedCard key="replaced" unsaved={mapUnsaved} />
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
        unsaved={mapUnsaved}
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
      <Panels key="panels" items={stopped ? [] : panelItems} front={front} focus={focusAt} takesFocus={() => focus.current.byKey} backToRef={panelsBack} />
      {ready && sim.snapshot?.company.name ? (
        <Dock
          tool={tool}
          panels={open}
          hasLines={(sim.snapshot?.lines.length ?? 0) > 0}
          locked={over}
          onTool={pickTool}
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
          data-opens="saves"
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
      {stopped ? null : <DayCard sim={sim} handBack={handBack} byKey={() => focus.current.byKey} panelBack={(panel) => panelsBack.current(panel)} />}
      <Corner key="corner" />
      {/* A failed game's worker is gone, and Export with it: its card offers Reload alone. */}
      <ReplacedCard key="replaced" failed={stopped ? failedText(sim.snapshot ? "stopped" : "start", CITIES[0]?.name ?? "The city") : null} unsaved={stopped ? null : mapUnsaved} />
    </main>
  );
}
