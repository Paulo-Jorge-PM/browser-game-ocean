import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import type { Resources, Base, GridPosition } from '../types/game';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private currentCityId: string | null = null;
  private statusCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

  connect(token?: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.notifyStatusChange('connected');

      // Re-join city room on reconnect
      if (this.currentCityId) {
        this.joinCity(this.currentCityId);
        // Request fresh state from server
        this.requestCityState(this.currentCityId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.notifyStatusChange('disconnected');
    });

    this.socket.on('reconnecting', () => {
      console.log('Reconnecting...');
      this.notifyStatusChange('reconnecting');
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      this.reconnectAttempts = attempt;
      this.notifyStatusChange('reconnecting');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    // Game events
    this.socket.on('connected', (data) => {
      console.log('Server acknowledged connection:', data);
    });

    this.socket.on('joined_city', (data) => {
      console.log('Joined city room:', data.city_id);
    });

    // City state hydration (for reconnection recovery)
    this.socket.on('city_state', (data) => {
      console.log('Received city state from server');
      const store = useGameStore.getState();
      store.hydrateFromServer(data);
    });

    this.socket.on('resource_tick', (data: { resources: Resources }) => {
      const store = useGameStore.getState();
      store.setResources(data.resources);
    });

    this.socket.on('city_update', (data: { type: string; data: unknown }) => {
      console.log('City update:', data);
    });

    this.socket.on('base_built', (data: { city_id: string; base: Base; position: { x: number; y: number }; timestamp: string }) => {
      console.log('Base built confirmed by server:', data);
      // Server has persisted the base - we can update local state if needed
    });

    this.socket.on('construction_updated', (data: { city_id: string; base_id: string; position: { x: number; y: number }; is_operational: boolean }) => {
      console.log('Construction updated:', data);
    });

    this.socket.on('build_error', (data: { error: string }) => {
      console.error('Build error from server:', data.error);
    });

    this.socket.on('state_error', (data: { error: string }) => {
      console.error('State error from server:', data.error);
    });

    this.socket.on('chat_message', (data) => {
      console.log('Chat message:', data);
    });

    this.socket.on('agent_comm', (data) => {
      console.log('Agent communication:', data);
    });
  }

  private notifyStatusChange(status: ConnectionStatus) {
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    // Return unsubscribe function
    return () => this.statusCallbacks.delete(callback);
  }

  getStatus(): ConnectionStatus {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'disconnected';
  }

  joinCity(cityId: string) {
    this.currentCityId = cityId;
    this.socket?.emit('join_city', { city_id: cityId });
  }

  leaveCity(cityId: string) {
    if (this.currentCityId === cityId) {
      this.currentCityId = null;
    }
    this.socket?.emit('leave_city', { city_id: cityId });
  }

  requestCityState(cityId: string) {
    this.socket?.emit('request_city_state', { city_id: cityId });
  }

  buildBase(cityId: string, base: Base, position: GridPosition) {
    // Convert client format to server format
    const serverBase = {
      id: base.id,
      type: base.type,
      position: { x: position.x, y: position.y },
      level: base.level,
      construction_progress: base.constructionProgress,
      is_operational: base.isOperational,
      workers: base.workers,
    };

    this.socket?.emit('build_base', {
      city_id: cityId,
      base: serverBase,
      position: { x: position.x, y: position.y },
    });
  }

  updateConstruction(cityId: string, baseId: string, position: GridPosition, isOperational: boolean) {
    this.socket?.emit('update_construction', {
      city_id: cityId,
      base_id: baseId,
      position: { x: position.x, y: position.y },
      is_operational: isOperational,
    });
  }

  sendChatMessage(room: string, message: string) {
    this.socket?.emit('chat_message', { room, message });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.currentCityId = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
