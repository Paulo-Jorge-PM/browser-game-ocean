import { create } from 'zustand';
import type { Resources, GridCell, GridPosition, Base, UIState, BaseType, CellZone } from '../types/game';
import {
  startAction,
  completeAction,
  syncResources,
  type ServerCityState,
  type BootstrapV2Response,
  type SyncConfig,
  type PendingAction,
} from '../services/api';
import { BASE_DEFINITIONS, canAffordBase, deductBaseCost, getOppositeSide } from '../game/constants/bases';
import type { ConnectionSide } from '../game/constants/bases';

// Helper to determine zone based on depth
const getZoneForDepth = (depth: number): CellZone => {
  if (depth < 0) return 'sky';
  if (depth === 0) return 'surface';
  if (depth < 5) return 'shallow';
  return 'deep';
};

// Visibility constants
const VISIBILITY_BUFFER = 5; // Cells visible past furthest structure
const INITIAL_VISIBLE_ROWS = 8; // Rows visible at game start

interface ConstructionEntry {
  baseType: BaseType;
  startTime: number;
  endTime: number;
  actionId?: string | null;
  isCompleting?: boolean;
}

// Pending action from server (event-driven architecture)
interface ServerPendingAction {
  actionId: string;
  actionType: string;
  startedAt: number; // Timestamp
  endsAt: number; // Timestamp
  durationSeconds: number;
  data: {
    baseType?: string;
    position?: { x: number; y: number };
    baseId?: string;
    techId?: string;
  };
}

interface GameState {
  // City info
  cityId: string | null;
  cityName: string;

  // Resources
  resources: Resources;
  resourceCapacity: Resources;
  resourceProduction: Resources;
  resourceConsumption: Resources;

  // Grid
  grid: GridCell[][];
  gridWidth: number;
  gridHeight: number;

  // Tech
  unlockedTechs: string[];
  currentResearch: string | null;
  researchProgress: number;

  // Construction queue
  constructionQueue: Map<string, ConstructionEntry>;

  // Event-driven sync state (new)
  syncConfig: SyncConfig | null;
  serverPendingActions: Map<string, ServerPendingAction>;
  lastResourceSyncTime: number;

  // Viewport/Scroll state
  scrollOffset: number; // Current scroll position in pixels
  maxVisibleDepth: number; // Deepest row that can be scrolled to
  visibleRowStart: number; // First visible row index
  visibleRowCount: number; // Number of rows visible on screen

  // UI State
  ui: UIState;

  // Tick tracking
  lastTickTime: number;

  // Actions
  setCityInfo: (cityId: string, cityName: string) => void;
  setResources: (resources: Partial<Resources>) => void;
  selectCell: (position: GridPosition | null) => void;
  setActivePanel: (panel: UIState['activePanel']) => void;
  startConstruction: (position: GridPosition, baseType: BaseType) => boolean;
  completeConstruction: (position: GridPosition) => void;
  demolishBase: (position: GridPosition) => void;
  placeBase: (position: GridPosition, base: Base) => void;
  initializeGrid: (width: number, height: number) => void;
  calculateResourceRates: () => void;
  applyResourceTick: (deltaSeconds: number) => void;
  updateConstructionProgress: () => void;
  unlockTech: (techId: string) => void;
  setResearch: (techId: string | null) => void;
  canBuildAt: (position: GridPosition, baseType: BaseType) => { canBuild: boolean; reason?: string };
  getBuildableCells: () => GridPosition[];

  // Viewport actions
  setScrollOffset: (offset: number) => void;
  updateMaxVisibleDepth: () => void;
  setVisibleRowCount: (count: number) => void;

  // Server state hydration
  hydrateFromServer: (serverState: ServerCityState) => void;

  // Event-driven sync actions (new)
  setSyncConfig: (config: SyncConfig) => void;
  startBuildActionV2: (position: GridPosition, baseType: BaseType) => Promise<boolean>;
  startResearchActionV2: (techId: string) => Promise<boolean>;
  completeActionV2: (actionId: string) => Promise<void>;
  syncResourcesWithServer: () => Promise<void>;
  hydrateFromBootstrapV2: (response: BootstrapV2Response) => void;
  setupPendingActionTimers: (pendingActions: PendingAction[]) => void;
}

const initialResources: Resources = {
  population: 10,
  food: 100,
  oxygen: 100,
  water: 100,
  energy: 50,
  minerals: 100,
  techPoints: 0,
};

const initialCapacity: Resources = {
  population: 50,
  food: 500,
  oxygen: 500,
  water: 500,
  energy: 200,
  minerals: 200,
  techPoints: 1000,
};

