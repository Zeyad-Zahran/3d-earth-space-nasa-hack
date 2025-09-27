import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Target, TrendingUp, Calendar, MapPin, Activity } from "lucide-react";
import EarthGlobe from './EarthGlobe';

interface MeteorTrajectory {
  id: string;
  name: string;
  currentLat: number;
  currentLng: number;
  entryLat: number;
  entryLng: number;
  closestApproachLat: number;
  closestApproachLng: number;
  exitLat: number;
  exitLng: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  velocity: number; // km/s
  altitude: number; // km
  diameter: number; // km
  timeToClosestApproach: number; // hours
  probability: number; // impact probability
}

interface MeteorTrajectoryProps {
  meteors: any[];
}

const MeteorTrajectoryVisualization: React.FC<MeteorTrajectoryProps> = ({ meteors }) => {
  const [trajectories, setTrajectories] = useState<MeteorTrajectory[]>([]);
  const [selectedTrajectory, setSelectedTrajectory] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Generate realistic trajectory data for meteors
  const generateTrajectoryData = (meteorData: any[]): MeteorTrajectory[] => {
    return meteorData.slice(0, 5).map((meteor, index) => {
      // Generate realistic entry points (typically from space)
      const entryLat = -90 + Math.random() * 180;
      const entryLng = -180 + Math.random() * 360;
      
      // Closest approach point (usually different from entry)
      const approachLat = entryLat + (-20 + Math.random() * 40);
      const approachLng = entryLng + (-30 + Math.random() * 60);
      
      // Exit point (if meteor doesn't impact)
      const exitLat = approachLat + (-15 + Math.random() * 30);
      const exitLng = approachLng + (-25 + Math.random() * 50);
      
      // Current position (interpolated based on time)
      const progressFactor = Math.random(); // 0 to 1
      const currentLat = entryLat + (approachLat - entryLat) * progressFactor;
      const currentLng = entryLng + (approachLng - entryLng) * progressFactor;
      
      // Calculate time to closest approach
      const timeToApproach = Math.random() * 72; // 0-72 hours
      
      // Determine risk level based on meteor properties
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      const riskScore = (meteor.impact_probability || 0) * 100 + meteor.diameter_min * 10;
      
      if (riskScore > 80) riskLevel = 'CRITICAL';
      else if (riskScore > 50) riskLevel = 'HIGH';
      else if (riskScore > 20) riskLevel = 'MEDIUM';

      return {
        id: meteor.id || `traj-${index}`,
        name: meteor.name || `Meteor ${index + 1}`,
        currentLat,
        currentLng,
        entryLat,
        entryLng,
        closestApproachLat: approachLat,
        closestApproachLng: approachLng,
        exitLat,
        exitLng,
        riskLevel,
        velocity: meteor.relative_velocity || 20 + Math.random() * 30,
        altitude: 100 + Math.random() * 500, // 100-600 km altitude
        diameter: meteor.diameter_min || 0.1 + Math.random() * 2,
        timeToClosestApproach: timeToApproach,
        probability: meteor.impact_probability || Math.random() * 0.1
      };
    });
  };

  // Generate points and arcs data for the globe
  const getGlobeVisualizationData = () => {
    const points: any[] = [];
    const arcs: any[] = [];

    trajectories.forEach((trajectory, index) => {
      const colorMap = {
        CRITICAL: '#dc2626',
        HIGH: '#ea580c',
        MEDIUM: '#d97706',
        LOW: '#16a34a'
      };
      
      const color = colorMap[trajectory.riskLevel];
      
      // Add trajectory points
      points.push(
        // Current position (larger, pulsing)
        {
          id: `${trajectory.id}-current`,
          lat: trajectory.currentLat,
          lng: trajectory.currentLng,
          size: 8,
          color: color,
          name: `${trajectory.name} (Current)`,
          altKm: trajectory.altitude
        },
        // Entry point
        {
          id: `${trajectory.id}-entry`,
          lat: trajectory.entryLat,
          lng: trajectory.entryLng,
          size: 4,
          color: '#64748b',
          name: `${trajectory.name} Entry`,
          altKm: 0
        },
        // Closest approach
        {
          id: `${trajectory.id}-approach`,
          lat: trajectory.closestApproachLat,
          lng: trajectory.closestApproachLng,
          size: 6,
          color: color,
          name: `${trajectory.name} Closest Approach`,
          altKm: trajectory.altitude * 0.5
        },
        // Exit point
        {
          id: `${trajectory.id}-exit`,
          lat: trajectory.exitLat,
          lng: trajectory.exitLng,
          size: 3,
          color: '#6b7280',
          name: `${trajectory.name} Exit`,
          altKm: 0
        }
      );

      // Add trajectory arcs
      arcs.push(
        // Entry to approach
        {
          startLat: trajectory.entryLat,
          startLng: trajectory.entryLng,
          endLat: trajectory.closestApproachLat,
          endLng: trajectory.closestApproachLng,
          color: [[color]],
          stroke: trajectory.riskLevel === 'CRITICAL' ? 3 : 2
        },
        // Current to approach (predicted path)
        {
          startLat: trajectory.currentLat,
          startLng: trajectory.currentLng,
          endLat: trajectory.closestApproachLat,
          endLng: trajectory.closestApproachLng,
          color: [[color + '80']], // Semi-transparent
          stroke: 1
        },
        // Approach to exit
        {
          startLat: trajectory.closestApproachLat,
          startLng: trajectory.closestApproachLng,
          endLat: trajectory.exitLat,
          endLng: trajectory.exitLng,
          color: [['#6b7280']],
          stroke: 1
        }
      );
    });

    return { points, arcs };
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

  const formatTimeToApproach = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${Math.round(hours)} hours`;
    return `${Math.round(hours / 24)} days`;
  };

  useEffect(() => {
    if (meteors.length > 0) {
      const newTrajectories = generateTrajectoryData(meteors);
      setTrajectories(newTrajectories);
      if (!selectedTrajectory && newTrajectories.length > 0) {
        setSelectedTrajectory(newTrajectories[0].id);
      }
    }
  }, [meteors]);

  // Animation effect for trajectory movement
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 100);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const { points, arcs } = getGlobeVisualizationData();
  const selectedTraj = trajectories.find(t => t.id === selectedTrajectory);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            مسارات النيازك المتتبعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTrajectory || ''} onValueChange={setSelectedTrajectory}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 mb-4">
              {trajectories.slice(0, 5).map((traj) => (
                <TabsTrigger key={traj.id} value={traj.id} className="text-xs">
                  {traj.name.split(' ')[1] || 'N/A'}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Globe Visualization */}
              <div className="order-2 lg:order-1">
                <div className="border rounded-lg overflow-hidden bg-black/20">
                  <EarthGlobe 
                    pointsData={points} 
                    arcsData={arcs} 
                    width={400} 
                    height={300} 
                  />
                </div>
              </div>

              {/* Trajectory Details */}
              <div className="order-1 lg:order-2 space-y-4">
                {trajectories.map((trajectory) => (
                  <TabsContent key={trajectory.id} value={trajectory.id} className="mt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">{trajectory.name}</h3>
                        <Badge variant="outline" className={`text-white ${getRiskColor(trajectory.riskLevel)}`}>
                          {trajectory.riskLevel}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="text-muted-foreground">السرعة</div>
                            <div className="font-medium">{trajectory.velocity.toFixed(1)} km/s</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="text-muted-foreground">الارتفاع</div>
                            <div className="font-medium">{trajectory.altitude.toFixed(0)} km</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-orange-500" />
                          <div>
                            <div className="text-muted-foreground">القطر</div>
                            <div className="font-medium">{trajectory.diameter.toFixed(2)} km</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-500" />
                          <div>
                            <div className="text-muted-foreground">وقت الاقتراب</div>
                            <div className="font-medium">{formatTimeToApproach(trajectory.timeToClosestApproach)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">احتمالية التصادم</div>
                          <div className="font-medium text-red-500">
                            {(trajectory.probability * 100).toFixed(3)}%
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-muted-foreground">الموقع الحالي</div>
                          <div className="font-mono text-xs">
                            {trajectory.currentLat.toFixed(2)}°, {trajectory.currentLng.toFixed(2)}°
                          </div>
                        </div>

                        <div>
                          <div className="text-muted-foreground">نقطة الاقتراب الأقصى</div>
                          <div className="font-mono text-xs">
                            {trajectory.closestApproachLat.toFixed(2)}°, {trajectory.closestApproachLng.toFixed(2)}°
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </div>
            </div>
          </Tabs>

          {trajectories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مسارات نيازك للعرض</p>
              <p className="text-sm">انتظر تحميل بيانات النيازك...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trajectory Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">مفتاح الرموز</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>الموقع الحالي</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>نقطة الدخول</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>الاقتراب الأقصى</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span>نقطة الخروج</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="text-muted-foreground text-xs">
              المسارات الملونة تظهر طريق النيزك من الدخول إلى الخروج. الخطوط المتقطعة تظهر المسار المتوقع.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MeteorTrajectoryVisualization;