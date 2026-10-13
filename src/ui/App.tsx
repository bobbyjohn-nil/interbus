import { useCallback, useState } from 'react';
import { CITIES } from '../cities';
import { MapView } from '../render/map/MapView';
import type { LngLatPair } from '../sim/types';
import { Corner } from './Corner';
import { DayCard } from './game/DayCard';
import { ProbeCard } from './game/ProbeCard';
import { SimPanel } from './game/SimPanel';
import { useSim } from './game/useSim';
import { ReplacedCard } from './ReplacedCard';

export function App() {
  const sim = useSim(CITIES[0]);
  const [screen, setScreen] = useState<[number, number] | null>(null);
  const { probeAt } = sim;
  const onPointer = useCallback(
    (at: LngLatPair | null, point: [number, number] | null) => {
      setScreen(point);
      probeAt(at);
    },
    [probeAt],
  );
  return (
    <main className="app">
      <MapView
        dots={sim.dots}
        lines={sim.snapshot?.lines ?? []}
        linesVersion={sim.snapshot?.linesVersion ?? 0}
        {...(sim.status === 'ready' ? { onPointer } : {})}
      />
      <SimPanel sim={sim} />
      <ProbeCard sim={sim} screen={screen} />
      <DayCard sim={sim} />
      <Corner />
      <ReplacedCard />
    </main>
  );
}
