import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { bootstrapDevCity, resetDevCity } from '../../services/api';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { cityId, cityName, hydrateFromServer } = useGameStore();
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      await resetDevCity();
      const cityState = await bootstrapDevCity();
      hydrateFromServer(cityState);
      localStorage.setItem('ocean_city_id', cityState.city_id);
      onClose();
    } catch (err) {
      console.error('Failed to reset dev city:', err);
      setError('Reset failed. Check backend logs.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-gray-900 border border-cyan-900 rounded-lg w-[640px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛠️</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">Admin Console</h2>
              <p className="text-xs text-gray-400">
                Hardcoded dev profile
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/50">
            <h3 className="text-sm font-semibold text-white mb-2">Profile</h3>
            <div className="text-xs text-gray-400 space-y-1">
              <div>City: <span className="text-cyan-400">{cityName || 'Unknown'}</span></div>
              <div>City ID: <span className="text-cyan-400">{cityId || 'Not set'}</span></div>
            </div>
          </div>

          <div className="border border-red-900/60 rounded-lg p-3 bg-red-950/30">
            <h3 className="text-sm font-semibold text-red-200 mb-2">DB Admin</h3>
            <p className="text-xs text-red-200/80 mb-3">
              Reset deletes the current city data for the dev profile and creates a fresh city.
            </p>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="w-full py-2 rounded bg-red-600/70 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {isResetting ? 'Resetting…' : 'Reset Dev City'}
            </button>
            {error && (
              <div className="mt-2 text-xs text-red-300">{error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
