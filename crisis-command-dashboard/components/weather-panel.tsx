"use client";

import { useEffect, useState } from "react";
import { weatherAPI } from "@/lib/api";
import { Cloud, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";

export function WeatherPanel({ mapCenter }: { mapCenter?: { lat: number, lng: number } }) {
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!mapCenter) return;
    
    const fetchWeather = async () => {
      setLoading(true);
      try {
        const response = await weatherAPI.getCurrent(mapCenter.lat, mapCenter.lng);
        if (response.success) {
          setWeatherData(response.current_weather);
        }
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeather();
    
    // Auto refresh every 15 minutes
    const intervalId = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [mapCenter?.lat, mapCenter?.lng]);

  if (!weatherData && !loading) return null;

  return (
    <div className="absolute top-4 left-4 z-[400] bg-background/80 backdrop-blur-md border border-border/50 rounded-2xl p-3 shadow-lg flex items-center gap-4 text-sm transiton-all animate-in fade-in slide-in-from-top-4">
      {loading && !weatherData ? (
        <span className="text-muted-foreground animate-pulse text-xs px-2">Fetching local conditions...</span>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <span>{weatherData.temperature}°C</span>
          </div>
          <div className="w-px h-4 bg-border/50"></div>
          <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
            <Wind className="w-4 h-4 text-blue-400" />
            <span>{weatherData.windspeed} km/h</span>
          </div>
          {weatherData.windspeed > 30 && (
             <>
               <div className="w-px h-4 bg-border/50"></div>
               <div className="flex items-center gap-1.5 text-destructive font-bold text-xs bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                 <AlertTriangle className="w-3 h-3" />
                 High Winds Warning
               </div>
             </>
          )}
        </>
      )}
    </div>
  );
}
