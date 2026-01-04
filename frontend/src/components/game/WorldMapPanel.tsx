import { useState } from 'react';
import { OCEAN_REGIONS, SERVERS } from '../../game/constants/worldMap';
import type { OceanRegion, ServerInfo } from '../../game/constants/worldMap';

interface WorldMapPanelProps {
  onClose: () => void;
}

export function WorldMapPanel({ onClose }: WorldMapPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<OceanRegion | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [view, setView] = useState<'map' | 'servers'>('map');

  const handleRegionClick = (region: OceanRegion) => {
    setSelectedRegion(region);
  };

  const renderMapView = () => (
    <div className="relative w-full h-full bg-[#0a1020] rounded overflow-hidden">
      {/* Simplified world map background */}
      <div className="absolute inset-0 opacity-20">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Continents as simplified shapes */}
          {/* North America */}
          <path
            d="M10,20 L30,15 L35,35 L25,45 L15,40 Z"
            fill="#334455"
            stroke="#446688"
          />
          {/* South America */}
          <path
            d="M25,50 L35,48 L38,70 L30,80 L22,65 Z"
            fill="#334455"
            stroke="#446688"
          />
          {/* Europe */}
          <path
            d="M45,20 L55,18 L58,35 L48,38 L43,30 Z"
            fill="#334455"
            stroke="#446688"
          />
          {/* Africa */}
          <path
            d="M48,40 L58,38 L62,65 L50,70 L45,55 Z"
            fill="#334455"
            stroke="#446688"
          />
          {/* Asia */}
          <path
            d="M60,15 L85,12 L90,45 L70,50 L58,35 Z"
            fill="#334455"
            stroke="#446688"
          />
          {/* Australia */}
          <path
            d="M78,55 L88,52 L92,68 L80,72 Z"
            fill="#334455"
            stroke="#446688"
          />
        </svg>
      </div>

      {/* Ocean regions as interactive points */}
      {OCEAN_REGIONS.map((region) => (
        <button
          key={region.id}
          onClick={() => handleRegionClick(region)}
          className={`absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all ${
            selectedRegion?.id === region.id
              ? 'ring-2 ring-cyan-400 scale-150'
              : 'hover:scale-125'
          }`}
          style={{
            left: `${region.coordinates.x}%`,
            top: `${region.coordinates.y}%`,
            backgroundColor: `#${region.color.toString(16).padStart(6, '0')}`,
          }}
          title={region.name}
        >
          <span className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[8px] text-white whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
            {region.name}
          </span>
        </button>
      ))}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-black/70 p-2 rounded text-xs">
        <div className="text-gray-400 mb-1">Regions by continent:</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-blue-400">● Europe</span>
          <span className="text-green-400">● Americas</span>
          <span className="text-purple-400">● Asia</span>
          <span className="text-orange-400">● Oceania</span>
        </div>
      </div>

      {/* Selected region info */}
      {selectedRegion && (
        <div className="absolute top-2 right-2 bg-black/90 p-3 rounded w-64">
          <h4 className="text-cyan-400 font-bold">{selectedRegion.name}</h4>
          <p className="text-xs text-gray-400 mt-1">{selectedRegion.description}</p>
          <div className="mt-2 text-xs">
            <span className="text-gray-500">Country: </span>
            <span className="text-white">{selectedRegion.country}</span>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Continent: </span>
            <span className="text-white capitalize">{selectedRegion.continent.replace('_', ' ')}</span>
          </div>
          <button className="mt-3 w-full py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-white text-xs font-medium">
            Settle Here
          </button>
        </div>
      )}
    </div>
  );

  const renderServersView = () => (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {SERVERS.map((server) => (
          <button
            key={server.id}
            onClick={() => setSelectedServer(server)}
            className={`p-3 rounded-lg border transition-all text-left ${
              selectedServer?.id === server.id
                ? 'border-cyan-500 bg-cyan-900/30'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">{server.name}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  server.status === 'online'
                    ? 'bg-green-500'
                    : server.status === 'full'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
            <div className="text-xs text-gray-400">
              Players: {server.playerCount.toLocaleString()} / {server.maxPlayers.toLocaleString()}
            </div>
            <div className="w-full h-1 bg-gray-700 rounded mt-1">
              <div
                className="h-full bg-cyan-500 rounded"
                style={{ width: `${(server.playerCount / server.maxPlayers) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {selectedServer && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <h4 className="text-cyan-400 font-bold mb-2">Server: {selectedServer.name}</h4>
          <p className="text-xs text-gray-400">
            This server hosts players from the {selectedServer.continent.replace('_', ' ')} region.
            Connect to play with others in your area for the best experience.
          </p>
          <button className="mt-3 w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white text-sm font-medium">
            Connect to Server
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-gray-900 border border-cyan-900 rounded-lg w-[900px] h-[600px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">World Map</h2>
              <p className="text-xs text-gray-400">
                Explore ocean regions and connect to servers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1 rounded text-sm ${
                  view === 'map'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Map
              </button>
              <button
                onClick={() => setView('servers')}
                className={`px-3 py-1 rounded text-sm ${
                  view === 'servers'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Servers
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'map' ? renderMapView() : renderServersView()}
        </div>
      </div>
    </div>
  );
}
