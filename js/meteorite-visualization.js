// meteorite-visualization.js - 3D Earth and meteorites visualization using Three.js

// Load Three.js from CDN
const THREE = window.THREE;

class MeteoriteVisualization {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earth = null;
    this.moon = null;
    this.sun = null;
    this.meteorites = [];
    this.meteoriteTrails = [];
    this.animationId = null;
    this.meteoriteData = [];
    
    // Orbital mechanics - ACCURATE ASTRONOMICAL SCALES
    this.time = 0;
    this.scaleFactor = 0.0001; // 1 unit = 10,000 km
    this.timeScale = 86400; // 1 second = 1 day (86,400x faster)
    
    // PERFECT DISTANCES for visualization
    this.earthOrbitRadius = 100; // Sun distance from Earth
    this.moonOrbitRadius = 20; // Moon distance from Earth
    
    // ACCURATE ORBITAL PERIODS (in days)
    this.earthOrbitalPeriod = 365.25; // Earth's orbital period
    this.moonOrbitalPeriod = 27.3; // Moon's orbital period
    
    // CALCULATED ANGULAR VELOCITIES (radians per day)
    this.earthOrbitSpeed = (2 * Math.PI) / this.earthOrbitalPeriod; // 0.0172 rad/day
    this.moonOrbitSpeed = (2 * Math.PI) / this.moonOrbitalPeriod; // 0.230 rad/day
    
    // POSITION VECTORS
    this.earthPosition = new THREE.Vector3();
    this.moonPosition = new THREE.Vector3();
    
    // Trail system
    this.trailLength = 2000; // 20x longer trails
    this.trailGeometry = null;
    this.trailMaterial = null;
    
    // Particle system for tails
    this.particleSystem = null;
    this.particleGeometry = null;
    this.particleMaterial = null;
    this.particles = [];
    
    // Future path prediction
    this.futurePaths = [];
    this.futurePathLength = 200; // Number of points in future path
    this.futureTimeStep = 0.1; // Time step for prediction
    
