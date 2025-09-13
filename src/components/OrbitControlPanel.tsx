import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Orbit } from "lucide-react";

interface OrbitCounts {
  LEO: number;
  MEO: number;
  GEO: number;
}

interface OrbitVisibility {
  LEO: boolean;
  MEO: boolean;
  GEO: boolean;
}

interface OrbitControlPanelProps {
  orbitCounts: OrbitCounts;
  orbitVisibility: OrbitVisibility;
  onVisibilityChange: (orbitType: keyof OrbitVisibility, visible: boolean) => void;
}

const OrbitControlPanel: React.FC<OrbitControlPanelProps> = ({
  orbitCounts,
  orbitVisibility,
  onVisibilityChange
}) => {
  const orbitTypes = [
    {
      key: 'LEO' as const,
      name: 'Low Earth Orbit',
      description: '< 2,000 km',
      color: 'text-green-500'
    },
    {
      key: 'MEO' as const,
      name: 'Medium Earth Orbit',
      description: '2,000 - 35,786 km',
      color: 'text-blue-500'
    },
    {
      key: 'GEO' as const,
      name: 'Geostationary Orbit',
      description: '~ 35,786 km',
      color: 'text-purple-500'
    }
  ];

  return (
    <Card className="transition-all duration-300 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Orbit className="w-4 h-4" />
          Orbit Visualization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {orbitTypes.map((orbit) => (
          <div 
            key={orbit.key}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-all duration-200"
          >
            <div className="flex items-center space-x-3">
              <Checkbox
                id={orbit.key}
                checked={orbitVisibility[orbit.key]}
                onCheckedChange={(checked) => 
                  onVisibilityChange(orbit.key, checked as boolean)
                }
                className="transition-all duration-200"
              />
              <div className="space-y-1">
                <label 
                  htmlFor={orbit.key}
                  className={`text-sm font-medium cursor-pointer ${orbit.color} transition-colors duration-200`}
                >
                  {orbit.name}
                </label>
                <p className="text-xs text-muted-foreground">
                  {orbit.description}
                </p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={`${orbitVisibility[orbit.key] ? 'opacity-100' : 'opacity-60'} transition-opacity duration-200`}
            >
              {orbitCounts[orbit.key]}
            </Badge>
          </div>
        ))}
        
        <div className="pt-2 text-xs text-muted-foreground border-t">
          Total satellites: {orbitCounts.LEO + orbitCounts.MEO + orbitCounts.GEO}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrbitControlPanel;