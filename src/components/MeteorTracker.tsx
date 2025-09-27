import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Target, Globe, AlertTriangle, RefreshCw } from "lucide-react";

interface NearEarthObject {
  id: string;
  name: string;
  diameter_min: number;
  diameter_max: number;
  close_approach_date: string;
  relative_velocity: number;
  miss_distance: number;
  hazardous: boolean;
  impact_probability?: number;
  satellite_collision_risk?: number;
}

interface ImpactRisk {
  object: string;
  earthProbability: number;
  satelliteProbability: number;
  impactDate: Date;
  impactEnergy: number; // in megatons TNT equivalent
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface MeteorTrackerProps {
  satellites: any[];
  onMeteorUpdate: (meteors: NearEarthObject[]) => void;
  onImpactRisks: (risks: ImpactRisk[]) => void;
}

const MeteorTracker: React.FC<MeteorTrackerProps> = ({
  satellites,
  onMeteorUpdate,
  onImpactRisks
}) => {
  const [meteors, setMeteors] = useState<NearEarthObject[]>([]);
  const [impactRisks, setImpactRisks] = useState<ImpactRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch Near-Earth Objects from NASA JPL API
  const fetchNearEarthObjects = async () => {
    setLoading(true);
    try {
      // Get close approaches in the next 60 days
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      
      const dateMin = now.toISOString().split('T')[0];
      const dateMax = futureDate.toISOString().split('T')[0];
      
      const apiUrl = `https://ssd-api.jpl.nasa.gov/cad.api?date-min=${dateMin}&date-max=${dateMax}&dist-max=0.2&sort=date&limit=50`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        const nearEarthObjects: NearEarthObject[] = data.data.map((item: any[], index: number) => {
          // NASA API returns arrays with specific indices
          const id = item[0] || `NEO-${index}`;
          const name = item[10] || `Unknown Object ${index}`;
          const closeApproachDate = item[3] || now.toISOString();
          const relativeVelocity = parseFloat(item[7]) || 0; // km/s
          const missDistance = parseFloat(item[4]) || 0; // AU
          const diameterMin = parseFloat(item[11]) || 0.1; // km
          const diameterMax = parseFloat(item[12]) || diameterMin * 2;
          
          // Calculate impact probabilities
          const earthProb = calculateEarthImpactProbability(missDistance, diameterMin, relativeVelocity);
          const satelliteRisk = calculateSatelliteCollisionRisk(missDistance, diameterMin, relativeVelocity);
          
          return {
            id,
            name,
            diameter_min: diameterMin,
            diameter_max: diameterMax,
            close_approach_date: closeApproachDate,
            relative_velocity: relativeVelocity,
            miss_distance: missDistance,
            hazardous: missDistance < 0.05 && diameterMin > 0.14, // NASA definition
            impact_probability: earthProb,
            satellite_collision_risk: satelliteRisk
          };
        });

        setMeteors(nearEarthObjects);
        setLastUpdate(new Date());
        onMeteorUpdate(nearEarthObjects);

        // Calculate impact risks
        calculateImpactRisks(nearEarthObjects);
      }
    } catch (error) {
      console.error('Error fetching NEO data:', error);
      // Fallback with simulated data for demonstration
      const mockMeteors = generateMockMeteorData();
      setMeteors(mockMeteors);
      onMeteorUpdate(mockMeteors);
      calculateImpactRisks(mockMeteors);
    } finally {
      setLoading(false);
    }
  };

