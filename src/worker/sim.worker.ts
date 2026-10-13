// The sim worker's entry: the host on a 50 ms timer. Started by src/platform (startSimWorker).
import type { ToWorker } from '../sim/types';
import { createHost } from './host';

// The page's clock stamps each save's time for the Saves panel; the sim never reads it.
const host = createHost((message) => postMessage(message), () => Date.now());
onmessage = (event: MessageEvent<ToWorker>) => host.handle(event.data);
setInterval(() => host.tick(performance.now()), 50);
