// The page's side of the sim worker: starts it on the city's sim file, keeps the latest snapshot,
// the dots and the last day card, and sends commands. Snapshots arrive about 10 times a second
// while time runs, so React re-renders at most that often, never per frame (AR-08).
import { useCallback, useEffect, useRef, useState } from 'react';
import { readSimFile, startSimWorker } from '../../platform';
import type { City } from '../../cities';
import type { DayCard, Dots, FromWorker, LngLatPair, Snapshot, ToWorker } from '../../sim/types';
import { errors } from '../errors';

export type SimStatus = 'none' | 'loading' | 'ready' | 'failed';

export interface Sim {
  readonly status: SimStatus;
  readonly dots: Dots | null;
  readonly snapshot: Snapshot | null;
  readonly dayCard: DayCard | null;
  /** The last probe: where, and how many people live within a walk of it. */
  readonly probe: { readonly at: LngLatPair; readonly people: number } | null;
  send(message: ToWorker): void;
  probeAt(at: LngLatPair | null): void;
  closeDayCard(): void;
}

export function useSim(city: City | undefined): Sim {
  const worker = useRef<Worker | null>(null);
  const [status, setStatus] = useState<SimStatus>(city?.sim ? 'loading' : 'none');
  const [dots, setDots] = useState<Dots | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dayCard, setDayCard] = useState<DayCard | null>(null);
  const [probe, setProbe] = useState<Sim['probe']>(null);
  const probes = useRef(new Map<number, LngLatPair>());
  const nextProbe = useRef(1);

  useEffect(() => {
    const sim = city?.sim;
    if (!city || !sim) return;
    let stopped = false;
    Promise.all([readSimFile(sim.file), startSimWorker()])
      .then(([simText, w]) => {
        if (stopped) return w.terminate();
        worker.current = w;
        w.onmessage = (event: MessageEvent<FromWorker>) => {
          const m = event.data;
          if (m.type === 'ready') {
            setDots(m.dots);
            setSnapshot(m.snapshot);
            setStatus('ready');
          } else if (m.type === 'snapshot') setSnapshot(m.snapshot);
          else if (m.type === 'day-card') setDayCard(m.card);
          else if (m.type === 'probe') {
            const at = probes.current.get(m.id);
            probes.current.delete(m.id);
            if (at) setProbe({ at, people: m.people });
          } else if (m.type === 'failed') {
            errors.report({ severity: 'fatal', source: 'sim', code: 'start-failed', detail: m.problem });
            setStatus('failed');
          } else if (m.type === 'refused') errors.report({ severity: 'note', source: 'sim', code: `refused-${m.command}`, detail: m.reason });
        };
        w.onerror = (event) => {
          errors.report({ severity: 'fatal', source: 'worker', code: 'crashed', detail: event.message });
          setStatus('failed');
        };
        const message: ToWorker = { type: 'init', simText, city: { id: city.id, revision: sim.extent, hash: sim.sha256 }, seed: 1 };
        w.postMessage(message);
      })
      .catch((error: unknown) => {
        errors.report({ severity: 'fatal', source: 'sim', code: 'start-failed', detail: String(error) });
        if (!stopped) setStatus('failed');
      });
    return () => {
      stopped = true;
      worker.current?.terminate();
      worker.current = null;
    };
  }, [city]);

  const send = useCallback((message: ToWorker) => worker.current?.postMessage(message), []);
  const probeAt = useCallback((at: LngLatPair | null) => {
    if (!at) return setProbe(null);
    const id = nextProbe.current++;
    probes.current.set(id, at);
    worker.current?.postMessage({ type: 'probe', id, at } satisfies ToWorker);
  }, []);
  const closeDayCard = useCallback(() => setDayCard(null), []);

  return { status, dots, snapshot, dayCard, probe, send, probeAt, closeDayCard };
}
