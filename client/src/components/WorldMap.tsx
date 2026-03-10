import React, { useRef, useState, useEffect } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';

const geoUrl = 'https://unpkg.com/world-atlas@2/countries-110m.json';

// Wine marker coordinates for countries (longitude, latitude)
const WINE_COORDINATES: Record<string, [number, number]> = {
  "France": [2.3522, 46.6034],
  "Italy": [12.5674, 41.8719],
  "Spain": [-3.7492, 40.4637],
  "Germany": [10.4515, 51.1657],
  "United States": [-95.7129, 37.0902],
  "Australia": [133.7751, -25.2744],
  "Chile": [-71.543, -35.6751],
  "Argentina": [-63.6167, -32.4228],
  "South Africa": [22.9375, -30.5595],
  "Portugal": [-8.2245, 39.3999],
  "New Zealand": [174.8857, -40.9006],
  "Canada": [-106.3468, 56.1304],
};

// Function to extract country from region
export const extractCountryFromRegion = (region: string): string | null => {
  const regionLower = region.toLowerCase();
  
  // Direct country matches
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

interface WorldMapProps {
  wines?: WineScore[];
}

const WorldMap: React.FC<WorldMapProps> = ({ wines = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 400 });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Responsive sizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setSize({
          width,
          height: width / 2, // Maintain 2:1 aspect ratio
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Group wines by country for markers
  const winesByCountry = wines.reduce((acc, wine) => {
    if (wine.region) {
      const country = extractCountryFromRegion(wine.region);
      if (country && WINE_COORDINATES[country]) {
        if (!acc[country]) {
          acc[country] = [];
        }
        acc[country].push(wine);
      }
    }
    return acc;
  }, {} as Record<string, WineScore[]>);

  const wineMarkers = Object.entries(winesByCountry).map(([country, countryWines]) => ({
    name: country,
    coordinates: WINE_COORDINATES[country] as [number, number],
    count: countryWines.length,
    wines: countryWines,
  }));

  const handleMarkerClick = (country: string) => {
    setSelectedCountry(country);
    setShowModal(true);
  };

  const selectedWines = selectedCountry ? winesByCountry[selectedCountry] || [] : [];

  return (
    <div className="mapContainer" ref={containerRef}>
      <ComposableMap
        width={800}
        height={400}
        style={{ width: '100%', height: 'auto' }}
        projectionConfig={{ 
          scale: 140,
          center: [0, 0]
        }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="1"
              floodColor="#8B5CF6"
              floodOpacity="0.3"
            />
          </filter>
        </defs>

        <ZoomableGroup>
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: any[] }) => {
              if (geographies.length === 0) {
                return null;
              }
              return geographies.map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(139, 92, 246, 0.1)"
                  stroke="rgba(139, 92, 246, 0.3)"
                  strokeWidth={0.5}
                  style={{
                    default: { 
                      fill: "rgba(139, 92, 246, 0.1)",
                      stroke: "rgba(139, 92, 246, 0.3)",
                      strokeWidth: 0.5,
                      outline: 'none' 
                    },
                    hover: { 
                      fill: "rgba(139, 92, 246, 0.15)",
                      stroke: "rgba(139, 92, 246, 0.5)",
                      strokeWidth: 0.5,
                      outline: 'none' 
                    },
                    pressed: { 
                      fill: "rgba(139, 92, 246, 0.2)",
                      stroke: "rgba(139, 92, 246, 0.4)",
                      outline: 'none' 
                    },
                  }}
                />
              ));
            }}
          </Geographies>

          {/* Wine markers */}
          {wineMarkers.map(({ name, coordinates, count }) => (
            <Marker key={name} coordinates={coordinates}>
              <g onClick={() => handleMarkerClick(name)} style={{ cursor: 'pointer' }}>
                <circle
                  r={Math.min(3 + count * 0.5, 8)}
                  fill="#8B5CF6"
                  stroke="#A855F7"
                  strokeWidth="2"
                  filter="url(#glow)"
                />
                {/* Pulsing ring animation */}
                <circle
                  r={Math.min(3 + count * 0.5, 8) + 2}
                  fill="none"
                  stroke="#A855F7"
                  strokeWidth="1"
                  opacity="0.6"
                >
                  <animate
                    attributeName="r"
                    values={`${Math.min(3 + count * 0.5, 8) + 2};${Math.min(3 + count * 0.5, 8) + 6};${Math.min(3 + count * 0.5, 8) + 2}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.2;0.6"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Wine Details Modal */}
      {showModal && selectedCountry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div 
            className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Wines from {selectedCountry}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-purple-300 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3">
              {selectedWines.map((wine) => (
                <div key={wine.wineId} className="bg-white/5 p-3 rounded border border-white/10">
                  <div className="font-semibold text-white">{wine.wineName}</div>
                  <div className="text-sm text-purple-200">
                    {wine.vintage && `${wine.vintage} • `}{wine.region}
                  </div>
                  <div className="text-sm text-yellow-400">
                    Rating: {wine.averageScore.toFixed(1)}
                  </div>
                  {wine.grapeVarietals && (
                    <div className="text-xs text-purple-300 mt-1">
                      {wine.grapeVarietals.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldMap; 