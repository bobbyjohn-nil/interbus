// The page's side of the sim worker: starts it on the city's sim file, keeps the latest snapshot,
// the dots and the last day card, and sends commands. Snapshots arrive about 10 times a second
// while time runs, so React re-renders at most that often, never per frame (AR-08). It also carries
// out the sim's saves in src/platform's store, one at a time in the order sent, since a worker has
// no localStorage; the sim names every key and decides what is set aside.
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEffects, build, createWebSaveStore, downloadText, onOtherTabWrite, pickTextFile, readSimFile, startSimWorker, storeRefusal, type SaveStore, type StoreRefusal } from '../../platform';
import { simOf, type City } from '../../cities';
import type { BusModelId, DayCard, DepotSiteView, StopSiteView, Dots, ExtendData, FareBandView, FromWorker, LineDraftView, LngLatPair, LoadView, RefusalView, SaveAbout, SetAsideWhy, SlotView, Snapshot, ToWorker } from '../../sim/types';
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
  /** The very list of clicks `draft` answers, so a tool can tell its draft from one for clicks since changed. */
  readonly draftOf: readonly LngLatPair[] | null;
  /** The last command the sim refused, until the next command. */
  readonly refusal: ({ readonly command: string } & RefusalView) | null;
  /** How many Save routes the sim has refused, counted apart from `refusal`, which the next command clears, so the route editor knows its own. */
  readonly routeRefusals: number;
  /** How many Creates the sim has refused, counted as Save route's are, so a Create on its way knows its answer. */
  readonly createRefusals: number;
  /**
   * The undos the page has sent the sim (Ctrl+Z, ⌘Z or the Undo chip: `sent`), and the newest of them the
   * sim did, taking a command back, by its place in that count (`done`, 0 before any): every undo has one
   * answer, 'undone' or its refusal, in the order sent. Its two users: a Create on its way (game/Tools.tsx,
   * createWaits) and a Save route on its way (game/RouteEditor.tsx, pressSave and followed) each keep `sent`
   * from the press and let go once `done` passes it, as an undo sent after the press took a command back.
   * One the sim refused, as it refuses every undo while time runs, lets neither go.
   */
  readonly undos: { readonly sent: number; readonly done: number };
  /** What became of the save this game started from. */
  readonly load: LoadView | null;
  /** The save slots, once asked for (Saves panel), and the last slot or file that became the game. */
  readonly slots: readonly SlotView[] | null;
  /** Saves set aside by a new build, kept until exported or deleted (the M5 spec, item 4). */
  readonly setAside: readonly SetAsideWhy[] | null;
  /** A save the start could not set aside (a full disk): it stays under the live key, and the game saves nothing over it until the player deletes it. */
  readonly unbacked: SetAsideWhy | null;
  /** The backup of the save the start set aside: checked until it reads back, then kept or not (and still not once the player deletes that save); null when the start set nothing aside. */
  readonly backup: 'checking' | 'kept' | 'not-kept' | null;
  /** The autosave as kept when the slots were last listed, or null when none is. */
  readonly autosave: SaveAbout | null;
  /** How many writes the store has kept, and changes another tab made to the live key, so the save list reads its saves again as they change. */
  readonly stored: number;
  /**
   * Saves' line, and why: set while a save of the game's own (the autosave, the quarter's start) the browser refused to keep
   * is not kept since, or after any other refusal (a delete, a read) until a write is kept, as before. `full` when the store
   * had no room for it ("No room for saves"), `blocked` when it keeps nothing ("This browser isn’t keeping saves"),
   * which wins over `full`. The refused keys live only in this page, not in the store: a reload forgets them, and the line
   * with them, while the save is still not kept. A start's set-aside refused is `unbacked` instead, a Save here `slotsRefused`.
   */
  readonly storeRefused: StoreRefusal | null;
  /** Why the store first refused a job on this page, but the start's set-aside and a Save here: the notice says so once. */
  readonly storeNotice: StoreRefusal | null;
  /** Each slot whose last Save here the store refused, and why: said on its row until the slot is saved, a delete in Saves is kept (it made room) or another game loads. */
  readonly slotsRefused: ReadonlyMap<number, StoreRefusal>;
  /** Whether the store refused the autosave and has kept none since: the game is not saving itself, which the Saves chip says. */
  readonly autosaveRefused: boolean;
  /**
   * Whether another tab has changed this city's live key (saved its game there, or removed it) since this page last read or
   * wrote it, so this game is older than the browser's: the page writes none of the game's own saves (the autosave, the
   * quarter's start) over it, and the game is not saving itself, which the Saves chip, a notice and Saves' line say, until Home
   * takes the browser's game up (`followNewest`) or the key holds this page's game again.
   */
  readonly newer: boolean;
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
  /** Whether Home stands over the game: while it does, the browser's newest game, another tab's, becomes this one as it is saved, so Continue names and plays it. */
  followNewest(on: boolean): void;
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
  const [draftOf, setDraftOf] = useState<Sim['draftOf']>(null);
  const [fareBand, setFareBand] = useState<Sim['fareBand']>(null);
  const [refusal, setRefusal] = useState<Sim['refusal']>(null);
  const [routeRefusals, setRouteRefusals] = useState(0);
  const [createRefusals, setCreateRefusals] = useState(0);
  const [undos, setUndos] = useState<Sim['undos']>({ sent: 0, done: 0 });
  const [load, setLoad] = useState<LoadView | null>(null);
  const [slots, setSlots] = useState<Sim['slots']>(null);
  const [setAside, setSetAside] = useState<Sim['setAside']>(null);
  const [unbacked, setUnbacked] = useState<Sim['unbacked']>(null);
  const [backup, setBackup] = useState<Sim['backup']>(null);
  const [autosave, setAutosave] = useState<Sim['autosave']>(null);
  const [stored, setStored] = useState(0);
  const [storeRefused, setStoreRefused] = useState<Sim['storeRefused']>(null);
  const [storeNotice, setStoreNotice] = useState<Sim['storeNotice']>(null);
  const [slotsRefused, setSlotsRefused] = useState<Sim['slotsRefused']>(() => new Map());
  const [autosaveRefused, setAutosaveRefused] = useState(false);
  const [newer, setNewer] = useState(false);
  const [loaded, setLoaded] = useState<Sim['loaded']>(null);
  const follow = useRef<(on: boolean) => void>(() => undefined);
  const probes = useRef(new LatestAsk<ProbeDot>());
  // Only the newest answer counts: an older one arriving late is dropped.
  const asked = useRef({ site: 0, draft: 0, band: 0, next: 1 });
  const sites = useRef(new Map<number, LngLatPair>());
  // The clicks of the newest draft asked for: only its answer counts, so it answers these.
  const draftClicks = useRef<readonly LngLatPair[] | null>(null);

  useEffect(() => {
    const sim = city ? simOf(city) : null;
    if (!city || !sim) return;
    let stopped = false;
    // Saves run one after another: a set-aside's backup is written before anything replaces the key.
    let store: SaveStore | null = null;
    let queue = Promise.resolve();
    // The keys of the game's own saves whose last write the store refused (a full disk), and why: a kept write of the key
    // takes it out. Saves says so while one is left, or once a read or a delete is refused (`loose`: blocked site data) until
    // a write is kept. Held only here, in the page: a reload starts with none, though the save refused is still not kept.
    const refused = new Map<string, StoreRefusal>();
    // Those of them an autosave left unwritten.
    const autosaves = new Set<string>();
    let loose: StoreRefusal | null = null;
    const sayRefused = () => {
      const why = [...refused.values(), loose];
      setStoreRefused(why.includes('blocked') ? 'blocked' : why.includes('full') ? 'full' : null);
      setAutosaveRefused(autosaves.size > 0);
    };
    // Two tabs of the game (the systems audit's fifth round; D12 keeps an old tab open across a deploy): the live key's text as
    // this page last read or wrote it, and what the page last knew it to hold, from the window's 'storage' event or a read made
    // before a write. Another tab's change since, a save or a removal, makes the browser's the newer game: the page writes none
    // of this game's own over it (`newer`), and while Home stands over the game (`following`) a save there becomes this one, as
    // a reload would bring it. Null until the start's read is kept: a store that refuses it keeps nothing to write over.
    let live: { key: string; text: string | null; holds: string | null } | null = null;
    let unwatch: (() => void) | undefined;
    const sayNewer = () => setNewer(live !== null && live.holds !== live.text);
    let following = false;
    // One take at a time: another tab's saves come every 0.67 s at 5,400×, and the next take reads whatever the key holds then.
    // Each reads the key first, so Home finds a save the page was told nothing of (a page back from the browser's cache), and
    // none goes once Home is gone: the game is never replaced in play.
    let taking: { text: string | null } | null = null;
    let takeAgain = false;
    const takeNewest = () => {
      const l = live;
      if (!l) return;
      if (taking) return void (takeAgain = true);
      const take: { text: string | null } = (taking = { text: l.text });
      inStore(async (s) => void (take.text = l.holds = await s.read(l.key)));
      queue = queue.then(() => {
        if (following && take.text !== l.text && worker.current) return worker.current.postMessage({ type: 'take-save', text: take.text } satisfies ToWorker);
        taken();
      });
    };
    /** A take answered, or found nothing to take: the next one goes if another tab saved again meanwhile and Home still stands. */
    const taken = () => {
      taking = null;
      sayNewer();
      const again = takeAgain && following;
      takeAgain = false;
      if (again) takeNewest();
    };
    follow.current = (on) => {
      following = on;
      if (on) takeNewest();
      else takeAgain = false;
    };
    // The start's set-aside is `quiet`: if its backup is refused, the sim finds it missing and says so ('unbacked').
    // `owed` names the keys of the game's own saves a refused job leaves unwritten, and whether they are the autosave's; a read
    // or a delete owes none, and holds the line only until a write is kept. `slot` names a Save here's slot: refused, it is said
    // on that slot's row alone.
    const inStore = (job: (s: SaveStore) => Promise<void>, quiet = false, owed?: () => { keys: string[]; autosave: boolean }, slot?: number) => {
      queue = queue
        .then(() => job((store ??= createWebSaveStore())))
        .catch((error: unknown) => {
          // The player is told, once (Notices), in words for why (src/platform); Saves says so while the game's own save is not
          // kept, which the sim owes, made once a delete frees room.
          const why = storeRefusal(error);
          if (slot !== undefined) setSlotsRefused((r) => new Map(r).set(slot, why));
          else if (!quiet) {
            setStoreNotice((first) => first ?? why);
            const { keys, autosave } = owed?.() ?? { keys: [], autosave: false };
            for (const k of keys) {
              refused.set(k, why);
              if (autosave) autosaves.add(k);
            }
            if (keys.length) worker.current?.postMessage({ type: 'store-refused', keys } satisfies ToWorker);
            if (keys.length === 0 && loose !== 'blocked') loose = why;
            sayRefused();
          }
          errors.report({ severity: 'problem', source: 'save', code: 'store-failed', detail: String(error) });
        });
    };
    // A worker that fails, to load or later, is stopped and says so (the failure card): its listener goes on at
    // once, before the city's sim file is read, or a script that never loads would leave the game loading for good.
    const started = startSimWorker().then((w) => {
      w.onerror = (event) => {
        errors.report({ severity: 'fatal', source: 'worker', code: 'crashed', detail: event.message });
        w.terminate();
        if (worker.current === w) worker.current = null;
        if (!stopped) setStatus('failed');
      };
      return w;
    });
    Promise.all([readSimFile(sim.file), started])
      .then(([simText, w]) => {
        if (stopped) return w.terminate();
        worker.current = w;
        // The undos this worker has answered, done or refused: the newest done is the answer's place among those sent.
        let undoAnswers = 0;
        w.onmessage = (event: MessageEvent<FromWorker>) => {
          const m = event.data;
          if (m.type === 'ready') {
            setDots(m.dots);
            setDepotLand(m.depotLand);
            setSnapshot(m.snapshot);
            setLoad(m.load);
            setBackup(m.checking ? 'checking' : null);
            setStatus('ready');
          } else if (m.type === 'read-save') {
            // No store (storage blocked) reads as no save: the game starts fresh and keeps playing.
            let text: string | null = null;
            inStore(async (s) => {
              text = await s.read(m.key);
              live = { key: m.key, text, holds: text };
            });
            queue = queue.then(() => w.postMessage({ type: 'save-text', text } satisfies ToWorker));
            unwatch ??= onOtherTabWrite(m.key, (text) => {
              if (!live) return;
              live.holds = text;
              sayNewer();
              // Saves lists the browser's autosave again, as for a write of this page's.
              setStored((n) => n + 1);
              if (following) takeNewest();
            });
          } else if (m.type === 'read-keys') {
            // After every store effect before it, as read-save: a slot just written reads back.
            let texts: (string | null)[] = m.keys.map(() => null);
            inStore(async (s) => void (texts = await Promise.all(m.keys.map((k) => s.read(k)))));
            queue = queue.then(() => w.postMessage({ type: 'key-texts', id: m.id, texts } satisfies ToWorker));
          } else if (m.type === 'slots') {
            setSlots(m.slots);
            setSetAside(m.setAside);
            setAutosave(m.autosave);
          }
          else if (m.type === 'export') downloadText(m.name, m.text);
          else if (m.type === 'unbacked') {
            setUnbacked(m.why);
            setBackup((b) => (b === 'checking' ? (m.why ? 'not-kept' : 'kept') : b));
          }
          // A new game from Home needs no notice, and takes down one still showing for the game before:
          // its founding card says what comes next. Whatever the game was, its day card and draft go with it,
          // and the Save here refused while it played.
          else if (m.type === 'loaded') {
            setLoaded(m.from === 'new' ? null : { from: m.from, load: m.load, at: Date.now() });
            setDayCard(null);
            setDraft(null);
            setSlotsRefused((r) => (r.size ? new Map() : r));
          }
          // A write kept takes its key off the refused: the browser keeps saves again once every save of the game's own it
          // refused is kept, not at another save kept, nor at a delete, which a full disk never refuses. A refusal stops the
          // job there, as applyEffects does, and its writes from there on are refused. A slot saved no longer says its Save here
          // was refused, nor does any slot once a delete is kept.
          else if (m.type === 'store') {
            let done = 0;
            const slot = m.slot;
            inStore(
              async (s) => {
                // Never over another tab's save: the game's own saves, and any job on the live key, read it first, and wait while it
                // holds a save other than the one this page last read or wrote there (said, not refused: no room is owed).
                const l = live;
                if (l && (m.owed !== undefined || m.effects.some((e) => e.key === l.key))) {
                  l.holds = await s.read(l.key);
                  sayNewer();
                  if (l.holds !== l.text) return;
                }
                for (const e of m.effects) {
                  await applyEffects(s, [e]);
                  done++;
                  if (l && e.key === l.key) {
                    l.text = l.holds = e.op === 'write' ? e.value : null;
                    sayNewer();
                  }
                  if (e.op === 'write') {
                    refused.delete(e.key);
                    autosaves.delete(e.key);
                    loose = null;
                  }
                }
                setStored((n) => n + 1);
                sayRefused();
                // A delete kept made room, so no slot's line still tells the player to make some.
                if (m.effects.length > 0 && m.effects.every((e) => e.op === 'remove')) setSlotsRefused((r) => (r.size ? new Map() : r));
                else if (slot !== undefined) setSlotsRefused((r) => (r.has(slot) ? new Map([...r].filter(([n]) => n !== slot)) : r));
              },
              m.setAside,
              () => ({ keys: m.owed ? m.effects.slice(done).flatMap((e) => (e.op === 'write' ? [e.key] : [])) : [], autosave: m.owed === 'autosave' }),
              m.effects.some((e) => e.op === 'write') ? slot : undefined,
            );
          }
          // Another tab's save became the game (Home names it): this page read it last, and nothing this game left unsaved, nor its
          // day card, its draft or a Save here refused while it played, is this game's now. One this build can't play leaves the
          // game as it was, still not saving itself.
          else if (m.type === 'took-save') {
            if (m.ok && taking && live) {
              live.text = taking.text;
              refused.clear();
              autosaves.clear();
              sayRefused();
              setDayCard(null);
              setDraft(null);
              setSlotsRefused((r) => (r.size ? new Map() : r));
            }
            taken();
          }
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
            if (m.id === asked.current.draft) {
              setDraft(m.draft);
              setDraftOf(draftClicks.current);
            }
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
          } else if (m.type === 'undone') {
            const done = ++undoAnswers;
            setUndos((u) => ({ ...u, done }));
          } else if (m.type === 'refused') {
            if (m.command === 'undo') undoAnswers++;
            setRefusal({ ...m, command: m.command });
            if (m.command === 'set-route') setRouteRefusals((n) => n + 1);
            if (m.command === 'create-line') setCreateRefusals((n) => n + 1);
            errors.report({ severity: 'note', source: 'sim', code: `refused-${m.command}`, detail: m.reason });
          }
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
      unwatch?.();
      follow.current = () => undefined;
      worker.current?.terminate();
      worker.current = null;
    };
  }, [city]);

  const send = useCallback((message: ToWorker) => {
    // Listing the saves is no command, so a refusal on screen stays (Saves lists them again at each save).
    if (message.type !== 'slots') setRefusal(null);
    // Counted only when it reaches the sim, so each undo sent has its answer.
    if (message.type === 'undo' && worker.current) setUndos((u) => ({ ...u, sent: u.sent + 1 }));
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
    draftClicks.current = clicks;
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
  const followNewest = useCallback((on: boolean) => follow.current(on), []);
  const importSave = useCallback(() => {
    void pickTextFile().then((text) => {
      if (text === null) return;
      setRefusal(null); // as send() does, so an older refusal does not hide what the import brings
      worker.current?.postMessage({ type: 'import', text } satisfies ToWorker);
    });
  }, []);

  return { status, dots, depotLand, snapshot, dayCard, probe, depotSite, stopSite, draft, draftOf, fareBand, refusal, routeRefusals, createRefusals, undos, load, slots, setAside, unbacked, backup, autosave, stored, storeRefused, storeNotice, slotsRefused, autosaveRefused, newer, loaded, send, probeAt, depotSiteAt, stopSiteAt, draftFor, fareBandFor, importSave, closeDayCard, followNewest };
}
