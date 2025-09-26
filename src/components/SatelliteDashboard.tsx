import React, { useRef, useState, useEffect } from 'react';
import * as satellite from 'satellite.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Satellite, Globe as GlobeIcon, Activity, Clock, MapPin, RefreshCw, Download, Shield, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import EarthGlobe from "./EarthGlobe";
import OrbitControlPanel from "./OrbitControlPanel";
import SpaceDebrisTracker from "./SpaceDebrisTracker";
import MeteorTracker from "./MeteorTracker";
import CollisionAnalyzer from "./CollisionAnalyzer";
import { SpaceAIChat } from "./SpaceAIChat";
interface SatelliteData {
  name: string;
  l1: string;
  l2: string;
  satrec: any;
  orbitType?: 'LEO' | 'MEO' | 'GEO';
  altKm?: number;
}
interface OrbitVisibility {
  LEO: boolean;
  MEO: boolean;
  GEO: boolean;
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
  const {
    toast
  } = useToast();
  const [tleText, setTleText] = useState('');
  const [sats, setSats] = useState<SatelliteData[]>([]);
  const [tracks, setTracks] = useState<SatelliteTrack[]>([]);
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([]);
  const [thresholdKm, setThresholdKm] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [sampleSec, setSampleSec] = useState(30);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [orbitVisibility, setOrbitVisibility] = useState<OrbitVisibility>({
    LEO: true,
    MEO: true,
    GEO: true
  });

  // New state for debris and meteors
  const [debris, setDebris] = useState<any[]>([]);
  const [meteors, setMeteors] = useState<any[]>([]);
  const [collisionRisks, setCollisionRisks] = useState<any[]>([]);
  const [impactRisks, setImpactRisks] = useState<any[]>([]);

  // Classify orbit type based on semi-major axis
  function classifyOrbitType(satrec: any): {
    orbitType: 'LEO' | 'MEO' | 'GEO';
    altKm: number;
  } {
    // Get current position to estimate altitude
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const gmst = satellite.gstime(now);
      const positionEci = positionAndVelocity.position;
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      const altKm = positionGd.height;
      if (altKm < 2000) {
        return {
          orbitType: 'LEO',
          altKm
        };
      } else if (altKm >= 2000 && altKm < 35000) {
        return {
          orbitType: 'MEO',
          altKm
        };
      } else {
        return {
          orbitType: 'GEO',
          altKm
        };
      }
    }

    // Fallback based on mean motion (approximate)
    const meanMotion = satrec.no; // rad/min
    const period = 2 * Math.PI / meanMotion; // minutes

