# SpaceTrack Dashboard

The SpaceTrack Dashboard is an interactive satellite tracking and collision analysis system built as a web application. Its main purpose is to allow users to visualize satellites orbiting the Earth in real time and to analyze possible close approaches between satellites or with space debris.

The system works by using TLE (Two-Line Element) data, which is the standard format for describing satellite orbits. This information is processed with the SGP4 algorithm to predict satellite positions at any given moment. The positions are then converted into geographic coordinates and displayed in a 3D view of Earth.

### Key Features
- **Satellite Tracking**: Load data for multiple satellites and see them moving in orbit around Earth.  
- **Collision Detection**: The system calculates distances between satellites to detect possible conjunctions and provides alerts when satellites come too close.  
- **3D Visualization**: Realistic Earth textures, orbital paths, and satellite points displayed in an interactive globe. Users can rotate, zoom, and view orbits from different perspectives.  
- **Mission Planning Support**: Look ahead in time to predict possible future risks, supporting operators and mission planners.  

### Technical Stack
- React + TypeScript  
- Vite as the build tool  
- Three.js for 3D graphics  
- satellite.js for orbital mechanics  
- Tailwind CSS and shadcn-ui for the interface  

### Limitations
The dashboard relies only on TLE data, which becomes less accurate after about two weeks, and collision detection is simplified to distance-based analysis rather than full probability modeling. Despite this, it provides a strong demonstration of how orbital mechanics and visualization can be combined into an accessible and educational web tool.

### Future Enhancements
- Automatic live updates from satellite databases  
- More advanced collision probability calculations  
- Collaborative features for mission teams  

---

**Project implemented by Zeyad Zahran**  
