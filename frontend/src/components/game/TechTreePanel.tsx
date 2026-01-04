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
  const {
    resources,
    unlockedTechs,
    currentResearch,
    setResearch,
    unlockTech,
    setResources,
  } = useGameStore();

  const handleStartResearch = (techId: string) => {
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

    // Deduct cost and start research
    setResources({ techPoints: resources.techPoints - tech.cost });
    setResearch(techId);

    // For demo purposes, complete research after timeout
    // In real implementation, this would be handled by server
    setTimeout(() => {
      unlockTech(techId);
      setResearch(null);
    }, tech.researchTime * 10); // Sped up for demo (10x faster)
  };

  const renderTechNode = (tech: TechNode) => {
    const isUnlocked = unlockedTechs.includes(tech.id);
    const isResearching = currentResearch === tech.id;
    const canResearch = canResearchTech(tech.id, unlockedTechs);
    const canAfford = resources.techPoints >= tech.cost;

    let statusClass = 'border-gray-700 bg-gray-800/50';
    let statusText = '';

    if (isUnlocked) {
      statusClass = 'border-green-500 bg-green-900/30';
      statusText = 'Researched';
    } else if (isResearching) {
      statusClass = 'border-cyan-500 bg-cyan-900/30 animate-pulse';
      statusText = 'Researching...';
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
            Cost: <span className={canAfford ? 'text-cyan-400' : 'text-red-400'}>{tech.cost} TP</span>
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

        {tech.prerequisites.length > 0 && !isUnlocked && (
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

        {tech.unlocks.length > 0 && (
          <div className="mt-1 text-xs text-gray-500">
            Unlocks: <span className="text-cyan-400">{tech.unlocks.join(', ')}</span>
          </div>
        )}

        {!isUnlocked && !isResearching && canResearch && (
          <button
            onClick={() => handleStartResearch(tech.id)}
            disabled={!canAfford}
            className={`mt-2 w-full py-1 rounded text-xs font-medium ${
              canAfford
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Research
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
