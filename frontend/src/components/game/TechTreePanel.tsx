import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import {
  TECH_TREE,
  getTechsByTier,
  canResearchTech,
} from '../../game/constants/techTree';
import type { TechNode } from '../../game/constants/techTree';

interface TechTreePanelProps {
  onClose: () => void;
}

export function TechTreePanel({ onClose }: TechTreePanelProps) {
  // Force re-render every 100ms while researching to update progress bar
  const [, setTick] = useState(0);
  const {
    resources,
    unlockedTechs,
    currentResearch,
    researchProgress,
    serverPendingActions,
    startResearchActionV2,
  } = useGameStore();

  // Force re-render every 100ms while researching to update progress bar
  useEffect(() => {
    if (!currentResearch) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [currentResearch]);

  // Calculate research progress from pending action
  const getResearchProgress = (): { progress: number; timeRemaining: number } => {
    if (!currentResearch) return { progress: 0, timeRemaining: 0 };

    // Find the research action in pending actions
    for (const action of serverPendingActions.values()) {
      if (action.actionType === 'research' && action.data.techId === currentResearch) {
        const now = Date.now();
        const elapsed = now - action.startedAt;
        const total = action.endsAt - action.startedAt;
        const progress = Math.min(100, (elapsed / total) * 100);
        const timeRemaining = Math.max(0, Math.ceil((action.endsAt - now) / 1000));
        return { progress, timeRemaining };
      }
    }

    return { progress: researchProgress, timeRemaining: 0 };
  };

  const handleStartResearch = async (techId: string) => {
    const tech = TECH_TREE[techId];
    if (!tech) return;

    if (resources.techPoints < tech.cost) {
      console.warn('Not enough tech points');
      return;
    }

    if (!canResearchTech(techId, unlockedTechs)) {
      console.warn('Prerequisites not met');
      return;
    }

    if (currentResearch) {
      console.warn('Already researching');
      return;
    }

    // Start research via backend action system
    const success = await startResearchActionV2(techId);
    if (!success) {
      console.error('Failed to start research');
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const renderTechNode = (tech: TechNode) => {
    const isUnlocked = unlockedTechs.includes(tech.id);
    const isResearching = currentResearch === tech.id;
    const canResearch = canResearchTech(tech.id, unlockedTechs);
    const canAfford = resources.techPoints >= tech.cost;
    const { progress, timeRemaining } = isResearching ? getResearchProgress() : { progress: 0, timeRemaining: 0 };

    let statusClass = 'border-gray-700 bg-gray-800/50';
    let statusText = '';

    if (isUnlocked) {
      statusClass = 'border-green-500 bg-green-900/30';
      statusText = 'Researched';
    } else if (isResearching) {
      statusClass = 'border-cyan-500 bg-cyan-900/30';
      statusText = `${Math.floor(progress)}%`;
    } else if (!canResearch) {
      statusClass = 'border-gray-800 bg-gray-900/50 opacity-50';
      statusText = 'Locked';
    } else if (!canAfford) {
      statusClass = 'border-red-800 bg-gray-800/50';
      statusText = 'Need more TP';
    }

    return (
      <div
        key={tech.id}
        className={`p-3 rounded-lg border ${statusClass} transition-all`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{tech.icon}</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">{tech.name}</h4>
            <p className="text-xs text-gray-400">{tech.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            Cost: <span className={canAfford || isUnlocked ? 'text-cyan-400' : 'text-red-400'}>{tech.cost} TP</span>
          </span>
          {statusText && (
            <span
              className={`${
                isUnlocked
                  ? 'text-green-400'
                  : isResearching
                  ? 'text-cyan-400'
                  : 'text-gray-500'
              }`}
            >
              {statusText}
            </span>
          )}
        </div>

        {/* Research Progress Bar */}
        {isResearching && (
          <div className="mt-2">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-cyan-400">
              <span>Researching...</span>
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>
        )}

        {tech.prerequisites.length > 0 && !isUnlocked && !isResearching && (
          <div className="mt-2 text-xs text-gray-500">
            Requires:{' '}
            {tech.prerequisites.map((prereq) => (
              <span
                key={prereq}
                className={`${
                  unlockedTechs.includes(prereq) ? 'text-green-400' : 'text-red-400'
                } mr-1`}
              >
                {TECH_TREE[prereq]?.name}
              </span>
            ))}
          </div>
        )}

        {tech.unlocks.length > 0 && !isResearching && (
          <div className="mt-1 text-xs text-gray-500">
            Unlocks: <span className="text-cyan-400">{tech.unlocks.join(', ')}</span>
          </div>
        )}

        {!isUnlocked && !isResearching && canResearch && !currentResearch && (
          <button
            onClick={() => handleStartResearch(tech.id)}
            disabled={!canAfford}
            className={`mt-2 w-full py-1 rounded text-xs font-medium ${
              canAfford
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Research ({formatTime(tech.researchTime)})
          </button>
        )}
      </div>
    );
  };

  const renderTier = (tier: number, title: string) => {
    const techs = getTechsByTier(tier);
    return (
      <div key={tier} className="mb-4">
        <h3 className="text-sm font-bold text-cyan-400 mb-2 border-b border-cyan-900 pb-1">
          {title}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {techs.map(renderTechNode)}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-gray-900 border border-cyan-900 rounded-lg w-[800px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">Technology Research</h2>
              <p className="text-xs text-gray-400">
                Tech Points: <span className="text-cyan-400">{Math.floor(resources.techPoints)}</span>
                {currentResearch && (
                  <span className="ml-2 text-yellow-400">
                    Researching: {TECH_TREE[currentResearch]?.name}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {renderTier(1, 'Tier 1 - Foundations')}
          {renderTier(2, 'Tier 2 - Advanced')}
          {renderTier(3, 'Tier 3 - Expert')}
          {renderTier(4, 'Tier 4 - Master')}
        </div>
      </div>
    </div>
  );
}
