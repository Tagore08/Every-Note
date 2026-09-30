export type PlantCategoryId = 'low_water' | 'moderate' | 'high_water';

export interface PlantCategory {
  id: PlantCategoryId;
  label: string;
  badge: string;
  icon: string;
  description: string;
  color: string;
}

export const PLANT_CATEGORIES: PlantCategory[] = [
  {
    id: 'low_water',
    label: 'Low water / Low maintenance',
    badge: 'Low Water',
    icon: '💧',
    description: 'Resilient and hardy desert succulents that thrive with minimal attention.',
    color: 'emerald',
  },
  {
    id: 'moderate',
    label: 'Daily watering / Moderate attention',
    badge: 'Daily Care',
    icon: '💧💧',
    description: 'Balanced companions requiring consistent routine care and indirect light.',
    color: 'blue',
  },
  {
    id: 'high_water',
    label: 'High water / High time investment',
    badge: 'High Investment',
    icon: '💧💧💧',
    description: 'Exotic beauties needing constant moisture, misting, and devoted dedication.',
    color: 'purple',
  },
];

export interface PlantVariety {
  id: string;
  name: string;
  scientificName: string;
  category: PlantCategoryId;
  icon: string;
  tagline: string;
  description: string;
  waterNeeds: string;
  sunlight: string;
  potStyle: 'terracotta' | 'ceramic' | 'stone' | 'porcelain' | 'bamboo';
  primaryColor: string;
  bloomedColor: string;
}

