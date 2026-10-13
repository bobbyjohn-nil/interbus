// The page's one error bus (bus.ts), installed at boot by main.tsx.
import { createErrorBus } from './bus';

export const errors = createErrorBus({ now: () => Date.now() });
export { installGlobalErrorHandlers, type ErrorReport } from './bus';
