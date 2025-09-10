import React, { useRef, useState, useEffect } from 'react';
import Globe from 'react-globe.gl';
import * as satellite from 'satellite.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Satellite, Globe as GlobeIcon, Activity, Clock, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SatelliteData {
  name: string;
  l1: string;
  l2: string;
  satrec: any;
}

interface TrackPoint {
  lat: number;
  lng: number;
  altKm: number;
  t: Date;
}

interface SatelliteTrack {
  name: string;
  points: TrackPoint[];
}

interface Conjunction {
  satA: string;
  satB: string;
  miss_km: number;
  tca: Date;
  sampleIndex: number;
}

const SatelliteDashboard = () => {
  const globeRef = useRef<any>();
  const { toast } = useToast();
  
  const [tleText, setTleText] = useState(`TIANMU-1 20
1 58661U 23208B   25252.28637402  .00007433  00000+0  28635-3 0  9992
2 58661  97.4279   4.0828 0007010 235.0082 125.0499 15.26617723 94470

ISS (ZARYA)
1 25544U 98067A   25252.50000000  .00002182  00000+0  40768-4 0  9990
2 25544  51.6461 339.7939 0001393  92.8340 267.3279 15.49309239426789`);
  
  const [sats, setSats] = useState<SatelliteData[]>([]);
  const [tracks, setTracks] = useState<SatelliteTrack[]>([]);
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  const [thresholdKm, setThresholdKm] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [sampleSec, setSampleSec] = useState(30);
  const [running, setRunning] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Parse TLE input into sets
  function parseTLEs(text: string) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const sets: { name: string; l1: string; l2: string }[] = [];
    
    for (let i = 0; i < lines.length;) {
      if ((lines[i].startsWith('1 ') || lines[i].startsWith('2 ')) && i + 1 < lines.length) {
        if (lines[i].startsWith('1 ') && lines[i+1].startsWith('2 ')) {
          sets.push({ name: 'Unknown Satellite', l1: lines[i], l2: lines[i+1] });
          i += 2; 
          continue;
        }
      }
      
      if (i + 2 < lines.length && lines[i+1].startsWith('1 ') && lines[i+2].startsWith('2 ')) {
        sets.push({ name: lines[i], l1: lines[i+1], l2: lines[i+2] });
        i += 3; 
        continue;
      }
      i += 1;
    }
    return sets;
  }

  function loadTLEs() {
    const sets = parseTLEs(tleText);
    const parsed = sets.map(s => {
      try {
        const satrec = satellite.twoline2satrec(s.l1, s.l2);
        return { ...s, satrec };
      } catch (e) {
        return null;
      }
    }).filter(Boolean) as SatelliteData[];
    
    setSats(parsed);
    setConjunctions([]);
    setTracks([]);
    setAlerts([]);
    
    toast({
      title: "TLEs Loaded",
      description: `Successfully loaded ${parsed.length} satellites`,
    });
  }

  // Propagate one satellite at a specific Date
  function propagateEci(satrec: any, when: Date) {
    try {
      const res = satellite.propagate(satrec, when);
      if (!res.position || typeof res.position === 'boolean') return null;
      return [res.position.x, res.position.y, res.position.z];
    } catch (e) { 
      return null; 
    }
  }

  // Compute tracks and conjunctions
  async function computeTracksAndConjunctions() {
    if (sats.length === 0) {
      toast({
        title: "No Satellites",
        description: "Please load TLE data first",
        variant: "destructive",
      });
      return;
    }
    
    setRunning(true);
    const now = new Date();
    const end = new Date(now.getTime() + windowMinutes * 60 * 1000);
    const samples = [];
    
    for (let t = now.getTime(); t <= end.getTime(); t += sampleSec * 1000) {
      samples.push(new Date(t));
    }

    // Compute per-satellite ECI vectors per sample
    const satSamples = sats.map(s => ({ 
      name: s.name, 
      satrec: s.satrec, 
      positions: [] as { t: Date; eci: number[] }[] 
    }));

    for (let si = 0; si < satSamples.length; si++) {
      const s = satSamples[si];
      for (let ti = 0; ti < samples.length; ti++) {
        const when = samples[ti];
        const eci = propagateEci(s.satrec, when);
        if (eci) s.positions.push({ t: when, eci });
      }
    }

    // Compute minimum distances pairwise
    const conjCandidates: Conjunction[] = [];
    for (let i = 0; i < satSamples.length; i++) {
      for (let j = i + 1; j < satSamples.length; j++) {
        let minD = Infinity, minTime: Date | null = null, minIdx = -1;
        const A = satSamples[i].positions;
        const B = satSamples[j].positions;
        const L = Math.min(A.length, B.length);
        
        for (let k = 0; k < L; k++) {
          const a = A[k].eci, b = B[k].eci;
          const dx = a[0]-b[0], dy = a[1]-b[1], dz = a[2]-b[2];
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (d < minD) { 
            minD = d; 
            minTime = A[k].t; 
            minIdx = k; 
          }
        }
        
        if (minD < thresholdKm && minTime) {
          conjCandidates.push({
            satA: sats[i].name || `SAT${i}`,
            satB: sats[j].name || `SAT${j}`,
            miss_km: minD,
            tca: minTime,
            sampleIndex: minIdx
          });
        }
      }
    }

    // Build tracks in lat/lng/alt for globe
    const tracksForGlobe = satSamples.map(s => {
      const points = s.positions.map(p => {
        const posEci = { x: p.eci[0], y: p.eci[1], z: p.eci[2] };
        const gmst = satellite.gstime(p.t);
        const geo = satellite.eciToGeodetic(posEci, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const altKm = geo.height;
        return { lat, lng: lon, altKm, t: p.t };
      });
      return { name: s.name, points };
    });

    setTracks(tracksForGlobe);
    setConjunctions(conjCandidates);
    
    if (conjCandidates.length > 0) {
      const alertMessages = conjCandidates.map(c => 
        `⚠️ Close approach: ${c.satA} & ${c.satB} - ${c.miss_km.toFixed(2)} km at ${c.tca.toLocaleString()}`
      );
      setAlerts(alertMessages);
      
      toast({
        title: "Conjunction Alert!",
        description: `Found ${conjCandidates.length} potential close approaches`,
        variant: "destructive",
      });
    } else {
      setAlerts(['✅ No close approaches detected within threshold']);
      toast({
        title: "Analysis Complete",
        description: "No conjunction threats detected",
      });
    }
    
    setRunning(false);
  }

  // Build globe visualization data
  const pointsData: any[] = [];
  const arcsData: any[] = [];

  // Add satellite tracks
  tracks.forEach((trk, idx) => {
    trk.points.forEach((p, i) => {
      pointsData.push({ 
        id: `${idx}-${i}`, 
        lat: p.lat, 
        lng: p.lng, 
        size: 0.8, 
        color: '#22c55e', 
        name: trk.name,
        altKm: p.altKm 
      });
    });
    
    // Create orbital track arcs
    for (let i = 0; i < Math.max(0, trk.points.length - 1); i++) {
      const a = trk.points[i], b = trk.points[i+1];
      arcsData.push({ 
        startLat: a.lat, 
        startLng: a.lng, 
        endLat: b.lat, 
        endLng: b.lng, 
        color: [['#22c55e', 0.6], ['#3b82f6', 0.8]],
        stroke: 1
      });
    }
  });

  // Add close approach markers
  conjunctions.forEach((c, idx) => {
    const satA = tracks.find(t => t.name === c.satA);
    const satB = tracks.find(t => t.name === c.satB);
    
    if (satA && satB) {
      const i = c.sampleIndex;
      const pa = satA.points[i];
      const pb = satB.points[i];
      
      if (pa) pointsData.push({ 
        id: `caA-${idx}`, 
        lat: pa.lat, 
        lng: pa.lng, 
        size: 3, 
        color: '#ef4444', 
        name: `${c.satA} @ TCA`,
        altKm: pa.altKm 
      });
      
      if (pb) pointsData.push({ 
        id: `caB-${idx}`, 
        lat: pb.lat, 
        lng: pb.lng, 
        size: 3, 
        color: '#f97316', 
        name: `${c.satB} @ TCA`,
        altKm: pb.altKm 
      });
      
      if (pa && pb) {
        arcsData.push({ 
          startLat: pa.lat, 
          startLng: pa.lng, 
          endLat: pb.lat, 
          endLng: pb.lng, 
          color: [['#ef4444', 1], ['#f97316', 1]], 
          stroke: 3 
        });
      }
    }
  });

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
  }, [globeRef.current]);

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-gradient-space">
      {/* Control Panel */}
      <div className="lg:w-96 w-full bg-card/90 backdrop-blur-sm border-r border-border p-6 overflow-auto shadow-shadow-deep">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Satellite className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SpaceTrack Dashboard</h1>
              <p className="text-sm text-muted-foreground">Satellite Tracking & Conjunction Analysis</p>
            </div>
          </div>

          {/* TLE Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <GlobeIcon className="w-4 h-4" />
                TLE Data Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea 
                value={tleText} 
                onChange={(e) => setTleText(e.target.value)}
                placeholder="Paste TLE data here..."
                className="h-32 font-mono text-xs bg-muted/50"
              />
              <div className="flex gap-2">
                <Button onClick={loadTLEs} variant="orbital" size="sm">
                  Load TLEs
                </Button>
                <Button 
                  onClick={computeTracksAndConjunctions} 
                  variant="satellite" 
                  size="sm"
                  disabled={running}
                >
                  {running ? 'Analyzing...' : 'Run Analysis'}
                </Button>
                <Button 
                  onClick={() => { 
                    setSats([]); setTracks([]); setConjunctions([]); setAlerts([]); 
                  }} 
                  variant="ghost" 
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Analysis Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="threshold" className="text-xs">Threshold Distance (km)</Label>
                <Input 
                  id="threshold"
                  type="number" 
                  value={thresholdKm} 
                  onChange={(e) => setThresholdKm(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="window" className="text-xs">Time Window (minutes)</Label>
                <Input 
                  id="window"
                  type="number" 
                  value={windowMinutes} 
                  onChange={(e) => setWindowMinutes(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="sample" className="text-xs">Sample Rate (seconds)</Label>
                <Input 
                  id="sample"
                  type="number" 
                  value={sampleSec} 
                  onChange={(e) => setSampleSec(Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Mission Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Satellites Loaded:</span>
                  <Badge variant="outline">{sats.length}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Active Tracks:</span>
                  <Badge variant="outline">{tracks.length}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Conjunctions:</span>
                  <Badge variant={conjunctions.length > 0 ? "destructive" : "outline"}>
                    {conjunctions.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <div key={i} className="text-xs p-2 bg-destructive/10 rounded border border-destructive/20">
                      {alert}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conjunctions Table */}
          {conjunctions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Close Approaches ({conjunctions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1">Satellite A</th>
                        <th className="text-left p-1">Satellite B</th>
                        <th className="text-right p-1">Miss (km)</th>
                        <th className="text-left p-1">TCA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conjunctions.map((c, idx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="p-1 font-mono">{c.satA}</td>
                          <td className="p-1 font-mono">{c.satB}</td>
                          <td className="p-1 text-right font-mono text-destructive">
                            {c.miss_km.toFixed(2)}
                          </td>
                          <td className="p-1 font-mono text-xs">
                            {new Date(c.tca).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border">
            <strong>Note:</strong> This visualization uses TLE+SGP4 for orbital propagation. 
            For operational collision avoidance, high-precision ephemeris and covariance data are required.
          </div>
        </div>
      </div>

      {/* Globe Visualization */}
      <div className="flex-1 relative overflow-hidden">
        <Globe
          ref={globeRef}
          globeImageUrl="/earth-texture.jpg"
          backgroundColor="rgba(0,0,0,0)"
          width={typeof window !== 'undefined' ? window.innerWidth : 800}
          height={typeof window !== 'undefined' ? window.innerHeight : 600}
          
          pointsData={pointsData}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lng}
          pointAltitude={(d: any) => (d.altKm ? d.altKm/6371 : 0.01)} // Relative to Earth radius
          pointRadius={(d: any) => d.size || 0.5}
          pointColor={(d: any) => d.color || '#22c55e'}
          
          arcsData={arcsData}
          arcStartLat={(d: any) => d.startLat}
          arcStartLng={(d: any) => d.startLng}
          arcEndLat={(d: any) => d.endLat}
          arcEndLng={(d: any) => d.endLng}
          arcColor={(d: any) => d.color || [['#22c55e', 0.6], ['#3b82f6', 0.8]]}
          arcStroke={(d: any) => d.stroke || 1}
          arcDashLength={0.5}
          arcDashGap={0.3}
          arcDashAnimateTime={2000}
          
          atmosphereColor="#3b82f6"
          atmosphereAltitude={0.15}
        />
        
        {/* Globe Controls Overlay */}
        <div className="absolute top-4 right-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>🖱️ Click & drag to rotate</div>
            <div>🔍 Scroll to zoom</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>Satellite tracks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span>Close approaches</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteDashboard;