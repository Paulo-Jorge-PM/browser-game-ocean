import { useEffect, useState } from 'react';
import { GameCanvas } from './game/core/GameCanvas';
import { ResourceBar } from './components/hud/ResourceBar';
import { BottomPanel } from './components/game/BottomPanel';
import { ConnectionStatus } from './components/hud/ConnectionStatus';
import { TechTreePanel } from './components/game/TechTreePanel';
import { WorldMapPanel } from './components/game/WorldMapPanel';
import { RankingsPanel } from './components/game/RankingsPanel';
import { useGameStore, startResourceTick, stopResourceTick } from './stores/gameStore';
import { socketService } from './services/socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const { placeBase, calculateResourceRates, unlockTech, ui, setActivePanel, hydrateFromServer } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeGame = async () => {
      // Check for existing city ID in localStorage
      const savedCityId = localStorage.getItem('ocean_city_id');

      if (savedCityId) {
        // Try to load existing city from backend
        try {
          const response = await fetch(`${API_URL}/api/v1/cities/${savedCityId}`);
          if (response.ok) {
            const cityData = await response.json();
            // Hydrate state from server
            hydrateFromServer({
              city_id: cityData.id,
              name: cityData.name,
              grid: cityData.grid,
              resources: cityData.resources,
              resource_capacity: cityData.resource_capacity,
            });
            console.log('Loaded existing city:', cityData.name);

            // Connect socket and join city room
            socketService.connect();
            socketService.joinCity(savedCityId);

            setIsLoading(false);
            startResourceTick();
            return;
          } else {
            console.log('City not found on server, creating new...');
            localStorage.removeItem('ocean_city_id');
          }
        } catch (error) {
          console.error('Failed to load city from server:', error);
          // Fall through to local initialization
        }
      }

      // No saved city or failed to load - initialize locally
      initializeLocalGame();
      setIsLoading(false);

      // Connect to socket
      socketService.connect();
    };

    const initializeLocalGame = () => {
      // Initialize with command ship on first load
      const commandShip = {
        id: 'command-ship-1',
        type: 'command_ship' as const,
        position: { x: 5, y: 0 },
        level: 1,
        constructionProgress: 100,
        isOperational: true,
        workers: 5,
      };
      placeBase({ x: 5, y: 0 }, commandShip);

      // Unlock starter techs
      unlockTech('basic_construction');
      unlockTech('life_support');
      unlockTech('power_generation');
      unlockTech('storage_systems');

      // Calculate initial resource rates
      calculateResourceRates();

      // Start resource tick
      startResourceTick();
    };

    initializeGame();

    return () => {
      stopResourceTick();
      socketService.disconnect();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0a1628]">
        <div className="text-center text-white">
          <div className="text-2xl mb-4">Loading Ocean Depths...</div>
          <div className="animate-pulse text-blue-400">Initializing colony systems</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0a1628]">
      <ResourceBar />
      <ConnectionStatus />
      <div className="pt-12 pb-52 h-full">
        <GameCanvas />
      </div>
      <BottomPanel />

      {/* Modal Panels */}
      {ui.activePanel === 'tech' && (
        <TechTreePanel onClose={() => setActivePanel('none')} />
      )}
      {ui.activePanel === 'world' && (
        <WorldMapPanel onClose={() => setActivePanel('none')} />
      )}
      {ui.activePanel === 'rankings' && (
        <RankingsPanel onClose={() => setActivePanel('none')} />
      )}
    </div>
  );
}

export default App;
