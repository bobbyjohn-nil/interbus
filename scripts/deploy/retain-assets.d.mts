export const KEEP_BUILDS: number;
export function retain(options: {
  dist: string;
  live: string;
  id: string;
  log?: (message: string) => void;
  tries?: number;
  delayMs?: number;
}): Promise<{ builds: { id: string; files: string[] }[] }>;
