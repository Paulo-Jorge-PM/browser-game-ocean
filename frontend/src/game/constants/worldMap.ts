export interface OceanRegion {
  id: string;
  name: string;
  continent: string;
  country: string;
  coordinates: { x: number; y: number }; // Normalized 0-100
  color: number;
  description: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  continent: string;
  playerCount: number;
  maxPlayers: number;
  status: 'online' | 'full' | 'maintenance';
}

export const OCEAN_REGIONS: OceanRegion[] = [
  // North Atlantic
  {
    id: 'na_east',
    name: 'North Atlantic East',
    continent: 'europe',
    country: 'International Waters',
    coordinates: { x: 42, y: 28 },
    color: 0x0066cc,
    description: 'Cold waters off the European coast',
  },
  {
    id: 'na_west',
    name: 'North Atlantic West',
    continent: 'north_america',
    country: 'International Waters',
    coordinates: { x: 28, y: 30 },
    color: 0x0077dd,
    description: 'Waters between North America and Europe',
  },
  {
    id: 'portugal',
    name: 'Portuguese Waters',
    continent: 'europe',
    country: 'Portugal',
    coordinates: { x: 40, y: 35 },
    color: 0x006600,
    description: 'Atlantic waters off the Iberian Peninsula',
  },
  {
    id: 'france',
    name: 'Bay of Biscay',
    continent: 'europe',
    country: 'France',
    coordinates: { x: 42, y: 32 },
    color: 0x0055bb,
    description: 'Waters off the French Atlantic coast',
  },
  {
    id: 'uk',
    name: 'British Isles',
    continent: 'europe',
    country: 'United Kingdom',
    coordinates: { x: 44, y: 26 },
    color: 0x003399,
    description: 'Waters surrounding the British Isles',
  },

  // Mediterranean
  {
    id: 'mediterranean_west',
    name: 'Western Mediterranean',
    continent: 'europe',
    country: 'International Waters',
    coordinates: { x: 48, y: 36 },
    color: 0x0088aa,
    description: 'Waters between Spain, France, and Italy',
  },
  {
    id: 'mediterranean_east',
    name: 'Eastern Mediterranean',
    continent: 'europe',
    country: 'International Waters',
    coordinates: { x: 55, y: 36 },
    color: 0x0099bb,
    description: 'Waters near Greece, Turkey, and the Middle East',
  },

  // South Atlantic
  {
    id: 'sa_west',
    name: 'South Atlantic West',
    continent: 'south_america',
    country: 'International Waters',
    coordinates: { x: 30, y: 60 },
    color: 0x0066aa,
    description: 'Waters off the South American coast',
  },
  {
    id: 'brazil',
    name: 'Brazilian Waters',
    continent: 'south_america',
    country: 'Brazil',
    coordinates: { x: 32, y: 55 },
    color: 0x009933,
    description: 'Tropical waters off Brazil',
  },

  // Pacific
  {
    id: 'np_west',
    name: 'North Pacific West',
    continent: 'asia',
    country: 'International Waters',
    coordinates: { x: 78, y: 32 },
    color: 0x0055aa,
    description: 'Waters near Japan and Korea',
  },
  {
    id: 'np_east',
    name: 'North Pacific East',
    continent: 'north_america',
    country: 'International Waters',
    coordinates: { x: 15, y: 32 },
    color: 0x0066bb,
    description: 'Waters off the US West Coast',
  },
  {
    id: 'sp_central',
    name: 'South Pacific Central',
    continent: 'oceania',
    country: 'International Waters',
    coordinates: { x: 85, y: 55 },
    color: 0x00aacc,
    description: 'Vast open waters of the South Pacific',
  },
  {
    id: 'australia',
    name: 'Australian Waters',
    continent: 'oceania',
    country: 'Australia',
    coordinates: { x: 82, y: 62 },
    color: 0x996600,
    description: 'Waters surrounding Australia',
  },

  // Indian Ocean
  {
    id: 'indian_west',
    name: 'Western Indian Ocean',
    continent: 'africa',
    country: 'International Waters',
    coordinates: { x: 58, y: 55 },
    color: 0x007799,
    description: 'Waters off the African East Coast',
  },
  {
    id: 'indian_east',
    name: 'Eastern Indian Ocean',
    continent: 'asia',
    country: 'International Waters',
    coordinates: { x: 72, y: 50 },
    color: 0x008888,
    description: 'Waters near India and Southeast Asia',
  },

  // Arctic/Antarctic
  {
    id: 'arctic',
    name: 'Arctic Ocean',
    continent: 'arctic',
    country: 'International Waters',
    coordinates: { x: 50, y: 8 },
    color: 0xaaddff,
    description: 'Freezing waters of the far north',
  },
  {
    id: 'antarctic',
    name: 'Southern Ocean',
    continent: 'antarctic',
    country: 'International Waters',
    coordinates: { x: 50, y: 92 },
    color: 0xbbddff,
    description: 'Icy waters surrounding Antarctica',
  },
];

export const SERVERS: ServerInfo[] = [
  {
    id: 'eu-west-1',
    name: 'Europe West',
    continent: 'europe',
    playerCount: 1247,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'eu-east-1',
    name: 'Europe East',
    continent: 'europe',
    playerCount: 892,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'na-east-1',
    name: 'North America East',
    continent: 'north_america',
    playerCount: 2134,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'na-west-1',
    name: 'North America West',
    continent: 'north_america',
    playerCount: 1567,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'asia-1',
    name: 'Asia Pacific',
    continent: 'asia',
    playerCount: 3421,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'sa-1',
    name: 'South America',
    continent: 'south_america',
    playerCount: 654,
    maxPlayers: 5000,
    status: 'online',
  },
  {
    id: 'oceania-1',
    name: 'Oceania',
    continent: 'oceania',
    playerCount: 423,
    maxPlayers: 5000,
    status: 'online',
  },
];

export const getRegionsByContinent = (continent: string): OceanRegion[] => {
  return OCEAN_REGIONS.filter((r) => r.continent === continent);
};

export const getServersByContinent = (continent: string): ServerInfo[] => {
  return SERVERS.filter((s) => s.continent === continent);
};