const zeroResources = (): Resources => ({
  population: 0,
  food: 0,
  oxygen: 0,
  water: 0,
  energy: 0,
  minerals: 0,
  techPoints: 0,
});

const createEmptyGrid = (width: number, height: number): GridCell[][] => {
  const grid: GridCell[][] = [];

  // First row (index 0) is the sky/surface row where command ship goes
  // We treat y=0 as the surface level
  for (let y = 0; y < height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < width; x++) {
      const depth = y; // y=0 is surface
      row.push({
        position: { x, y },
        base: null,
        isUnlocked: false,
        depth,
        zone: getZoneForDepth(depth),
      });
    }
    grid.push(row);
  }
  return grid;
};

// Helper to get direction from one cell to another
const getDirection = (from: GridPosition, to: GridPosition): ConnectionSide | null => {
  if (to.y === from.y - 1) return 'top';
  if (to.y === from.y + 1) return 'bottom';
  if (to.x === from.x - 1) return 'left';
  if (to.x === from.x + 1) return 'right';
  return null;
};

// Helper to get adjacent positions
const getAdjacentPositions = (pos: GridPosition): GridPosition[] => {
  return [
    { x: pos.x, y: pos.y - 1 }, // top
    { x: pos.x, y: pos.y + 1 }, // bottom
    { x: pos.x - 1, y: pos.y }, // left
    { x: pos.x + 1, y: pos.y }, // right
  ];
};

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  cityId: null,
  cityName: 'New Colony',
  resources: initialResources,
  resourceCapacity: initialCapacity,
  resourceProduction: zeroResources(),
  resourceConsumption: zeroResources(),
  grid: createEmptyGrid(10, 15),
  gridWidth: 10,
  gridHeight: 15,
  unlockedTechs: [],
  currentResearch: null,
  researchProgress: 0,
  constructionQueue: new Map(),
  lastTickTime: Date.now(),

  // Event-driven sync state (new)
  syncConfig: null,
  serverPendingActions: new Map(),
  lastResourceSyncTime: Date.now(),

  // Viewport state
  scrollOffset: 0,
  maxVisibleDepth: INITIAL_VISIBLE_ROWS,
  visibleRowStart: 0,
  visibleRowCount: 10,

  ui: {
    selectedCell: null,
    selectedBase: null,
    activePanel: 'none',
    isAgentCommActive: false,
  },

  // Actions
  setCityInfo: (cityId, cityName) =>
    set({ cityId, cityName }),

  setResources: (newResources) =>
    set((state) => ({
      resources: { ...state.resources, ...newResources },
    })),

  selectCell: (position) =>
    set((state) => {
      if (!position) {
        return {
          ui: { ...state.ui, selectedCell: null, selectedBase: null, activePanel: 'none' },
        };
      }
      const cell = state.grid[position.y]?.[position.x];
      const isUnlocked = cell?.isUnlocked || false;
      const hasBase = cell?.base != null;

      return {
        ui: {
          ...state.ui,
          selectedCell: position,
          selectedBase: cell?.base || null,
          activePanel: hasBase ? 'none' : (isUnlocked ? 'build' : 'none'),
        },
      };
    }),

  setActivePanel: (panel) =>
    set((state) => ({
      ui: { ...state.ui, activePanel: panel },
    })),

  canBuildAt: (position, baseType) => {
    const state = get();
    const cell = state.grid[position.y]?.[position.x];

    if (!cell) return { canBuild: false, reason: 'Invalid position' };
    if (!cell.isUnlocked) return { canBuild: false, reason: 'Cell is locked' };
    if (cell.base) return { canBuild: false, reason: 'Cell already has a base' };

    // Check if there's an adjacent base that can connect
    const adjacentPositions = getAdjacentPositions(position);
    let hasValidConnection = false;

    for (const adjPos of adjacentPositions) {
      const adjCell = state.grid[adjPos.y]?.[adjPos.x];
      if (adjCell?.base && adjCell.base.isOperational) {
        const direction = getDirection(adjPos, position);
        if (direction) {
          const adjBaseDef = BASE_DEFINITIONS[adjCell.base.type];
          const newBaseDef = BASE_DEFINITIONS[baseType];

          // Check if adjacent base can connect in this direction
          if (adjBaseDef.connectionSides.includes(direction)) {
            // Check if new base can receive connection from opposite direction
            const opposite = getOppositeSide(direction);
            if (newBaseDef.connectionSides.includes(opposite)) {
              hasValidConnection = true;
              break;
            }
          }
        }
      }
    }

    if (!hasValidConnection) {
      return { canBuild: false, reason: 'Must connect to an existing base' };
    }

    // Check tech requirements
    const definition = BASE_DEFINITIONS[baseType];
    if (definition.unlockTech && !state.unlockedTechs.includes(definition.unlockTech)) {
      return { canBuild: false, reason: 'Technology not researched' };
    }

    // Check resources
    if (!canAffordBase(baseType, state.resources)) {
      return { canBuild: false, reason: 'Insufficient resources' };
    }

    return { canBuild: true };
  },

  getBuildableCells: () => {
    const state = get();
    const buildable: GridPosition[] = [];

    for (let y = 0; y < state.gridHeight; y++) {
      for (let x = 0; x < state.gridWidth; x++) {
        const cell = state.grid[y][x];
        if (cell.isUnlocked && !cell.base) {
          buildable.push({ x, y });
        }
      }
    }

    return buildable;
  },

  startConstruction: (position, baseType) => {
    const state = get();
    const result = state.canBuildAt(position, baseType);

    if (!result.canBuild) {
      console.warn('Cannot build:', result.reason);
      return false;
    }

    const definition = BASE_DEFINITIONS[baseType];
    const newResources = deductBaseCost(baseType, state.resources);
    const now = Date.now();
    const buildTimeMs = definition.buildTime * 1000;

    // Create base in construction state
    const newBase: Base = {
      id: `base-${now}-${Math.random().toString(36).substr(2, 9)}`,
      type: baseType,
      position,
      level: 1,
      constructionProgress: 0,
      isOperational: false,
      workers: 0,
    };

    // Update grid
    const newGrid = state.grid.map((row) => row.map((cell) => ({ ...cell })));
    newGrid[position.y][position.x] = {
      ...newGrid[position.y][position.x],
      base: newBase,
    };

    // Add to construction queue
    const newQueue = new Map(state.constructionQueue);
    newQueue.set(newBase.id, {
      baseType,
      startTime: now,
      endTime: now + buildTimeMs,
    });

    set({
      resources: newResources,
      grid: newGrid,
      constructionQueue: newQueue,
      ui: { ...state.ui, selectedCell: null, selectedBase: null, activePanel: 'none' },
    });

    return true;
  },

  completeConstruction: (position) => {
    const state = get();
    const cell = state.grid[position.y]?.[position.x];

    if (!cell?.base) return;

    const definition = BASE_DEFINITIONS[cell.base.type];
    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));

    // Mark as operational
    newGrid[position.y][position.x].base = {
      ...cell.base,
      constructionProgress: 100,
      isOperational: true,
      workers: definition.workersRequired,
    };

    // Unlock adjacent cells based on connection sides
    const adjacentPositions = [
      { pos: { x: position.x, y: position.y - 1 }, side: 'top' as ConnectionSide },
      { pos: { x: position.x, y: position.y + 1 }, side: 'bottom' as ConnectionSide },
      { pos: { x: position.x - 1, y: position.y }, side: 'left' as ConnectionSide },
      { pos: { x: position.x + 1, y: position.y }, side: 'right' as ConnectionSide },
    ];

    adjacentPositions.forEach(({ pos, side }) => {
      if (
        pos.y >= 0 &&
        pos.y < state.gridHeight &&
        pos.x >= 0 &&
        pos.x < state.gridWidth &&
        definition.connectionSides.includes(side)
      ) {
        newGrid[pos.y][pos.x].isUnlocked = true;
      }
    });

    // Remove from construction queue
    const newQueue = new Map(state.constructionQueue);
    newQueue.delete(cell.base.id);

    set({
      grid: newGrid,
      constructionQueue: newQueue,
    });

    // Recalculate resource rates
    get().calculateResourceRates();
  },

  demolishBase: (position) => {
    const state = get();
    const cell = state.grid[position.y]?.[position.x];

    if (!cell?.base || cell.base.type === 'command_ship') {
      return;
    }

    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));
    newGrid[position.y][position.x] = {
      ...newGrid[position.y][position.x],
      base: null,
    };

    // Return some resources
    const definition = BASE_DEFINITIONS[cell.base.type];
    const refund: Partial<Resources> = {};
    for (const [resource, cost] of Object.entries(definition.cost)) {
      refund[resource as keyof Resources] = Math.floor((cost || 0) * 0.5);
    }

    const newResources = { ...state.resources };
    for (const [resource, amount] of Object.entries(refund)) {
      const key = resource as keyof Resources;
      newResources[key] = Math.min(
        newResources[key] + (amount || 0),
        state.resourceCapacity[key]
      );
    }

    set({
      grid: newGrid,
      resources: newResources,
      ui: { ...state.ui, selectedCell: null, selectedBase: null, activePanel: 'none' },
    });

    get().calculateResourceRates();
  },

  placeBase: (position, base) => {
    const state = get();
    const newGrid = state.grid.map((row) => row.map((c) => ({ ...c })));

    if (newGrid[position.y]?.[position.x]) {
      newGrid[position.y][position.x] = {
        ...newGrid[position.y][position.x],
        base,
        isUnlocked: true, // The cell with a base is always unlocked
      };

      // Unlock adjacent cells based on connection sides
      const definition = BASE_DEFINITIONS[base.type];
      const adjacentPositions = [
        { pos: { x: position.x, y: position.y - 1 }, side: 'top' as ConnectionSide },
        { pos: { x: position.x, y: position.y + 1 }, side: 'bottom' as ConnectionSide },
        { pos: { x: position.x - 1, y: position.y }, side: 'left' as ConnectionSide },
        { pos: { x: position.x + 1, y: position.y }, side: 'right' as ConnectionSide },
      ];

      adjacentPositions.forEach(({ pos, side }) => {
        if (
          pos.y >= 0 &&
          pos.y < state.gridHeight &&
          pos.x >= 0 &&
          pos.x < state.gridWidth &&
          definition.connectionSides.includes(side)
        ) {
          newGrid[pos.y][pos.x].isUnlocked = true;
        }
      });
    }

    set({ grid: newGrid });
  },

  initializeGrid: (width, height) =>
    set(() => ({
      grid: createEmptyGrid(width, height),
      gridWidth: width,
      gridHeight: height,
    })),

  calculateResourceRates: () => {
    const state = get();
    const production = zeroResources();
    const consumption = zeroResources();
    let additionalCapacity = { ...initialCapacity };

    // Calculate based on all operational bases
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell.base && cell.base.isOperational) {
          const definition = BASE_DEFINITIONS[cell.base.type];

          // Add production
          for (const [resource, amount] of Object.entries(definition.production)) {
            if (resource === 'population') {
              additionalCapacity.population += (amount || 0);
            } else {
              production[resource as keyof Resources] += (amount || 0);
            }
          }

          // Add consumption
          for (const [resource, amount] of Object.entries(definition.consumption)) {
            consumption[resource as keyof Resources] += (amount || 0);
          }

          // Storage hubs increase capacity
          if (cell.base.type === 'storage_hub') {
            additionalCapacity.food += 200;
            additionalCapacity.minerals += 100;
            additionalCapacity.water += 100;
            additionalCapacity.oxygen += 100;
          }
        }
      }
    }

    // Population consumption based on current population
    const popConsumption = state.resources.population;
    consumption.food += popConsumption * 0.5;
    consumption.oxygen += popConsumption * 0.3;
    consumption.water += popConsumption * 0.2;

    set({
      resourceProduction: production,
      resourceConsumption: consumption,
      resourceCapacity: additionalCapacity,
    });
  },

  applyResourceTick: (deltaSeconds) => {
    const state = get();
    const tickMultiplier = deltaSeconds / 60;

    const newResources = { ...state.resources };

    for (const resource of Object.keys(newResources) as (keyof Resources)[]) {
      if (resource === 'population') continue;

      const net =
        (state.resourceProduction[resource] - state.resourceConsumption[resource]) *
        tickMultiplier;

      newResources[resource] = Math.max(
        0,
        Math.min(
          newResources[resource] + net,
          state.resourceCapacity[resource]
        )
      );
    }

    // Population growth/decline
    const hasFood = newResources.food > state.resources.population;
    const hasOxygen = newResources.oxygen > state.resources.population * 0.5;
    const hasWater = newResources.water > state.resources.population * 0.3;

    if (hasFood && hasOxygen && hasWater) {
      const growthRate = 0.01 * tickMultiplier;
      newResources.population = Math.min(
        newResources.population + growthRate,
        state.resourceCapacity.population
      );
    } else if (!hasFood || !hasOxygen || !hasWater) {
      const declineRate = 0.05 * tickMultiplier;
      newResources.population = Math.max(1, newResources.population - declineRate);
    }

    set({
      resources: newResources,
      lastTickTime: Date.now(),
    });
  },

  updateConstructionProgress: () => {
    const state = get();
    const now = Date.now();
    const newQueue = new Map(state.constructionQueue);
    const completions: { baseId: string; actionId?: string; position: GridPosition }[] = [];

    // Update progress and identify completions without mutating operational state.
    const newGrid = state.grid.map((row) =>
      row.map((cell) => {
        if (cell.base && !cell.base.isOperational) {
          const construction = state.constructionQueue.get(cell.base.id);
          if (construction) {
            const elapsed = now - construction.startTime;
            const total = construction.endTime - construction.startTime;
            const progress = Math.min(100, (elapsed / total) * 100);

            if (progress >= 100 && !construction.isCompleting) {
              construction.isCompleting = true;
              newQueue.set(cell.base.id, { ...construction });
              completions.push({
                baseId: cell.base.id,
                actionId: cell.base.actionId ?? undefined,
                position: cell.position,
              });
            }

            return {
              ...cell,
              base: {
                ...cell.base,
                constructionProgress: Math.min(100, progress),
              },
            };
          }
        }
        return cell;
      })
    );

    // Single atomic state update
    set({ grid: newGrid, constructionQueue: newQueue });

    if (completions.length === 0) {
      return;
    }

    // Use the new event-driven action completion flow
    completions.forEach((completion) => {
      if (completion.actionId) {
        // New flow: complete via action system
        get().completeActionV2(completion.actionId);
      } else {
        // Fallback: complete construction locally (for legacy builds without actionId)
        console.warn('No actionId for construction, completing locally:', completion.baseId);
        get().completeConstruction(completion.position);
      }
    });
  },

  unlockTech: (techId) =>
    set((state) => ({
      unlockedTechs: [...state.unlockedTechs, techId],
    })),

  setResearch: (techId) =>
    set({ currentResearch: techId, researchProgress: 0 }),

  // Viewport actions
  setScrollOffset: (offset) => {
    const state = get();
    const CELL_SIZE = 64; // Must match GameCanvas CELL_SIZE
    const maxScroll = Math.max(0, (state.maxVisibleDepth - state.visibleRowCount + 2) * CELL_SIZE);
    const clampedOffset = Math.max(0, Math.min(offset, maxScroll));
    const visibleRowStart = Math.floor(clampedOffset / CELL_SIZE);

    set({
      scrollOffset: clampedOffset,
      visibleRowStart,
    });
  },

  updateMaxVisibleDepth: () => {
    const state = get();
    let deepestBase = 0;
    let miningRigBonus = 0;

    // Find the deepest operational base and count mining rigs
    for (let y = 0; y < state.gridHeight; y++) {
      for (let x = 0; x < state.gridWidth; x++) {
        const cell = state.grid[y][x];
        if (cell.base && cell.base.isOperational) {
          deepestBase = Math.max(deepestBase, y);
          // Mining rigs unlock additional depth
          if (cell.base.type === 'mining_rig') {
            miningRigBonus += 5;
          }
        }
      }
    }

    // Max visible is deepest base + visibility buffer + mining rig bonus, capped at grid height
    const maxVisible = Math.min(
      deepestBase + VISIBILITY_BUFFER + miningRigBonus,
      state.gridHeight - 1
    );

    set({ maxVisibleDepth: Math.max(maxVisible, INITIAL_VISIBLE_ROWS) });
  },

  setVisibleRowCount: (count) =>
    set({ visibleRowCount: count }),

  hydrateFromServer: (serverState) => {
    const { city_id, name, grid: serverGrid, resources: serverResources, resource_capacity, unlocked_techs, current_research } = serverState;

    // Convert server grid format to client format
    const hydratedGrid: GridCell[][] = [];
    const newQueue = new Map<string, ConstructionEntry>();
    const now = Date.now();

    for (let y = 0; y < serverGrid.length; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < serverGrid[y].length; x++) {
        const serverCell = serverGrid[y][x];
        let clientBase: Base | null = null;

        if (serverCell.base) {
          const startedAt = serverCell.base.construction_started_at
            ? Date.parse(serverCell.base.construction_started_at)
            : null;
          const endsAt = serverCell.base.construction_ends_at
            ? Date.parse(serverCell.base.construction_ends_at)
            : null;
          const isOperational = serverCell.base.is_operational;
          let progress = serverCell.base.construction_progress;

          if (!isOperational && startedAt && endsAt && endsAt > startedAt) {
            const elapsed = Math.max(0, Math.min(now - startedAt, endsAt - startedAt));
            progress = Math.min(100, (elapsed / (endsAt - startedAt)) * 100);
          }

          clientBase = {
            id: serverCell.base.id,
            type: serverCell.base.type as BaseType,
            position: { x: serverCell.base.position.x, y: serverCell.base.position.y },
            level: serverCell.base.level,
            constructionProgress: progress,
            isOperational,
            workers: serverCell.base.workers,
            actionId: serverCell.base.action_id ?? null,
            constructionStartedAt: startedAt,
            constructionEndsAt: endsAt,
          };

          if (!isOperational && startedAt && endsAt) {
            newQueue.set(serverCell.base.id, {
              baseType: serverCell.base.type as BaseType,
              startTime: startedAt,
              endTime: endsAt,
              actionId: serverCell.base.action_id ?? null,
            });
          }
        }

        row.push({
          position: { x: serverCell.position.x, y: serverCell.position.y },
          base: clientBase,
          isUnlocked: serverCell.is_unlocked,
          depth: serverCell.depth,
          zone: getZoneForDepth(serverCell.depth),
        });
      }
      hydratedGrid.push(row);
    }

    // Convert server resources to client format
    const hydratedResources: Resources = {
      population: serverResources.population || 0,
      food: serverResources.food || 0,
      oxygen: serverResources.oxygen || 0,
      water: serverResources.water || 0,
      energy: serverResources.energy || 0,
      minerals: serverResources.minerals || 0,
      techPoints: serverResources.tech_points || 0,
    };

    const hydratedCapacity: Resources = resource_capacity
      ? {
          population: resource_capacity.population || initialCapacity.population,
          food: resource_capacity.food || initialCapacity.food,
          oxygen: resource_capacity.oxygen || initialCapacity.oxygen,
          water: resource_capacity.water || initialCapacity.water,
          energy: resource_capacity.energy || initialCapacity.energy,
          minerals: resource_capacity.minerals || initialCapacity.minerals,
          techPoints: resource_capacity.tech_points || initialCapacity.techPoints,
        }
      : initialCapacity;

    // Default unlocked techs (Tier 1)
    const defaultUnlockedTechs = [
      'basic_construction',
      'life_support',
      'power_generation',
      'storage_systems',
    ];

    set({
      cityId: city_id,
      cityName: name,
      grid: hydratedGrid,
      gridWidth: hydratedGrid[0]?.length || 10,
      gridHeight: hydratedGrid.length || 15,
      resources: hydratedResources,
      resourceCapacity: hydratedCapacity,
      constructionQueue: newQueue,
      unlockedTechs: unlocked_techs || defaultUnlockedTechs,
      currentResearch: current_research || null,
    });

    // Recalculate derived state
    get().calculateResourceRates();
    get().updateMaxVisibleDepth();

    console.log(`Hydrated city state: ${name} (${city_id}), unlocked techs: ${(unlocked_techs || defaultUnlockedTechs).length}`);
  },

  // ============================================
  // Event-Driven Sync Methods (New)
  // ============================================

  setSyncConfig: (config) => set({ syncConfig: config }),

  startBuildActionV2: async (position, baseType) => {
    const state = get();
    const cityId = state.cityId;

    if (!cityId) {
      console.error('No city ID set');
      return false;
    }

    // Validate locally first
    const result = state.canBuildAt(position, baseType);
    if (!result.canBuild) {
      console.warn('Cannot build:', result.reason);
      return false;
    }

    try {
      // Call backend to start action
      const response = await startAction(cityId, 'build', {
        base_type: baseType,
        position: { x: position.x, y: position.y },
      });

      const startedAt = Date.parse(response.started_at);
      const endsAt = Date.parse(response.ends_at);

      // Create base in construction state
      const newBase: Base = {
        id: response.action_id, // Use action_id as base id for now
        type: baseType,
        position,
        level: 1,
        constructionProgress: 0,
        isOperational: false,
        workers: 0,
        actionId: response.action_id,
        constructionStartedAt: startedAt,
        constructionEndsAt: endsAt,
      };

      // Update grid
      const newGrid = state.grid.map((row) => row.map((cell) => ({ ...cell })));
      newGrid[position.y][position.x] = {
        ...newGrid[position.y][position.x],
        base: newBase,
      };

      // Add to construction queue
      const newQueue = new Map(state.constructionQueue);
      newQueue.set(response.action_id, {
        baseType,
        startTime: startedAt,
        endTime: endsAt,
        actionId: response.action_id,
      });

      // Add to server pending actions
      const newPendingActions = new Map(state.serverPendingActions);
      newPendingActions.set(response.action_id, {
        actionId: response.action_id,
        actionType: 'build',
        startedAt,
        endsAt,
        durationSeconds: response.duration_seconds,
        data: {
          baseType,
          position: { x: position.x, y: position.y },
        },
      });

      // Update resources from server response
      const newResources: Resources = {
        population: response.resources.population || state.resources.population,
        food: response.resources.food || state.resources.food,
        oxygen: response.resources.oxygen || state.resources.oxygen,
        water: response.resources.water || state.resources.water,
        energy: response.resources.energy || state.resources.energy,
        minerals: response.resources.minerals || state.resources.minerals,
        techPoints: response.resources.tech_points || state.resources.techPoints,
      };

      set({
        grid: newGrid,
        constructionQueue: newQueue,
        serverPendingActions: newPendingActions,
        resources: newResources,
        ui: { ...state.ui, selectedCell: null, selectedBase: null, activePanel: 'none' },
      });

      console.log(`Started build action: ${baseType} at (${position.x}, ${position.y}), action_id: ${response.action_id}`);
      return true;

    } catch (error) {
      console.error('Failed to start build action:', error);
      return false;
    }
  },

  startResearchActionV2: async (techId) => {
    const state = get();
    const cityId = state.cityId;

    if (!cityId) {
      console.error('No city ID set');
      return false;
    }

    // Check if already researching
    if (state.currentResearch) {
      console.warn('Already researching:', state.currentResearch);
      return false;
    }

    // Check if already unlocked
    if (state.unlockedTechs.includes(techId)) {
      console.warn('Tech already unlocked:', techId);
      return false;
    }

    try {
      // Call backend to start research action
      const response = await startAction(cityId, 'research', {
        tech_id: techId,
      });

      const startedAt = Date.parse(response.started_at);
      const endsAt = Date.parse(response.ends_at);

      // Add to server pending actions
      const newPendingActions = new Map(state.serverPendingActions);
      newPendingActions.set(response.action_id, {
        actionId: response.action_id,
        actionType: 'research',
        startedAt,
        endsAt,
        durationSeconds: response.duration_seconds,
        data: {
          techId,
        },
      });

      // Update resources from server response
      const newResources: Resources = {
        population: response.resources.population ?? state.resources.population,
        food: response.resources.food ?? state.resources.food,
        oxygen: response.resources.oxygen ?? state.resources.oxygen,
        water: response.resources.water ?? state.resources.water,
        energy: response.resources.energy ?? state.resources.energy,
        minerals: response.resources.minerals ?? state.resources.minerals,
        techPoints: response.resources.tech_points ?? state.resources.techPoints,
      };

      set({
        currentResearch: techId,
        researchProgress: 0,
        serverPendingActions: newPendingActions,
        resources: newResources,
      });

      // Schedule completion check
      const timeUntilComplete = endsAt - Date.now();
      if (timeUntilComplete > 0) {
        setTimeout(() => {
          get().completeActionV2(response.action_id);
        }, timeUntilComplete + 1000); // Add 1s buffer
      }

      console.log(`Started research action: ${techId}, action_id: ${response.action_id}, duration: ${response.duration_seconds}s`);
      return true;

    } catch (error) {
      console.error('Failed to start research action:', error);
      return false;
    }
  },

  completeActionV2: async (actionId) => {
    const state = get();

    try {
      const response = await completeAction(actionId);

      if (response.status === 'completed') {
        // Action completed successfully
        console.log(`Action ${actionId} completed at ${response.completed_at}`);

        // Find the pending action
        const pendingAction = state.serverPendingActions.get(actionId);
        if (pendingAction) {
          if (pendingAction.actionType === 'build' && pendingAction.data.position) {
            // Complete the construction locally
            get().completeConstruction(pendingAction.data.position as GridPosition);
          } else if (pendingAction.actionType === 'research' && pendingAction.data.techId) {
            // Complete the research locally
            const techId = pendingAction.data.techId;
            set((state) => ({
              unlockedTechs: [...state.unlockedTechs, techId],
              currentResearch: null,
              researchProgress: 0,
            }));
            console.log(`Research completed: ${techId}`);
          }
        }

        // Remove from pending actions
        const newPendingActions = new Map(state.serverPendingActions);
        newPendingActions.delete(actionId);
        set({ serverPendingActions: newPendingActions });

      } else if (response.status === 'pending' && response.remaining_seconds) {
        // Action not ready yet - schedule retry
        console.log(`Action ${actionId} not ready, ${response.remaining_seconds}s remaining`);
        setTimeout(() => {
          get().completeActionV2(actionId);
        }, (response.remaining_seconds + 1) * 1000);

      } else if (response.status === 'failed') {
        console.error(`Action ${actionId} failed: ${response.error}`);
      }

    } catch (error) {
      console.error(`Failed to complete action ${actionId}:`, error);
      // Retry after a delay
      const retryDelay = state.syncConfig?.action_complete_retry_seconds || 3;
      setTimeout(() => {
        get().completeActionV2(actionId);
      }, retryDelay * 1000);
    }
  },

  syncResourcesWithServer: async () => {
    const state = get();
    const cityId = state.cityId;

    if (!cityId) {
      console.warn('No city ID set, skipping resource sync');
      return;
    }

    try {
      // Round to integers - backend expects int, but local tick produces floats
      const response = await syncResources(cityId, {
        population: Math.round(state.resources.population),
        food: Math.round(state.resources.food),
        oxygen: Math.round(state.resources.oxygen),
        water: Math.round(state.resources.water),
        energy: Math.round(state.resources.energy),
        minerals: Math.round(state.resources.minerals),
        tech_points: Math.round(state.resources.techPoints),
      });

      // Update resources from server (server is source of truth)
      const newResources: Resources = {
        population: response.resources.population || 0,
        food: response.resources.food || 0,
        oxygen: response.resources.oxygen || 0,
        water: response.resources.water || 0,
        energy: response.resources.energy || 0,
        minerals: response.resources.minerals || 0,
        techPoints: response.resources.tech_points || 0,
      };

      const newCapacity: Resources = {
        population: response.capacity.population || initialCapacity.population,
        food: response.capacity.food || initialCapacity.food,
        oxygen: response.capacity.oxygen || initialCapacity.oxygen,
        water: response.capacity.water || initialCapacity.water,
        energy: response.capacity.energy || initialCapacity.energy,
        minerals: response.capacity.minerals || initialCapacity.minerals,
        techPoints: response.capacity.tech_points || initialCapacity.techPoints,
      };

      set({
        resources: newResources,
        resourceCapacity: newCapacity,
        lastResourceSyncTime: Date.now(),
      });

      if (response.drift_detected) {
        console.warn('Resource drift detected:', response.drift_details);
      } else {
        console.log('Resources synced with server');
      }

    } catch (error) {
      console.error('Failed to sync resources:', error);
    }
  },

  hydrateFromBootstrapV2: (response) => {
    const { city, pending_actions, sync_config } = response;

    // First, hydrate the city state using existing method
    get().hydrateFromServer(city);

    // Set sync config
    set({ syncConfig: sync_config });

    // Setup pending action timers
    get().setupPendingActionTimers(pending_actions);

    console.log('Hydrated from bootstrap v2, sync_config:', sync_config);
  },

  setupPendingActionTimers: (pendingActions) => {
    const now = Date.now();
    const newPendingActions = new Map<string, ServerPendingAction>();
    const newQueue = new Map<string, ConstructionEntry>();
    let researchTechId: string | null = null;

    for (const action of pendingActions) {
      const startedAt = Date.parse(action.started_at);
      const endsAt = Date.parse(action.ends_at);

      newPendingActions.set(action.action_id, {
        actionId: action.action_id,
        actionType: action.action_type,
        startedAt,
        endsAt,
        durationSeconds: action.duration_seconds,
        data: {
          baseType: action.data.base_type,
          position: action.data.position,
          baseId: action.data.base_id,
          techId: action.data.tech_id,
        },
      });

      // Add to construction queue if it's a build action
      if (action.action_type === 'build' && action.data.base_type) {
        newQueue.set(action.action_id, {
          baseType: action.data.base_type as BaseType,
          startTime: startedAt,
          endTime: endsAt,
          actionId: action.action_id,
        });
      }

      // Track research action
      if (action.action_type === 'research' && action.data.tech_id) {
        researchTechId = action.data.tech_id;
      }

      // Schedule completion check
      const timeUntilComplete = endsAt - now;
      if (timeUntilComplete > 0) {
        setTimeout(() => {
          get().completeActionV2(action.action_id);
        }, timeUntilComplete + 1000); // Add 1s buffer
      } else {
        // Already past completion time, try to complete now
        get().completeActionV2(action.action_id);
      }
    }

    set({
      serverPendingActions: newPendingActions,
      constructionQueue: newQueue,
      currentResearch: researchTechId,
    });

    console.log(`Setup ${pendingActions.length} pending action timers`);
  },
}));

