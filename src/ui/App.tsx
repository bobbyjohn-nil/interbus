import { useCallback, useEffect, useRef, useState } from "react";
import { CITIES } from "../cities";
import { MapView, type MapHit } from "../render/map/MapView";
import type { BusModelId, ExtendData, LngLatPair } from "../sim/types";
import { Corner } from "./Corner";
import { DayCard } from "./game/DayCard";
import { FailureCard } from "./game/FailureCard";
import { FoundingCard } from "./game/Founding";
import { ProbeCard } from "./game/ProbeCard";
import { StopCard } from "./game/StopCard";
import { DepotCard, DraftCard, type Tool } from "./game/Tools";
import { useSim } from "./game/useSim";
import { ReplacedCard } from "./ReplacedCard";
import { Dock, type Panel } from "./shell/Dock";
import { Finance } from "./shell/Finance";
import { Contracts } from "./shell/Contracts";
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
  // The line the line tool is extending, if any, and how many stops it had when it started.
  const [extending, setExtending] = useState<
    (ExtendData & { readonly stops: number }) | null
  >(null);
  // One panel at a time on the right: the line tool's draft card, the lines' inspector, or a stop's card.
  const [panel, setPanel] = useState<Panel>("none");
  const [lineId, setLineId] = useState<number | null>(null);
  const [stopId, setStopId] = useState<number | null>(null);
  const { probeAt, depotSiteAt, draftFor, send } = sim;

  // A tool's pointer: the depot card while placing a depot, "people within a walk" otherwise.
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const onPointer = useCallback(
    (at: LngLatPair | null, point: [number, number] | null) => {
      setScreen(point);
      if (toolRef.current === "depot") depotSiteAt(at);
      else if (toolRef.current === "none") probeAt(at);
    },
    [probeAt, depotSiteAt],
  );
  const onClick = useCallback(
    (at: LngLatPair, hit: MapHit) => {
      if (toolRef.current === "depot") send({ type: "place-depot", at });
      else if (toolRef.current === "line") setClicks((c) => [...c, at]);
      else if (hit.stopId !== null) {
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
      setExtending(null);
      if (next !== "none") setPanel("none");
      probeAt(null);
      depotSiteAt(null);
    },
    [probeAt, depotSiteAt],
  );

  useEffect(
    () =>
      draftFor(
        clicks,
        draftModel,
        extending
          ? { lineId: extending.lineId, end: extending.end }
          : undefined,
      ),
    [clicks, draftModel, extending, draftFor],
  );
  const startExtend = useCallback(
    (id: number, end: "start" | "end") => {
      const stops =
        sim.snapshot?.lines.find((l) => l.id === id)?.stopIds.length ?? 0;
      setTool("line");
      setClicks([]);
      setPanel("none");
      setExtending({ lineId: id, end, stops });
      probeAt(null);
    },
    [sim.snapshot, probeAt],
  );
  // An extension that lands closes the tool and shows the line, as a new line does: the line it
  // extends gains stops.
  const extendingLine = extending
    ? (sim.snapshot?.lines.find((l) => l.id === extending.lineId) ?? null)
    : null;
  const extendedStops = extendingLine?.stopIds.length ?? 0;
  const extendTarget = useRef<{ lineId: number; stops: number } | null>(null);
  useEffect(() => {
    extendTarget.current = extending
      ? { lineId: extending.lineId, stops: extending.stops }
      : null;
  }, [extending]);
  useEffect(() => {
    const target = extendTarget.current;
    if (!target || extendedStops <= target.stops) return;
    extendTarget.current = null;
    setTool("none");
    setClicks([]);
    setExtending(null);
    setLineId(target.lineId);
    setPanel("lines");
  }, [extendedStops]);

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
        event.target instanceof HTMLInputElement
      )
        return;
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

  const ready = sim.status === "ready";
  return (
    <main className="app">
      <MapView
        dots={sim.dots}
        lines={sim.snapshot?.lines ?? []}
        stops={sim.snapshot?.stops ?? []}
        linesVersion={sim.snapshot?.linesVersion ?? 0}
        depotLand={sim.depotLand}
        tint={tool === "depot"}
        depots={sim.snapshot?.depots ?? []}
        contracts={sim.snapshot?.contracts ?? []}
        event={sim.snapshot?.event ?? null}
        draft={tool === "line" && clicks.length ? sim.draft : null}
        clock={
          sim.snapshot
            ? { second: sim.snapshot.secondOfDay, rate: sim.snapshot.rate }
            : null
        }
        {...(ready ? { onPointer, onClick } : {})}
      />
      <TopBar
        sim={sim}
        onContracts={() => {
          choose("none");
          setPanel("contracts");
        }}
      />
      {tool === "none" ? <ProbeCard sim={sim} screen={screen} /> : null}
      {tool === "depot" ? <DepotCard sim={sim} screen={screen} /> : null}
      {tool === "line" ? (
        <DraftCard
          sim={sim}
          clicks={clicks.length}
          model={draftModel}
          extend={
            extendingLine
              ? { name: extendingLine.name, model: extendingLine.model }
              : null
          }
          onModel={setDraftModel}
          onCreate={() =>
            extending
              ? send({
                  type: "extend-line",
                  lineId: extending.lineId,
                  end: extending.end,
                  clicks,
                })
              : send({ type: "create-line", clicks, model: draftModel })
          }
          onUndo={() => setClicks((c) => c.slice(0, -1))}
          onCancel={() => choose("none")}
        />
      ) : null}
      {tool === "none" && panel === "lines" ? (
        <Inspector
          sim={sim}
          lineId={lineId}
          onLine={setLineId}
          onExtend={startExtend}
          onClose={() => setPanel("none")}
        />
      ) : null}
      {tool === "none" && panel === "finance" ? (
        <Finance sim={sim} onClose={() => setPanel("none")} />
      ) : null}
      {tool === "none" && panel === "saves" ? (
        <Saves sim={sim} onClose={() => setPanel("none")} />
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
          onPanel={setPanel}
        />
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
