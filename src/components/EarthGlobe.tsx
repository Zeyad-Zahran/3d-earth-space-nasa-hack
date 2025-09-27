import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface EarthPoint {
  id: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
  name: string;
  altKm?: number;
}

interface EarthArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[][];
  stroke?: number;
}

interface EarthGlobeProps {
  pointsData: EarthPoint[];
  arcsData: EarthArc[];
  width?: number;
  height?: number;
}

const EarthGlobe: React.FC<EarthGlobeProps> = ({ 
  pointsData = [], 
  arcsData = [], 
  width = 800, 
  height = 600 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const earthRef = useRef<THREE.Mesh>();
  const pointsGroupRef = useRef<THREE.Group>();
  const arcsGroupRef = useRef<THREE.Group>();
  const controlsRef = useRef<{ 
    mouseDown: boolean; 
    mouseX: number; 
    mouseY: number; 
    targetRotationX: number; 
    targetRotationY: number; 
  }>();

  // Convert lat/lng to 3D coordinates
  const latLngToVector3 = (lat: number, lng: number, radius: number = 1, altitude: number = 0) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const r = radius + altitude;
    
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  };

  // Create curved path between two points
  const createArcCurve = (start: THREE.Vector3, end: THREE.Vector3, numPoints: number = 50, arcHeight: number = 0.3) => {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Create arc by interpolating and adding height
      const point = start.clone().lerp(end, t);
      const height = Math.sin(t * Math.PI) * arcHeight; // Variable arc height
      point.normalize().multiplyScalar(1 + height);
      points.push(point);
    }
    return points;
  };

  // Create animated trajectory path for meteors
  const createAnimatedTrajectory = (start: THREE.Vector3, end: THREE.Vector3, animationPhase: number = 0) => {
    const totalPoints = 100;
    const visiblePoints = Math.floor(totalPoints * 0.3); // Show 30% of the trajectory
    const startIndex = Math.floor((totalPoints - visiblePoints) * (animationPhase / 100));
    
    const points = [];
    for (let i = 0; i < totalPoints; i++) {
      const t = i / totalPoints;
      const point = start.clone().lerp(end, t);
      const height = Math.sin(t * Math.PI) * 0.4; // Higher arc for meteors
      point.normalize().multiplyScalar(1 + height);
      
      // Only include points in the visible range for animation effect
      if (i >= startIndex && i < startIndex + visiblePoints) {
        points.push(point);
      }
    }
    return points;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Earth sphere
    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('/earth-texture.jpg'),
      transparent: true,
      opacity: 0.9
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // Atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Groups for points and arcs
    const pointsGroup = new THREE.Group();
    const arcsGroup = new THREE.Group();
    scene.add(pointsGroup);
    scene.add(arcsGroup);

    // Camera position
    camera.position.set(0, 0, 3);

    // Mouse controls
    const controls = {
      mouseDown: false,
      mouseX: 0,
      mouseY: 0,
      targetRotationX: 0,
      targetRotationY: 0
    };

    const onMouseDown = (event: MouseEvent) => {
      controls.mouseDown = true;
      controls.mouseX = event.clientX;
      controls.mouseY = event.clientY;
    };

    const onMouseUp = () => {
      controls.mouseDown = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!controls.mouseDown) return;
      
      const deltaX = event.clientX - controls.mouseX;
      const deltaY = event.clientY - controls.mouseY;
      
      controls.targetRotationY += deltaX * 0.005;
      controls.targetRotationX += deltaY * 0.005;
      
      controls.mouseX = event.clientX;
      controls.mouseY = event.clientY;
    };

    const onWheel = (event: WheelEvent) => {
      camera.position.z += event.deltaY * 0.001;
      camera.position.z = Math.max(1.5, Math.min(5, camera.position.z));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Smooth rotation
      earth.rotation.y += (controls.targetRotationY - earth.rotation.y) * 0.1;
      earth.rotation.x += (controls.targetRotationX - earth.rotation.x) * 0.1;
      pointsGroup.rotation.copy(earth.rotation);
      arcsGroup.rotation.copy(earth.rotation);
      
      // Auto rotation when not interacting
      if (!controls.mouseDown) {
        earth.rotation.y += 0.001;
        pointsGroup.rotation.y += 0.001;
        arcsGroup.rotation.y += 0.001;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Store refs
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    earthRef.current = earth;
    pointsGroupRef.current = pointsGroup;
    arcsGroupRef.current = arcsGroup;
    controlsRef.current = controls;

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [width, height]);

  // Update points when data changes
  useEffect(() => {
    if (!pointsGroupRef.current) return;
    
    // Clear existing points
    pointsGroupRef.current.clear();
    
    pointsData.forEach(point => {
      const position = latLngToVector3(point.lat, point.lng, 1, (point.altKm || 0) * 0.0002);
      
      // Check if this is a meteor point
      const isMeteor = point.name?.includes('(NEO)') || point.id?.includes('meteor');
      const isCurrentMeteorPosition = point.name?.includes('Current');
      
      let pointSize = point.size * 0.01;
      let opacity = 0.8;
      
      // Enhanced visualization for meteors
      if (isMeteor) {
        pointSize *= 1.5; // Make meteors larger
        opacity = isCurrentMeteorPosition ? 1.0 : 0.7;
      }
      
      const geometry = new THREE.SphereGeometry(pointSize, 8, 8);
      const material = new THREE.MeshBasicMaterial({ 
        color: point.color,
        transparent: true,
        opacity: opacity
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);
      pointsGroupRef.current!.add(sphere);
      
      // Add pulsing effect for current meteor positions
      if (isCurrentMeteorPosition) {
        const pulseGeometry = new THREE.SphereGeometry(pointSize * 2, 8, 8);
        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: point.color,
          transparent: true,
          opacity: 0.3
        });
        const pulseRing = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulseRing.position.copy(position);
        pointsGroupRef.current!.add(pulseRing);
        
        // Animate the pulse effect
        const animate = () => {
          const scale = 1 + 0.3 * Math.sin(Date.now() * 0.003);
          pulseRing.scale.setScalar(scale);
          requestAnimationFrame(animate);
        };
        animate();
      }
    });
  }, [pointsData]);

  // Update arcs when data changes
  useEffect(() => {
    if (!arcsGroupRef.current) return;
    
    // Clear existing arcs
    arcsGroupRef.current.clear();
    
    arcsData.forEach(arc => {
      const startPos = latLngToVector3(arc.startLat, arc.startLng);
      const endPos = latLngToVector3(arc.endLat, arc.endLng);
      
      // Check if this is a meteor trajectory (has special properties)
      const isMeteorTrajectory = arc.color[0][0]?.includes('#') && (
        arc.color[0][0].includes('#dc2626') || // CRITICAL
        arc.color[0][0].includes('#ea580c') || // HIGH
        arc.color[0][0].includes('#d97706') || // MEDIUM
        arc.color[0][0].includes('#16a34a')    // LOW
      );
      
      let arcPoints;
      if (isMeteorTrajectory) {
        // Use animated trajectory for meteors
        arcPoints = createAnimatedTrajectory(startPos, endPos, Date.now() / 100 % 100);
      } else {
        // Use standard arc for satellites
        arcPoints = createArcCurve(startPos, endPos, 30, 0.3);
      }
      
      if (arcPoints.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        
        // Enhanced material with glow effect for meteors
        const material = new THREE.LineBasicMaterial({ 
          color: arc.color[0][0] || '#22c55e',
          transparent: true,
          opacity: isMeteorTrajectory ? 0.9 : 0.7,
          linewidth: arc.stroke || (isMeteorTrajectory ? 3 : 1)
        });
        
        const line = new THREE.Line(geometry, material);
        arcsGroupRef.current!.add(line);
        
        // Add glow effect for meteor trajectories
        if (isMeteorTrajectory) {
          const glowMaterial = new THREE.LineBasicMaterial({
            color: arc.color[0][0] || '#22c55e',
            transparent: true,
            opacity: 0.3,
            linewidth: (arc.stroke || 3) * 2
          });
          const glowLine = new THREE.Line(geometry.clone(), glowMaterial);
          arcsGroupRef.current!.add(glowLine);
        }
      }
    });
  }, [arcsData]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default EarthGlobe;