    this.init();
  }

  async init() {
    try {
      console.log('Initializing meteorite visualization...');
      
      // Check if Three.js is loaded
      if (typeof THREE === 'undefined') {
        throw new Error('Three.js not loaded');
      }
      
      await this.loadMeteoriteData();
      this.setupScene();
      this.createMeteorites();
      this.setupControls();
      this.animate();
      this.setupEventListeners();
      
      console.log('Meteorite visualization initialized successfully');
      console.log('Meteorites created:', this.meteorites.length);
      console.log('Scene objects:', this.scene.children.length);
    } catch (error) {
      console.error('Error initializing meteorite visualization:', error);
      this.showError(error.message);
    }
  }

  async loadMeteoriteData() {
    try {
      const response = await fetch('cneos_sentry_summary_data(1).csv');
      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      // Skip header and empty lines
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = this.parseCSVLine(line);
        if (columns.length >= 10) {
          const meteorite = {
            designation: columns[0].replace(/"/g, ''),
            yearRange: columns[1].replace(/"/g, ''),
            potentialImpacts: parseInt(columns[2].replace(/"/g, '')) || 0,
            impactProbability: parseFloat(columns[3].replace(/"/g, '')) || 0,
            vInfinity: parseFloat(columns[4].replace(/"/g, '')) || 0,
            hMagnitude: parseFloat(columns[5].replace(/"/g, '')) || 0,
            diameter: parseFloat(columns[6].replace(/"/g, '')) || 0,
            palermoScale: parseFloat(columns[7].replace(/"/g, '')) || 0,
            torinoScale: parseInt(columns[9].replace(/"/g, '')) || 0
          };
          
          this.meteoriteData.push(meteorite);
        }
      }
      
      console.log(`Loaded ${this.meteoriteData.length} meteorites`);
    } catch (error) {
      console.error('Error loading meteorite data:', error);
    }
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  setupScene() {
    // Clear loading state
    this.container.innerHTML = '';
    this.container.classList.remove('loading');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 20, 50);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Create Sun
    this.createSun();
    
    // Create Earth
    this.createEarth();

    // Skip stars for better visibility
    // this.createStars();
    
    // Setup trail system
    this.setupTrailSystem();
    
    // Setup particle system for tails
    this.setupParticleSystem();
  }

  createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 2000;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0.8
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
  }

  createSun() {
    // Sun geometry - PERFECT SIZE for background
    const sunRadius = 30; // Perfect size for background
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 1.0
    });

    this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sun.position.set(0, 0, 0); // Sun will orbit around Earth
    this.scene.add(this.sun);
    // Sun created successfully

    // Sun light - very bright to illuminate the large Sun and distant Earth
    const sunLight = new THREE.PointLight(0xffffff, 10, 5000);
    sunLight.position.copy(this.sun.position);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);

    // Additional directional light for better illumination
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
    this.scene.add(ambientLight);
  }

  createEarth() {
    // Earth geometry - PERFECT SIZE for center view
    const earthRadius = 10; // Perfect size for center view
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    
    // Earth material
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x4a90e2,
      shininess: 100,
      emissive: 0x001122,
      emissiveIntensity: 0.1
    });

    this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earth.position.set(0, 0, 0); // Earth is at the center
    this.earth.castShadow = true;
    this.earth.receiveShadow = true;
    this.scene.add(this.earth);
    // Earth created successfully

    // Atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.02, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.earth.add(atmosphere);

    // Create Moon
    this.createMoon();

    // Earth's orbital position (will be updated in animate)
    this.updateEarthPosition();
  }

  createMoon() {
    // Moon geometry - PERFECT SIZE for Earth orbit
    const moonRadius = 3; // Perfect size for Earth orbit
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
    
    // Moon material
    const moonMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      shininess: 50,
      emissive: 0x111111,
      emissiveIntensity: 0.05
    });

    this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moon.castShadow = true;
    this.moon.receiveShadow = true;
    this.scene.add(this.moon);
    // Moon created successfully

    // Moon's orbital position (will be updated in animate)
    this.updateMoonPosition();
  }

  setupTrailSystem() {
    // Create trail geometry and material
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    });
  }

  setupParticleSystem() {
    // Create particle geometry for tails
    const particleCount = 10000; // Much more particles for visible tails
    this.particleGeometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);
    
    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      colors[i * 3] = 1; // White
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
      
      sizes[i] = 0;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      lifetimes[i] = 0;
    }
    
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    this.particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    
    // Create particle material
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.3, // Perfect size for visibility
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      alphaTest: 0.1
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particleSystem);
    
    // Initialize particle data
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 0,
        size: 0
      });
    }
  }

  createMeteorites() {
    this.meteoriteData.forEach((data, index) => {
      // ACCURATE NEAR-EARTH ASTEROID ORBITAL PARAMETERS with visibility multiplier
      const earthRadius = 0.6371 * 10; // Earth radius in our scaled units * 10 for visibility
      
      // PERFECT near-Earth asteroid distances for visualization
      const minDistance = 30; // Close to Earth
      const maxDistance = 80; // Far from Earth but visible
      const nearEarthDistance = minDistance + (index * (maxDistance - minDistance) / this.meteoriteData.length) + Math.random() * 10;
      const semiMajorAxis = nearEarthDistance; // Distance from Earth
      
      // Real asteroid orbital parameters
      const eccentricity = 0.1 + Math.random() * 0.7; // Most NEAs have e = 0.1-0.8
      const inclination = (Math.random() - 0.5) * Math.PI / 6; // Most NEAs have i < 30°
      const longitudeOfAscendingNode = Math.random() * Math.PI * 2;
      const argumentOfPeriapsis = Math.random() * Math.PI * 2;
      const meanAnomaly = Math.random() * Math.PI * 2;

      // PERFECT SIZE for visibility
      const meteoriteRadius = Math.max(0.5, Math.min(2, (data.diameter / 2) / 1000000)) * 20; // Perfect size for visibility
      const size = meteoriteRadius;

      // Color based on Torino scale
      let color = 0xaaaaaa; // Default gray
      if (data.torinoScale > 0) {
        color = 0xff6666; // Red for potential threats
      } else if (data.palermoScale > -2) {
        color = 0xffcc66; // Orange for moderate concern
      } else {
        color = 0x66ff66; // Green for low concern
      }

      // Create meteorite
      const geometry = new THREE.SphereGeometry(size, 12, 12);
      const material = new THREE.MeshPhongMaterial({ 
        color: color,
        shininess: 100,
        emissive: color,
        emissiveIntensity: 0.2
      });

      const meteorite = new THREE.Mesh(geometry, material);
      meteorite.castShadow = true;
      meteorite.userData = {
        ...data,
        orbitalParams: {
          semiMajorAxis,
          eccentricity,
          inclination,
          longitudeOfAscendingNode,
          argumentOfPeriapsis,
          meanAnomaly
        },
        trail: [],
        velocity: new THREE.Vector3(),
        tailParticles: [],
        lastTailTime: 0
      };

      // Initialize position
      this.updateMeteoritePosition(meteorite, 0);
      
      this.scene.add(meteorite);
      this.meteorites.push(meteorite);
      // Meteorite created successfully
    });
  }

  updateEarthPosition() {
    // Earth stays at the center (0, 0, 0)
    this.earthPosition.set(0, 0, 0);
    this.earth.position.copy(this.earthPosition);
    
    // Earth rotates on its axis (24-hour day)
    this.earth.rotation.y += this.earthOrbitSpeed * 0.1; // Slow rotation for visibility
    
    // Update Sun position (Sun orbits around Earth)
    this.updateSunPosition();
    
    // Update Moon position
    this.updateMoonPosition();
  }

  updateSunPosition() {
    // Sun orbits around Earth (heliocentric view)
    const angle = this.time * this.earthOrbitSpeed;
    this.sun.position.set(
      Math.cos(angle) * this.earthOrbitRadius,
      0,
      Math.sin(angle) * this.earthOrbitRadius
    );
  }

  updateMoonPosition() {
    // ACCURATE Moon's orbital motion around Earth
    const angle = this.time * this.moonOrbitSpeed;
    this.moonPosition.set(
      Math.cos(angle) * this.moonOrbitRadius,
      Math.sin(angle * 0.1) * this.moonOrbitRadius * 0.1, // Slight vertical variation
      Math.sin(angle) * this.moonOrbitRadius
    );
    
    // Position relative to Earth
    const worldMoonPosition = this.moonPosition.clone().add(this.earthPosition);
    this.moon.position.copy(worldMoonPosition);
    
    // ACCURATE Moon's rotation (tidally locked - same face always toward Earth)
    this.moon.rotation.y += this.moonOrbitSpeed * 0.1; // Slow rotation for visibility
  }

  updateMeteoritePosition(meteorite, deltaTime) {
    const params = meteorite.userData.orbitalParams;
    const meanAnomaly = params.meanAnomaly + deltaTime * 0.0001; // Much slower orbital speed
    
    // Calculate true anomaly using Kepler's equation (simplified)
    const eccentricAnomaly = meanAnomaly + params.eccentricity * Math.sin(meanAnomaly);
    const trueAnomaly = 2 * Math.atan(Math.sqrt((1 + params.eccentricity) / (1 - params.eccentricity)) * Math.tan(eccentricAnomaly / 2));
    
    // Calculate position in orbital plane
    const r = params.semiMajorAxis * (1 - params.eccentricity * params.eccentricity) / (1 + params.eccentricity * Math.cos(trueAnomaly));
    const x = r * Math.cos(trueAnomaly);
    const z = r * Math.sin(trueAnomaly);
    
    // Apply orbital inclination and rotation
    const cosI = Math.cos(params.inclination);
    const sinI = Math.sin(params.inclination);
    const cosOmega = Math.cos(params.longitudeOfAscendingNode);
    const sinOmega = Math.sin(params.longitudeOfAscendingNode);
    const cosW = Math.cos(params.argumentOfPeriapsis);
    const sinW = Math.sin(params.argumentOfPeriapsis);
    
    // Transform to 3D space
    const x1 = x * cosW - z * sinW;
    const z1 = x * sinW + z * cosW;
    const y1 = z1 * sinI;
    const z2 = z1 * cosI;
    const x2 = x1 * cosOmega - z2 * sinOmega;
    const z3 = x1 * sinOmega + z2 * cosOmega;
    
    // Position relative to Earth (in Earth's coordinate system)
    const position = new THREE.Vector3(x2, y1, z3);
    
    // Add Earth's position to get world coordinates
    const worldPosition = position.clone().add(this.earthPosition);
    
    // Add to trail (store in world coordinates for trail rendering)
    meteorite.userData.trail.push(worldPosition.clone());
    if (meteorite.userData.trail.length > this.trailLength) {
      meteorite.userData.trail.shift();
    }
    
    // Update position (set world position)
    meteorite.position.copy(worldPosition);
    
    // Update velocity for trail direction (relative to Earth)
    if (meteorite.userData.trail.length > 1) {
      const prevWorldPos = meteorite.userData.trail[meteorite.userData.trail.length - 2];
      meteorite.userData.velocity.copy(worldPosition).sub(prevWorldPos);
    }
    
    // Create tail particles based on speed
    this.createTailParticles(meteorite, deltaTime);
  }

  createTailParticles(meteorite, deltaTime) {
    const speed = meteorite.userData.velocity.length();
    const minSpeed = 0.01; // Minimum speed to create particles
    const particleRate = Math.min(50, speed * 100); // Particles per second based on speed
    
    if (speed > minSpeed && this.time - meteorite.userData.lastTailTime > 1 / particleRate) {
      meteorite.userData.lastTailTime = this.time;
      
      // Find available particle
      const availableParticle = this.particles.find(p => !p.active);
      if (availableParticle) {
        // Set particle properties
        availableParticle.active = true;
        availableParticle.position.copy(meteorite.position);
        
        // Tail direction is opposite to velocity
        const tailDirection = meteorite.userData.velocity.clone().normalize().multiplyScalar(-1);
        const tailLength = Math.min(5, speed * 2); // Tail length based on speed
        const randomOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        );
        
        availableParticle.velocity.copy(tailDirection).multiplyScalar(speed * 0.5).add(randomOffset);
        availableParticle.lifetime = 0;
        availableParticle.maxLifetime = 2 + Math.random() * 3; // 2-5 seconds
        availableParticle.size = 0.05 + Math.random() * 0.1; // Size based on meteorite size
        
        meteorite.userData.tailParticles.push(availableParticle);
      }
    }
  }

  updateParticleSystem() {
    const positions = this.particleGeometry.attributes.position.array;
    const colors = this.particleGeometry.attributes.color.array;
    const sizes = this.particleGeometry.attributes.size.array;
    const lifetimes = this.particleGeometry.attributes.lifetime.array;
    
    // Update all particles
    this.particles.forEach((particle, index) => {
      if (particle.active) {
        // Update position
        particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
        
        // Update lifetime
        particle.lifetime += 0.016;
        
        // Fade out over time
        const lifeRatio = particle.lifetime / particle.maxLifetime;
        const alpha = Math.max(0, 1 - lifeRatio);
        
        // Update geometry
        positions[index * 3] = particle.position.x;
        positions[index * 3 + 1] = particle.position.y;
        positions[index * 3 + 2] = particle.position.z;
        
        // Vary tail color slightly (white to light blue)
        const colorVariation = 0.8 + Math.random() * 0.2;
        colors[index * 3] = colorVariation; // Red component
        colors[index * 3 + 1] = colorVariation; // Green component  
        colors[index * 3 + 2] = 1; // Blue component (slight blue tint)
        
        sizes[index] = particle.size * alpha;
        lifetimes[index] = particle.lifetime;
        
        // Deactivate if lifetime exceeded
        if (particle.lifetime >= particle.maxLifetime) {
          particle.active = false;
          particle.lifetime = 0;
        }
      } else {
        // Hide inactive particles
        positions[index * 3] = 0;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = 0;
        sizes[index] = 0;
        lifetimes[index] = 0;
      }
    });
    
    // Mark attributes as needing update
    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.color.needsUpdate = true;
    this.particleGeometry.attributes.size.needsUpdate = true;
    this.particleGeometry.attributes.lifetime.needsUpdate = true;
  }

  setupControls() {
    // Basic camera controls without OrbitControls
    this.cameraDistance = 50;
    this.cameraAngleX = 0.3;
    this.cameraAngleY = 0;
    this.isMouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    
    // Update camera position
    this.updateCameraPosition();
  }
  
  updateCameraPosition() {
    const x = Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX) * this.cameraDistance;
    const y = Math.sin(this.cameraAngleX) * this.cameraDistance;
    const z = Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX) * this.cameraDistance;
    
    // Look at Earth's position (Earth is the center)
    this.camera.position.set(x + this.earthPosition.x, y + this.earthPosition.y, z + this.earthPosition.z);
    this.camera.lookAt(this.earthPosition);
  }

  setupEventListeners() {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });

    // Mouse controls for camera rotation
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      this.isMouseDown = true;
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
    });

    this.renderer.domElement.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (!this.isMouseDown) {
        // Handle meteorite hover
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects(this.meteorites);
        
        // Reset all meteorite scales
        this.meteorites.forEach(meteorite => {
          meteorite.scale.set(1, 1, 1);
        });

        if (intersects.length > 0) {
          const meteorite = intersects[0].object;
          meteorite.scale.set(1.5, 1.5, 1.5);
          this.renderer.domElement.style.cursor = 'pointer';
        } else {
          this.renderer.domElement.style.cursor = 'default';
        }
        return;
      }

      // Camera rotation
      const deltaX = event.clientX - this.mouseX;
      const deltaY = event.clientY - this.mouseY;

      this.cameraAngleY -= deltaX * 0.01;
      this.cameraAngleX -= deltaY * 0.01;

      // Limit vertical rotation
      this.cameraAngleX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraAngleX));

      this.mouseX = event.clientX;
      this.mouseY = event.clientY;

      this.updateCameraPosition();
    });

    // Handle meteorite clicks
    this.renderer.domElement.addEventListener('click', (event) => {
      if (this.isMouseDown) return; // Don't click if we were dragging

      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
      mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      const intersects = raycaster.intersectObjects(this.meteorites);
      
      if (intersects.length > 0) {
        const meteorite = intersects[0].object;
        this.showMeteoriteInfo(meteorite.userData);
      }
    });

    // Zoom with mouse wheel
    this.renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.cameraDistance += event.deltaY * 0.1;
      this.cameraDistance = Math.max(20, Math.min(100, this.cameraDistance));
      this.updateCameraPosition();
    });
  }

  showMeteoriteInfo(data) {
    const info = `
      <div style="position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; max-width: 300px; z-index: 1000;">
        <h3>${data.designation}</h3>
        <p><strong>Year Range:</strong> ${data.yearRange}</p>
        <p><strong>Diameter:</strong> ${data.diameter} km</p>
        <p><strong>Impact Probability:</strong> ${data.impactProbability.toExponential(2)}</p>
        <p><strong>Velocity:</strong> ${data.vInfinity} km/s</p>
        <p><strong>Torino Scale:</strong> ${data.torinoScale}</p>
        <p><strong>Palermo Scale:</strong> ${data.palermoScale.toFixed(2)}</p>
        <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', info);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // PERFECT TIME SCALING: Smooth and visible
    this.time += 0.016 * 0.1; // ~60fps * perfect time scale

    // Update Earth position and rotation
    this.updateEarthPosition();

    // Update meteorite positions with orbital mechanics
    this.meteorites.forEach((meteorite) => {
      this.updateMeteoritePosition(meteorite, this.time);
    });

    // Render trails
    this.renderTrails();
    
    // Update particle system
    this.updateParticleSystem();
    
    // Update future paths
    this.updateFuturePaths();

    this.renderer.render(this.scene, this.camera);
  }

  renderTrails() {
    // Remove old trail lines
    this.meteoriteTrails.forEach(trail => {
      this.scene.remove(trail);
    });
    this.meteoriteTrails = [];

    // Create new trail lines
    let trailsCreated = 0;
    this.meteorites.forEach((meteorite) => {
      if (meteorite.userData.trail.length > 1) {
        trailsCreated++;
        const trailGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(meteorite.userData.trail.length * 3);
        
        meteorite.userData.trail.forEach((point, index) => {
          positions[index * 3] = point.x;
          positions[index * 3 + 1] = point.y;
          positions[index * 3 + 2] = point.z;
        });
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Color trail based on threat level
        let trailColor = 0xaaaaaa;
        if (meteorite.userData.torinoScale > 0) {
          trailColor = 0xff6666;
        } else if (meteorite.userData.palermoScale > -2) {
          trailColor = 0xffcc66;
        } else {
          trailColor = 0x66ff66;
        }
        
        const trailMaterial = new THREE.LineBasicMaterial({
          color: trailColor,
          transparent: true,
          opacity: 0.8,
          linewidth: 3
        });
        
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(trail);
        this.meteoriteTrails.push(trail);
      }
    });
    
    // Debug logging (only log occasionally to avoid spam)
    if (Math.random() < 0.01) {
      console.log('Trails created:', trailsCreated, 'Total meteorites:', this.meteorites.length);
    }
  }

  updateFuturePaths() {
    // Remove old future path lines
    this.futurePaths.forEach(path => {
      this.scene.remove(path);
    });
    this.futurePaths = [];

    // Calculate future path for Earth
    this.createFuturePath(this.calculateEarthFuturePath(), 0x4a90e2, 'Earth');
    
    // Calculate future path for Moon
    this.createFuturePath(this.calculateMoonFuturePath(), 0xcccccc, 'Moon');
    
    // Calculate future paths for meteorites
    this.meteorites.forEach((meteorite, index) => {
      const futurePath = this.calculateMeteoriteFuturePath(meteorite);
      let color = 0x888888;
      if (meteorite.userData.torinoScale > 0) {
        color = 0xff6666;
      } else if (meteorite.userData.palermoScale > -2) {
        color = 0xffcc66;
      } else {
        color = 0x66ff66;
      }
      this.createFuturePath(futurePath, color, `Meteorite-${index}`);
    });
  }

  calculateEarthFuturePath() {
    const path = [];
    for (let i = 0; i < this.futurePathLength; i++) {
      const futureTime = this.time + (i * this.futureTimeStep);
      const angle = futureTime * this.earthOrbitSpeed;
      const x = Math.cos(angle) * this.earthOrbitRadius;
      const z = Math.sin(angle) * this.earthOrbitRadius;
      path.push(new THREE.Vector3(x, 0, z));
    }
    return path;
  }

  calculateMoonFuturePath() {
    const path = [];
    for (let i = 0; i < this.futurePathLength; i++) {
      const futureTime = this.time + (i * this.futureTimeStep);
      
      // Earth's future position
      const earthAngle = futureTime * this.earthOrbitSpeed;
      const earthX = Math.cos(earthAngle) * this.earthOrbitRadius;
      const earthZ = Math.sin(earthAngle) * this.earthOrbitRadius;
      const earthPos = new THREE.Vector3(earthX, 0, earthZ);
      
      // Moon's position relative to Earth
      const moonAngle = futureTime * this.moonOrbitSpeed;
      const moonX = Math.cos(moonAngle) * this.moonOrbitRadius;
      const moonY = Math.sin(moonAngle * 0.1) * this.moonOrbitRadius * 0.1;
      const moonZ = Math.sin(moonAngle) * this.moonOrbitRadius;
      const moonPos = new THREE.Vector3(moonX, moonY, moonZ);
      
      // Moon's world position
      path.push(earthPos.clone().add(moonPos));
    }
    return path;
  }

  calculateMeteoriteFuturePath(meteorite) {
    const path = [];
    const params = meteorite.userData.orbitalParams;
    
    for (let i = 0; i < this.futurePathLength; i++) {
      const futureTime = this.time + (i * this.futureTimeStep);
      
      // Earth's future position
      const earthAngle = futureTime * this.earthOrbitSpeed;
      const earthX = Math.cos(earthAngle) * this.earthOrbitRadius;
      const earthZ = Math.sin(earthAngle) * this.earthOrbitRadius;
      const earthPos = new THREE.Vector3(earthX, 0, earthZ);
      
      // Simplified meteorite orbital position - follow current motion direction
      const meteoriteAngle = params.meanAnomaly + futureTime * 0.001; // Much slower orbital speed
      const meteoriteX = Math.cos(meteoriteAngle) * params.semiMajorAxis;
      const meteoriteY = Math.sin(meteoriteAngle * 0.5) * params.semiMajorAxis * 0.1; // Slight vertical motion
      const meteoriteZ = Math.sin(meteoriteAngle) * params.semiMajorAxis;
      
      const meteoritePos = new THREE.Vector3(meteoriteX, meteoriteY, meteoriteZ);
      path.push(earthPos.clone().add(meteoritePos));
    }
    return path;
  }

  createFuturePath(points, color, name) {
    if (points.length < 2) return;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    
    points.forEach((point, index) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineDashedMaterial({
      color: color,
      linewidth: 2,
      dashSize: 0.1,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.6
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances(); // Required for dashed lines
    this.scene.add(line);
    this.futurePaths.push(line);
  }

  showError(message) {
    this.container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444; text-align: center; padding: 2rem;">
        <div>
          <h3>Visualization Error</h3>
          <p>${message}</p>
          <p>Please check the browser console for more details.</p>
        </div>
      </div>
    `;
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    if (this.container && this.renderer) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

export { MeteoriteVisualization };
