// The page's side of the sim worker: starts it on the city's sim file, keeps the latest snapshot,
// the dots and the last day card, and sends commands. Snapshots arrive about 10 times a second
// while time runs, so React re-renders at most that often, never per frame (AR-08). It also carries
// out the sim's saves in src/platform's store, one at a time in the order sent, since a worker has
// no localStorage; the sim names every key and decides what is set aside.
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEffects, build, createWebSaveStore, downloadText, pickTextFile, readSimFile, startSimWorker, type SaveStore } from '../../platform';
import { simOf, type City } from '../../cities';
import type { BusModelId, DayCard, DepotSiteView, StopSiteView, Dots, ExtendData, FareBandView, FromWorker, LineDraftView, LngLatPair, LoadView, RefusalView, SetAsideWhy, SlotView, Snapshot, ToWorker } from '../../sim/types';
import { errors } from '../errors';
import { LatestAsk } from './latest';

export type SimStatus = 'none' | 'loading' | 'ready' | 'failed';

/** A demand dot the pointer is on: a home dot (its people) or a job dot (its jobs), and where it is. */
export interface ProbeDot {
  readonly kind: 'home' | 'job';
  readonly at: LngLatPair;
  /** The dot's own people or jobs. */
  readonly here: number;
}

export interface Sim {
  readonly status: SimStatus;
  readonly dots: Dots | null;
  /** Where depots may stand (sim.json depotLand), for the tint. */
  readonly depotLand: readonly (readonly LngLatPair[])[] | null;
  readonly snapshot: Snapshot | null;
  readonly dayCard: DayCard | null;
  /** The demand dot last asked about: its kind, where it is, its own count, and how many live or work within a walk of it. */
  readonly probe: (ProbeDot & { readonly within: number }) | null;
  /** The depot rule's verdict where the pointer last was, while placing a depot. */
  readonly depotSite: { readonly at: LngLatPair; readonly site: DepotSiteView } | null;
  /** Where Place stop would put a stop at the pointer, or why not (D25). */
  readonly stopSite: { readonly at: LngLatPair; readonly site: StopSiteView } | null;
  /** The fare band of the line last asked about. */
  readonly fareBand: { readonly lineId: number; readonly band: FareBandView | null } | null;
  /** The line rule's draft for the clicks last sent. */
  readonly draft: LineDraftView | null;
  /** The last command the sim refused, until the next command. */
  readonly refusal: ({ readonly command: string } & RefusalView) | null;
  /** What became of the save this game started from. */
  readonly load: LoadView | null;
  /** The save slots, once asked for (Saves panel), and the last slot or file that became the game. */
  readonly slots: readonly SlotView[] | null;
  /** Saves set aside by a new build, kept until exported or deleted (the M5 spec, item 4). */
  readonly setAside: readonly SetAsideWhy[] | null;
  readonly loaded: { readonly from: 'slot' | 'file' | 'quarter'; readonly load: LoadView; readonly at: number } | null;
  /** Asks the player for a save file and, if they pick one, asks the sim to load it. */
  importSave(): void;
  send(message: ToWorker): void;
  /** Asks about a demand dot; null clears the card and drops any answer still to come. */
  probeAt(dot: ProbeDot | null): void;
  depotSiteAt(at: LngLatPair | null): void;
  stopSiteAt(at: LngLatPair | null): void;
  /** Asks for the draft card of these clicks, or of a line extended by them; an empty list clears it. */
  /** A draft's card: a new line's clicks, or with `route`, that line's whole route as the editor has it (D25). */
  draftFor(clicks: readonly LngLatPair[], model?: BusModelId, extend?: ExtendData, route?: number): void;
  /** Asks for a line's fare band; null forgets it. */
  fareBandFor(lineId: number | null): void;
  closeDayCard(): void;
}