  // Generate mock meteor data for demonstration
  const generateMockMeteorData = (): NearEarthObject[] => {
    const mockData: NearEarthObject[] = [];
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const missDistance = 0.01 + Math.random() * 0.15; // 0.01 to 0.16 AU
      const diameter = 0.05 + Math.random() * 2; // 50m to 2km
      const velocity = 10 + Math.random() * 30; // 10-40 km/s
      const approachDate = new Date(now.getTime() + Math.random() * 60 * 24 * 60 * 60 * 1000);
      
      mockData.push({
        id: `MOCK-NEO-${i + 1}`,
        name: `Asteroid ${2024000 + i}`,
        diameter_min: diameter,
        diameter_max: diameter * 1.5,
        close_approach_date: approachDate.toISOString(),
        relative_velocity: velocity,
        miss_distance: missDistance,
        hazardous: missDistance < 0.05 && diameter > 0.14,
        impact_probability: calculateEarthImpactProbability(missDistance, diameter, velocity),
        satellite_collision_risk: calculateSatelliteCollisionRisk(missDistance, diameter, velocity)
      });
    }
    return mockData;
  };

  // Calculate Earth impact probability based on miss distance and object characteristics
  const calculateEarthImpactProbability = (missDistanceAU: number, diameterKm: number, velocityKmS: number): number => {
    // Convert AU to km (1 AU ≈ 149.6 million km)
    const missDistanceKm = missDistanceAU * 149597871;
    const earthRadius = 6371; // km
    
    // Basic probability calculation
    // Objects passing within 10 Earth radii have higher impact probability
    const criticalDistance = earthRadius * 10;
    
    let probability = 0;
    
    if (missDistanceKm < criticalDistance) {
      // Inverse square relationship with distance
      probability = Math.max(0, 1 - (missDistanceKm / criticalDistance));
      
      // Larger objects have slightly higher probability due to gravitational focusing
      probability *= (1 + Math.log10(diameterKm + 0.1) * 0.1);
      
      // Higher velocity objects are harder to deflect
      probability *= (1 + velocityKmS / 100);
    }
    
    return Math.min(probability, 0.95); // Cap at 95%
  };

  // Calculate satellite collision risk
  const calculateSatelliteCollisionRisk = (missDistanceAU: number, diameterKm: number, velocityKmS: number): number => {
    const missDistanceKm = missDistanceAU * 149597871;
    const satelliteAltitude = 500; // Approximate LEO altitude
    const satelliteShellThickness = 1500; // LEO to MEO range
    
    // Risk exists if object passes through satellite orbital ranges
    if (missDistanceKm < 50000) { // Within 50,000 km of Earth
      let risk = 0.1; // Base risk
      
      // Higher risk for larger objects
      risk *= (1 + diameterKm);
      
      // Higher risk for faster objects
      risk *= (1 + velocityKmS / 50);
      
      // Distance factor
      risk *= Math.max(0, 1 - missDistanceKm / 50000);
      
      return Math.min(risk, 0.8);
    }
    
    return 0;
  };

  // Calculate comprehensive impact risks
  const calculateImpactRisks = (objects: NearEarthObject[]) => {
    const risks: ImpactRisk[] = objects
      .filter(obj => (obj.impact_probability || 0) > 0.01 || (obj.satellite_collision_risk || 0) > 0.1)
      .map(obj => {
        const earthProb = obj.impact_probability || 0;
        const satelliteProb = obj.satellite_collision_risk || 0;
        const impactDate = new Date(obj.close_approach_date);
        
        // Calculate impact energy (Kinetic energy = 1/2 * m * v^2)
        // Assume density of 2.5 g/cm³ for asteroid
        const volume = (4/3) * Math.PI * Math.pow((obj.diameter_min * 500), 3); // m³
        const mass = volume * 2500; // kg
        const velocityMS = obj.relative_velocity * 1000; // m/s
        const energyJoules = 0.5 * mass * velocityMS * velocityMS;
        const energyMegatons = energyJoules / (4.184e15); // Convert to megatons TNT
        
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        const maxProb = Math.max(earthProb, satelliteProb);
        
        if (maxProb > 0.6 || energyMegatons > 100) riskLevel = 'CRITICAL';
        else if (maxProb > 0.3 || energyMegatons > 10) riskLevel = 'HIGH';
        else if (maxProb > 0.1 || energyMegatons > 1) riskLevel = 'MEDIUM';
        
        return {
          object: obj.name,
          earthProbability: earthProb,
          satelliteProbability: satelliteProb,
          impactDate,
          impactEnergy: energyMegatons,
          riskLevel
        };
      })
      .sort((a, b) => Math.max(b.earthProbability, b.satelliteProbability) - Math.max(a.earthProbability, a.satelliteProbability))
      .slice(0, 10);

    setImpactRisks(risks);
    onImpactRisks(risks);
  };

  useEffect(() => {
    fetchNearEarthObjects();
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const hazardousCount = meteors.filter(m => m.hazardous).length;
  const highEarthRiskCount = meteors.filter(m => (m.impact_probability || 0) > 0.1).length;
  const highSatelliteRiskCount = meteors.filter(m => (m.satellite_collision_risk || 0) > 0.2).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Near-Earth Objects (NEO) - Live Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={fetchNearEarthObjects} 
              variant="outline" 
              size="sm"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh NEO Data'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>Hazardous: {hazardousCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3 text-blue-500" />
              <span>Total NEOs: {meteors.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3 text-orange-500" />
              <span>Earth Risk: {highEarthRiskCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-purple-500" />
              <span>Satellite Risk: {highSatelliteRiskCount}</span>
            </div>
          </div>
          
          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last Updated: {lastUpdate.toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {impactRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Impact Risks ({impactRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {impactRisks.slice(0, 5).map((risk, idx) => (
                <div key={idx} className="text-xs p-2 bg-muted rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{risk.object}</span>
                    <Badge variant="outline" className={`text-white ${getRiskColor(risk.riskLevel)}`}>
                      {risk.riskLevel}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground space-y-1">
                    <div>Earth Impact: {(risk.earthProbability * 100).toFixed(2)}%</div>
                    <div>Satellite Risk: {(risk.satelliteProbability * 100).toFixed(2)}%</div>
                    <div>Energy: {risk.impactEnergy.toFixed(1)} MT TNT</div>
                    <div>Date: {risk.impactDate.toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeteorTracker;