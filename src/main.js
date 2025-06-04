// Enhanced 3D Web Benchmark with GPU Stress Effects
import * as THREE from 'three';
import Stats from 'stats.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: "high-performance",
    alpha: true 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Stats setup
const stats = new Stats();
stats.showPanel(0);
document.getElementById("fps").appendChild(stats.dom);

// UI elements
const resultBox = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const qualitySelect = document.getElementById("quality");

// Benchmark variables
let cubes = [];
let particles = [];
let lights = [];
let frameCount = 0;
let totalTime = 0;
const maxTime = 30;
let running = false;
let startTime = 0;

// Effect variables
let particleSystem;
let explosionParticles = [];
let cameraShake = { x: 0, y: 0, intensity: 0 };
let postProcessing = false;

// Quality settings
const qualitySettings = {
    insane: {
        cubes: 2000,
        particles: 20000,
        lights: 25,
        effects: true,
        complexity: 4
    }
};

function clearScene() {
    // Clear cubes
    cubes.forEach(cube => {
        scene.remove(cube);
        cube.geometry.dispose();
        cube.material.dispose();
    });
    cubes = [];

    // Clear particles
    if (particleSystem) {
        scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        particleSystem.material.dispose();
        particleSystem = null;
    }
    
    explosionParticles.forEach(system => {
        scene.remove(system);
        system.geometry.dispose();
        system.material.dispose();
    });
    explosionParticles = [];

    // Clear lights (keep ambient)
    lights.forEach(light => {
        if (light.type !== 'AmbientLight') {
            scene.remove(light);
        }
    });
    lights = lights.filter(light => light.type === 'AmbientLight');
}

function createParticleSystem(count, color = 0xffffff, size = 0.1) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        // Positions
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

        // Velocities
        velocities[i * 3] = (Math.random() - 0.5) * 2;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

        // Colors
        const hue = Math.random();
        const saturation = 0.8 + Math.random() * 0.2;
        const lightness = 0.5 + Math.random() * 0.5;
        const rgb = hslToRgb(hue, saturation, lightness);
        colors[i * 3] = rgb.r;
        colors[i * 3 + 1] = rgb.g;
        colors[i * 3 + 2] = rgb.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8
    });

    return new THREE.Points(geometry, material);
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r, g, b };
}

function createExplosionEffect(position) {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const speed = 5 + Math.random() * 10;
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        velocities[i * 3] = Math.sin(theta) * Math.cos(phi) * speed;
        velocities[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * speed;
        velocities[i * 3 + 2] = Math.cos(theta) * speed;

        colors[i * 3] = 1;
        colors[i * 3 + 1] = Math.random() * 0.5;
        colors[i * 3 + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    const explosion = new THREE.Points(geometry, material);
    explosion.userData = { life: 1.0, maxLife: 60 };
    scene.add(explosion);
    explosionParticles.push(explosion);
}

function setupScene(quality) {
    clearScene();
    const settings = qualitySettings[quality];

    // Enhanced ambient lighting
    if (lights.length === 0) {
        const ambientLight = new THREE.AmbientLight(0x404080, 0.3);
        scene.add(ambientLight);
        lights.push(ambientLight);
    }

    // Create dynamic cubes with different materials
    const geometries = [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.ConeGeometry(0.5, 1, 8),
        new THREE.OctahedronGeometry(0.7)
    ];

    for (let i = 0; i < settings.cubes; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150
        );
        
        cube.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        // Add rotation speeds
        cube.userData = {
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02,
                z: (Math.random() - 0.5) * 0.02
            },
            oscillation: {
                phase: Math.random() * Math.PI * 2,
                amplitude: Math.random() * 5 + 2
            }
        };

        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cubes.push(cube);
    }

    // Create particle system
    particleSystem = createParticleSystem(settings.particles);
    scene.add(particleSystem);

    // Create dynamic lights
    const lightColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];
    for (let i = 0; i < settings.lights; i++) {
        const light = new THREE.PointLight(
            lightColors[i % lightColors.length], 
            2, 
            100
        );
        light.position.set(
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200
        );
        light.castShadow = settings.effects;
        light.userData = {
            originalPosition: light.position.clone(),
            phase: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.02
        };
        scene.add(light);
        lights.push(light);
    }

    // Camera position
    camera.position.set(0, 0, 80);
    camera.lookAt(0, 0, 0);

    // Scene fog for depth
    scene.fog = new THREE.Fog(0x000011, 50, 300);
}

function updateParticles(deltaTime) {
    if (!particleSystem) return;

    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.geometry.attributes.velocity.array;
    const colors = particleSystem.geometry.attributes.color.array;

    for (let i = 0; i < positions.length; i += 3) {
        // Update positions
        positions[i] += velocities[i] * deltaTime;
        positions[i + 1] += velocities[i + 1] * deltaTime;
        positions[i + 2] += velocities[i + 2] * deltaTime;

        // Boundary check and reset
        if (Math.abs(positions[i]) > 150 || 
            Math.abs(positions[i + 1]) > 150 || 
            Math.abs(positions[i + 2]) > 150) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = (Math.random() - 0.5) * 50;
            positions[i + 2] = (Math.random() - 0.5) * 50;
        }

        // Update colors for rainbow effect
        const time = performance.now() * 0.001;
        const hue = (time * 0.1 + i * 0.01) % 1;
        const rgb = hslToRgb(hue, 0.8, 0.6);
        colors[i] = rgb.r;
        colors[i + 1] = rgb.g;
        colors[i + 2] = rgb.b;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
}

