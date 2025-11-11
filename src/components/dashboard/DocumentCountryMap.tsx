import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { MapPin, Plus, Minus, Maximize2 } from "lucide-react";
import worldMapData from "@/assets/world-countries-110m.json";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type CountryCounts = Record<string, number>;

// Country name to flag emoji mapping
const getCountryFlag = (countryName: string): string => {
  const flagMap: Record<string, string> = {
    "united states": "🇺🇸", "usa": "🇺🇸", "united states of america": "🇺🇸",
    "united kingdom": "🇬🇧", "uk": "🇬🇧",
    "canada": "🇨🇦",
    "australia": "🇦🇺",
    "germany": "🇩🇪",
    "france": "🇫🇷",
    "spain": "🇪🇸",
    "italy": "🇮🇹",
    "netherlands": "🇳🇱",
    "belgium": "🇧🇪",
    "sweden": "🇸🇪",
    "norway": "🇳🇴",
    "denmark": "🇩🇰",
    "finland": "🇫🇮",
    "poland": "🇵🇱",
    "portugal": "🇵🇹",
    "greece": "🇬🇷",
    "austria": "🇦🇹",
    "switzerland": "🇨🇭",
    "ireland": "🇮🇪",
    "india": "🇮🇳",
    "china": "🇨🇳",
    "japan": "🇯🇵",
    "south korea": "🇰🇷", "korea": "🇰🇷",
    "brazil": "🇧🇷",
    "mexico": "🇲🇽",
    "argentina": "🇦🇷",
    "chile": "🇨🇱",
    "south africa": "🇿🇦",
    "egypt": "🇪🇬",
    "nigeria": "🇳🇬",
    "kenya": "🇰🇪",
    "new zealand": "🇳🇿",
    "singapore": "🇸🇬",
    "malaysia": "🇲🇾",
    "thailand": "🇹🇭",
    "philippines": "🇵🇭",
    "indonesia": "🇮🇩",
    "vietnam": "🇻🇳",
    "pakistan": "🇵🇰",
    "bangladesh": "🇧🇩",
    "turkey": "🇹🇷",
    "israel": "🇮🇱",
    "saudi arabia": "🇸🇦",
    "united arab emirates": "🇦🇪", "uae": "🇦🇪",
    "russia": "🇷🇺",
    "ukraine": "🇺🇦",
  };
  return flagMap[countryName.toLowerCase()] || "🌍";
};

export function DocumentCountryMap() {
  const [counts, setCounts] = useState<CountryCounts>({});
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("document_tracker")
          .select("country, employee_id");
        if (error) throw error;
        
        // Count unique employees per country
        const employeesByCountry: Record<string, Set<string>> = {};
        (data || []).forEach((row: any) => {
          const country = (row?.country || "").trim();
          const employeeId = row?.employee_id;
          if (!country || !employeeId) return;
          
          const key = country.toLowerCase();
          if (!employeesByCountry[key]) {
            employeesByCountry[key] = new Set();
          }
          employeesByCountry[key].add(employeeId);
        });
        
        // Convert to counts
        const map: CountryCounts = {};
        Object.entries(employeesByCountry).forEach(([country, employeeSet]) => {
          map[country] = employeeSet.size;
        });
        
        setCounts(map);
      } catch (e) {
        console.error("Failed to load employee country distribution", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const max = useMemo(() => {
    return Object.values(counts).reduce((a, b) => Math.max(a, b), 0) || 0;
  }, [counts]);

  // Multi-color heatmap gradient: green → yellow → orange → red
  const getFill = (value: number) => {
    if (value <= 0) return "hsl(var(--muted) / 0.3)";
    const ratio = value / Math.max(1, max);
    
    // Very High (75-100%): Red
    if (ratio > 0.75) return "hsl(0, 75%, 55%)";
    // High (50-75%): Orange
    if (ratio > 0.5) return "hsl(30, 85%, 55%)";
    // Medium (25-50%): Yellow
    if (ratio > 0.25) return "hsl(43, 90%, 60%)";
    // Low (0-25%): Green
    return "hsl(142, 70%, 50%)";
  };

  const handleZoomIn = () => {
    if (zoom < 4) setZoom(zoom * 1.5);
  };

  const handleZoomOut = () => {
    if (zoom > 1) setZoom(zoom / 1.5);
  };

  const handleReset = () => {
    setZoom(1);
    setCenter([0, 20]);
  };

  const totalEmployees = useMemo(() => {
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }, [counts]);

  const topCountries = useMemo(() => {
    return Object.entries(counts)
      .map(([country, count]) => ({
        country: country.charAt(0).toUpperCase() + country.slice(1),
        count,
        percentage: totalEmployees > 0 ? ((count / totalEmployees) * 100).toFixed(1) : "0.0"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [counts, totalEmployees]);

  return (
    <div className="card-premium p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Employee Global Distribution</h3>
            <p className="text-sm text-muted-foreground">Based on document records</p>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Density:</span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: "hsl(0, 75%, 55%)" }} />
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: "hsl(30, 85%, 55%)" }} />
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: "hsl(43, 90%, 60%)" }} />
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: "hsl(142, 70%, 50%)" }} />
              <span className="text-muted-foreground">Very High</span>
            </div>
          </div>
        </div>
      </div>

      {/* World Map with Glassmorphism */}
      <div className="relative w-full aspect-[2/1] rounded-xl border overflow-hidden map-glass">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <Button
            size="icon"
            variant="secondary"
            onClick={handleZoomIn}
            className="glass h-8 w-8 shadow-lg hover:scale-110 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={handleZoomOut}
            className="glass h-8 w-8 shadow-lg hover:scale-110 transition-transform"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={handleReset}
            className="glass h-8 w-8 shadow-lg hover:scale-110 transition-transform"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : mapError ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Map temporarily unavailable</p>
            </div>
          </div>
        ) : (
          <ComposableMap 
            projection="geoMercator"
            projectionConfig={{ 
              scale: 100,
              center: [0, 0]
            }}
            width={800}
            height={400}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={(position) => setCenter(position.coordinates)}
            >
              <Geographies 
                geography={worldMapData}
                onError={(error) => {
                  console.error("Map loading error:", error);
                  setMapError(true);
                }}
              >
                {({ geographies }) => {
                  if (!mapLoaded) {
                    console.log("Map geographies loaded:", geographies.length);
                    setMapLoaded(true);
                  }
                  return geographies.map((geo) => {
                  const rawName =
                    (geo.properties?.name as string) ||
                    (geo.properties?.NAME as string) ||
                    (geo.properties?.NAME_LONG as string) ||
                    "";
                  const key = rawName.toLowerCase();
                  const value = counts[key] || 0;
                  const percentage = totalEmployees > 0 ? ((value / totalEmployees) * 100).toFixed(1) : "0.0";
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getFill(value)}
                      stroke="hsl(var(--border))"
                      strokeWidth={0.5}
                      style={{
                        default: { 
                          outline: "none",
                          transition: "all 0.3s ease-in-out",
                          opacity: 0.9
                        },
                        hover: { 
                          fill: value > 0 ? getFill(value) : "hsl(var(--muted) / 0.5)", 
                          outline: "none",
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 1.5,
                          cursor: value > 0 ? "pointer" : "default",
                          opacity: 1,
                          filter: "brightness(1.1)"
                        },
                        pressed: { 
                          fill: value > 0 ? getFill(value) : "hsl(var(--muted) / 0.5)", 
                          outline: "none",
                          opacity: 0.95
                        },
                      }}
                    >
                      <title>
                        {getCountryFlag(rawName)} {rawName}: {value} employees ({percentage}%)
                      </title>
                    </Geography>
                  );
                });
              }}
            </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        )}
      </div>

      {/* Top Countries Statistics */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Top Countries by Employees</h3>
          <span className="text-sm text-muted-foreground">Total: {totalEmployees} employees</span>
        </div>
        
        <div className="grid gap-3">
          {topCountries.map((item, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
            const ratio = item.count / Math.max(1, max);
            let barColor = "hsl(0, 75%, 55%)"; // Red (low ratio)
            if (ratio > 0.75) barColor = "hsl(142, 70%, 50%)"; // Green (very high)
            else if (ratio > 0.5) barColor = "hsl(43, 90%, 60%)"; // Yellow (high)
            else if (ratio > 0.25) barColor = "hsl(30, 85%, 55%)"; // Orange (medium)
            
            return (
              <div 
                key={item.country} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8">
                    {medal ? (
                      <span className="text-2xl group-hover:scale-110 transition-transform">{medal}</span>
                    ) : (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <span className="text-xl mr-2">{getCountryFlag(item.country)}</span>
                  <span className="font-medium">{item.country}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm font-medium">{item.count} employees</div>
                    <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                  </div>
                  <div className="w-24 h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out country-bar-gradient"
                      style={{ 
                        width: `${item.percentage}%`,
                        background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
