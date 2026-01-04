// Resource types
export interface Resources {
  population: number;
  food: number;
  oxygen: number;
  water: number;
  energy: number;
  minerals: number;
  techPoints: number;
}

// Base types
export type BaseType =
  | 'command_ship'
  | 'residential'
  | 'hydroponic_farm'
  | 'kelp_forest'
  | 'mining_rig'
  | 'oxygen_generator'
  | 'water_purifier'
  | 'power_plant'
  | 'comms_tower'
  | 'defense_platform'
  | 'shipyard'
  | 'research_lab'
  | 'storage_hub'
  | 'trade_hub';

export interface BaseDefinition {
  type: BaseType;
  name: string;
  description: string;
  cost: Partial<Resources>;
  production: Partial<Resources>;
  consumption: Partial<Resources>;
  buildTime: number; // seconds
  unlockTech?: string;
}

// Grid and cell types
export interface GridPosition {
  x: number;
  y: number;
}

// Zone types based on depth
export type CellZone = 'sky' | 'surface' | 'shallow' | 'deep';

export interface GridCell {
  position: GridPosition;
  base: Base | null;
  isUnlocked: boolean;
  depth: number; // -1 = sky, 0 = surface, higher = deeper
  zone: CellZone;
}

export interface Base {
  id: string;
  type: BaseType;
  position: GridPosition;
  level: number;
  constructionProgress: number; // 0-100
  isOperational: boolean;
  workers: number;
}

// City
export interface City {
  id: string;
  name: string;
  playerId: string;
  grid: GridCell[][];
  resources: Resources;
  resourceCapacity: Resources;
  createdAt: Date;
}

// Player
export interface Player {
  id: string;
  username: string;
  email: string;
  cityId: string;
  region: string;
  country: string;
  createdAt: Date;
}

// World map
export interface WorldRegion {
  id: string;
  name: string;
  country: string;
  continent: string;
  coordinates: { lat: number; lng: number };
  cities: string[]; // city IDs
}

// Rankings
export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RankingEntry {
  rank: number;
  playerId: string;
  playerName: string;
  cityName: string;
  score: number;
  country: string;
}

// UI State
export interface UIState {
  selectedCell: GridPosition | null;
  selectedBase: Base | null;
  activePanel: 'none' | 'build' | 'tech' | 'comms' | 'world' | 'rankings';
  isAgentCommActive: boolean;
}
