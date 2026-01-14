import { useEffect, useState, useRef } from 'react';
import { GameCanvas } from './game/core/GameCanvas';
import { ResourceBar } from './components/hud/ResourceBar';
import { BottomPanel } from './components/game/BottomPanel';
import { ConnectionStatus } from './components/hud/ConnectionStatus';
import { TechTreePanel } from './components/game/TechTreePanel';
import { WorldMapPanel } from './components/game/WorldMapPanel';
import { RankingsPanel } from './components/game/RankingsPanel';
import { AdminPanel } from './components/game/AdminPanel';
import {
  useGameStore,
  startResourceTick,
  startResourceSyncInterval,
  stopAllIntervals,
} from './stores/gameStore';
import { socketService } from './services/socket';
import { bootstrapDevCityV2 } from './services/api';

function App() {
  const { ui, setActivePanel, hydrateFromBootstrapV2 } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Use the new bootstrap v2 endpoint which:
        // - Auto-completes expired pending actions
        // - Returns sync config
        // - Returns pending actions for timer restoration
        const response = await bootstrapDevCityV2();

        // Hydrate from v2 response (includes city state, pending actions, sync config)
        hydrateFromBootstrapV2(response);
        localStorage.setItem('ocean_city_id', response.city.city_id);

        // Connect socket for real-time updates (but most sync happens via REST now)
        socketService.connect();
        socketService.joinCity(response.city.city_id);

        setIsLoading(false);

        // Start local resource tick (100ms for smooth UI)
        startResourceTick();

        // Start resource sync interval with server (configurable, default 30s)
        startResourceSyncInterval(response.sync_config.resource_sync_interval_seconds);

      } catch (error) {
        console.error('Failed to bootstrap dev city:', error);
        setIsLoading(false);
      }
    };

    initializeGame();

    return () => {
      stopAllIntervals();
      socketService.disconnect();
    };
  }, []);

  // Handle reconnection recovery
  useEffect(() => {
    const unsubscribe = socketService.onStatusChange(async (status) => {
      if (status === 'disconnected') {
        wasDisconnectedRef.current = true;
      } else if (status === 'connected' && wasDisconnectedRef.current) {
        // Reconnected after being disconnected - re-bootstrap to get fresh state
        console.log('Reconnected - re-bootstrapping game state...');
        wasDisconnectedRef.current = false;
        try {
          const response = await bootstrapDevCityV2();
          hydrateFromBootstrapV2(response);
          console.log('Game state recovered after reconnection');
        } catch (error) {
          console.error('Failed to recover game state after reconnection:', error);
        }
      }
    });

    return unsubscribe;
  }, [hydrateFromBootstrapV2]);

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
      {ui.activePanel === 'admin' && (
        <AdminPanel onClose={() => setActivePanel('none')} />
      )}
    </div>
  );
}

export default App;