// Resource tick interval (local UI updates)
let tickInterval: number | null = null;

// Resource sync interval (server sync)
let syncInterval: number | null = null;

export const startResourceTick = () => {
  if (tickInterval) return;

  const store = useGameStore.getState();
  store.calculateResourceRates();

  tickInterval = window.setInterval(() => {
    const state = useGameStore.getState();
    const now = Date.now();
    const deltaSeconds = (now - state.lastTickTime) / 1000;
    state.applyResourceTick(deltaSeconds);
    state.updateConstructionProgress();
  }, 100); // Update more frequently for smoother construction progress
};

export const stopResourceTick = () => {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
};

// Start periodic resource sync with server
export const startResourceSyncInterval = (intervalSeconds?: number) => {
  if (syncInterval) return;

  // Use provided interval or get from sync config or default to 30 seconds
  const state = useGameStore.getState();
  const syncIntervalMs = (intervalSeconds || state.syncConfig?.resource_sync_interval_seconds || 30) * 1000;

  console.log(`Starting resource sync interval: ${syncIntervalMs / 1000}s`);

  syncInterval = window.setInterval(() => {
    const store = useGameStore.getState();
    store.syncResourcesWithServer();
  }, syncIntervalMs);
};

export const stopResourceSyncInterval = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
};

// Stop all intervals
export const stopAllIntervals = () => {
  stopResourceTick();
  stopResourceSyncInterval();
};
