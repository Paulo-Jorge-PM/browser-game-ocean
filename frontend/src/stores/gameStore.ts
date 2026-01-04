import { create } from 'zustand';
import type { Resources, GridCell, GridPosition, Base, UIState, BaseType, CellZone } from '../types/game';
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
  constructionQueue: Map<string, { baseType: BaseType; startTime: number; endTime: number }>;

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
}

// Type for server city state
interface ServerCityState {
  city_id: string;
  name: string;
  grid: ServerGridCell[][];
  resources: Record<string, number>;
  resource_capacity?: Record<string, number>;
}

interface ServerGridCell {
  position: { x: number; y: number };
  base: ServerBase | null;
  is_unlocked: boolean;
  depth: number;
}

interface ServerBase {
  id: string;
  type: BaseType;
  position: { x: number; y: number };
  level: number;
  construction_progress: number;
  is_operational: boolean;
  workers: number;
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
    let hasCompletions = false;
    const newQueue = new Map(state.constructionQueue);
    const completedPositions: { pos: GridPosition; baseType: BaseType }[] = [];

    // First pass: Update progress and identify completions
    const newGrid = state.grid.map((row) =>
      row.map((cell) => {
        if (cell.base && !cell.base.isOperational) {
          const construction = state.constructionQueue.get(cell.base.id);
          if (construction) {
            const elapsed = now - construction.startTime;
            const total = construction.endTime - construction.startTime;
            const progress = Math.min(100, (elapsed / total) * 100);

            if (progress >= 100) {
              // Complete construction atomically in the same pass
              hasCompletions = true;
              newQueue.delete(cell.base.id);
              completedPositions.push({ pos: cell.position, baseType: cell.base.type });

              const definition = BASE_DEFINITIONS[cell.base.type];
              return {
                ...cell,
                base: {
                  ...cell.base,
                  constructionProgress: 100,
                  isOperational: true,
                  workers: definition.workersRequired,
                },
              };
            }

            return {
              ...cell,
              base: {
                ...cell.base,
                constructionProgress: progress,
              },
            };
          }
        }
        return cell;
      })
    );

    // Second pass: Unlock adjacent cells for completed bases
    if (hasCompletions) {
      for (const { pos, baseType } of completedPositions) {
        const definition = BASE_DEFINITIONS[baseType];
        const adjacentPositions = [
          { adjPos: { x: pos.x, y: pos.y - 1 }, side: 'top' as ConnectionSide },
          { adjPos: { x: pos.x, y: pos.y + 1 }, side: 'bottom' as ConnectionSide },
          { adjPos: { x: pos.x - 1, y: pos.y }, side: 'left' as ConnectionSide },
          { adjPos: { x: pos.x + 1, y: pos.y }, side: 'right' as ConnectionSide },
        ];

        for (const { adjPos, side } of adjacentPositions) {
          if (
            adjPos.y >= 0 &&
            adjPos.y < state.gridHeight &&
            adjPos.x >= 0 &&
            adjPos.x < state.gridWidth &&
            definition.connectionSides.includes(side)
          ) {
            newGrid[adjPos.y][adjPos.x] = {
              ...newGrid[adjPos.y][adjPos.x],
              isUnlocked: true,
            };
          }
        }
      }
    }

    // Single atomic state update
    set({ grid: newGrid, constructionQueue: newQueue });

    // Recalculate resource rates and visibility after state is updated
    if (hasCompletions) {
      get().calculateResourceRates();
      get().updateMaxVisibleDepth();
    }
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
    const { city_id, name, grid: serverGrid, resources: serverResources, resource_capacity } = serverState;

    // Convert server grid format to client format
    const hydratedGrid: GridCell[][] = [];
    for (let y = 0; y < serverGrid.length; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < serverGrid[y].length; x++) {
        const serverCell = serverGrid[y][x];
        const clientBase: Base | null = serverCell.base
          ? {
              id: serverCell.base.id,
              type: serverCell.base.type as BaseType,
              position: { x: serverCell.base.position.x, y: serverCell.base.position.y },
              level: serverCell.base.level,
              constructionProgress: serverCell.base.construction_progress,
              isOperational: serverCell.base.is_operational,
              workers: serverCell.base.workers,
            }
          : null;

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

    set({
      cityId: city_id,
      cityName: name,
      grid: hydratedGrid,
      gridWidth: hydratedGrid[0]?.length || 10,
      gridHeight: hydratedGrid.length || 15,
      resources: hydratedResources,
      resourceCapacity: hydratedCapacity,
      constructionQueue: new Map(), // Clear construction queue on hydration
    });

    // Recalculate derived state
    get().calculateResourceRates();
    get().updateMaxVisibleDepth();

    console.log(`Hydrated city state: ${name} (${city_id})`);
  },
}));

// Resource tick interval
let tickInterval: number | null = null;

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
