import { useCallback, useEffect, useRef, useState } from 'react';
import { CITIES } from '../cities';
import { MapView } from '../render/map/MapView';
import type { BusModelId, LngLatPair } from '../sim/types';
import { Corner } from './Corner';
import { DayCard } from './game/DayCard';
import { FoundingCard } from './game/Founding';
import { ProbeCard } from './game/ProbeCard';
import { DepotCard, DraftCard, type Tool } from './game/Tools';
import { useSim } from './game/useSim';
import { ReplacedCard } from './ReplacedCard';
import { Dock, type Panel } from './shell/Dock';
import { Inspector } from './shell/Inspector';
import { Notices } from './shell/Notices';
import { TopBar } from './shell/TopBar';

export function App() {
  const sim = useSim(CITIES[0]);
  const [screen, setScreen] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [clicks, setClicks] = useState<LngLatPair[]>([]);
  const [draftModel, setDraftModel] = useState<BusModelId>('sparrow');
  // One panel at a time on the right: the line tool's draft card, or the lines' inspector.
  const [panel, setPanel] = useState<Panel>('none');
  const [lineId, setLineId] = useState<number | null>(null);
  const { probeAt, depotSiteAt, draftFor, send } = sim;

  // A tool's pointer: the depot card while placing a depot, "people within a walk" otherwise.
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const onPointer = useCallback(
    (at: LngLatPair | null, point: [number, number] | null) => {
      setScreen(point);
      if (toolRef.current === 'depot') depotSiteAt(at);
      else if (toolRef.current === 'none') probeAt(at);
    },
    [probeAt, depotSiteAt],
  );
  const onClick = useCallback(
    (at: LngLatPair, line: number | null) => {
      if (toolRef.current === 'depot') send({ type: 'place-depot', at });
      else if (toolRef.current === 'line') setClicks((c) => [...c, at]);
      else if (line !== null) {
        // A click on a line opens its inspector.
        setLineId(line);
        setPanel('lines');
      }
    },
    [send],
  );

  const choose = useCallback(
    (next: Tool) => {
      setTool((now) => (now === next ? 'none' : next));
      setClicks([]);
      if (next !== 'none') setPanel('none');
      probeAt(null);
      depotSiteAt(null);
    },
    [probeAt, depotSiteAt],
  );

  useEffect(() => draftFor(clicks, draftModel), [clicks, draftModel, draftFor]);

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
      setTool('none');
      setClicks([]);
      depotSiteAt(null);
    }
    // A new line opens in the inspector, so its headways and forecast are one look away.
    if (lines > counts.current.lines) {
      setLineId(null);
      setPanel('lines');
    }
    counts.current = { depots, lines };
  }, [started, depots, lines, depotSiteAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      if (event.key === 'Escape') {
        choose('none');
        setPanel('none');
      }
      else if (event.key === 'Backspace' && toolRef.current === 'line') setClicks((c) => c.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);

  const ready = sim.status === 'ready';
  return (
    <main className="app">
      <MapView
        dots={sim.dots}
        lines={sim.snapshot?.lines ?? []}
        linesVersion={sim.snapshot?.linesVersion ?? 0}
        depotLand={sim.depotLand}
        tint={tool === 'depot'}
        depots={sim.snapshot?.depots ?? []}
        draft={tool === 'line' && clicks.length ? sim.draft : null}
        clock={sim.snapshot ? { second: sim.snapshot.secondOfDay, rate: sim.snapshot.rate } : null}
        {...(ready ? { onPointer, onClick } : {})}
      />
      <TopBar sim={sim} />
      {tool === 'none' ? <ProbeCard sim={sim} screen={screen} /> : null}
      {tool === 'depot' ? <DepotCard sim={sim} screen={screen} /> : null}
      {tool === 'line' ? (
        <DraftCard
          sim={sim}
          clicks={clicks.length}
          model={draftModel}
          onModel={setDraftModel}
          onCreate={() => send({ type: 'create-line', clicks, model: draftModel })}
          onUndo={() => setClicks((c) => c.slice(0, -1))}
          onCancel={() => choose('none')}
        />
      ) : null}
      {tool === 'none' && panel === 'lines' ? <Inspector sim={sim} lineId={lineId} onLine={setLineId} onClose={() => setPanel('none')} /> : null}
      {ready && sim.snapshot?.company.name ? (
        <Dock tool={tool} panel={panel} hasLines={(sim.snapshot?.lines.length ?? 0) > 0} onTool={choose} onPanel={setPanel} />
      ) : null}
      <Notices sim={sim} />
      <FoundingCard sim={sim} />
      <DayCard sim={sim} />
      <Corner />
      <ReplacedCard />
    </main>
  );
}