export const PLANT_LIBRARY: PlantVariety[] = [
  // --- Category 1: Low water / Low maintenance ---
  {
    id: 'cactus',
    name: 'Desert Cactus',
    scientificName: 'Echinocactus grusonii',
    category: 'low_water',
    icon: '🌵',
    tagline: 'Hardy survivor of arid dunes',
    description: 'A sturdy golden barrel cactus that stores water deep inside its pleated ribs, bursting with a desert bloom when you conquer your focus.',
    waterNeeds: 'Minimal (1-2x monthly)',
    sunlight: 'Direct intense sun',
    potStyle: 'terracotta',
    primaryColor: '#10b981',
    bloomedColor: '#f43f5e',
  },
  {
    id: 'snake_plant',
    name: 'Snake Plant',
    scientificName: 'Sansevieria trifasciata',
    category: 'low_water',
    icon: '🪴',
    tagline: 'Indestructible architectural blade',
    description: 'Upright sword-like leaves with striking yellow-green variegation. Purifies the atmosphere while demanding virtually zero fuss.',
    waterNeeds: 'Infrequent (every 2-3 weeks)',
    sunlight: 'Low to indirect light',
    potStyle: 'ceramic',
    primaryColor: '#059669',
    bloomedColor: '#eab308',
  },
  {
    id: 'aloe_vera',
    name: 'Aloe Vera',
    scientificName: 'Aloe barbadensis',
    category: 'low_water',
    icon: '🌿',
    tagline: 'Soothing medicinal succulent',
    description: 'Thick fleshy spear leaves filled with natural cooling gel. A calming desk presence that flourishes through quiet determination.',
    waterNeeds: 'Low (allow soil to dry)',
    sunlight: 'Bright indirect sunlight',
    potStyle: 'terracotta',
    primaryColor: '#14b8a6',
    bloomedColor: '#f59e0b',
  },
  {
    id: 'jade_plant',
    name: 'Jade Plant',
    scientificName: 'Crassula ovata',
    category: 'low_water',
    icon: '🍃',
    tagline: 'Symbol of good fortune and prosperity',
    description: 'Glossy jade-green rounded coin leaves on thick woody miniature branches. Represents steady accumulation of productive focus.',
    waterNeeds: 'Low (drought-tolerant)',
    sunlight: 'Bright sunny windowsill',
    potStyle: 'stone',
    primaryColor: '#15803d',
    bloomedColor: '#ec4899',
  },

  // --- Category 2: Daily watering / Moderate attention ---
  {
    id: 'bonsai',
    name: 'Zen Bonsai',
    scientificName: 'Juniperus chinensis',
    category: 'moderate',
    icon: '🌳',
    tagline: 'Mastery through patience and care',
    description: 'An ancient sculpted miniature evergreen juniper requiring steady mindful pruning and daily attention to reach meditative harmony.',
    waterNeeds: 'Daily check, damp soil',
    sunlight: 'Gentle morning sun',
    potStyle: 'ceramic',
    primaryColor: '#16a34a',
    bloomedColor: '#ec4899',
  },
  {
    id: 'sunflower',
    name: 'Golden Sunflower',
    scientificName: 'Helianthus annuus',
    category: 'moderate',
    icon: '🌻',
    tagline: 'Cheerful tracker of golden light',
    description: 'A tall emerald stalk crowned with vibrant radiant yellow petals that follow the journey of your focused session from start to finish.',
    waterNeeds: 'Regular moderate watering',
    sunlight: 'Full direct sunlight',
    potStyle: 'terracotta',
    primaryColor: '#22c55e',
    bloomedColor: '#eab308',
  },
  {
    id: 'monstera',
    name: 'Monstera Deliciosa',
    scientificName: 'Monstera deliciosa',
    category: 'moderate',
    icon: '🌿',
    tagline: 'Iconic Swiss cheese tropical foliage',
    description: 'Broad dramatic heart leaves developing natural fenestrations as they mature. A vibrant powerhouse of creative visual inspiration.',
    waterNeeds: 'Weekly soak & leaf wipe',
    sunlight: 'Dappled medium light',
    potStyle: 'porcelain',
    primaryColor: '#166534',
    bloomedColor: '#22c55e',
  },
  {
    id: 'pothos',
    name: 'Golden Pothos',
    scientificName: 'Epipremnum aureum',
    category: 'moderate',
    icon: '🍃',
    tagline: 'Cascading vine of continuous flow',
    description: 'Graceful trailing vines with marbled gold-and-green heart foliage, spilling gently over balcony ledges as your session builds momentum.',
    waterNeeds: 'Moderate (when topsoil dries)',
    sunlight: 'Versatile low to medium',
    potStyle: 'bamboo',
    primaryColor: '#4ade80',
    bloomedColor: '#facc15',
  },
  {
    id: 'lavender',
    name: 'French Lavender',
    scientificName: 'Lavandula angustifolia',
    category: 'moderate',
    icon: '🪻',
    tagline: 'Aromatic purple sprigs of calm',
    description: 'Slender silver-green foliage producing intensely fragrant violet flower spikes that dispel anxiety and induce deep deep work.',
    waterNeeds: 'Well-drained daily rhythm',
    sunlight: 'Full airy sun',
    potStyle: 'terracotta',
    primaryColor: '#84cc16',
    bloomedColor: '#a855f7',
  },

  // --- Category 3: High water / High time investment ---
  {
    id: 'peace_lily',
    name: 'White Peace Lily',
    scientificName: 'Spathiphyllum wallisii',
    category: 'high_water',
    icon: '🪷',
    tagline: 'Graceful porcelain white bloom',
    description: 'Deep glossy emerald leaves that dramatically droop when thirsty and promptly spring back with pure white spathes upon receiving dedicated water.',
    waterNeeds: 'High (always moist & misted)',
    sunlight: 'Low-to-medium indirect',
    potStyle: 'porcelain',
    primaryColor: '#14532d',
    bloomedColor: '#f8fafc',
  },
  {
    id: 'orchid',
    name: 'Royal Orchid',
    scientificName: 'Phalaenopsis amabilis',
    category: 'high_water',
    icon: '🌸',
    tagline: 'Aristocratic exotic blossom',
    description: 'Delicate arching flower spike bearing exquisite butterfly-shaped petals. Requires specific humidity, orchid bark, and focused dedication.',
    waterNeeds: 'High precision hydration',
    sunlight: 'Filtered bright canopy',
    potStyle: 'porcelain',
    primaryColor: '#15803d',
    bloomedColor: '#f43f5e',
  },
  {
    id: 'fern',
    name: 'Boston Fern',
    scientificName: 'Nephrolepis exaltata',
    category: 'high_water',
    icon: '🌿',
    tagline: 'Feathery cloud of emerald fronds',
    description: 'Arching lush fronds with miniature delicate leaflets that thrive exclusively in high-humidity rainforest mist and relentless moisture.',
    waterNeeds: 'Frequent daily misting & soak',
    sunlight: 'Gentle shade & humidity',
    potStyle: 'bamboo',
    primaryColor: '#10b981',
    bloomedColor: '#34d399',
  },
  {
    id: 'venus_flytrap',
    name: 'Venus Flytrap',
    scientificName: 'Dionaea muscipula',
    category: 'high_water',
    icon: '🌱',
    tagline: 'Carnivorous marvel of the wetlands',
    description: 'Fascinating red-lined hinged snap traps bordered by hair-like trigger cilia. Demands mineral-free rainwater and constant boggy substrate.',
    waterNeeds: 'Constant bog-level moisture',
    sunlight: 'High direct outdoor sun',
    potStyle: 'stone',
    primaryColor: '#22c55e',
    bloomedColor: '#ef4444',
  },
];

/**
 * Three representative starter plants (one per category) shown at session start
 */
export const DEFAULT_STARTER_PLANT_IDS: [string, string, string] = [
  'cactus',     // Low water
  'bonsai',     // Moderate
  'peace_lily', // High water
];

export function getPlantById(id: string): PlantVariety {
  const found = PLANT_LIBRARY.find((p) => p.id === id);
  return found || PLANT_LIBRARY[0];
}

export function getPlantsByCategory(cat: PlantCategoryId): PlantVariety[] {
  return PLANT_LIBRARY.filter((p) => p.category === cat);
}
