import React, { useState, useEffect } from 'react';
import * as satellite from 'satellite.js';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Zap, Trash2 } from "lucide-react";

interface DebrisObject {
  name: string;
  l1: string;
  l2: string;
  satrec: any;
  category: 'FENGYUN' | 'COSMOS' | 'IRIDIUM' | 'OTHER';
  size?: string;
  earthImpactRisk?: number;
}

interface CollisionRisk {
  debris: string;
  satellite: string;
  probability: number;
  distance: number;
  timeToCA: Date;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SpaceDebrisTrackerProps {
  satellites: any[];
  onDebrisUpdate: (debris: DebrisObject[]) => void;
  onCollisionRisks: (risks: CollisionRisk[]) => void;
}

const SpaceDebrisTracker: React.FC<SpaceDebrisTrackerProps> = ({
  satellites,
  onDebrisUpdate,
  onCollisionRisks
}) => {
  const [debris, setDebris] = useState<DebrisObject[]>([]);
  const [collisionRisks, setCollisionRisks] = useState<CollisionRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch space debris data from Celestrak
  const fetchSpaceDebris = async () => {
    setLoading(true);
    try {
      const debrisCategories = [
        { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle', category: 'FENGYUN' as const },
        { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle', category: 'COSMOS' as const },
        { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle', category: 'IRIDIUM' as const }
      ];

      const allDebris: DebrisObject[] = [];

      for (const { url, category } of debrisCategories) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          
          const text = await response.text();
          const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
          
          for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 < lines.length && lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
              try {
                const satrec = satellite.twoline2satrec(lines[i + 1], lines[i + 2]);
                const earthRisk = calculateEarthImpactRisk(satrec);
                
                allDebris.push({
                  name: lines[i],
                  l1: lines[i + 1],
                  l2: lines[i + 2],
                  satrec,
                  category,
                  earthImpactRisk: earthRisk
                });
              } catch (e) {
                // Skip invalid TLE
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch ${category} debris:`, e);
        }
      }

      // Limit to 100 debris objects for performance
      const limitedDebris = allDebris.slice(0, 100);
      setDebris(limitedDebris);
      setLastUpdate(new Date());
      onDebrisUpdate(limitedDebris);

      // Calculate collision risks
      if (satellites.length > 0) {
        calculateCollisionRisks(limitedDebris, satellites);
      }

    } catch (error) {
      console.error('Error fetching space debris:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Earth impact risk based on orbital parameters
  const calculateEarthImpactRisk = (satrec: any): number => {
    try {
      const now = new Date();
      const positionAndVelocity = satellite.propagate(satrec, now);
      
      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const gmst = satellite.gstime(now);
        const positionEci = positionAndVelocity.position;
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);
        const altitude = positionGd.height;
        
        // Calculate risk based on altitude and eccentricity
        const eccentricity = satrec.ecco;
        const meanMotion = satrec.no;
        
        // Lower altitude = higher risk
        let riskScore = 0;
        if (altitude < 200) riskScore += 0.8;
        else if (altitude < 400) riskScore += 0.6;
        else if (altitude < 800) riskScore += 0.4;
        else if (altitude < 1500) riskScore += 0.2;
        
        // Higher eccentricity = more unpredictable orbit
        riskScore += eccentricity * 0.3;
        
        // Higher mean motion = more orbital decay potential
        riskScore += Math.min(meanMotion * 0.001, 0.2);
        
        return Math.min(riskScore, 1.0);
      }
    } catch (e) {
      // Default to medium risk for unparseable objects
      return 0.3;
    }
    return 0.1;
  };

  // Calculate collision risks between debris and satellites
  const calculateCollisionRisks = (debrisObjects: DebrisObject[], satelliteObjects: any[]) => {
    const risks: CollisionRisk[] = [];
    const now = new Date();
    const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours ahead

    debrisObjects.forEach(debris => {
      satelliteObjects.forEach(sat => {
        try {
          // Calculate positions at current time
          const debrisPos = satellite.propagate(debris.satrec, now);
          const satPos = satellite.propagate(sat.satrec, now);
          
          if (debrisPos.position && satPos.position && 
              typeof debrisPos.position !== 'boolean' && typeof satPos.position !== 'boolean') {
            
            const dx = debrisPos.position.x - satPos.position.x;
            const dy = debrisPos.position.y - satPos.position.y;
            const dz = debrisPos.position.z - satPos.position.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // Calculate relative velocity
            if (debrisPos.velocity && satPos.velocity &&
                typeof debrisPos.velocity !== 'boolean' && typeof satPos.velocity !== 'boolean') {
              
              const vx = debrisPos.velocity.x - satPos.velocity.x;
              const vy = debrisPos.velocity.y - satPos.velocity.y;
              const vz = debrisPos.velocity.z - satPos.velocity.z;
              const relativeVelocity = Math.sqrt(vx*vx + vy*vy + vz*vz);
              
              // Calculate collision probability based on distance, velocity, and time
              let probability = 0;
              if (distance < 50) { // Within 50km
                probability = Math.max(0, (50 - distance) / 50);
                probability *= Math.min(relativeVelocity / 10, 1); // Normalize velocity factor
                
                let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
                if (probability > 0.8) riskLevel = 'CRITICAL';
                else if (probability > 0.6) riskLevel = 'HIGH';
                else if (probability > 0.3) riskLevel = 'MEDIUM';
                
                if (probability > 0.1) { // Only include significant risks
                  risks.push({
                    debris: debris.name,
                    satellite: sat.name,
                    probability,
                    distance,
                    timeToCA: futureTime,
                    riskLevel
                  });
                }
              }
            }
          }
        } catch (e) {
          // Skip calculation errors
        }
      });
    });

    // Sort by probability and take top 20
    const topRisks = risks
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 20);
    
    setCollisionRisks(topRisks);
    onCollisionRisks(topRisks);
  };

  useEffect(() => {
    fetchSpaceDebris();
  }, []);

  useEffect(() => {
    if (debris.length > 0 && satellites.length > 0) {
      calculateCollisionRisks(debris, satellites);
    }
  }, [satellites, debris]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FENGYUN': return <Zap className="w-4 h-4" />;
      case 'COSMOS': return <Shield className="w-4 h-4" />;
      case 'IRIDIUM': return <Trash2 className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const categoryStats = {
    FENGYUN: debris.filter(d => d.category === 'FENGYUN').length,
    COSMOS: debris.filter(d => d.category === 'COSMOS').length,
    IRIDIUM: debris.filter(d => d.category === 'IRIDIUM').length,
    OTHER: debris.filter(d => d.category === 'OTHER').length
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Space Debris Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span>FENGYUN: {categoryStats.FENGYUN}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-red-500" />
              <span>COSMOS: {categoryStats.COSMOS}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trash2 className="w-3 h-3 text-blue-500" />
              <span>IRIDIUM: {categoryStats.IRIDIUM}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-gray-500" />
              <span>OTHER: {categoryStats.OTHER}</span>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Total Debris: {debris.length} | High Earth Impact Risk: {debris.filter(d => (d.earthImpactRisk || 0) > 0.6).length}
          </div>
          
          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last Updated: {lastUpdate.toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {collisionRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Collision Risks ({collisionRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {collisionRisks.slice(0, 5).map((risk, idx) => (
                <div key={idx} className="text-xs p-2 bg-muted rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{risk.debris}</span>
                    <Badge variant="outline" className={`text-white ${getRiskColor(risk.riskLevel)}`}>
                      {risk.riskLevel}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    vs {risk.satellite} • {risk.distance.toFixed(1)}km • {(risk.probability * 100).toFixed(1)}%
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

export default SpaceDebrisTracker;