import { useGameStore } from '../../stores/gameStore';

const resourceIcons: Record<string, string> = {
  population: '👥',
  food: '🍎',
  oxygen: '💨',
  water: '💧',
  energy: '⚡',
  minerals: '⛏️',
  techPoints: '🔬',
};

const resourceColors: Record<string, string> = {
  population: 'text-green-400',
  food: 'text-orange-400',
  oxygen: 'text-cyan-400',
  water: 'text-blue-400',
  energy: 'text-yellow-400',
  minerals: 'text-amber-600',
  techPoints: 'text-purple-400',
};

// Format resource value - show one decimal for values under 100
const formatValue = (value: number): string => {
  if (value < 100) {
    return value.toFixed(1);
  }
  return Math.floor(value).toLocaleString();
};

export function ResourceBar() {
  const { resources, resourceCapacity } = useGameStore();

  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-black/80 backdrop-blur-sm border-b border-cyan-900/50 flex items-center justify-center gap-4 px-4 z-50">
      {Object.entries(resources).map(([key, value]) => {
        const capacity = resourceCapacity[key as keyof typeof resourceCapacity];
        const percentage = (value / capacity) * 100;
        const isLow = percentage < 20;

        return (
          <div
            key={key}
            className={`flex items-center gap-1.5 ${isLow ? 'animate-pulse' : ''}`}
          >
            <span className="text-base">{resourceIcons[key]}</span>
            <div className="flex flex-col">
              <span
                className={`text-xs font-mono ${resourceColors[key]} ${isLow ? 'text-red-400' : ''}`}
              >
                {formatValue(value)}
                <span className="text-gray-500 text-[10px]">/{capacity}</span>
              </span>
              <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isLow ? 'bg-red-500' : 'bg-cyan-500'}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
