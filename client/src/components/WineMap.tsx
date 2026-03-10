import React from 'react';
import { MapPin, Globe, Wine, Star } from 'lucide-react';
import WorldMap from './WorldMap';

interface WineScore {
  wineId: string;
  wineName: string;
  wineDescription: string;
  wineImageUrl: string;
  producer?: string;
  region?: string;
  vintage?: number;
  wineType?: string;
  grapeVarietals?: string[];
  alcoholContent?: string;
  scores: number[];
  averageScore: number;
  totalRatings: number;
  isFavorite: boolean;
}

interface WineMapProps {
  wines: WineScore[];
}

// Function to extract country from region (same as in WorldMap)
export const extractCountryFromRegion = (region: string): string | null => {
  const regionLower = region.toLowerCase();
  
  if (regionLower.includes('france') || regionLower.includes('bordeaux') || regionLower.includes('burgundy') || regionLower.includes('champagne')) {
    return 'France';
  }
  if (regionLower.includes('italy') || regionLower.includes('tuscany') || regionLower.includes('piedmont') || regionLower.includes('veneto') || regionLower.includes('sicily')) {
    return 'Italy';
  }
  if (regionLower.includes('spain') || regionLower.includes('rioja') || regionLower.includes('catalonia')) {
    return 'Spain';
  }
  if (regionLower.includes('germany') || regionLower.includes('mosel') || regionLower.includes('rheingau')) {
    return 'Germany';
  }
  if (regionLower.includes('napa') || regionLower.includes('california') || regionLower.includes('oregon') || regionLower.includes('washington')) {
    return 'United States';
  }
  if (regionLower.includes('australia') || regionLower.includes('barossa') || regionLower.includes('hunter valley')) {
    return 'Australia';
  }
  if (regionLower.includes('chile') || regionLower.includes('maipo') || regionLower.includes('casablanca')) {
    return 'Chile';
  }
  if (regionLower.includes('argentina') || regionLower.includes('mendoza')) {
    return 'Argentina';
  }
  if (regionLower.includes('south africa') || regionLower.includes('stellenbosch')) {
    return 'South Africa';
  }
  if (regionLower.includes('portugal') || regionLower.includes('douro') || regionLower.includes('alentejo')) {
    return 'Portugal';
  }
  if (regionLower.includes('new zealand') || regionLower.includes('marlborough')) {
    return 'New Zealand';
  }
  if (regionLower.includes('canada') || regionLower.includes('british columbia') || regionLower.includes('ontario')) {
    return 'Canada';
  }
  
  return null;
};

export default function WineMap({ wines }: WineMapProps) {
  // Count statistics
  const winesByCountry = wines.reduce((acc, wine) => {
    if (wine.region) {
      const country = extractCountryFromRegion(wine.region);
      if (country) {
        acc[country] = (acc[country] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueCountries = Object.keys(winesByCountry).length;
  const uniqueRegions = new Set(wines.map(wine => wine.region).filter(Boolean)).size;
  const totalWines = wines.length;
  const avgRating = wines.length > 0 ? wines.reduce((sum, wine) => sum + wine.averageScore, 0) / wines.length : 0;

  return (
    <div className="mt-8 p-6 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
      <div className="flex items-center space-x-3 mb-4">
        <Globe className="w-6 h-6 text-purple-300" />
        <h2 className="text-2xl font-bold text-white">
          Wine Origins Map
        </h2>
      </div>
      <p className="text-purple-200 mb-6">
        Explore the global origins of wines in your collection
      </p>
      
      <div className="mb-6">
        <WorldMap wines={wines} />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {/* <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-center mb-2">
            <MapPin className="w-5 h-5 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white">{uniqueRegions}</div>
          <div className="text-sm text-purple-200">Locations</div>
        </div> */}
        <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-center mb-2">
            <Globe className="w-5 h-5 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white">{uniqueCountries}</div>
          <div className="text-sm text-purple-200">Countries</div>
        </div>
        <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-center mb-2">
            <Wine className="w-5 h-5 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white">{totalWines}</div>
          <div className="text-sm text-purple-200">Total Wines</div>
        </div>
        <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-center mb-2">
            <Star className="w-5 h-5 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white">{avgRating.toFixed(1)}</div>
          <div className="text-sm text-purple-200">Avg Rating</div>
        </div>
      </div>
    </div>
  );
} 