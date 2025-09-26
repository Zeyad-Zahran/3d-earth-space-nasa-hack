import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpaceAIChat } from "@/components/SpaceAIChat";
import { Satellite, Radar, MessageCircle, BarChart3, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MobileData {
  satellites: {
    count: number;
    types: { LEO: number; MEO: number; GEO: number };
    active: number;
  };
  debris: {
    count: number;
    highRisk: number;
    trackable: number;
  };
  meteors: {
    count: number;
    approaching: number;
    potentiallyHazardous: number;
  };
  collisionRisks: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
  };
  conjunctions: {
    total: number;
    upcoming: number;
    withinDay: number;
  };
}

const Mobile = () => {
  const { toast } = useToast();
  const [data, setData] = useState<MobileData>({
    satellites: {
      count: 8420,
      types: { LEO: 5240, MEO: 1890, GEO: 1290 },
      active: 7650
    },
    debris: {
      count: 34000,
      highRisk: 2800,
      trackable: 28500
    },
    meteors: {
      count: 157,
      approaching: 12,
      potentiallyHazardous: 3
    },
    collisionRisks: {
      total: 847,
      critical: 15,
      high: 62,
      moderate: 770
    },
    conjunctions: {
      total: 234,
      upcoming: 45,
      withinDay: 8
    }
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
      toast({
        title: "Data Refreshed",
        description: "Space tracking data has been updated successfully.",
      });
    }, 1500);
  };

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate minor data updates
      setData(prev => ({
        ...prev,
        satellites: {
          ...prev.satellites,
          count: prev.satellites.count + Math.floor(Math.random() * 3) - 1
        },
        collisionRisks: {
          ...prev.collisionRisks,
          total: prev.collisionRisks.total + Math.floor(Math.random() * 5) - 2
        }
      }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ 
    icon: Icon, 
    title, 
    value, 
    subtitle, 
    variant = "default" 
  }: {
    icon: any;
    title: string;
    value: string | number;
    subtitle?: string;
    variant?: "default" | "critical" | "warning";
  }) => (
    <Card className="p-3 space-y-2 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${
          variant === "critical" ? "text-destructive" : 
          variant === "warning" ? "text-yellow-500" : 
          "text-primary"
        }`} />
        <Badge variant={
          variant === "critical" ? "destructive" : 
          variant === "warning" ? "secondary" : 
          "default"
        } className="text-xs">
          Live
        </Badge>
      </div>
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">{title}</h3>
        <p className="text-lg font-bold">{value.toLocaleString()}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <Satellite className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">TLE Mobile</h1>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs"
          >
            <Radar className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        {/* AI Chat - Primary Focus */}
        <Card className="bg-card/30 backdrop-blur-sm border-border/50">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Space AI Assistant</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask anything about space data, satellites, or collision risks
            </p>
          </div>
          <div className="p-2">
            <SpaceAIChat 
              satelliteData={[data.satellites]}
              debrisData={[data.debris]}
              meteorData={[data.meteors]}
              collisionRisks={[data.collisionRisks]}
              conjunctions={[data.conjunctions]}
            />
          </div>
        </Card>

        {/* Data Overview Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="risks" className="text-xs">Risks</TabsTrigger>
            <TabsTrigger value="tracking" className="text-xs">Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Satellite}
                title="Active Satellites"
                value={data.satellites.active}
                subtitle={`${data.satellites.count} total tracked`}
              />
              <StatCard
                icon={BarChart3}
                title="Space Debris"
                value={data.debris.trackable}
                subtitle={`${data.debris.count} total pieces`}
              />
              <StatCard
                icon={Radar}
                title="Near Objects"
                value={data.meteors.approaching}
                subtitle={`${data.meteors.count} monitored`}
              />
              <StatCard
                icon={Shield}
                title="Conjunctions"
                value={data.conjunctions.upcoming}
                subtitle="Next 24 hours"
              />
            </div>
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 gap-3">
              <StatCard
                icon={AlertTriangle}
                title="Critical Collision Risks"
                value={data.collisionRisks.critical}
                subtitle="Immediate attention required"
                variant="critical"
              />
              <StatCard
                icon={AlertTriangle}
                title="High Risk Events"
                value={data.collisionRisks.high}
                subtitle="Elevated monitoring"
                variant="warning"
              />
              <StatCard
                icon={Shield}
                title="Hazardous Asteroids"
                value={data.meteors.potentiallyHazardous}
                subtitle="PHAs being tracked"
                variant="warning"
              />
            </div>
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Satellite}
                title="LEO Satellites"
                value={data.satellites.types.LEO}
                subtitle="Low Earth Orbit"
              />
              <StatCard
                icon={Satellite}
                title="MEO Satellites"
                value={data.satellites.types.MEO}
                subtitle="Medium Earth Orbit"
              />
              <StatCard
                icon={Satellite}
                title="GEO Satellites"
                value={data.satellites.types.GEO}
                subtitle="Geostationary"
              />
              <StatCard
                icon={Radar}
                title="High Risk Debris"
                value={data.debris.highRisk}
                subtitle="Collision potential"
                variant="warning"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="p-4 bg-card/30 backdrop-blur-sm border-border/50">
          <h3 className="font-medium mb-3 text-sm">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              View Alerts
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              Analytics
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Mobile;