function updateExplosions(deltaTime) {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const explosion = explosionParticles[i];
        const positions = explosion.geometry.attributes.position.array;
        const velocities = explosion.geometry.attributes.velocity.array;

        explosion.userData.life -= deltaTime * 0.02;

        if (explosion.userData.life <= 0) {
            scene.remove(explosion);
            explosion.geometry.dispose();
            explosion.material.dispose();
            explosionParticles.splice(i, 1);
            continue;
        }

        // Update particle positions
        for (let j = 0; j < positions.length; j += 3) {
            positions[j] += velocities[j] * deltaTime;
            positions[j + 1] += velocities[j + 1] * deltaTime;
            positions[j + 2] += velocities[j + 2] * deltaTime;
            
            // Apply gravity
            velocities[j + 1] -= 0.5 * deltaTime;
        }

        explosion.geometry.attributes.position.needsUpdate = true;
        explosion.material.opacity = explosion.userData.life;
    }
}

function startBenchmark() {
    running = true;
    frameCount = 0;
    totalTime = 0;
    startTime = performance.now();
    resultBox.style.display = "none";
    
    // Hide UI after starting benchmark
    document.getElementById("ui").style.display = "none";
    
    setupScene(qualitySelect.value);
    
    // Add some initial explosions for visual impact
    setTimeout(() => {
        if (running) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (running) {
                        createExplosionEffect(new THREE.Vector3(
                            (Math.random() - 0.5) * 100,
                            (Math.random() - 0.5) * 100,
                            (Math.random() - 0.5) * 100
                        ));
                    }
                }, i * 1000);
            }
        }
    }, 2000);
    
    animate();
}

function animate() {
    if (!running) return;

    stats.begin();
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - (animate.lastTime || currentTime)) / 16.67, 2);
    animate.lastTime = currentTime;

    // Update scene rotation
    scene.rotation.y += 0.005;
    scene.rotation.x += 0.002;

    // Update cubes
    cubes.forEach((cube, index) => {
        cube.rotation.x += cube.userData.rotationSpeed.x;
        cube.rotation.y += cube.userData.rotationSpeed.y;
        cube.rotation.z += cube.userData.rotationSpeed.z;

        // Oscillating movement
        const time = currentTime * 0.001;
        const osc = cube.userData.oscillation;
        cube.position.y += Math.sin(time * 2 + osc.phase) * osc.amplitude * 0.01;
        
        // Random explosions
        if (Math.random() < 0.0001 && explosionParticles.length < 5) {
            createExplosionEffect(cube.position);
            cameraShake.intensity = Math.max(cameraShake.intensity, 0.5);
        }
    });

    // Update dynamic lights
    lights.forEach(light => {
        if (light.userData && light.userData.originalPosition) {
            const time = currentTime * 0.001;
            const data = light.userData;
            light.position.x = data.originalPosition.x + Math.sin(time * data.speed) * 30;
            light.position.y = data.originalPosition.y + Math.cos(time * data.speed * 1.3) * 20;
            light.position.z = data.originalPosition.z + Math.sin(time * data.speed * 0.7) * 25;
        }
    });

    // Update particles
    updateParticles(deltaTime);
    
    // Update explosions
    updateExplosions(deltaTime);

    // Camera shake
    if (cameraShake.intensity > 0) {
        cameraShake.x = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.y = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.intensity *= 0.95;
        
        camera.position.x += cameraShake.x;
        camera.position.y += cameraShake.y;
    }

    // Auto camera movement
    const time = currentTime * 0.001;
    camera.position.x = Math.sin(time * 0.3) * 20;
    camera.position.z = 80 + Math.cos(time * 0.2) * 30;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    stats.end();

    frameCount++;
    totalTime = (currentTime - startTime) / 1000;

    if (totalTime < maxTime && running) {
        requestAnimationFrame(animate);
    } else {
        finishBenchmark();
    }
}

function finishBenchmark() {
    running = false;
    const avgFPS = frameCount / totalTime;
    const quality = qualitySelect.value;
    const settings = qualitySettings[quality];
    
    let performance = "";
    let emoji = "";
    
    if (avgFPS > 55) {
        performance = "🔥 BEAST MODE";
        emoji = "🚀";
    } else if (avgFPS > 40) {
        performance = "💪 HIGH-END";
        emoji = "⚡";
    } else if (avgFPS > 25) {
        performance = "👍 MID-RANGE";
        emoji = "🎮";
    } else if (avgFPS > 15) {
        performance = "😅 BUDGET";
        emoji = "🐌";
    } else {
        performance = "💀 TOASTER";
        emoji = "🔥";
    }

    resultBox.innerHTML = `
        <h2 style="color: #00ff88; margin-bottom: 15px;">${emoji} BENCHMARK COMPLETE ${emoji}</h2>
        <div style="font-size: 24px; margin: 10px 0; color: #ffff00;">
            Average FPS: ${avgFPS.toFixed(1)}
        </div>
        <div style="font-size: 18px; margin: 10px 0;">
            Performance: ${performance}
        </div>
        <div style="font-size: 14px; margin-top: 15px; color: #888;">
            Quality: ${quality.toUpperCase()}<br>
            Objects: ${settings.cubes} cubes, ${settings.particles} particles<br>
            Lights: ${settings.lights} dynamic lights<br>
            Duration: ${totalTime.toFixed(1)}s
        </div>
        <div style="margin-top: 15px;">
            <button onclick="location.reload()" style="
                background: linear-gradient(45deg, #ff6b6b, #ffa500);
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                color: black;
                font-weight: bold;
                cursor: pointer;
            ">Run Again</button>
        </div>
    `;
    resultBox.style.display = "block";
}

// Event listeners
startBtn.addEventListener("click", startBenchmark);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && running) {
        finishBenchmark();
    }
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Performance monitoring
setInterval(() => {
    if (running && performance.memory) {
        console.log(`Memory: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
    }
}, 5000);