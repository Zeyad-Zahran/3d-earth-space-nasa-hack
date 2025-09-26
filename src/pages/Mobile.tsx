import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpaceAIChat } from "@/components/SpaceAIChat";
import { Satellite, Radar, MessageCircle, BarChart3, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRealTimeSpaceData } from "@/hooks/useRealTimeSpaceData";


const Mobile = () => {
  const { toast } = useToast();
  const { data, loading, lastUpdate, refreshData } = useRealTimeSpaceData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      toast({
        title: "البيانات محدثة",
        description: "تم تحديث بيانات تتبع الفضاء بنجاح من المصادر الحقيقية.",
      });
    } catch (error) {
      toast({
        title: "خطأ في التحديث",
        description: "فشل في تحديث البيانات. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };


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
            disabled={refreshing || loading}
            className="text-xs"
          >
            <Radar className={`h-4 w-4 mr-1 ${refreshing || loading ? "animate-spin" : ""}`} />
            {refreshing || loading ? "تحديث..." : "تحديث"}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        {/* AI Chat - Primary Focus */}
        <Card className="bg-card/30 backdrop-blur-sm border-border/50">
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">مساعد الفضاء الذكي</h2>
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                بيانات حقيقية
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              اسأل أي شيء عن بيانات الفضاء والأقمار الصناعية ومخاطر التصادم
            </p>
            {lastUpdate && (
              <p className="text-xs text-muted-foreground mt-1">
                آخر تحديث: {lastUpdate.toLocaleString('ar')}
              </p>
            )}
          </div>
          <div className="p-2 max-h-80 overflow-hidden">
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