    if (period < 200) {
      // ~LEO
      return {
        orbitType: 'LEO',
        altKm: 500
      };
    } else if (period < 1200) {
      // ~MEO
      return {
        orbitType: 'MEO',
        altKm: 20000
      };
    } else {
      // ~GEO
      return {
        orbitType: 'GEO',
        altKm: 35786
      };
    }
  }

  // Fetch satellites from Celestrak
  async function fetchSatellitesFromCelestrak() {
    setLoading(true);
    try {
      const response = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();

      // Parse Celestrak format: every 3 lines = one satellite (name + 2 TLE lines)
      const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const satellites = [];
      for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length && lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
          satellites.push({
            name: lines[i].trim(),
            l1: lines[i + 1].trim(),
            l2: lines[i + 2].trim()
          });
        }
      }

      // Convert to satellite records and limit to first 50 for performance
      const parsed = satellites.slice(0, 50).map(s => {
        try {
          const satrec = satellite.twoline2satrec(s.l1, s.l2);
          const {
            orbitType,
            altKm
          } = classifyOrbitType(satrec);
          return {
            name: s.name,
            l1: s.l1,
            l2: s.l2,
            satrec,
            orbitType,
            altKm
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean) as SatelliteData[];
      setSats(parsed);
      setTleText(satellites.slice(0, 50).map(s => `${s.name}\n${s.l1}\n${s.l2}`).join('\n\n'));
      setConjunctions([]);
      setTracks([]);
      setAlerts([]);
      setAutoLoaded(true);
      toast({
        title: "Satellites Loaded",
        description: `Successfully loaded ${parsed.length} satellites from Celestrak`
      });

      // Auto-run analysis after loading
      setTimeout(() => computeTracksAndConjunctions(), 500);
    } catch (error) {
      console.error('Error fetching satellites:', error);
      toast({
        title: "Error Loading Satellites",
        description: "Failed to fetch satellite data from Celestrak. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  // Parse TLE input into sets (for manual input)
  function parseTLEs(text: string) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const sets: {
      name: string;
      l1: string;
      l2: string;
    }[] = [];
    for (let i = 0; i < lines.length;) {
      if ((lines[i].startsWith('1 ') || lines[i].startsWith('2 ')) && i + 1 < lines.length) {
        if (lines[i].startsWith('1 ') && lines[i + 1].startsWith('2 ')) {
          sets.push({
            name: 'Unknown Satellite',
            l1: lines[i],
            l2: lines[i + 1]
          });
          i += 2;
          continue;
        }
      }
      if (i + 2 < lines.length && lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
        sets.push({
          name: lines[i],
          l1: lines[i + 1],
          l2: lines[i + 2]
        });
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
        const {
          orbitType,
          altKm
        } = classifyOrbitType(satrec);
        return {
          ...s,
          satrec,
          orbitType,
          altKm
        };
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
      description: `Successfully loaded ${parsed.length} satellites`
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
        variant: "destructive"
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
      positions: [] as {
        t: Date;
        eci: number[];
      }[]
    }));
    for (let si = 0; si < satSamples.length; si++) {
      const s = satSamples[si];
      for (let ti = 0; ti < samples.length; ti++) {
        const when = samples[ti];
        const eci = propagateEci(s.satrec, when);
        if (eci) s.positions.push({
          t: when,
          eci
        });
      }
    }

    // Compute minimum distances pairwise
    const conjCandidates: Conjunction[] = [];
    for (let i = 0; i < satSamples.length; i++) {
      for (let j = i + 1; j < satSamples.length; j++) {
        let minD = Infinity,
          minTime: Date | null = null,
          minIdx = -1;
        const A = satSamples[i].positions;
        const B = satSamples[j].positions;
        const L = Math.min(A.length, B.length);
        for (let k = 0; k < L; k++) {
          const a = A[k].eci,
            b = B[k].eci;
          const dx = a[0] - b[0],
            dy = a[1] - b[1],
            dz = a[2] - b[2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
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
        const posEci = {
          x: p.eci[0],
          y: p.eci[1],
          z: p.eci[2]
        };
        const gmst = satellite.gstime(p.t);
        const geo = satellite.eciToGeodetic(posEci, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const altKm = geo.height;
        return {
          lat,
          lng: lon,
          altKm,
          t: p.t
        };
      });
      return {
        name: s.name,
        points
      };
    });
    setTracks(tracksForGlobe);
    setConjunctions(conjCandidates);
    if (conjCandidates.length > 0) {
      const alertMessages = conjCandidates.map(c => `⚠️ Close approach: ${c.satA} & ${c.satB} - ${c.miss_km.toFixed(2)} km at ${c.tca.toLocaleString()}`);
      setAlerts(alertMessages);
      toast({
        title: "Conjunction Alert!",
        description: `Found ${conjCandidates.length} potential close approaches`,
        variant: "destructive"
      });
    } else {
      setAlerts(['✅ No close approaches detected within threshold']);
      toast({
        title: "Analysis Complete",
        description: "No conjunction threats detected"
      });
    }
    setRunning(false);
  }

  // Helper function to get orbit color
  const getOrbitColor = (orbitType?: 'LEO' | 'MEO' | 'GEO') => {
    switch (orbitType) {
      case 'LEO':
        return '#22c55e';
      // Green
      case 'MEO':
        return '#3b82f6';
      // Blue  
      case 'GEO':
        return '#a855f7';
      // Purple
      default:
        return '#6b7280';
      // Gray
    }
  };

  // Filter satellites based on orbit visibility
  const visibleSatellites = sats.filter(sat => sat.orbitType && orbitVisibility[sat.orbitType]);

  // Calculate orbit counts
  const orbitCounts = {
    LEO: sats.filter(s => s.orbitType === 'LEO').length,
    MEO: sats.filter(s => s.orbitType === 'MEO').length,
    GEO: sats.filter(s => s.orbitType === 'GEO').length
  };

  // Filter tracks based on visibility
  const visibleTracks = tracks.filter(track => {
    const sat = visibleSatellites.find(s => s.name === track.name);
    return sat && sat.orbitType && orbitVisibility[sat.orbitType];
  });

  // Build globe visualization data
  const pointsData: any[] = [];
  const arcsData: any[] = [];

  // Add satellite tracks (only visible ones)
  visibleTracks.forEach((trk, idx) => {
    const sat = visibleSatellites.find(s => s.name === trk.name);
    const orbitColor = getOrbitColor(sat?.orbitType);
    trk.points.forEach((p, i) => {
      pointsData.push({
        id: `sat-${idx}-${i}`,
        lat: p.lat,
        lng: p.lng,
        size: 0.8,
        color: orbitColor,
        name: trk.name,
        altKm: p.altKm,
        orbitType: sat?.orbitType
      });
    });

    // Create orbital track arcs
    for (let i = 0; i < Math.max(0, trk.points.length - 1); i++) {
      const a = trk.points[i],
        b = trk.points[i + 1];
      arcsData.push({
        startLat: a.lat,
        startLng: a.lng,
        endLat: b.lat,
        endLng: b.lng,
        color: [[orbitColor, 0.6], [orbitColor, 0.8]],
        stroke: 1
      });
    }
  });

  // Add space debris visualization
  debris.forEach((debrisItem, idx) => {
    try {
      const now = new Date();
      const positionAndVelocity = satellite.propagate(debrisItem.satrec, now);
      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const gmst = satellite.gstime(now);
        const positionEci = positionAndVelocity.position;
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);
        const lat = satellite.degreesLat(positionGd.latitude);
        const lng = satellite.degreesLong(positionGd.longitude);
        const altKm = positionGd.height;
        let debrisColor = '#6b7280'; // Default gray
        switch (debrisItem.category) {
          case 'FENGYUN':
            debrisColor = '#eab308';
            break;
          // Yellow
          case 'COSMOS':
            debrisColor = '#ef4444';
            break;
          // Red
          case 'IRIDIUM':
            debrisColor = '#3b82f6';
            break;
          // Blue
        }
        pointsData.push({
          id: `debris-${idx}`,
          lat,
          lng,
          size: 0.5,
          color: debrisColor,
          name: `${debrisItem.name} (Debris)`,
          altKm
        });
      }
    } catch (e) {
      // Skip invalid debris
    }
  });

  // Add meteor visualization (simplified position estimation)
  meteors.forEach((meteor, idx) => {
    // Simplified meteor visualization - place them at Earth's edge approaching
    const approachDate = new Date(meteor.close_approach_date);
    const now = new Date();
    const timeRatio = Math.max(0, Math.min(1, (approachDate.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000))); // 30 days max

    // Random position around Earth for demonstration
    const lat = (Math.random() - 0.5) * 180;
    const lng = (Math.random() - 0.5) * 360;
    const altKm = 500 + timeRatio * meteor.miss_distance * 149597871 * 0.001; // Simplified altitude

    let meteorColor = '#10b981'; // Green for safe
    if (meteor.hazardous) meteorColor = '#ef4444'; // Red for hazardous
    else if (meteor.impact_probability > 0.1) meteorColor = '#f59e0b'; // Yellow for risky

    pointsData.push({
      id: `meteor-${idx}`,
      lat,
      lng,
      size: Math.min(2, meteor.diameter_min * 10),
      // Scale size
      color: meteorColor,
      name: `${meteor.name} (NEO)`,
      altKm
    });
  });

  // Add close approach markers (only for visible satellites)
  conjunctions.forEach((c, idx) => {
    const satA = visibleTracks.find(t => t.name === c.satA);
    const satB = visibleTracks.find(t => t.name === c.satB);
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
    // Auto-load satellites from Celestrak on component mount
    if (!autoLoaded) {
      fetchSatellitesFromCelestrak();
    }
  }, [autoLoaded]);
  return <div className="h-screen flex flex-col lg:flex-row bg-gradient-space">
      {/* Control Panel */}
      <div className="lg:w-96 w-full bg-card/90 backdrop-blur-sm border-r border-border p-6 overflow-auto shadow-shadow-deep">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Satellite className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SpaceTrack Dashboard</h1>
                <p className="text-sm text-muted-foreground">Satellite Tracking & Conjunction Analysis</p>
              </div>
            </div>
            <Link to="/mobile">
              
            </Link>
          </div>

          {/* Satellite Data Source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4" />
                Satellite Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={fetchSatellitesFromCelestrak} variant="orbital" size="sm" disabled={loading} className="flex items-center gap-2">
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh from Celestrak'}
                </Button>
                <Button onClick={computeTracksAndConjunctions} variant="satellite" size="sm" disabled={running || sats.length === 0}>
                  {running ? 'Analyzing...' : 'Run Analysis'}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Auto-loading active satellites from Celestrak
              </div>
            </CardContent>
          </Card>

          {/* Manual TLE Input (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <GlobeIcon className="w-4 h-4" />
                Manual TLE Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={tleText} onChange={e => setTleText(e.target.value)} placeholder="Paste custom TLE data here (optional)..." className="h-24 font-mono text-xs bg-muted/50" />
              <div className="flex gap-2">
                <Button onClick={loadTLEs} variant="outline" size="sm">
                  Load Custom TLEs
                </Button>
                <Button onClick={() => {
                setSats([]);
                setTracks([]);
                setConjunctions([]);
                setAlerts([]);
                setTleText('');
                setAutoLoaded(false);
              }} variant="ghost" size="sm">
                  Clear All
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
                <Input id="threshold" type="number" value={thresholdKm} onChange={e => setThresholdKm(Number(e.target.value))} className="h-8" />
              </div>
              <div>
                <Label htmlFor="window" className="text-xs">Time Window (minutes)</Label>
                <Input id="window" type="number" value={windowMinutes} onChange={e => setWindowMinutes(Number(e.target.value))} className="h-8" />
              </div>
              <div>
                <Label htmlFor="sample" className="text-xs">Sample Rate (seconds)</Label>
                <Input id="sample" type="number" value={sampleSec} onChange={e => setSampleSec(Number(e.target.value))} className="h-8" />
              </div>
            </CardContent>
          </Card>

          {/* Orbit Control Panel */}
          <OrbitControlPanel orbitCounts={orbitCounts} orbitVisibility={orbitVisibility} onVisibilityChange={(orbitType, visible) => {
          setOrbitVisibility(prev => ({
            ...prev,
            [orbitType]: visible
          }));
        }} />

          {/* Space Debris & Meteor Tracking */}
          <SpaceDebrisTracker satellites={sats} onDebrisUpdate={setDebris} onCollisionRisks={setCollisionRisks} />
          
          <MeteorTracker satellites={sats} onMeteorUpdate={setMeteors} onImpactRisks={setImpactRisks} />

          {/* Collision Analysis */}
          <CollisionAnalyzer satellites={sats} debris={debris} meteors={meteors} collisionRisks={collisionRisks} impactRisks={impactRisks} />

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
                <div className="flex justify-between text-xs">
                  <span>Space Debris:</span>
                  <Badge variant="outline">{debris.length}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Near-Earth Objects:</span>
                  <Badge variant="outline">{meteors.length}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Collision Risks:</span>
                  <Badge variant={collisionRisks.length > 0 ? "destructive" : "outline"}>
                    {collisionRisks.length}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Impact Risks:</span>
                  <Badge variant={impactRisks.length > 0 ? "destructive" : "outline"}>
                    {impactRisks.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {alerts.length > 0 && <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.map((alert, i) => <div key={i} className="text-xs p-2 bg-destructive/10 rounded border border-destructive/20">
                      {alert}
                    </div>)}
                </div>
              </CardContent>
            </Card>}

          {/* Conjunctions Table */}
          {conjunctions.length > 0 && <Card>
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
                      {conjunctions.map((c, idx) => <tr key={idx} className="border-b border-border/50">
                          <td className="p-1 font-mono">{c.satA}</td>
                          <td className="p-1 font-mono">{c.satB}</td>
                          <td className="p-1 text-right font-mono text-destructive">
                            {c.miss_km.toFixed(2)}
                          </td>
                          <td className="p-1 font-mono text-xs">
                            {new Date(c.tca).toLocaleTimeString()}
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>}

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border">
            <strong>Note:</strong> This visualization uses TLE+SGP4 for orbital propagation. 
            For operational collision avoidance, high-precision ephemeris and covariance data are required.
          </div>
        </div>
      </div>

      {/* Globe Visualization */}
      <div className="flex-1 relative overflow-hidden">
        <EarthGlobe pointsData={pointsData} arcsData={arcsData} width={typeof window !== 'undefined' ? window.innerWidth - (window.innerWidth > 1024 ? 384 : 0) : 800} height={typeof window !== 'undefined' ? window.innerHeight : 600} />
        
        {/* Globe Controls Overlay */}
        <div className="absolute top-4 right-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>🖱️ Click & drag to rotate</div>
            <div>🔍 Scroll to zoom</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>Satellites</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span>Close approaches</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Space debris</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Near-Earth objects</span>
            </div>
          </div>
        </div>
      </div>
      
      <SpaceAIChat satelliteData={sats} debrisData={debris} meteorData={meteors} collisionRisks={collisionRisks} conjunctions={conjunctions} />
    </div>;
};
export default SatelliteDashboard;