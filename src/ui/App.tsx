import { MapView } from '../render/map/MapView';
import { Corner } from './Corner';
import { ReplacedCard } from './ReplacedCard';

export function App() {
  return (
    <main className="app">
      <MapView />
      <Corner />
      <ReplacedCard />
    </main>
  );
}
