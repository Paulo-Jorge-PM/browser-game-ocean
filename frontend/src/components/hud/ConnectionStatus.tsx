import { useState, useEffect } from 'react';
import { socketService, type ConnectionStatus as Status } from '../../services/socket';

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>(socketService.getStatus());

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = socketService.onStatusChange(setStatus);

    // Also check initial status
    setStatus(socketService.getStatus());

    return () => unsubscribe();
  }, []);

  // Don't show anything when connected (less visual noise)
  if (status === 'connected') {
    return (
      <div className="fixed top-14 right-4 flex items-center gap-2 text-xs z-50">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400/60">Online</span>
      </div>
    );
  }

  return (
    <div className="fixed top-14 right-4 flex items-center gap-2 text-xs z-50">
      <div
        className={`w-2 h-2 rounded-full ${
          status === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span className={status === 'reconnecting' ? 'text-yellow-400' : 'text-red-400'}>
        {status === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
      </span>
    </div>
  );
}
