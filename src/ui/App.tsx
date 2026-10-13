import { useCallback, useEffect, useRef, useState } from 'react';
import { CITIES } from '../cities';
import { MapView } from '../render/map/MapView';
import type { LngLatPair } from '../sim/types';
import { Corner } from './Corner';
import { DayCard } from './game/DayCard';
import { LineCard } from './game/LineCard';
import { ProbeCard } from './game/ProbeCard';
import { SimPanel } from './game/SimPanel';
import { DepotCard, DraftCard, type Tool } from './game/Tools';
import { useSim } from './game/useSim';
import { ReplacedCard } from './ReplacedCard';

export function App() {
  const sim = useSim(CITIES[0]);
  const [screen, setScreen] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [clicks, setClicks] = useState<LngLatPair[]>([]);
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
    (at: LngLatPair) => {
      if (toolRef.current === 'depot') send({ type: 'place-depot', at });
      else if (toolRef.current === 'line') setClicks((c) => [...c, at]);
    },
    [send],
  );

  const choose = useCallback(
    (next: Tool) => {
      setTool((now) => (now === next ? 'none' : next));
      setClicks([]);
      probeAt(null);
      depotSiteAt(null);
    },
    [probeAt, depotSiteAt],
  );

  useEffect(() => draftFor(clicks), [clicks, draftFor]);

  // A tool closes once its purchase lands: a new depot, or a new line.
  const depots = sim.snapshot?.depots.length ?? 0;
  const lines = sim.snapshot?.lines.length ?? 0;
  const counts = useRef({ depots, lines });
  useEffect(() => {
    if (depots > counts.current.depots || lines > counts.current.lines) {
      setTool('none');
      setClicks([]);
      depotSiteAt(null);
    }
    counts.current = { depots, lines };
  }, [depots, lines, depotSiteAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      if (event.key === 'Escape') choose('none');
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
      <SimPanel sim={sim} tool={tool} onTool={choose} />
      {tool === 'none' ? <ProbeCard sim={sim} screen={screen} /> : null}
      {tool === 'depot' ? <DepotCard sim={sim} screen={screen} /> : null}
      {tool === 'line' ? (
        <DraftCard
          sim={sim}
          clicks={clicks.length}
          onCreate={() => send({ type: 'create-line', clicks })}
          onUndo={() => setClicks((c) => c.slice(0, -1))}
          onCancel={() => choose('none')}
        />
      ) : null}
      {tool === 'none' && ready ? (
        <div className="line-cards">
          {(sim.snapshot?.lines ?? []).map((line) => (
            <LineCard key={line.id} sim={sim} line={line} />
          ))}
        </div>
      ) : null}
      <DayCard sim={sim} />
      <Corner />
      <ReplacedCard />
    </main>
  );
}
