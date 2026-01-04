import type { BaseType, Resources } from '../../types/game';

// Connection sides - which directions a base can connect to adjacent cells
export type ConnectionSide = 'top' | 'bottom' | 'left' | 'right';

export interface BaseDefinition {
  type: BaseType;
  name: string;
  description: string;
  icon: string;
  color: number;
  cost: Partial<Resources>;
  production: Partial<Resources>;
  consumption: Partial<Resources>;
  buildTime: number; // seconds to build
  workersRequired: number;
  unlockTech?: string;
  tier: number; // 1 = basic, 2 = advanced, 3 = expert
  connectionSides: ConnectionSide[]; // Which sides can connect to other bases
}

export const BASE_DEFINITIONS: Record<BaseType, BaseDefinition> = {
  command_ship: {
    type: 'command_ship',
    name: 'Command Ship',
    description: 'Your central hub. Cannot be destroyed or moved. Produces basic resources.',
    icon: '🚢',
    color: 0xffd700,
    cost: {},
    production: { energy: 5, minerals: 2, food: 1, oxygen: 2, water: 2 }, // Slow but constant
    consumption: {},
    buildTime: 0,
    workersRequired: 5,
    tier: 1,
    connectionSides: ['bottom', 'left', 'right'], // Can't connect upward (at surface)
  },
  residential: {
    type: 'residential',
    name: 'Residential Dome',
    description: 'Houses your population. Each dome increases capacity by 20.',
    icon: '🏠',
    color: 0x00ff88,
    cost: { minerals: 50, energy: 20 },
    production: { population: 20 },
    consumption: { energy: 5, oxygen: 10, water: 10, food: 15 },
    buildTime: 30,
    workersRequired: 2,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  hydroponic_farm: {
    type: 'hydroponic_farm',
    name: 'Hydroponic Farm',
    description: 'Grows food using artificial light and nutrient solutions.',
    icon: '🌱',
    color: 0x88ff00,
    cost: { minerals: 30, energy: 15 },
    production: { food: 25 },
    consumption: { energy: 8, water: 5 },
    buildTime: 45,
    workersRequired: 3,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  kelp_forest: {
    type: 'kelp_forest',
    name: 'Kelp Forest',
    description: 'Natural oxygen and food production. Low maintenance.',
    icon: '🌿',
    color: 0x00aa44,
    cost: { minerals: 20 },
    production: { food: 10, oxygen: 15 },
    consumption: {},
    buildTime: 20,
    workersRequired: 1,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  mining_rig: {
    type: 'mining_rig',
    name: 'Mining Rig',
    description: 'Extracts minerals from the ocean floor.',
    icon: '⛏️',
    color: 0xaa6600,
    cost: { minerals: 40, energy: 30 },
    production: { minerals: 20 },
    consumption: { energy: 15 },
    buildTime: 60,
    workersRequired: 5,
    tier: 1,
    connectionSides: ['top', 'left', 'right'], // Mines downward, connects from top
  },
  oxygen_generator: {
    type: 'oxygen_generator',
    name: 'Oxygen Generator',
    description: 'Electrolyzes water to produce breathable oxygen.',
    icon: '💨',
    color: 0x00aaff,
    cost: { minerals: 35, energy: 25 },
    production: { oxygen: 30 },
    consumption: { energy: 12, water: 5 },
    buildTime: 40,
    workersRequired: 2,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  water_purifier: {
    type: 'water_purifier',
    name: 'Water Purifier',
    description: 'Filters and purifies seawater for drinking.',
    icon: '💧',
    color: 0x4488ff,
    cost: { minerals: 35, energy: 25 },
    production: { water: 35 },
    consumption: { energy: 10 },
    buildTime: 40,
    workersRequired: 2,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  power_plant: {
    type: 'power_plant',
    name: 'Thermal Power Plant',
    description: 'Generates energy from ocean thermal vents.',
    icon: '⚡',
    color: 0xffaa00,
    cost: { minerals: 60 },
    production: { energy: 50 },
    consumption: { minerals: 2 },
    buildTime: 90,
    workersRequired: 4,
    tier: 1,
    connectionSides: ['top', 'left', 'right'], // Built near ocean floor
  },
  comms_tower: {
    type: 'comms_tower',
    name: 'Communications Tower',
    description: 'Enables long-range communication and radar.',
    icon: '📡',
    color: 0xff00ff,
    cost: { minerals: 80, energy: 40 },
    production: {},
    consumption: { energy: 20 },
    buildTime: 60,
    workersRequired: 2,
    unlockTech: 'telecommunications',
    tier: 2,
    connectionSides: ['bottom'], // Tower extends upward, connects from bottom
  },
  defense_platform: {
    type: 'defense_platform',
    name: 'Defense Platform',
    description: 'Protects your city from hostile attacks.',
    icon: '🛡️',
    color: 0xff4444,
    cost: { minerals: 100, energy: 50 },
    production: {},
    consumption: { energy: 25 },
    buildTime: 90,
    workersRequired: 6,
    unlockTech: 'defense_systems',
    tier: 2,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  shipyard: {
    type: 'shipyard',
    name: 'Shipyard',
    description: 'Constructs exploration and military vessels.',
    icon: '🔧',
    color: 0x888888,
    cost: { minerals: 120, energy: 60 },
    production: {},
    consumption: { energy: 30, minerals: 5 },
    buildTime: 120,
    workersRequired: 8,
    unlockTech: 'naval_construction',
    tier: 2,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  research_lab: {
    type: 'research_lab',
    name: 'Research Laboratory',
    description: 'Generates tech points for researching new technologies.',
    icon: '🔬',
    color: 0xaa00ff,
    cost: { minerals: 80, energy: 50 },
    production: { techPoints: 10 },
    consumption: { energy: 20 },
    buildTime: 75,
    workersRequired: 4,
    tier: 2,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  storage_hub: {
    type: 'storage_hub',
    name: 'Storage Hub',
    description: 'Increases resource storage capacity.',
    icon: '📦',
    color: 0x666666,
    cost: { minerals: 40, energy: 20 },
    production: {},
    consumption: { energy: 5 },
    buildTime: 30,
    workersRequired: 1,
    tier: 1,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
  trade_hub: {
    type: 'trade_hub',
    name: 'Trade Hub',
    description: 'Enables trading with other cities.',
    icon: '🤝',
    color: 0x00ffaa,
    cost: { minerals: 150, energy: 80 },
    production: {},
    consumption: { energy: 25 },
    buildTime: 120,
    workersRequired: 5,
    unlockTech: 'trade_routes',
    tier: 3,
    connectionSides: ['top', 'bottom', 'left', 'right'],
  },
};

// Get the opposite side for connection checking
export const getOppositeSide = (side: ConnectionSide): ConnectionSide => {
  const opposites: Record<ConnectionSide, ConnectionSide> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  return opposites[side];
};

// Check if two bases can connect
export const canBasesConnect = (
  fromType: BaseType,
  toType: BaseType,
  direction: ConnectionSide
): boolean => {
  const fromDef = BASE_DEFINITIONS[fromType];
  const toDef = BASE_DEFINITIONS[toType];
  const opposite = getOppositeSide(direction);

  return fromDef.connectionSides.includes(direction) && toDef.connectionSides.includes(opposite);
};

// Get bases available at start (tier 1, no tech requirement)
export const getAvailableBases = (unlockedTechs: string[] = []): BaseDefinition[] => {
  return Object.values(BASE_DEFINITIONS).filter((base) => {
    if (base.type === 'command_ship') return false;
    if (base.unlockTech && !unlockedTechs.includes(base.unlockTech)) return false;
    return true;
  });
};

// Calculate if player can afford a base
export const canAffordBase = (
  baseType: BaseType,
  resources: Resources
): boolean => {
  const definition = BASE_DEFINITIONS[baseType];
  if (!definition) return false;

  for (const [resource, cost] of Object.entries(definition.cost)) {
    if ((resources[resource as keyof Resources] || 0) < (cost || 0)) {
      return false;
    }
  }
  return true;
};

// Deduct cost from resources
export const deductBaseCost = (
  baseType: BaseType,
  resources: Resources
): Resources => {
  const definition = BASE_DEFINITIONS[baseType];
  const newResources = { ...resources };

  for (const [resource, cost] of Object.entries(definition.cost)) {
    newResources[resource as keyof Resources] -= cost || 0;
  }

  return newResources;
};
