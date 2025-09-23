import React, { useState, useEffect } from 'react';
import * as satellite from 'satellite.js';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Shield, Target, TrendingUp } from "lucide-react";

interface CollisionAnalysis {
  totalObjects: number;
  satelliteSatelliteRisks: number;
  satelliteDebrisRisks: number;
  meteorSatelliteRisks: number;
  meteorEarthRisks: number;
  debrisEarthReentryRisks: number;
  overallRiskScore: number;
  criticalAlerts: string[];
}

interface CollisionAnalyzerProps {
  satellites: any[];
  debris: any[];
  meteors: any[];
  collisionRisks: any[];
  impactRisks: any[];
}

const CollisionAnalyzer: React.FC<CollisionAnalyzerProps> = ({
  satellites,
  debris,
  meteors,
  collisionRisks,
  impactRisks
}) => {
  const [analysis, setAnalysis] = useState<CollisionAnalysis>({
    totalObjects: 0,
    satelliteSatelliteRisks: 0,
    satelliteDebrisRisks: 0,
    meteorSatelliteRisks: 0,
    meteorEarthRisks: 0,
    debrisEarthReentryRisks: 0,
    overallRiskScore: 0,
    criticalAlerts: []
  });

  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timeout | null>(null);

  // Comprehensive collision analysis
  const performCollisionAnalysis = () => {
    const totalObjects = satellites.length + debris.length + meteors.length;
    
    // Count different types of risks
    const satelliteSatelliteRisks = collisionRisks.filter(r => 
      r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL'
    ).length;
    
    const meteorSatelliteRisks = meteors.filter(m => 
      (m.satellite_collision_risk || 0) > 0.2
    ).length;
    
    const meteorEarthRisks = meteors.filter(m => 
      (m.impact_probability || 0) > 0.1
    ).length;
    
    const debrisEarthReentryRisks = debris.filter(d => 
      (d.earthImpactRisk || 0) > 0.3
    ).length;
    
    const satelliteDebrisRisks = collisionRisks.filter(r => 
      r.debris && (r.riskLevel === 'MEDIUM' || r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL')
    ).length;

    // Calculate overall risk score (0-100)
    let riskScore = 0;
    
    // Weight different risk factors
    riskScore += Math.min(satelliteSatelliteRisks * 5, 25); // Max 25 points
    riskScore += Math.min(satelliteDebrisRisks * 3, 20); // Max 20 points
    riskScore += Math.min(meteorSatelliteRisks * 8, 25); // Max 25 points
    riskScore += Math.min(meteorEarthRisks * 10, 20); // Max 20 points
    riskScore += Math.min(debrisEarthReentryRisks * 2, 10); // Max 10 points
    
    // Generate critical alerts
    const criticalAlerts: string[] = [];
    
    if (meteorEarthRisks > 0) {
      criticalAlerts.push(`${meteorEarthRisks} meteor(s) with Earth impact risk >10%`);
    }
    
    if (satelliteSatelliteRisks > 5) {
      criticalAlerts.push(`${satelliteSatelliteRisks} high-risk satellite conjunctions detected`);
    }
    
    if (meteorSatelliteRisks > 3) {
      criticalAlerts.push(`${meteorSatelliteRisks} meteors pose collision risk to satellites`);
    }
    
    if (debrisEarthReentryRisks > 10) {
      criticalAlerts.push(`${debrisEarthReentryRisks} debris objects at high reentry risk`);
    }
    
    // Check for cascade effect risk (Kessler Syndrome indicators)
    const highDensityRegions = calculateOrbitalDensity();
    if (highDensityRegions.LEO > 50) {
      criticalAlerts.push(`High debris density in LEO (${highDensityRegions.LEO} objects/region)`);
    }

    setAnalysis({
      totalObjects,
      satelliteSatelliteRisks,
      satelliteDebrisRisks,
      meteorSatelliteRisks,
      meteorEarthRisks,
      debrisEarthReentryRisks,
      overallRiskScore: Math.min(riskScore, 100),
      criticalAlerts
    });
  };

  // Calculate orbital density for Kessler Syndrome risk assessment
  const calculateOrbitalDensity = () => {
    const densityRegions = { LEO: 0, MEO: 0, GEO: 0 };
    
    // Count satellites by orbit
    satellites.forEach(sat => {
      if (sat.orbitType === 'LEO') densityRegions.LEO++;
      else if (sat.orbitType === 'MEO') densityRegions.MEO++;
      else if (sat.orbitType === 'GEO') densityRegions.GEO++;
    });
    
    // Add debris
    debris.forEach(d => {
      try {
        const now = new Date();
        const positionAndVelocity = satellite.propagate(d.satrec, now);
        
        if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
          const gmst = satellite.gstime(now);
          const positionEci = positionAndVelocity.position;
          const positionGd = satellite.eciToGeodetic(positionEci, gmst);
          const altitude = positionGd.height;
          
          if (altitude < 2000) densityRegions.LEO++;
          else if (altitude < 35000) densityRegions.MEO++;
          else densityRegions.GEO++;
        }
      } catch (e) {
        // Default to LEO for calculation
        densityRegions.LEO++;
      }
    });
    
    return densityRegions;
  };

  // Real-time risk assessment
  useEffect(() => {
    performCollisionAnalysis();
    
    // Update analysis every 30 seconds
    const interval = setInterval(performCollisionAnalysis, 30000);
    setUpdateInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [satellites, debris, meteors, collisionRisks, impactRisks]);

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  };

  const densityData = calculateOrbitalDensity();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Collision Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Risk Score */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Risk Level</span>
              <Badge variant="outline" className={getRiskColor(analysis.overallRiskScore)}>
                {getRiskLabel(analysis.overallRiskScore)}
              </Badge>
            </div>
            <Progress 
              value={analysis.overallRiskScore} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground text-right">
              {analysis.overallRiskScore.toFixed(1)}/100
            </div>
          </div>

          {/* Risk Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Sat-Sat Risks:</span>
                <Badge variant="outline">
                  {analysis.satelliteSatelliteRisks}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Sat-Debris:</span>
                <Badge variant="outline">
                  {analysis.satelliteDebrisRisks}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Meteor-Sat:</span>
                <Badge variant="outline">
                  {analysis.meteorSatelliteRisks}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Earth Impact:</span>
                <Badge variant="outline">
                  {analysis.meteorEarthRisks}
                </Badge>
              </div>
            </div>
          </div>

          {/* Orbital Density (Kessler Syndrome Risk) */}
          <div className="p-2 bg-muted/30 rounded text-xs">
            <div className="font-medium mb-2 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Orbital Density
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="font-mono text-sm">{densityData.LEO}</div>
                <div className="text-muted-foreground">LEO</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-sm">{densityData.MEO}</div>
                <div className="text-muted-foreground">MEO</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-sm">{densityData.GEO}</div>
                <div className="text-muted-foreground">GEO</div>
              </div>
            </div>
          </div>

          {/* Total Objects */}
          <div className="text-xs text-muted-foreground">
            Tracking {analysis.totalObjects} space objects
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {analysis.criticalAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Critical Alerts ({analysis.criticalAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.criticalAlerts.map((alert, idx) => (
                <div key={idx} className="text-xs p-2 bg-red-500/10 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{alert}</span>
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

export default CollisionAnalyzer;