export function useSim(city: City | undefined): Sim {
  const worker = useRef<Worker | null>(null);
  const [status, setStatus] = useState<SimStatus>(city && simOf(city) ? 'loading' : 'none');
  const [dots, setDots] = useState<Dots | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dayCard, setDayCard] = useState<DayCard | null>(null);
  const [probe, setProbe] = useState<Sim['probe']>(null);
  const [depotLand, setDepotLand] = useState<Sim['depotLand']>(null);
  const [depotSite, setDepotSite] = useState<Sim['depotSite']>(null);
  const [stopSite, setStopSite] = useState<Sim['stopSite']>(null);
  const [draft, setDraft] = useState<LineDraftView | null>(null);
  const [fareBand, setFareBand] = useState<Sim['fareBand']>(null);
  const [refusal, setRefusal] = useState<Sim['refusal']>(null);
  const [load, setLoad] = useState<LoadView | null>(null);
  const [slots, setSlots] = useState<Sim['slots']>(null);
  const [setAside, setSetAside] = useState<Sim['setAside']>(null);
  const [loaded, setLoaded] = useState<Sim['loaded']>(null);
  const probes = useRef(new LatestAsk<ProbeDot>());
  // Only the newest answer counts: an older one arriving late is dropped.
  const asked = useRef({ site: 0, draft: 0, band: 0, next: 1 });
  const sites = useRef(new Map<number, LngLatPair>());

  useEffect(() => {
    const sim = city ? simOf(city) : null;
    if (!city || !sim) return;
    let stopped = false;
    // Saves run one after another: a set-aside's backup is written before anything replaces the key.
    let store: SaveStore | null = null;
    let queue = Promise.resolve();
    const inStore = (job: (s: SaveStore) => Promise<void>) => {
      queue = queue
        .then(() => job((store ??= createWebSaveStore())))
        .catch((error: unknown) => errors.report({ severity: 'problem', source: 'save', code: 'store-failed', detail: String(error) }));
    };
    Promise.all([readSimFile(sim.file), startSimWorker()])
      .then(([simText, w]) => {
        if (stopped) return w.terminate();
        worker.current = w;
        w.onmessage = (event: MessageEvent<FromWorker>) => {
          const m = event.data;
          if (m.type === 'ready') {
            setDots(m.dots);
            setDepotLand(m.depotLand);
            setSnapshot(m.snapshot);
            setLoad(m.load);
            setStatus('ready');
          } else if (m.type === 'read-save') {
            // No store (storage blocked) reads as no save: the game starts fresh and keeps playing.
            let text: string | null = null;
            inStore(async (s) => void (text = await s.read(m.key)));
            queue = queue.then(() => w.postMessage({ type: 'save-text', text } satisfies ToWorker));
          } else if (m.type === 'read-keys') {
            // After every store effect before it, as read-save: a slot just written reads back.
            let texts: (string | null)[] = m.keys.map(() => null);
            inStore(async (s) => void (texts = await Promise.all(m.keys.map((k) => s.read(k)))));
            queue = queue.then(() => w.postMessage({ type: 'key-texts', id: m.id, texts } satisfies ToWorker));
          } else if (m.type === 'slots') {
            setSlots(m.slots);
            setSetAside(m.setAside);
          }
          else if (m.type === 'export') downloadText(m.name, m.text);
          // A new game from Home needs no notice: its founding card says what comes next. Whatever the
          // game was, its day card and draft go with it.
          else if (m.type === 'loaded') {
            if (m.from !== 'new') setLoaded({ from: m.from, load: m.load, at: Date.now() });
            setDayCard(null);
            setDraft(null);
          }
          else if (m.type === 'store') inStore((s) => applyEffects(s, m.effects));
          else if (m.type === 'snapshot') setSnapshot(m.snapshot);
          else if (m.type === 'depot-site') {
            const at = sites.current.get(m.id);
            sites.current.delete(m.id);
            if (at && m.id === asked.current.site) setDepotSite({ at, site: m.site });
          } else if (m.type === 'stop-site') {
            const at = sites.current.get(m.id);
            sites.current.delete(m.id);
            if (at && m.id === asked.current.site) setStopSite({ at, site: m.site });
          } else if (m.type === 'line-draft') {
            if (m.id === asked.current.draft) setDraft(m.draft);
          } else if (m.type === 'fare-band') {
            if (m.id === asked.current.band) setFareBand({ lineId: m.lineId, band: m.band });
          }
          else if (m.type === 'day-card') setDayCard(m.card);
          else if (m.type === 'probe') {
            const dot = probes.current.answer(m.id);
            if (dot) setProbe({ ...dot, within: m.within });
          } else if (m.type === 'failed') {
            errors.report({ severity: 'fatal', source: 'sim', code: 'start-failed', detail: m.problem });
            setStatus('failed');
          } else if (m.type === 'refused') {
            setRefusal({ ...m, command: m.command });
            errors.report({ severity: 'note', source: 'sim', code: `refused-${m.command}`, detail: m.reason });
          }
        };
        w.onerror = (event) => {
          errors.report({ severity: 'fatal', source: 'worker', code: 'crashed', detail: event.message });
          setStatus('failed');
        };
        const message: ToWorker = { type: 'init', simText, city: { id: city.id, revision: sim.extent, hash: sim.sha256 }, seed: 1, build: { sha: build.sha, version: build.version } };
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

  const send = useCallback((message: ToWorker) => {
    setRefusal(null);
    worker.current?.postMessage(message);
  }, []);
  const probeAt = useCallback((dot: ProbeDot | null) => {
    if (!dot) {
      probes.current.withdraw();
      return setProbe(null);
    }
    const id = probes.current.ask(dot);
    worker.current?.postMessage({ type: 'probe', id, at: dot.at, kind: dot.kind } satisfies ToWorker);
  }, []);
  const depotSiteAt = useCallback((at: LngLatPair | null) => {
    if (!at) {
      asked.current.site = 0;
      return setDepotSite(null);
    }
    const id = asked.current.next++;
    asked.current.site = id;
    sites.current.set(id, at);
    worker.current?.postMessage({ type: 'depot-site', id, at } satisfies ToWorker);
  }, []);
  const stopSiteAt = useCallback((at: LngLatPair | null) => {
    if (!at) {
      asked.current.site = 0;
      return setStopSite(null);
    }
    const id = asked.current.next++;
    asked.current.site = id;
    sites.current.set(id, at);
    worker.current?.postMessage({ type: 'stop-site', id, at } satisfies ToWorker);
  }, []);
  const draftFor = useCallback((clicks: readonly LngLatPair[], model: BusModelId = 'sparrow', extend?: ExtendData, route?: number) => {
    if (!clicks.length) {
      asked.current.draft = 0;
      return setDraft(null);
    }
    const id = asked.current.next++;
    asked.current.draft = id;
    worker.current?.postMessage({ type: 'line-draft', id, clicks, model, ...(extend ? { extend } : {}), ...(route === undefined ? {} : { route }) } satisfies ToWorker);
  }, []);
  const fareBandFor = useCallback((lineId: number | null) => {
    if (lineId === null) {
      asked.current.band = 0;
      return setFareBand(null);
    }
    const id = asked.current.next++;
    asked.current.band = id;
    worker.current?.postMessage({ type: 'fare-band', id, lineId } satisfies ToWorker);
  }, []);
  const closeDayCard = useCallback(() => setDayCard(null), []);
  const importSave = useCallback(() => {
    void pickTextFile().then((text) => {
      if (text === null) return;
      setRefusal(null); // as send() does, so an older refusal does not hide what the import brings
      worker.current?.postMessage({ type: 'import', text } satisfies ToWorker);
    });
  }, []);

  return { status, dots, depotLand, snapshot, dayCard, probe, depotSite, stopSite, draft, fareBand, refusal, load, slots, setAside, loaded, send, probeAt, depotSiteAt, stopSiteAt, draftFor, fareBandFor, importSave, closeDayCard };
}
