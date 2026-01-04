export interface TechNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number; // Tech points required
  researchTime: number; // Seconds
  prerequisites: string[];
  unlocks: string[]; // Base types or features unlocked
  tier: number;
  category: 'infrastructure' | 'military' | 'exploration' | 'economy';
}

export const TECH_TREE: Record<string, TechNode> = {
  // Tier 1 - Basic
  basic_construction: {
    id: 'basic_construction',
    name: 'Basic Construction',
    description: 'Fundamental underwater construction techniques.',
    icon: '🔨',
    cost: 0,
    researchTime: 0,
    prerequisites: [],
    unlocks: ['residential', 'hydroponic_farm', 'kelp_forest', 'mining_rig'],
    tier: 1,
    category: 'infrastructure',
  },
  life_support: {
    id: 'life_support',
    name: 'Life Support Systems',
    description: 'Essential systems for underwater survival.',
    icon: '💨',
    cost: 0,
    researchTime: 0,
    prerequisites: [],
    unlocks: ['oxygen_generator', 'water_purifier'],
    tier: 1,
    category: 'infrastructure',
  },
  power_generation: {
    id: 'power_generation',
    name: 'Power Generation',
    description: 'Harness thermal energy from ocean vents.',
    icon: '⚡',
    cost: 0,
    researchTime: 0,
    prerequisites: [],
    unlocks: ['power_plant'],
    tier: 1,
    category: 'infrastructure',
  },
  storage_systems: {
    id: 'storage_systems',
    name: 'Storage Systems',
    description: 'Efficient resource storage solutions.',
    icon: '📦',
    cost: 0,
    researchTime: 0,
    prerequisites: [],
    unlocks: ['storage_hub'],
    tier: 1,
    category: 'economy',
  },

  // Tier 2 - Advanced
  advanced_research: {
    id: 'advanced_research',
    name: 'Advanced Research',
    description: 'Establish dedicated research facilities.',
    icon: '🔬',
    cost: 50,
    researchTime: 120,
    prerequisites: ['basic_construction', 'power_generation'],
    unlocks: ['research_lab'],
    tier: 2,
    category: 'infrastructure',
  },
  telecommunications: {
    id: 'telecommunications',
    name: 'Telecommunications',
    description: 'Long-range underwater communication systems.',
    icon: '📡',
    cost: 80,
    researchTime: 180,
    prerequisites: ['advanced_research'],
    unlocks: ['comms_tower'],
    tier: 2,
    category: 'infrastructure',
  },
  defense_systems: {
    id: 'defense_systems',
    name: 'Defense Systems',
    description: 'Protect your city from threats.',
    icon: '🛡️',
    cost: 100,
    researchTime: 240,
    prerequisites: ['advanced_research'],
    unlocks: ['defense_platform'],
    tier: 2,
    category: 'military',
  },
  naval_construction: {
    id: 'naval_construction',
    name: 'Naval Construction',
    description: 'Build underwater vessels for exploration and combat.',
    icon: '🔧',
    cost: 120,
    researchTime: 300,
    prerequisites: ['defense_systems'],
    unlocks: ['shipyard'],
    tier: 2,
    category: 'military',
  },

  // Tier 3 - Expert
  trade_routes: {
    id: 'trade_routes',
    name: 'Trade Routes',
    description: 'Establish trade connections with other cities.',
    icon: '🤝',
    cost: 150,
    researchTime: 360,
    prerequisites: ['telecommunications'],
    unlocks: ['trade_hub'],
    tier: 3,
    category: 'economy',
  },
  deep_exploration: {
    id: 'deep_exploration',
    name: 'Deep Exploration',
    description: 'Explore the deepest parts of the ocean.',
    icon: '🔦',
    cost: 200,
    researchTime: 420,
    prerequisites: ['naval_construction'],
    unlocks: [],
    tier: 3,
    category: 'exploration',
  },
  artifact_analysis: {
    id: 'artifact_analysis',
    name: 'Artifact Analysis',
    description: 'Study pre-war artifacts to unlock ancient knowledge.',
    icon: '🏛️',
    cost: 180,
    researchTime: 400,
    prerequisites: ['deep_exploration'],
    unlocks: [],
    tier: 3,
    category: 'exploration',
  },
  advanced_weapons: {
    id: 'advanced_weapons',
    name: 'Advanced Weapons',
    description: 'Develop powerful weapons for city defense.',
    icon: '⚔️',
    cost: 250,
    researchTime: 480,
    prerequisites: ['naval_construction', 'artifact_analysis'],
    unlocks: [],
    tier: 3,
    category: 'military',
  },

  // Tier 4 - Master
  world_government: {
    id: 'world_government',
    name: 'World Government',
    description: 'Participate in global politics and diplomacy.',
    icon: '🌍',
    cost: 300,
    researchTime: 600,
    prerequisites: ['trade_routes', 'telecommunications'],
    unlocks: [],
    tier: 4,
    category: 'economy',
  },
  quantum_communications: {
    id: 'quantum_communications',
    name: 'Quantum Communications',
    description: 'Instant secure communication across the globe.',
    icon: '🔮',
    cost: 400,
    researchTime: 720,
    prerequisites: ['world_government'],
    unlocks: [],
    tier: 4,
    category: 'infrastructure',
  },
};

export const getTechsByTier = (tier: number): TechNode[] => {
  return Object.values(TECH_TREE).filter((tech) => tech.tier === tier);
};

export const getTechsByCategory = (category: TechNode['category']): TechNode[] => {
  return Object.values(TECH_TREE).filter((tech) => tech.category === category);
};

export const canResearchTech = (techId: string, unlockedTechs: string[]): boolean => {
  const tech = TECH_TREE[techId];
  if (!tech) return false;
  if (unlockedTechs.includes(techId)) return false;
  return tech.prerequisites.every((prereq) => unlockedTechs.includes(prereq));
};

export const getAvailableTechs = (unlockedTechs: string[]): TechNode[] => {
  return Object.values(TECH_TREE).filter(
    (tech) => !unlockedTechs.includes(tech.id) && canResearchTech(tech.id, unlockedTechs)
  );
};
