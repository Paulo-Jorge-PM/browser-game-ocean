import { useGameStore } from '../../stores/gameStore';
import { BASE_DEFINITIONS, getAvailableBases } from '../../game/constants/bases';
import type { BaseType } from '../../types/game';

const menuItems = [
  { id: 'tech', name: 'Tech Tree', icon: '🔬' },
  { id: 'comms', name: 'Comms', icon: '📡' },
  { id: 'world', name: 'World', icon: '🗺️' },
  { id: 'rankings', name: 'Ranks', icon: '🏆' },
  { id: 'admin', name: 'Admin', icon: '🛠️' },
];

function formatCost(cost: Partial<Record<string, number>>): string {
  const parts: string[] = [];
  if (cost.minerals) parts.push(`${cost.minerals}⛏️`);
  if (cost.energy) parts.push(`${cost.energy}⚡`);
  return parts.join(' ') || 'Free';
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatRate(production: number, consumption: number): string {
  const net = production - consumption;
  if (net === 0) return '-';
  return net > 0 ? `+${net.toFixed(1)}` : `${net.toFixed(1)}`;
}

export function BottomPanel() {
  const {
    ui,
    unlockedTechs,
    resourceProduction,
    resourceConsumption,
    selectCell,
    setActivePanel,
    demolishBase,
    canBuildAt,
    startBuildActionV2,
  } = useGameStore();

  const availableBases = getAvailableBases(unlockedTechs);

  const handleBuildBase = async (type: BaseType) => {
    if (!ui.selectedCell) return;

    // Use the new event-driven build action
    // This calls backend /actions/start, gets timestamps, and sets up local timers
    const success = await startBuildActionV2(ui.selectedCell, type);

    if (!success) {
      console.error('Failed to start build action');
    }
  };

  const handleDemolish = () => {
    if (!ui.selectedCell) return;
    demolishBase(ui.selectedCell);
  };

  const renderBuildMenu = () => {
    // Check which bases can actually be built at selected location
    const buildableInfo = availableBases.map((base) => {
      const result = ui.selectedCell ? canBuildAt(ui.selectedCell, base.type) : { canBuild: false, reason: 'No cell selected' };
      return { base, ...result };
    });

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <h3 className="text-sm font-bold text-cyan-400">Build Structure</h3>
          <button
            onClick={() => {
              selectCell(null);
              setActivePanel('none');
            }}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {buildableInfo.map(({ base, canBuild, reason }) => (
              <button
                key={base.type}
                onClick={() => canBuild && handleBuildBase(base.type)}
                disabled={!canBuild}
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  canBuild
                    ? 'bg-gray-800/50 hover:bg-cyan-900/50 border-gray-700 hover:border-cyan-500 cursor-pointer'
                    : 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed'
                }`}
                title={canBuild ? base.description : reason}
              >
                <span className="text-xl">{base.icon}</span>
                <span className="text-[10px] font-medium text-white text-center leading-tight mt-1">
                  {base.name}
                </span>
                <span className={`text-[9px] mt-0.5 ${canBuild ? 'text-gray-400' : 'text-red-400'}`}>
                  {formatCost(base.cost)}
                </span>
                <span className="text-[9px] text-cyan-400">
                  {formatTime(base.buildTime)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderBaseInfo = () => {
    if (!ui.selectedBase) return null;
    const definition = BASE_DEFINITIONS[ui.selectedBase.type];
    const isConstructing = !ui.selectedBase.isOperational;

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{definition.icon}</span>
            <div>
              <h3 className="text-sm font-bold text-cyan-400">{definition.name}</h3>
              <p className="text-[10px] text-gray-400 max-w-xs truncate">{definition.description}</p>
            </div>
          </div>
          <button
            onClick={() => {
              selectCell(null);
              setActivePanel('none');
            }}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isConstructing ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🔨</div>
              <div className="text-lg font-bold text-yellow-400">
                Building... {Math.floor(ui.selectedBase.constructionProgress)}%
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full mt-2">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-100"
                  style={{ width: `${ui.selectedBase.constructionProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-gray-800/50 p-2 rounded text-center">
                <div className="text-gray-400">Level</div>
                <div className="text-lg font-bold text-white">{ui.selectedBase.level}</div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded text-center">
                <div className="text-gray-400">Workers</div>
                <div className="text-lg font-bold text-white">{ui.selectedBase.workers}</div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded text-center">
                <div className="text-gray-400">Status</div>
                <div className={`text-sm font-bold ${ui.selectedBase.isOperational ? 'text-green-400' : 'text-red-400'}`}>
                  {ui.selectedBase.isOperational ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded text-center">
                <div className="text-gray-400">Depth</div>
                <div className="text-lg font-bold text-cyan-400">{ui.selectedBase.position.y * 10}m</div>
              </div>

              {/* Production info */}
              {Object.entries(definition.production).length > 0 && (
                <div className="col-span-2 bg-green-900/20 p-2 rounded">
                  <div className="text-green-400 text-[10px] mb-1">Produces/min</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(definition.production).map(([res, amt]) => (
                      <span key={res} className="text-green-300 text-[10px]">+{amt} {res}</span>
                    ))}
                  </div>
                </div>
              )}
              {Object.entries(definition.consumption).length > 0 && (
                <div className="col-span-2 bg-red-900/20 p-2 rounded">
                  <div className="text-red-400 text-[10px] mb-1">Consumes/min</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(definition.consumption).map(([res, amt]) => (
                      <span key={res} className="text-red-300 text-[10px]">-{amt} {res}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!isConstructing && ui.selectedBase.type !== 'command_ship' && (
          <div className="px-3 pb-3">
            <button
              onClick={handleDemolish}
              className="w-full py-2 bg-red-600/50 hover:bg-red-600 rounded text-white text-xs font-medium"
            >
              Demolish (50% refund)
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderResourceRates = () => (
    <div className="flex-shrink-0 bg-gray-900/80 border-b border-gray-800 px-4 py-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-500">Production:</span>
        <div className="flex gap-3">
          <span>🍎<span className={resourceProduction.food - resourceConsumption.food >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(resourceProduction.food, resourceConsumption.food)}</span></span>
          <span>💨<span className={resourceProduction.oxygen - resourceConsumption.oxygen >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(resourceProduction.oxygen, resourceConsumption.oxygen)}</span></span>
          <span>💧<span className={resourceProduction.water - resourceConsumption.water >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(resourceProduction.water, resourceConsumption.water)}</span></span>
          <span>⚡<span className={resourceProduction.energy - resourceConsumption.energy >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(resourceProduction.energy, resourceConsumption.energy)}</span></span>
          <span>⛏️<span className={resourceProduction.minerals - resourceConsumption.minerals >= 0 ? 'text-green-400' : 'text-red-400'}>{formatRate(resourceProduction.minerals, resourceConsumption.minerals)}</span></span>
          <span>🔬<span className="text-cyan-400">+{resourceProduction.techPoints}</span></span>
        </div>
      </div>
    </div>
  );

  const renderDefaultMenu = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center gap-4 p-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id as typeof ui.activePanel)}
            className="flex flex-col items-center gap-1 p-3 bg-gray-800/50 hover:bg-cyan-900/50 rounded-lg border border-gray-700 hover:border-cyan-500 transition-all min-w-[70px]"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium text-white">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    if (ui.selectedBase) return renderBaseInfo();
    if (ui.activePanel === 'build' && ui.selectedCell) return renderBuildMenu();
    return renderDefaultMenu();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-48 md:h-52 bg-black/95 backdrop-blur-sm border-t border-cyan-900/50 z-50 flex flex-col">
      {renderResourceRates()}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
