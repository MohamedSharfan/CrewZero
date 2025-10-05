"use client";
import React, { useEffect, useRef, useState } from "react";

const NASA_API_BASE_URL = "/api/nasa-horizons";

const fetchNASAHorizonsAPI = async (params) => {
  const url = `${NASA_API_BASE_URL}?${new URLSearchParams(params)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const SolarSystem = () => {
  const canvasRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1000000);
  const [showInfo, setShowInfo] = useState(true);
  const [showAddObject, setShowAddObject] = useState(false);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [selectedObjectForAnalysis, setSelectedObjectForAnalysis] =
    useState(null);
  const [impactData, setImpactData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const animationRef = useRef(null);
  const elapsedSeconds = useRef(0);
  const lastDateUpdate = useRef(0);
  const [isLoadingNASAData, setIsLoadingNASAData] = useState(false);
  const [useNASAData, setUseNASAData] = useState(false);
  const [nasaDataTimestamp, setNasaDataTimestamp] = useState(null);
  const [simulationStartDate] = useState(new Date());
  const [currentSimulationDate, setCurrentSimulationDate] = useState(
    new Date()
  );
  const [calculationMode, setCalculationMode] = useState("Kepler's Laws");

  const planetDataNASA = [
    {
      name: "Mercury",
      radius: 3,
      color: "#8C7853",
      distanceKm: 57.9,
      periodDays: 88.0,
      velocityKmS: 47.4,
      eccentricity: 0.206,
      perihelionArg: 29,
      angle: 0,
      type: "planet",
    },
    {
      name: "Venus",
      radius: 6,
      color: "#FFC649",
      distanceKm: 108.2,
      periodDays: 224.7,
      velocityKmS: 35.0,
      eccentricity: 0.007,
      perihelionArg: 55,
      angle: 0,
      type: "planet",
    },
    {
      name: "Earth",
      radius: 6,
      color: "#4A90E2",
      distanceKm: 149.6,
      periodDays: 365.2,
      velocityKmS: 29.8,
      eccentricity: 0.017,
      perihelionArg: 102,
      angle: 0,
      type: "planet",
    },
    {
      name: "Mars",
      radius: 4,
      color: "#E27B58",
      distanceKm: 228.0,
      periodDays: 687.0,
      velocityKmS: 24.1,
      eccentricity: 0.094,
      perihelionArg: 336,
      angle: 0,
      type: "planet",
    },
    {
      name: "Jupiter",
      radius: 14,
      color: "#C88B3A",
      distanceKm: 778.5,
      periodDays: 4331,
      velocityKmS: 13.1,
      eccentricity: 0.049,
      perihelionArg: 14,
      angle: 0,
      type: "planet",
    },
    {
      name: "Saturn",
      radius: 12,
      color: "#FAD5A5",
      distanceKm: 1432.0,
      periodDays: 10747,
      velocityKmS: 9.7,
      eccentricity: 0.052,
      perihelionArg: 92,
      angle: 0,
      type: "planet",
    },
    {
      name: "Uranus",
      radius: 8,
      color: "#4FD0E7",
      distanceKm: 2867.0,
      periodDays: 30589,
      velocityKmS: 6.8,
      eccentricity: 0.047,
      perihelionArg: 170,
      angle: 0,
      type: "planet",
    },
    {
      name: "Neptune",
      radius: 8,
      color: "#4166F5",
      distanceKm: 4515.0,
      periodDays: 59800,
      velocityKmS: 5.4,
      eccentricity: 0.01,
      perihelionArg: 44,
      angle: 0,
      type: "planet",
    },
  ];

  const planetsWithPixelDistance = planetDataNASA.map((p) => ({
    ...p,
    distancePixels: (p.distanceKm / 4515.0) * 350 + 30,
    // nasaState will hold last-received state-vector position (x,y,z in million km) and velocity (km/s)
    nasaState: null,
    nasaTimestamp: null,
  }));

  const [celestialBodies, setCelestialBodies] = useState(
    planetsWithPixelDistance
  );
  const [newObject, setNewObject] = useState({
    name: "",
    type: "asteroid",
    radius: 4,
    color: "#FF6B6B",
    distanceKm: 300,
    eccentricity: 0.1,
    inclination: 0,
    mass: 1e15,
    diameter: null, // meters
    composition: "Rocky",
    perihelionArg: 0,
  });

  // manual add by designation (e.g., "99942" or "2025 AB")
  const [manualDesignation, setManualDesignation] = useState("");
  const [manualName, setManualName] = useState("");

  const calculateOrbitalPeriod = (distanceKm) => {
    const distanceAU = distanceKm / 149.6;
    return Math.pow(distanceAU, 1.5) * 365.256;
  };

  const calculateOrbitalVelocity = (distanceKm, periodDays) => {
    const orbitCircumference = 2 * Math.PI * distanceKm * 1000000;
    const periodSeconds = periodDays * 86400;
    return orbitCircumference / periodSeconds / 1000;
  };

  const calculateDiameterFromMass = (mass, composition = "Rocky") => {
    // Density in kg/m³
    const densities = {
      Rocky: 2500,
      Metallic: 7800,
      Icy: 900,
      Carbonaceous: 1400,
      Mixed: 2000,
    };
    const density = densities[composition] || 2500;
    const volume = mass / density; // m³
    const radius = Math.pow((3 * volume) / (4 * Math.PI), 1/3); // meters
    const diameter = 2 * radius; // diameter in meters
    return diameter;
  };

  // Estimate asteroid size from its orbital characteristics
  const estimateAsteroidSize = (semiMajorAxis, eccentricity, designation) => {
    // Typical asteroid size estimations based on orbital characteristics
    // This is a rough approximation based on asteroid belt statistics
    
    // Main belt asteroids (2.1 - 3.3 AU): more numerous, generally smaller
    // Near-Earth asteroids (<1.3 AU): various sizes, but often smaller
    // Outer asteroids (>3.3 AU): can be larger
    
    const au = semiMajorAxis / 149.6; // Convert million km to AU
    
    // Size category based on orbital position
    let typicalDiameter; // in meters
    
    if (au < 1.3) {
      // Near-Earth asteroids - typically 10m to 30km
      // Most are under 1km
      typicalDiameter = 500; // 500 meters as typical
    } else if (au >= 2.0 && au <= 3.5) {
      // Main belt - highly variable (1m to 940km)
      // Most are 1-10 km
      typicalDiameter = 5000; // 5 km as typical
    } else if (au > 3.5) {
      // Outer belt and beyond - can be larger
      typicalDiameter = 50000; // 50 km as typical
    } else {
      // Mars crossers and others
      typicalDiameter = 2000; // 2 km as typical
    }
    
    // Adjust for eccentricity (highly eccentric orbits might indicate different populations)
    if (eccentricity > 0.4) {
      typicalDiameter *= 0.5; // Eccentric orbits often indicate smaller objects
    }
    
    return typicalDiameter;
  };

  // Calculate mass from estimated diameter and composition
  const calculateMassFromDiameter = (diameter, composition = "Rocky") => {
    const densities = {
      Rocky: 2500,    // kg/m³
      Stony: 2500,
      Metallic: 7800,
      Icy: 900,
      Carbonaceous: 1400,
      Mixed: 2000,
    };
    const density = densities[composition] || 2500;
    const radius = diameter / 2; // meters
    const volume = (4/3) * Math.PI * Math.pow(radius, 3); // m³
    const mass = volume * density; // kg
    return mass;
  };

  const addCustomObject = () => {
    if (!newObject.name.trim()) {
      alert("Please enter a name for the object");
      return;
    }

    const period = calculateOrbitalPeriod(newObject.distanceKm);
    const velocity = calculateOrbitalVelocity(newObject.distanceKm, period);
    const distancePixels = (newObject.distanceKm / 4515.0) * 350 + 30;

    // Calculate diameter if not provided
    const diameter = newObject.diameter || calculateDiameterFromMass(newObject.mass, newObject.composition);

    const customBody = {
      ...newObject,
      diameter: diameter,
      periodDays: period,
      velocityKmS: velocity,
      distancePixels: distancePixels,
      angle: 0,
      meanAnomaly: 0,
      id: Date.now(),
    };

    setCelestialBodies([...celestialBodies, customBody]);
    setShowAddObject(false);

    setNewObject({
      name: "",
      type: "asteroid",
      radius: 4,
      color: "#FF6B6B",
      distanceKm: 300,
      eccentricity: 0.1,
      inclination: 0,
      mass: 1e15,
      diameter: null,
      composition: "Rocky",
      perihelionArg: 0,
    });
  };

  const removeCustomObject = (id) => {
    setCelestialBodies(celestialBodies.filter((body) => body.id !== id));
  };

  const solveKeplerEquation = (M, e, tolerance = 1e-6) => {
    let E = M;
    let delta = 1;
    let iterations = 0;
    const maxIterations = 100;

    while (Math.abs(delta) > tolerance && iterations < maxIterations) {
      delta = E - e * Math.sin(E) - M;
      E = E - delta / (1 - e * Math.cos(E));
      iterations++;
    }

    return E;
  };

  const calculateImpactProbability = (object) => {
    const earth = celestialBodies.find((b) => b.name === "Earth");
    if (!earth) return null;

    const a1 = earth.distanceKm;
    const e1 = earth.eccentricity;
    const a2 = object.distanceKm;
    const e2 = object.eccentricity;

    const earthPerihelion = a1 * (1 - e1);
    const earthAphelion = a1 * (1 + e1);
    const objectPerihelion = a2 * (1 - e2);
    const objectAphelion = a2 * (1 + e2);

    const orbitsCanIntersect = !(
      objectPerihelion > earthAphelion || objectAphelion < earthPerihelion
    );

    let minDistance = Infinity;
    let closestApproachAngle1 = 0;
    let closestApproachAngle2 = 0;

    for (let theta1 = 0; theta1 < 360; theta1 += 5) {
      const rad1 = (theta1 * Math.PI) / 180;
      const r1 = (a1 * (1 - e1 * e1)) / (1 + e1 * Math.cos(rad1));
      const omega1 = ((earth.perihelionArg || 0) * Math.PI) / 180;
      const x1 =
        r1 *
        (Math.cos(rad1) * Math.cos(omega1) - Math.sin(rad1) * Math.sin(omega1));
      const y1 =
        r1 *
        (Math.cos(rad1) * Math.sin(omega1) + Math.sin(rad1) * Math.cos(omega1));

      for (let theta2 = 0; theta2 < 360; theta2 += 5) {
        const rad2 = (theta2 * Math.PI) / 180;
        const r2 = (a2 * (1 - e2 * e2)) / (1 + e2 * Math.cos(rad2));
        const omega2 = ((object.perihelionArg || 0) * Math.PI) / 180;
        const x2 =
          r2 *
          (Math.cos(rad2) * Math.cos(omega2) -
            Math.sin(rad2) * Math.sin(omega2));
        const y2 =
          r2 *
          (Math.cos(rad2) * Math.sin(omega2) +
            Math.sin(rad2) * Math.cos(omega2));

        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (dist < minDistance) {
          minDistance = dist;
          closestApproachAngle1 = theta1;
          closestApproachAngle2 = theta2;
        }
      }
    }

    const earthDiameter = 0.012756;
    const impactThreshold = earthDiameter * 100;

    let impactProbability = 0;
    let riskLevel = "None";

    if (minDistance < impactThreshold) {
      impactProbability = Math.max(
        0,
        (1 - minDistance / impactThreshold) * 100
      );

      if (impactProbability > 10) riskLevel = "Extreme";
      else if (impactProbability > 5) riskLevel = "High";
      else if (impactProbability > 1) riskLevel = "Moderate";
      else if (impactProbability > 0.1) riskLevel = "Low";
      else riskLevel = "Very Low";
    }

    const impactZones = [];
    if (impactProbability > 0.01) {
      const seed = object.distanceKm * 1000 + object.eccentricity * 100;
      for (let i = 0; i < 5; i++) {
        const lat = Math.sin(seed + i * 1.5) * 90;
        const lon = ((seed * 123 + i * 67) % 360) - 180;
        const prob = impactProbability * (1 - i * 0.15);
        impactZones.push({ lat, lon, probability: Math.max(0, prob) });
      }
    }

    // Calculate impact velocity (relative velocity at collision)
    // Use object's orbital velocity as baseline
    let impactVelocity = object.velocityKmS || 20;
    
    // If object has velocity, calculate relative velocity to Earth
    if (object.velocityKmS && earth.velocityKmS) {
      // Approximate relative velocity considering both orbital velocities
      // For head-on collision: v_rel ≈ v_object + v_earth
      // For same-direction: v_rel ≈ |v_object - v_earth|
      // Use average case: geometric mean
      const earthVel = earth.velocityKmS;
      const objectVel = object.velocityKmS;
      
      // Account for inclination and eccentricity effects
      const inclinationFactor = 1 + (object.inclination || 0) / 90;
      const eccentricityFactor = 1 + object.eccentricity * 0.5;
      
      // Estimate relative velocity (typically 15-40 km/s for NEOs)
      impactVelocity = Math.sqrt(objectVel * objectVel + earthVel * earthVel) * inclinationFactor * eccentricityFactor;
    }
    
    const impactVelocityMs = impactVelocity * 1000;

    const kineticEnergy = 0.5 * object.mass * impactVelocityMs ** 2;

    const energyMegatons = kineticEnergy / 4.184e15;

    const gravity = 9.8;

    const densityFactor =
      {
        Rocky: 1.0,
        Metallic: 1.3,
        Icy: 0.7,
        Carbonaceous: 0.9,
        Mixed: 1.0,
      }[object.composition] || 1.0;

    const craterDiameter =
      1.8 * densityFactor * Math.pow(kineticEnergy / gravity, 0.28);

    const craterDepth = craterDiameter * 0.22;

    const centralPeakHeight = craterDiameter > 5000 ? craterDepth * 0.4 : 0;

    const craterZones = {
      centralPeak: craterDiameter * 0.1,
      terracedRim: craterDiameter * 0.35,
      ejectaRim: craterDiameter * 0.5,
      ejectaBlanket: craterDiameter * 2.5,
      shockwave: craterDiameter * 5,
    };

    return {
      orbitsIntersect: orbitsCanIntersect,
      minDistance: minDistance,
      minDistanceKm: minDistance * 1000000,
      impactProbability: impactProbability,
      riskLevel: riskLevel,
      closestApproachAngle1,
      closestApproachAngle2,
      impactZones,
      earthRadius: 6371,
      impactVelocity: impactVelocity,
      kineticEnergy: kineticEnergy,
      energyMegatons: energyMegatons,
      craterDiameter: craterDiameter,
      craterDepth: craterDepth,
      centralPeakHeight: centralPeakHeight,
      craterZones: craterZones,
    };
  };

  const analyzeObject = (object) => {
    const analysis = calculateImpactProbability(object);
    setImpactData(analysis);
    setSelectedObjectForAnalysis(object);
    setShowImpactAnalysis(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2 + panX;
    const centerY = canvas.height / 2 + panY;

    let lastFrameTime = performance.now();

    const draw = (currentFrameTime) => {
      const deltaTimeMs = currentFrameTime - lastFrameTime;
      lastFrameTime = currentFrameTime;

      if (!isPaused) {
        const simulatedSecondsPassed = (deltaTimeMs / 1000) * speed;
        elapsedSeconds.current += simulatedSecondsPassed;

        const elapsedDays = elapsedSeconds.current / 86400;

        const now = performance.now();
        if (now - lastDateUpdate.current > 1000) {
          const newDate = new Date(simulationStartDate);
          newDate.setSeconds(newDate.getSeconds() + elapsedSeconds.current);
          setCurrentSimulationDate(newDate);
          lastDateUpdate.current = now;
        }

        ctx.fillStyle = "#000814";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#FFFFFF";
        for (let i = 0; i < 200; i++) {
          const x = (i * 97) % canvas.width;
          const y = (i * 137) % canvas.height;
          const size = (i % 3) * 0.5;
          ctx.fillRect(x, y, size, size);
        }

        const sunRadius = 25 * Math.min(zoom, 2);
        const sunGradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          sunRadius
        );
        sunGradient.addColorStop(0, "#FFF500");
        sunGradient.addColorStop(0.5, "#FFD700");
        sunGradient.addColorStop(1, "#FFA500");
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 200, 0, 0.15)";
        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          sunRadius + 10 * Math.min(zoom, 2),
          0,
          Math.PI * 2
        );
        ctx.fill();

        celestialBodies.forEach((body, index) => {
          // Calculate position based on type and data availability
          let x, y;
          
          // For planets with NASA state-vector data, use the static position
          // For asteroids/custom objects, ALWAYS calculate position using Kepler's laws for animation
          const useStaticNASAPosition = useNASAData && body.nasaState && body.type === "planet";
          
          if (useStaticNASAPosition) {
            // Use static NASA position for planets (they don't animate in this mode)
            const scale = (350 / 4515.0) * zoom; // pixels per million km (approx)
            const vx = body.nasaState.x; // million km
            const vy = body.nasaState.y; // million km

            x = centerX + vx * scale;
            y = centerY + vy * scale;
          } else {
            // Calculate orbital position using Kepler's laws (for all asteroids and non-NASA planets)
            const omega = ((body.perihelionArg || 0) * Math.PI) / 180;
            const n = (2 * Math.PI) / body.periodDays;
            const initialOffset =
              body.type === "planet" ? (index * 45 * Math.PI) / 180 : 0;
            const M = (n * elapsedDays + initialOffset) % (2 * Math.PI);

            const E = solveKeplerEquation(M, body.eccentricity);

            const v =
              2 *
              Math.atan2(
                Math.sqrt(1 + body.eccentricity) * Math.sin(E / 2),
                Math.sqrt(1 - body.eccentricity) * Math.cos(E / 2)
              );

            const a = body.distancePixels * zoom;
            const b = a * Math.sqrt(1 - body.eccentricity * body.eccentricity);
            const c = a * body.eccentricity;

            const r =
              (a * (1 - body.eccentricity * body.eccentricity)) /
              (1 + body.eccentricity * Math.cos(v));

            const theta = v;
            const xOrbit = r * Math.cos(theta);
            const yOrbit = r * Math.sin(theta);

            x = centerX + (xOrbit * Math.cos(omega) - yOrbit * Math.sin(omega));
            y = centerY + (xOrbit * Math.sin(omega) + yOrbit * Math.cos(omega));
          }

          ctx.strokeStyle =
            body.type === "planet"
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(255, 107, 107, 0.5)";
          ctx.lineWidth = body.type === "planet" ? 1 : 2.5;
          ctx.setLineDash(body.type === "planet" ? [] : [5, 5]);

          // Draw the Kepler orbit ellipse
          // For asteroids and custom objects, always draw the orbit
          // For planets, only draw if not using NASA data (to avoid confusion with NASA-driven positions)
          const shouldDrawOrbit = body.type !== "planet" || !(useNASAData && body.nasaState);
          
          if (shouldDrawOrbit && body.distancePixels && body.eccentricity !== undefined) {
            // Calculate orbital parameters for drawing
            const drawOmega = ((body.perihelionArg || 0) * Math.PI) / 180;
            const drawA = body.distancePixels * zoom;
            const drawB =
              drawA * Math.sqrt(1 - body.eccentricity * body.eccentricity);
            const drawC = drawA * body.eccentricity;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(drawOmega);
            ctx.beginPath();
            ctx.ellipse(-drawC, 0, drawA, drawB, 0, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          }
          
          // Reset line dash after drawing orbit
          ctx.setLineDash([]);

          const displayRadius = body.radius * Math.min(zoom, 2);

          // Validate coordinates and radius are finite numbers
          if (isFinite(x) && isFinite(y) && isFinite(displayRadius)) {
            try {
              const gradient = ctx.createRadialGradient(
                x - 2,
                y - 2,
                0,
                x,
                y,
                displayRadius
              );
              gradient.addColorStop(0, lightenColor(body.color, 30));
              gradient.addColorStop(1, body.color);
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(x, y, displayRadius, 0, Math.PI * 2);
              ctx.fill();
            } catch (error) {
              // Fallback to solid color if gradient fails
              ctx.fillStyle = body.color;
              ctx.beginPath();
              ctx.arc(x, y, displayRadius, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (body.type !== "planet") {
            ctx.strokeStyle = body.color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(x, y, displayRadius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.strokeStyle = lightenColor(body.color, 50);
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(x, y, displayRadius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.beginPath();
          ctx.arc(x + 1, y + 1, displayRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = body.type === "planet" ? "#FFFFFF" : "#FF6B6B";
          ctx.font = body.type === "planet" ? "11px Arial" : "bold 12px Arial";
          ctx.textAlign = "center";

          if (body.type !== "planet") {
            const textWidth = ctx.measureText(body.name).width;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
              x - textWidth / 2 - 3,
              y - displayRadius - 20,
              textWidth + 6,
              14
            );
            ctx.fillStyle = "#FF6B6B";
          }

          ctx.fillText(body.name, x, y - displayRadius - 8);

          if (body.type !== "planet") {
            ctx.fillStyle = "#FFB6B6";
            ctx.font = "9px Arial";
            ctx.fillText(
              `${body.distanceKm.toFixed(0)}M km`,
              x,
              y + displayRadius + 15
            );
          }
        });

        if (showInfo) {
          const infoHeight = useNASAData ? 180 : 145;
          ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
          ctx.fillRect(10, 10, 270, infoHeight);

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 13px Arial";
          ctx.textAlign = "left";
          ctx.fillText("Solar System Simulation", 20, 30);

          ctx.font = "bold 11px Arial";
          ctx.fillStyle = "#BB86FC";
          ctx.fillText("● KEPLER + NASA DATA", 20, 48);

          const displayDate = new Date(simulationStartDate);
          displayDate.setSeconds(
            displayDate.getSeconds() + elapsedSeconds.current
          );

          ctx.fillStyle = "#AAAAAA";
          ctx.font = "10px Arial";
          ctx.fillText(`📅 ${displayDate.toLocaleDateString()}`, 20, 63);

          ctx.strokeStyle = "#444";
          ctx.beginPath();
          ctx.moveTo(20, 70);
          ctx.lineTo(260, 70);
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "11px Arial";

          const days = Math.floor(elapsedDays);
          const years = elapsedDays / 365.2;

          ctx.fillText(`Time: ${days.toLocaleString()} Earth days`, 20, 87);
          ctx.fillText(`≈ ${years.toFixed(3)} Earth years`, 20, 102);

          if (speed === 1) {
            ctx.fillText("Speed: Real-time", 20, 117);
          } else if (speed < 86400) {
            ctx.fillText(`Speed: ${speed.toFixed(0)}x real-time`, 20, 117);
          } else {
            ctx.fillText(
              `Speed: ${(speed / 86400).toFixed(0)} days/sec`,
              20,
              117
            );
          }
          ctx.fillText(`Objects: ${celestialBodies.length}`, 20, 132);

          const customCount = celestialBodies.filter(
            (b) => b.type !== "planet"
          ).length;
          if (customCount > 0) {
            ctx.fillStyle = "#FF6B6B";
            ctx.fillText(`(${customCount} custom)`, 135, 132);
          }
        }

        if (showImpactAnalysis && impactData && selectedObjectForAnalysis) {
          const earth = celestialBodies.find((b) => b.name === "Earth");
          const analysisObject = celestialBodies.find(
            (b) => b.id === selectedObjectForAnalysis.id
          );
          if (earth && analysisObject) {
            ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            const a1 = earth.distancePixels * zoom;
            const e1 = earth.eccentricity;
            const omega1 = ((earth.perihelionArg || 0) * Math.PI) / 180;
            const theta1 = (impactData.closestApproachAngle1 * Math.PI) / 180;
            const r1 = (a1 * (1 - e1 * e1)) / (1 + e1 * Math.cos(theta1));
            const x1 =
              centerX +
              r1 *
                (Math.cos(theta1) * Math.cos(omega1) -
                  Math.sin(theta1) * Math.sin(omega1));
            const y1 =
              centerY +
              r1 *
                (Math.cos(theta1) * Math.sin(omega1) +
                  Math.sin(theta1) * Math.cos(omega1));

            const a2 = analysisObject.distancePixels * zoom;
            const e2 = analysisObject.eccentricity;
            const omega2 =
              ((analysisObject.perihelionArg || 0) * Math.PI) / 180;
            const theta2 = (impactData.closestApproachAngle2 * Math.PI) / 180;
            const r2 = (a2 * (1 - e2 * e2)) / (1 + e2 * Math.cos(theta2));
            const x2 =
              centerX +
              r2 *
                (Math.cos(theta2) * Math.cos(omega2) -
                  Math.sin(theta2) * Math.sin(omega2));
            const y2 =
              centerY +
              r2 *
                (Math.cos(theta2) * Math.sin(omega2) +
                  Math.sin(theta2) * Math.cos(omega2));

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "rgba(255, 200, 0, 0.7)";
            ctx.beginPath();
            ctx.arc(x1, y1, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x2, y2, 6, 0, Math.PI * 2);
            ctx.fill();

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            const labelText = `Min Distance: ${impactData.minDistance.toFixed(
              2
            )}M km`;
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillRect(
              midX - textWidth / 2 - 5,
              midY - 15,
              textWidth + 10,
              20
            );
            ctx.fillStyle = "#FFD700";
            ctx.font = "bold 11px Arial";
            ctx.textAlign = "center";
            ctx.fillText(labelText, midX, midY);
          }
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    isPaused,
    speed,
    showInfo,
    celestialBodies,
    zoom,
    panX,
    panY,
    showImpactAnalysis,
    impactData,
    selectedObjectForAnalysis,
    simulationStartDate,
  ]);

  const lightenColor = (color, percent) => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, "0")}`;
  };

  const resetSimulation = () => {
    elapsedSeconds.current = 0;
    setCurrentSimulationDate(new Date(simulationStartDate));
  };

  const syncToNow = () => {
    // Reset elapsed time to 0
    elapsedSeconds.current = 0;
    // Set current simulation date to now
    const now = new Date();
    setCurrentSimulationDate(now);
    // Set speed to real-time
    setSpeed(1);
  };

  const removeAllCustomObjects = () => {
    setCelestialBodies(planetsWithPixelDistance);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // Add non-passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)));
    };

    canvas.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", wheelHandler);
    };
  }, []);


  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  function parseFullNasaStringToJson(nasaData) {
  const resultText = nasaData.result || "";
  const parsed = {};

  console.log("\n=== PARSING NASA DATA ===");
  
  // ---- Planet/Object Name ----
  const nameMatch = resultText.match(/Revised:.*?\s+([A-Za-z]+)\s+\d+/);
  parsed.name = nameMatch ? nameMatch[1] : "Unknown";

  // ---- Try multiple patterns for PHYSICAL DATA ----
  // Pattern 1: Standard format with asterisks
  let physMatch = resultText.match(/(?:PHYSICAL DATA|GEOPHYSICAL PROPERTIES|SATELLITE PHYSICAL PROPERTIES|PHYSICAL PROPERTIES).*?\n([\s\S]*?)\*{10}/);
  
  // Pattern 2: Sometimes physical data appears between "Revised:" and first asterisk line
  if (!physMatch) {
    physMatch = resultText.match(/Revised:[\s\S]*?\n([\s\S]*?)\n\*{10}/);
  }
  
  // Pattern 3: Try to find any section with "=" signs before ephemeris data
  if (!physMatch) {
    const beforeEphemeris = resultText.split(/\$\$SOE/)[0];
    const linesWithEquals = beforeEphemeris.split('\n').filter(line => 
      line.includes('=') && 
      !line.includes('*****') &&
      !line.includes('CENTER') &&
      !line.includes('COMMAND')
    );
    if (linesWithEquals.length > 0) {
      console.log(`Found ${linesWithEquals.length} lines with '=' signs before ephemeris`);
      physMatch = [null, linesWithEquals.join('\n')];
    }
  }
  
  if (physMatch) {
    const physText = physMatch[1];
    const lines = physText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && l.includes("=") && !l.includes('*'));

    console.log(`Parsing ${lines.length} potential physical data lines`);
    
    if (lines.length > 0) {
      parsed.physicalData = {};
      lines.forEach(line => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let valueStr = parts.slice(1).join("=").trim();

          // Extract first number from value (before +- or other text)
          // Match patterns like: "761.4 +- 2.6" or "1.66 +- 0.05" or "205.34 +- 5.8"
          const numMatch = valueStr.match(/^([\d.]+(?:e[+-]?\d+)?)/i);
          if (numMatch) {
            const numValue = parseFloat(numMatch[1]);
            if (!isNaN(numValue)) {
              parsed.physicalData[key] = numValue;
              console.log(`  Parsed: "${key}" = ${numValue}`);
            } else {
              parsed.physicalData[key] = valueStr;
            }
          } else {
            parsed.physicalData[key] = valueStr;
            console.log(`  Parsed: "${key}" = "${valueStr}" (text)`);
          }
        }
      });
    }
  } else {
    console.log("⚠ No physical data section found in NASA response");
  }

  // ---- Orbital / HELIOCENTRIC ORBIT CHARACTERISTICS ----
  const orbitMatch = resultText.match(/HELIOCENTRIC ORBIT CHARACTERISTICS:([\s\S]*?)\*{10}/);
  if (orbitMatch) {
    const orbitText = orbitMatch[1];
    const lines = orbitText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && l.includes("="));

    parsed.orbitalData = {};
    lines.forEach(line => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join("=").trim();
        const numValue = parseFloat(value.replace(/[^\d\.\-e+]/g, ""));
        value = isNaN(numValue) ? value : numValue;
        parsed.orbitalData[key] = value;
      }
    });
  }

  // ---- Ephemeris Table ----
  const ephemMatch = resultText.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (ephemMatch) {
    const ephemText = ephemMatch[1].trim();
    const ephemRows = ephemText
      .split("\n")
      .map(r => r.trim())
      .filter(r => r);

    parsed.ephemeris = ephemRows.map(row => {
      const cols = row.split(",").map(c => c.trim());
      return {
        JDTDB: parseFloat(cols[0]),
        calendarDate: cols[1],
        X: parseFloat(cols[2]),
        Y: parseFloat(cols[3]),
        Z: parseFloat(cols[4]),
        VX: parseFloat(cols[5]),
        VY: parseFloat(cols[6]),
        VZ: parseFloat(cols[7]),
        LT: parseFloat(cols[8]),
        RG: parseFloat(cols[9]),
        RR: parseFloat(cols[10])
      };
    });
  }
  
  console.log("Parsed NASA data:", parsed);
  return parsed;
}


  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const addRealAsteroid = async (name, designation) => {
    setIsLoadingNASAData(true);

    try {
      const today = new Date();
      const jdNow = dateToJulianDate(today);
      const jdTomorrow = jdNow + 1;

      const params = {
        format: "json",
        COMMAND: `'${designation}'`,
        EPHEM_TYPE: "VECTORS",
        CENTER: `'@sun'`,
        REF_PLANE: `'ECLIPTIC'`,
        REF_SYSTEM: `'J2000'`,
        VEC_LABELS: `'YES'`,
        VEC_DELTA_T: `'NO'`,
        OUT_UNITS: `'KM-S'`,
        CSV_FORMAT: `'YES'`,
        OBJ_DATA: `'YES'`,
        VEC_TABLE: `'3'`,
        START_TIME: `'JD ${jdNow}'`,
        STOP_TIME: `'JD ${jdTomorrow}'`,
        STEP_SIZE: `'1 d'`,
      };

      const data = await fetchNASAHorizonsAPI(params);

      if (data && data.result) {
        // Log the raw NASA response to see what's available
        console.log("\n========== RAW NASA RESPONSE ==========");
        console.log("First 2000 characters of response:");
        console.log(data.result.substring(0, 2000));
        console.log("\n========================================\n");
        
        // Parse full NASA response to get physical data (diameter, mass, etc.)
        const fullData = parseFullNasaStringToJson(data);
        const vectorData = parseHorizonsVectorData(data);

        if (vectorData) {
          const orbitalElements = stateVectorsToOrbitalElements(vectorData);
          const period = orbitalElements.period;
          const velocity = orbitalElements.velocity;
          const distancePixels =
            (orbitalElements.semiMajorAxis / 4515.0) * 350 + 30;

          // Extract physical data from NASA response
          let diameter = null; // meters
          let mass = null; // kg
          let composition = "Rocky"; // default
          let nasaVelocity = null; // km/s from NASA data
          
          // Data source tracking for debugging
          let diameterSource = "not found";
          let massSource = "not found";
          let velocitySource = "not found";

          console.log("\n=== NASA DATA EXTRACTION FOR:", name, "===");
          console.log("Designation:", designation);
          console.log("Full NASA response keys:", Object.keys(fullData || {}));
          console.log("Physical Data available:", !!fullData?.physicalData);
          
          if (fullData?.physicalData) {
            console.log("\n📋 Available Physical Data from NASA:");
            console.log("Physical Data keys:", Object.keys(fullData.physicalData));
            console.log("Physical Data:", fullData.physicalData);
          } else {
            console.log("\n⚠ NASA Horizons did NOT provide physical data for this object");
            console.log("This is common for most asteroids - NASA only has detailed physical");
            console.log("data for well-studied objects (planets, major moons, some large asteroids)");
            console.log("\n[NASA] Available NASA data:");
            console.log("  - Position vectors (X, Y, Z)");
            console.log("  - Velocity vectors (VX, VY, VZ)");
            console.log("  - Orbital elements (calculated from vectors)");
            console.log("\n[ESTIMATE] Will estimate size/mass from orbital characteristics...");
          }

          if (fullData && fullData.physicalData) {
            const phys = fullData.physicalData;
            console.log("Available NASA keys:", Object.keys(phys));
            console.log("All key-value pairs:");
            for (const key in phys) {
              console.log(`  "${key}" = ${phys[key]} (type: ${typeof phys[key]})`);
            }
            
            // DIAMETER/RADIUS EXTRACTION
            // NASA format: "Radius (km)" or "Diameter" or "Mean diameter"
            for (const key in phys) {
              const lowerKey = key.toLowerCase();
              const value = phys[key];
              
              if (!diameter && typeof value === 'number' && value > 0) {
                // Check for diameter
                if (lowerKey.includes('diameter') || lowerKey.includes('diam')) {
                  diameter = value * 1000; // convert km to meters
                  diameterSource = `NASA (${key})`;
                  console.log(`[NASA] DIAMETER from NASA key "${key}": ${value} km = ${diameter} meters`);
                  break;
                }
                // Check for radius (double it to get diameter)
                else if (lowerKey.includes('radius') && lowerKey.includes('km')) {
                  diameter = value * 2 * 1000; // convert radius km to diameter meters
                  diameterSource = `NASA (${key} × 2)`;
                  console.log(`[NASA] DIAMETER from NASA radius "${key}": ${value} km radius × 2 = ${diameter} meters`);
                  break;
                }
              }
            }
            
            // MASS EXTRACTION
            // NASA format: "GM (km^3/s^2)" - can calculate mass from GM
            // Or direct mass fields
            for (const key in phys) {
              const lowerKey = key.toLowerCase();
              const value = phys[key];
              
              if (!mass && typeof value === 'number' && value > 0) {
                // Check for GM (Gravitational parameter = G * M)
                // GM can be in format: "GM (km^3/s^2)" or "GM, km^3 s^-2" etc
                if (lowerKey.includes('gm')) {
                  // GM in km^3/s^2, G = 6.67430e-20 km^3/(kg·s^2)
                  const G = 6.67430e-20; // km^3/(kg·s^2)
                  mass = value / G;
                  massSource = `NASA (calculated from ${key})`;
                  console.log(`[NASA] MASS from NASA GM "${key}": ${value} km³/s² → ${mass.toExponential(2)} kg`);
                  break;
                }
                // Check for direct mass
                else if (lowerKey.includes('mass')) {
                  if (key.includes('10^21') || key.includes('10**21') || key.includes('10^+21')) {
                    mass = value * 1e21;
                    massSource = `NASA (${key})`;
                    console.log(`[NASA] MASS from NASA "${key}": ${value} × 10²¹ = ${mass.toExponential(2)} kg`);
                    break;
                  } else if (key.includes('10^22') || key.includes('10**22') || key.includes('10^+22')) {
                    mass = value * 1e22;
                    massSource = `NASA (${key})`;
                    console.log(`[NASA] MASS from NASA "${key}": ${value} × 10²² = ${mass.toExponential(2)} kg`);
                    break;
                  } else if (key.includes('10^20') || key.includes('10**20') || key.includes('10^+20')) {
                    mass = value * 1e20;
                    massSource = `NASA (${key})`;
                    console.log(`[NASA] MASS from NASA "${key}": ${value} × 10²⁰ = ${mass.toExponential(2)} kg`);
                    break;
                  } else if (key.includes('10^19') || key.includes('10**19') || key.includes('10^+19')) {
                    mass = value * 1e19;
                    massSource = `NASA (${key})`;
                    console.log(`[NASA] MASS from NASA "${key}": ${value} × 10¹⁹ = ${mass.toExponential(2)} kg`);
                    break;
                  } else if (key.includes('10^10') || key.includes('10**10') || key.includes('10^+10')) {
                    mass = value * 1e10;
                    massSource = `NASA (${key})`;
                    console.log(`[NASA] MASS from NASA "${key}": ${value} × 10¹⁰ = ${mass.toExponential(2)} kg`);
                    break;
                  }
                }
              }
            }
            
            // VELOCITY EXTRACTION
            for (const key in phys) {
              const lowerKey = key.toLowerCase();
              const value = phys[key];
              
              if (!nasaVelocity && typeof value === 'number' && value > 0) {
                if ((lowerKey.includes('orbital') || lowerKey.includes('orbit')) && 
                    (lowerKey.includes('speed') || lowerKey.includes('velocity') || lowerKey.includes('vel'))) {
                  nasaVelocity = value;
                  velocitySource = `NASA (${key})`;
                  console.log(`[NASA] VELOCITY from NASA "${key}": ${nasaVelocity} km/s`);
                  break;
                }
              }
            }
          }

          // FALLBACK CALCULATIONS
          // If we have diameter but no mass, calculate mass from diameter
          if (diameter && !mass) {
            mass = calculateMassFromDiameter(diameter, composition);
            massSource = "Calculated from diameter";
            console.log(`⚙ MASS calculated from diameter: ${mass.toExponential(2)} kg (using density for ${composition})`);
          }
          // If we have mass but no diameter, calculate diameter from mass
          else if (mass && !diameter) {
            diameter = calculateDiameterFromMass(mass, composition);
            diameterSource = "Calculated from mass";
            console.log(`⚙ DIAMETER calculated from mass: ${diameter.toFixed(2)} meters`);
          }
          // If we have neither, estimate from orbital characteristics
          else if (!mass && !diameter) {
            // Estimate size based on orbital parameters
            diameter = estimateAsteroidSize(orbitalElements.semiMajorAxis, orbitalElements.eccentricity, designation);
            diameterSource = "Estimated from orbital characteristics";
            console.log(`[ESTIMATE] DIAMETER estimated from orbit: ${diameter.toFixed(2)} meters`);
            console.log(`   (Semi-major axis: ${orbitalElements.semiMajorAxis.toFixed(2)} M km, Eccentricity: ${orbitalElements.eccentricity.toFixed(3)})`);
            
            // Calculate mass from estimated diameter
            mass = calculateMassFromDiameter(diameter, composition);
            massSource = "Calculated from estimated diameter";
            console.log(`⚙ MASS calculated from estimated diameter: ${mass.toExponential(2)} kg (using density for ${composition})`);
          }
          
          // Use calculated velocity if NASA didn't provide it
          if (!nasaVelocity) {
            velocitySource = "Calculated from orbital elements";
            console.log(`⚙ VELOCITY will be calculated from state vectors`);
          }

          // Use NASA velocity if available, otherwise use calculated velocity from state vectors
          const finalVelocity = nasaVelocity || velocity;

          const asteroid = {
            name: name,
            type: "asteroid",
            radius: 5,
            color: "#FFD700",
            distanceKm: orbitalElements.semiMajorAxis,
            eccentricity: orbitalElements.eccentricity,
            perihelionArg: orbitalElements.argumentOfPeriapsis,
            mass: mass,
            diameter: diameter, // meters
            composition: composition,
            periodDays: period,
            velocityKmS: finalVelocity,
            distancePixels: distancePixels,
            angle: 0,
            id: Date.now(),
            nasaData: true,
            physicalData: fullData?.physicalData || null,
            nasaState: {
              x: vectorData.x / 1000000,
              y: vectorData.y / 1000000,
              z: vectorData.z / 1000000,
              vx: vectorData.vx,
              vy: vectorData.vy,
              vz: vectorData.vz,
            },
            nasaTimestamp: vectorData.date,
            // Debug metadata
            _debug: {
              diameterSource,
              massSource,
              velocitySource
            }
          };

          console.log("\n=== FINAL ASTEROID DATA ===");
          console.log(`Name: ${name}`);
          console.log(`Diameter: ${diameter.toFixed(2)} meters [${diameterSource}]`);
          console.log(`Mass: ${mass.toExponential(2)} kg [${massSource}]`);
          console.log(`Velocity: ${finalVelocity.toFixed(2)} km/s [${velocitySource}]`);
          console.log(`Composition: ${composition} (default)`);
          console.log(`Semi-major Axis: ${orbitalElements.semiMajorAxis.toFixed(2)} M km`);
          console.log(`Eccentricity: ${orbitalElements.eccentricity.toFixed(4)}`);
          console.log(`Period: ${period.toFixed(2)} days`);
          console.log("===========================\n");

          setCelestialBodies((prev) => [...prev, asteroid]);
        } else {
          alert(`Could not parse orbital data for ${name}.`);
        }
      } else {
        alert(`No data returned for ${name}.`);
      }
    } catch (error) {
      console.error(`Error fetching asteroid ${name}:`, error);
      alert(`Network error loading ${name}.\n\nDetails: ${error.message}`);
    } finally {
      setIsLoadingNASAData(false);
    }
  };

  const handleAddByDesignation = async () => {
    const designation = manualDesignation.trim();
    if (!designation) return;

    const displayName = manualName.trim() || designation;

    try {
      await addRealAsteroid(displayName, designation);
      // clear inputs on success
      setManualDesignation("");
      setManualName("");
    } catch (e) {
      // addRealAsteroid already alerts on failure; ensure loading flag cleared
      setIsLoadingNASAData(false);
    }
  };

  const dateToJulianDate = (date) => {
    const time = date.getTime();
    const tzoffset = date.getTimezoneOffset();
    return time / 86400000 - tzoffset / 1440 + 2440587.5;
  };

  const parseHorizonsVectorData = (result) => {
    try {
      if (!result || typeof result !== "object") {
        throw new Error("Invalid response format");
      }

      // Check for error messages
      if (result.error) {
        throw new Error(`API Error: ${result.error}`);
      }

      const soeIndex = result.result.indexOf("$$SOE");
      const eoeIndex = result.result.indexOf("$$EOE");

      if (soeIndex === -1 || eoeIndex === -1) {
        throw new Error("No vector data found in response");
      }

      const dataSection = result.result
        .substring(soeIndex + 5, eoeIndex)
        .trim();
      const lines = dataSection
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        throw new Error("Insufficient data lines in response");
      }

      // Parse CSV format - all data is on ONE line, comma-separated
      // Format: JDTDB, Calendar Date, X, Y, Z, VX, VY, VZ, LT, RG, RR
      const firstLine = lines[0];
      const values = firstLine.split(",").map((v) => v.trim());

      if (values.length < 11) {
        throw new Error(`Insufficient columns in data: ${values.length}`);
      }

      const jdtdb = parseFloat(values[0]);
      const dateStr = values[1];
      const x = parseFloat(values[2]);
      const y = parseFloat(values[3]);
      const z = parseFloat(values[4]);
      const vx = parseFloat(values[5]);
      const vy = parseFloat(values[6]);
      const vz = parseFloat(values[7]);

      // Validate parsed values
      if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(vx) || isNaN(vy) || isNaN(vz)) {
        throw new Error("Failed to parse numeric values from data");
      }

      // Values are already in KM and KM/S due to OUT_UNITS parameter
      return {
        x,
        y,
        z, // Position in kilometers
        vx,
        vy,
        vz, // Velocity in kilometers per second
        date: dateStr,
        jdtdb: jdtdb,
        frame: "J2000",
        center: "@sun",
        units: "KM-S",
      };
    } catch (error) {
      console.error("Error parsing Horizons data:", error);
      return null;
    }
  };

  const stateVectorsToOrbitalElements = (vectors) => {
    const { x, y, z, vx, vy, vz } = vectors;

    const r = Math.sqrt(x * x + y * y + z * z);
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

    const mu = 1.32712440018e11;
    const epsilon = (v * v) / 2 - mu / r;
    const a = -mu / (2 * epsilon);

    const hx = y * vz - z * vy;
    const hy = z * vx - x * vz;
    const hz = x * vy - y * vx;

    const ex = (vy * hz - vz * hy) / mu - x / r;
    const ey = (vz * hx - vx * hz) / mu - y / r;
    const ez = (vx * hy - vy * hx) / mu - z / r;
    const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

    const period = (2 * Math.PI * Math.sqrt((a * a * a) / mu)) / 86400;
    const argPeri = (Math.atan2(ey, ex) * 180) / Math.PI;

    return {
      semiMajorAxis: a / 1000000,
      eccentricity: e,
      period: period,
      velocity: v,
      argumentOfPeriapsis: argPeri >= 0 ? argPeri : argPeri + 360,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#191928] p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-gray-200 mb-2">
          NASA Accurate Solar System
        </h1>
        <p className="text-gray-300 text-sm">
          Real-time orbital simulation with Impact Analysis
        </p>

        <div className="mt-3 flex gap-4 justify-center items-center flex-wrap">
          <div className="bg-[#1e1e30] px-4 py-2 rounded-lg">
            <p className="text-gray-400 text-xs">Simulation Date</p>
            <p className="text-gray-200 text-sm font-bold">
              {currentSimulationDate.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="text-gray-300 text-xs">
              {currentSimulationDate.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className={`px-4 py-2 rounded-lg bg-[#1e1e30]`}>
            <p className="text-gray-400 text-xs">Calculation Mode</p>
            <p className="text-sm font-bold text-gray-200">{calculationMode}</p>
            <p className="text-gray-400 text-xs mt-1">
              Orbital mechanics from NASA fact sheets
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-xs mt-2">
          Scroll to zoom - Drag to pan - Analyze collision risks
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        className=" rounded-lg shadow-2xl bg-black cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <div className="flex flex-wrap gap-3 items-center justify-center mt-6 mb-4">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="px-5 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold transition-colors"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>

        <button
          onClick={resetSimulation}
          className="px-5 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold transition-colors"
        >
          Reset Time
        </button>

        <button
          onClick={syncToNow}
          className="px-5 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold transition-colors"
        >
          Sync Now
        </button>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="px-5 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold transition-colors"
        >
          {showInfo ? "Hide Info" : "Show Info"}
        </button>

        <button
          onClick={() => setShowAddObject(!showAddObject)}
          className="px-5 py-2 bg-green-600 hover:bg-green-700 text-gray-200 rounded-lg font-semibold transition-colors"
        >
          Add Custom Object
        </button>

        {celestialBodies.filter((b) => b.type !== "planet").length > 0 && (
          <button
            onClick={removeAllCustomObjects}
            className="px-5 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold transition-colors"
          >
            Clear All Custom
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-gray-200 font-semibold">Time Speed:</label>
        <input
          type="range"
          min="0"
          max="8"
          step="0.1"
          value={Math.log10(speed)}
          onChange={(e) => setSpeed(Math.pow(10, parseFloat(e.target.value)))}
          className="w-48"
        />
        <span className="text-gray-200 w-32 text-center text-sm">
          {speed === 1
            ? "Real-time"
            : speed < 86400
            ? `${speed.toFixed(0)}x`
            : `${(speed / 86400).toFixed(0)} days/s`}
        </span>
      </div>

      <div className="mt-2 flex gap-2 flex-wrap justify-center">
        <button
          onClick={() => setSpeed(1)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          Real-time
        </button>
        <button
          onClick={() => setSpeed(3600)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          1 hour/sec
        </button>
        <button
          onClick={() => setSpeed(86400)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          1 day/sec
        </button>
        <button
          onClick={() => setSpeed(604800)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          1 week/sec
        </button>
        <button
          onClick={() => setSpeed(2592000)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          1 month/sec
        </button>
        <button
          onClick={() => setSpeed(31536000)}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          1 year/sec
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-gray-200 font-semibold">Zoom:</label>
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded"
        >
          −
        </button>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-32"
        />
        <button
          onClick={() => setZoom(Math.min(5, zoom + 0.25))}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded"
        >
          +
        </button>
        <span className="text-gray-200 w-16 text-center text-sm">
          {zoom.toFixed(1)}x
        </span>
        <button
          onClick={() => {
            setZoom(1);
            setPanX(0);
            setPanY(0);
          }}
          className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
        >
          Reset View
        </button>
      </div>
      <div className="mb-4 max-w-4xl mx-auto bg-[#1e1e30] p-4 rounded-lg">
        <h3 className="text-gray-200 font-bold mb-3 text-center">
          Add Real Asteroids from NASA Database
        </h3>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => addRealAsteroid("Apophis", "99942")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Apophis")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Apophis (99942)
          </button>

          <button
            onClick={() => addRealAsteroid("Eros", "433")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Eros")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Eros (433)
          </button>

          <button
            onClick={() => addRealAsteroid("Bennu", "101955")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Bennu")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Bennu (101955)
          </button>

          <button
            onClick={() => addRealAsteroid("Ryugu", "162173")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Ryugu")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Ryugu (162173)
          </button>

          <button
            onClick={() => addRealAsteroid("Vesta", "4")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Vesta")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Vesta (4)
          </button>

          {/* More important/main-belt asteroids */}
          <button
            onClick={() => addRealAsteroid("Ceres", "1")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Ceres")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Ceres (1)
          </button>

          <button
            onClick={() => addRealAsteroid("Pallas", "2")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Pallas")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Pallas (2)
          </button>

          <button
            onClick={() => addRealAsteroid("Juno", "3")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Juno")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Juno (3)
          </button>

          <button
            onClick={() => addRealAsteroid("Hygiea", "10")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Hygiea")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Hygiea (10)
          </button>

          <button
            onClick={() => addRealAsteroid("Interamnia", "704")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Interamnia")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Interamnia (704)
          </button>

          <button
            onClick={() => addRealAsteroid("Itokawa", "25143")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "Itokawa")
            }
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Itokawa (25143)
          </button>

          {/* Near-Earth Asteroids with Close Approaches */}
          <button
            onClick={() => addRealAsteroid("2019 OK", "2019 OK")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "2019 OK")
            }
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            2019 OK
          </button>

          <button
            onClick={() => addRealAsteroid("2023 DW", "2023 DW")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "2023 DW")
            }
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            2023 DW
          </button>

          <button
            onClick={() => addRealAsteroid("2024 PT5", "2024 PT5")}
            disabled={
              isLoadingNASAData ||
              celestialBodies.some((b) => b.name === "2024 PT5")
            }
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            2024 PT5
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <input
            type="text"
            placeholder="Designation (e.g. 99942 or 2025 AB)"
            value={manualDesignation}
            onChange={(e) => setManualDesignation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddByDesignation();
              }
            }}
            className="px-3 py-2 bg-[#1e1e30] text-gray-200 rounded w-56 border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
          />
          <input
            type="text"
            placeholder="Optional display name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddByDesignation();
              }
            }}
            className="px-3 py-2 bg-[#1e1e30] text-gray-200 rounded w-44 border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
          />
          <button
            onClick={() => handleAddByDesignation()}
            disabled={isLoadingNASAData || !manualDesignation.trim()}
            className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded font-semibold text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {showAddObject && (
        <div className="mt-6 bg-[#1e1e30] p-6 rounded-lg max-w-3xl w-full">
          <h3 className="text-gray-200 font-bold text-lg mb-4">
            Add Custom Celestial Object
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Name *</label>
              <input
                type="text"
                value={newObject.name}
                onChange={(e) =>
                  setNewObject({ ...newObject, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                placeholder="e.g., Halley's Comet"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Object Type
              </label>
              <select
                value={newObject.type}
                onChange={(e) =>
                  setNewObject({ ...newObject, type: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)] cursor-pointer"
              >
                <option value="asteroid">Asteroid</option>
                <option value="comet">Comet</option>
                <option value="dwarf-planet">Dwarf Planet</option>
                <option value="trans-neptunian">Trans-Neptunian Object</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Semi-Major Axis (million km)
              </label>
              <input
                type="number"
                value={newObject.distanceKm}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    distanceKm: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                min="10"
                max="10000"
              />
              <span className="text-xs text-gray-400">
                Average distance from Sun
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Eccentricity (0-0.99)
              </label>
              <input
                type="number"
                value={newObject.eccentricity}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    eccentricity: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                min="0"
                max="0.99"
                step="0.01"
              />
              <span className="text-xs text-gray-400">
                0 = circle, higher = more elliptical
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Mass (kg, scientific notation)
              </label>
              <input
                type="number"
                value={newObject.mass}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    mass: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                step="1e10"
              />
              <span className="text-xs text-gray-400">
                e.g., 1e15 = 1×10¹⁵ kg
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Diameter (meters, optional)
              </label>
              <input
                type="number"
                value={newObject.diameter || ""}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    diameter: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                step="1"
                placeholder="Auto-calculated from mass"
              />
              <span className="text-xs text-gray-400">
                Leave empty to auto-calculate from mass
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Composition
              </label>
              <select
                onChange={(e) =>
                  setNewObject({ ...newObject, composition: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
              >
                <option value="Rocky">Rocky (Silicate)</option>
                <option value="Metallic">Metallic (Iron-Nickel)</option>
                <option value="Icy">Icy (Water/Methane)</option>
                <option value="Carbonaceous">Carbonaceous</option>
                <option value="Mixed">Mixed Composition</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Argument of Perihelion (degrees)
              </label>
              <input
                type="number"
                value={newObject.perihelionArg}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    perihelionArg: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                min="0"
                max="360"
              />
              <span className="text-xs text-gray-400">
                Rotation of orbit (0-360°)
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">
                Visual Size (pixels)
              </label>
              <input
                type="number"
                value={newObject.radius}
                onChange={(e) =>
                  setNewObject({
                    ...newObject,
                    radius: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-[#1e1e30] text-gray-200 rounded border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
                min="2"
                max="30"
              />
              <span className="text-xs text-gray-400">
                Larger = easier to see (2-30 pixels)
              </span>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">Color</label>
              <input
                type="color"
                value={newObject.color}
                onChange={(e) =>
                  setNewObject({ ...newObject, color: e.target.value })
                }
                className="w-full h-10 bg-[#1e1e30] rounded cursor-pointer border-2 border-[#3b82f5] focus:ring-2 focus:ring-[#3b82f5] focus:outline-none transition-all shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)]"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#1e1e30] rounded">
            <p className="text-sm text-gray-300">
              <strong>Calculated Orbital Period:</strong>{" "}
              {calculateOrbitalPeriod(newObject.distanceKm).toFixed(2)} Earth
              days (
              {(calculateOrbitalPeriod(newObject.distanceKm) / 365.25).toFixed(
                2
              )}{" "}
              years)
            </p>
            <p className="text-sm text-gray-300 mt-1">
              <strong>Orbital Velocity:</strong>{" "}
              {calculateOrbitalVelocity(
                newObject.distanceKm,
                calculateOrbitalPeriod(newObject.distanceKm)
              ).toFixed(2)}{" "}
              km/s
            </p>
            {!newObject.diameter && newObject.mass && (
              <p className="text-sm text-gray-300 mt-1">
                <strong>Estimated Diameter:</strong>{" "}
                {calculateDiameterFromMass(
                  newObject.mass,
                  newObject.composition
                ).toFixed(2)}{" "}
                meters
                <span className="text-xs text-gray-400 ml-2">
                  (from mass & composition)
                </span>
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => setShowAddObject(false)}
              className="px-4 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded"
            >
              Cancel
            </button>
            <button
              onClick={addCustomObject}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-200 rounded font-semibold"
            >
              Add to Simulation
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-600">
            <p className="text-gray-300 text-sm mb-2">Quick Presets:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() =>
                  setNewObject({
                    name: "Halley's Comet",
                    type: "comet",
                    radius: 5,
                    color: "#88CCFF",
                    distanceKm: 2678,
                    eccentricity: 0.967,
                    mass: 2.2e14,
                    diameter: 11000, // meters (11 km)
                    composition: "Icy",
                    perihelionArg: 111,
                    inclination: 0,
                  })
                }
                className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
              >
                Halley's Comet
              </button>
              <button
                onClick={() =>
                  setNewObject({
                    name: "Ceres",
                    type: "dwarf-planet",
                    radius: 6,
                    color: "#C4A57B",
                    distanceKm: 414,
                    eccentricity: 0.076,
                    mass: 9.39e20,
                    diameter: 939400, // meters (939.4 km)
                    composition: "Rocky",
                    perihelionArg: 73,
                    inclination: 0,
                  })
                }
                className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
              >
                Ceres (Dwarf Planet)
              </button>
              <button
                onClick={() =>
                  setNewObject({
                    name: "Pluto",
                    type: "dwarf-planet",
                    radius: 5,
                    color: "#DEB887",
                    distanceKm: 5906,
                    eccentricity: 0.244,
                    mass: 1.31e22,
                    diameter: 2376600, // meters (2376.6 km)
                    composition: "Icy",
                    perihelionArg: 113,
                    inclination: 0,
                  })
                }
                className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
              >
                Pluto
              </button>
              <button
                onClick={() =>
                  setNewObject({
                    name: "Bennu",
                    type: "asteroid",
                    radius: 4,
                    color: "#8B7355",
                    distanceKm: 168,
                    eccentricity: 0.204,
                    mass: 7.3e10,
                    diameter: 492, // meters (0.492 km)
                    composition: "Carbonaceous",
                    perihelionArg: 66,
                    inclination: 0,
                  })
                }
                className="px-3 py-1 bg-gray-600 hover:bg-[#3b82f5] text-gray-200 rounded text-xs"
              >
                Bennu (Asteroid)
              </button>
              <button
                onClick={() =>
                  setNewObject({
                    name: "The Collider",
                    type: "asteroid",
                    radius: 6,
                    color: "#FF0000",
                    distanceKm: 149.8,
                    eccentricity: 0.015,
                    mass: 5e15,
                    diameter: 1380, // meters (1.38 km)
                    composition: "Metallic",
                    perihelionArg: 102,
                    inclination: 0,
                  })
                }
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-gray-200 rounded text-xs animate-pulse"
              >
                The Collider (COLLISION COURSE!)
              </button>
            </div>
            <p className="text-red-400 text-xs mt-2 italic">
              "The Collider" is reverse-calculated to have a collision
              trajectory with Earth!
            </p>
          </div>
        </div>
      )}

      {celestialBodies.filter((b) => b.type !== "planet").length > 0 && (
        <div className="mt-4 bg-[#1e1e30] p-4 rounded-lg max-w-3xl w-full">
          <h3 className="text-gray-200 font-bold mb-3">
            Custom Objects (Removable)
          </h3>
          <div className="space-y-2">
            {celestialBodies
              .filter((b) => b.type !== "planet")
              .map((body) => (
                <div
                  key={body.id}
                  className="flex items-center justify-between bg-[#1e1e30] p-3 rounded"
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: body.color }}
                      className="w-4 h-4 rounded-full"
                    ></div>
                    <div>
                      <p className="text-gray-200 font-semibold">{body.name}</p>
                      <p className="text-xs text-gray-400">
                        {body.type} - {body.distanceKm}M km - e=
                        {body.eccentricity} - {body.composition}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => analyzeObject(body)}
                      className="px-3 py-1 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded text-sm"
                    >
                      Impact Analysis
                    </button>
                    <button
                      onClick={() => removeCustomObject(body.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-gray-200 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showImpactAnalysis && impactData && selectedObjectForAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div
            className="bg-[#1e1e30] rounded-lg p-6 max-w-4xl w-full my-8"
            style={{ maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}
          >
            <div className="flex justify-between items-start mb-4 sticky top-0 bg-[#1e1e30] z-10 pb-2">
              <h2 className="text-2xl font-bold text-gray-200">
                Impact Analysis: {selectedObjectForAnalysis.name}
              </h2>
              <button
                onClick={() => setShowImpactAnalysis(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#1e1e30] p-4 rounded">
                <h3 className="text-gray-200 font-bold mb-2">
                  Orbital Intersection
                </h3>
                <p className="text-gray-300 text-sm mb-2">
                  <strong>Orbits Can Intersect:</strong>{" "}
                  <span
                    className={
                      impactData.orbitsIntersect
                        ? "text-red-400"
                        : "text-green-400"
                    }
                  >
                    {impactData.orbitsIntersect ? "Yes" : "No"}
                  </span>
                </p>
                <p className="text-gray-300 text-sm mb-2">
                  <strong>Minimum Distance:</strong>{" "}
                  {impactData.minDistance.toFixed(2)} million km
                </p>
                <p className="text-gray-300 text-sm">
                  <strong>≈</strong>{" "}
                  {(impactData.minDistanceKm / impactData.earthRadius).toFixed(
                    0
                  )}{" "}
                  Earth radii
                </p>
              </div>

              <div className="bg-[#1e1e30] p-4 rounded">
                <h3 className="text-gray-200 font-bold mb-2">
                  Impact Risk Assessment
                </h3>
                <p className="text-gray-300 text-sm mb-2">
                  <strong>Risk Level:</strong>{" "}
                  <span
                    className={
                      impactData.riskLevel === "Extreme"
                        ? "text-red-500 font-bold"
                        : impactData.riskLevel === "High"
                        ? "text-red-400 font-bold"
                        : impactData.riskLevel === "Moderate"
                        ? "text-gray-300"
                        : impactData.riskLevel === "Low"
                        ? "text-gray-400"
                        : "text-gray-300"
                    }
                  >
                    {impactData.riskLevel}
                  </span>
                </p>
                <p className="text-gray-300 text-sm mb-2">
                  <strong>Impact Probability:</strong>{" "}
                  {impactData.impactProbability.toFixed(4)}%
                </p>
                <div className="bg-[#1e1e30] h-4 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full ${
                      impactData.riskLevel === "Extreme"
                        ? "bg-red-600"
                        : impactData.riskLevel === "High"
                        ? "bg-red-500"
                        : impactData.riskLevel === "Moderate"
                        ? "bg-gray-600"
                        : "bg-gray-700"
                    }`}
                    style={{
                      width: `${Math.min(100, impactData.impactProbability)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e30] p-4 rounded mb-4">
              <h3 className="text-gray-200 font-bold mb-2">Object Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <div>
                  <strong>Type:</strong>{" "}
                  {selectedObjectForAnalysis.type || "Unknown"}
                </div>
                <div>
                  <strong>Mass:</strong>{" "}
                  {selectedObjectForAnalysis.mass
                    ? selectedObjectForAnalysis.mass.toExponential(2)
                    : "N/A"}{" "}
                  kg
                </div>
                {selectedObjectForAnalysis.diameter && (
                  <div>
                    <strong>Diameter:</strong>{" "}
                    {selectedObjectForAnalysis.diameter.toFixed(2)} meters
                  </div>
                )}
                <div>
                  <strong>Composition:</strong>{" "}
                  {selectedObjectForAnalysis.composition || "Unknown"}
                </div>
                <div>
                  <strong>Semi-major Axis:</strong>{" "}
                  {selectedObjectForAnalysis.distanceKm
                    ? selectedObjectForAnalysis.distanceKm.toFixed(1)
                    : "N/A"}{" "}
                  M km
                </div>
                <div>
                  <strong>Eccentricity:</strong>{" "}
                  {selectedObjectForAnalysis.eccentricity
                    ? selectedObjectForAnalysis.eccentricity.toFixed(3)
                    : "N/A"}
                </div>
                {selectedObjectForAnalysis.periodDays && (
                  <div>
                    <strong>Orbital Period:</strong>{" "}
                    {selectedObjectForAnalysis.periodDays.toFixed(1)} days
                  </div>
                )}
                {selectedObjectForAnalysis.velocityKmS && (
                  <div>
                    <strong>Orbital Velocity:</strong>{" "}
                    {selectedObjectForAnalysis.velocityKmS.toFixed(2)} km/s
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#1e1e30] p-4 rounded">
              <h3 className="text-gray-200 font-bold mb-3">
                Impact Comparison
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                {impactData.energyMegatons < 0.001 && (
                  <p>
                    <strong>Comparable to:</strong> Small meteorite (burns up in
                    atmosphere)
                  </p>
                )}
                {impactData.energyMegatons >= 0.001 &&
                  impactData.energyMegatons < 15 && (
                    <p>
                      <strong>Comparable to:</strong> Hiroshima bomb (15 kt) -
                      local devastation
                    </p>
                  )}
                {impactData.energyMegatons >= 15 &&
                  impactData.energyMegatons < 1000 && (
                    <p>
                      <strong>Comparable to:</strong> Tunguska event (1908) -
                      regional devastation
                    </p>
                  )}
                {impactData.energyMegatons >= 1000 &&
                  impactData.energyMegatons < 100000 && (
                    <p>
                      <strong>Comparable to:</strong> Large asteroid -
                      continental damage, climate effects
                    </p>
                  )}
                {impactData.energyMegatons >= 100000 && (
                  <p>
                    <strong>Comparable to:</strong> Chicxulub impact - global
                    mass extinction event
                  </p>
                )}

                {impactData.craterDiameter > 1000 && (
                  <p className="mt-2 text-gray-300">
                    <strong>Warning:</strong> Crater diameter exceeds 1 km -
                    would cause widespread devastation
                  </p>
                )}

                {impactData.craterDiameter > 10000 && (
                  <p className="text-red-400">
                    <strong>CATASTROPHIC:</strong> This impact would cause
                    global climate change and mass extinction
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  // Get exact values from impact analysis report
                  const impactVelocity = impactData.impactVelocity; // km/s from report
                  const diameter =
                    selectedObjectForAnalysis.diameter || "unknown"; // meters
                  const composition = (
                    selectedObjectForAnalysis.composition || "Rocky"
                  ).toLowerCase();

                  // Construct API URL with parameters
                  const apiUrl = `https://impact.meteosim.earth/?velocity=${impactVelocity}&diameter=${diameter}&composition=${composition}`;

                  // Open in new tab
                  window.open(apiUrl, "_blank");
                }}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-gray-200 rounded-lg font-semibold"
              >
                Simulate Impact
              </button>
              <button
                onClick={() => setShowImpactAnalysis(false)}
                className="px-6 py-2 bg-[#1e1e30] hover:bg-[#3b82f5] text-gray-200 rounded-lg font-semibold"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolarSystem;
