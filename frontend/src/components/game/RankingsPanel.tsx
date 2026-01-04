import { useState } from 'react';
import type { RankingPeriod } from '../../types/game';

interface RankingsPanelProps {
  onClose: () => void;
}

// Mock data for rankings
const MOCK_RANKINGS = [
  { rank: 1, playerName: 'DeepSeaKing', cityName: 'Atlantis Prime', score: 125420, country: 'USA' },
  { rank: 2, playerName: 'OceanMaster', cityName: 'Neptune\'s Haven', score: 118350, country: 'Japan' },
  { rank: 3, playerName: 'AbyssWalker', cityName: 'The Deep', score: 112890, country: 'UK' },
  { rank: 4, playerName: 'TidalForce', cityName: 'Poseidon City', score: 98750, country: 'Germany' },
  { rank: 5, playerName: 'CoralQueen', cityName: 'Reef Central', score: 95200, country: 'Australia' },
  { rank: 6, playerName: 'MarineOne', cityName: 'Subsurface Alpha', score: 89430, country: 'Canada' },
  { rank: 7, playerName: 'WaveRider', cityName: 'Current Flow', score: 85670, country: 'Brazil' },
  { rank: 8, playerName: 'KelpForest', cityName: 'Green Depths', score: 82100, country: 'France' },
  { rank: 9, playerName: 'PressurePro', cityName: 'Mariana Station', score: 78900, country: 'Korea' },
  { rank: 10, playerName: 'BubbleBase', cityName: 'Oxygen Hub', score: 75430, country: 'Portugal' },
];

const periods: { id: RankingPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'All Time' },
];

const categories = [
  { id: 'overall', label: 'Overall', icon: '🏆' },
  { id: 'population', label: 'Population', icon: '👥' },
  { id: 'resources', label: 'Resources', icon: '💎' },
  { id: 'military', label: 'Military', icon: '⚔️' },
  { id: 'exploration', label: 'Exploration', icon: '🔦' },
];

export function RankingsPanel({ onClose }: RankingsPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>('weekly');
  const [selectedCategory, setSelectedCategory] = useState('overall');

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-400';
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-yellow-900/20 border-yellow-600';
    if (rank === 2) return 'bg-gray-700/20 border-gray-500';
    if (rank === 3) return 'bg-orange-900/20 border-orange-600';
    return 'bg-gray-800/30 border-gray-700';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-gray-900 border border-cyan-900 rounded-lg w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">Global Rankings</h2>
              <p className="text-xs text-gray-400">
                Top players across all ocean regions
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

        {/* Filters */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {/* Period selector */}
            <div className="flex gap-1">
              {periods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedPeriod === period.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {/* Category selector */}
            <div className="flex gap-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rankings list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {MOCK_RANKINGS.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-4 p-3 rounded-lg border ${getRankBg(entry.rank)}`}
              >
                {/* Rank */}
                <div className={`w-10 text-center font-bold text-xl ${getRankColor(entry.rank)}`}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                </div>

                {/* Player info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{entry.playerName}</span>
                    <span className="text-xs text-gray-500">({entry.country})</span>
                  </div>
                  <div className="text-xs text-gray-400">{entry.cityName}</div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className="font-bold text-cyan-400">{entry.score.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-400">
              Your rank: <span className="text-cyan-400 font-bold">#2,847</span>
            </div>
            <div className="text-gray-400">
              Your score: <span className="text-cyan-400 font-bold">12,450</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
