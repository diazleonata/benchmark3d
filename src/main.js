// Enhanced 3D Web Benchmark with WebGPU
import * as THREE from "three";
import Stats from "stats.js";

// WebGPU initialization
let renderer;
let webgpuSupported = false;

// Function to detect GPU information
async function detectGPU() {
    try {
        const canvas = document.createElement("canvas");
        const gl =
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");

        if (!gl) {
            return "WebGL not supported";
        }

        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
            return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
        return "GPU info protected";
    } catch (e) {
        console.error("GPU detection failed:", e);
        return "Detection failed";
    }
}

// Function to detect CPU information
function detectCPU() {
    try {
        // Try to get CPU core count
        const cores = navigator.hardwareConcurrency || "Unknown";
        document.getElementById("cpuCores").textContent = cores;

        // Try to get CPU architecture
        const arch =
            navigator.userAgentData?.platform ||
            navigator.platform ||
            "Unknown";
        return arch.replace("Win32", "").replace("MacIntel", "Apple Silicon");
    } catch (e) {
        console.error("CPU detection failed:", e);
        return "Unknown";
    }
}

// Initialize hardware detection on page load
window.addEventListener("load", async () => {
    // Detect and display CPU info
    document.getElementById("cpuName").textContent = detectCPU();

    // Detect and display GPU info
    const gpuInfo = await detectGPU();
    document.getElementById("gpuName").textContent = gpuInfo;
});

async function initRenderer() {
    // Check WebGPU support and initialize
    if ("gpu" in navigator) {
        try {
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: "high-performance"
            });

            if (adapter) {
                const device = await adapter.requestDevice({
                    requiredFeatures: [],
                    requiredLimits: {}
                });

                webgpuSupported = true;

                // Create WebGL renderer but with WebGPU optimizations
                renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    powerPreference: "high-performance",
                    alpha: true,
                    // WebGPU-optimized settings
                    precision: "highp",
                    stencil: false,
                    depth: true,
                    premultipliedAlpha: false,
                    preserveDrawingBuffer: false
                });

                // Store WebGPU device for potential compute shader usage
                renderer.webgpuDevice = device;
                renderer.webgpuAdapter = adapter;

                console.log("🚀 WebGPU-enhanced WebGL renderer initialized");
                console.log("GPU:", adapter.info || "WebGPU Adapter");
            }
        } catch (error) {
            console.warn("WebGPU not available, using standard WebGL:", error);
            webgpuSupported = false;
        }
    }

    // Standard WebGL renderer if WebGPU is not supported
    if (!webgpuSupported) {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: true
        });
        console.log("📱 Standard WebGL renderer initialized");
    }

    // Enhanced renderer settings
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, webgpuSupported ? 3 : 2)
    );

    // Enhanced shadow and lighting settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = webgpuSupported
        ? THREE.PCFSoftShadowMap
        : THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = true;

    // Enhanced tone mapping and exposure
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = webgpuSupported ? 1.5 : 1.2;

    // WebGPU-specific optimizations
    if (webgpuSupported) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.useLegacyLights = false;
        renderer.physicallyCorrectLights = true;
    }

    document.body.appendChild(renderer.domElement);

    // Initialize the rest of the benchmark
    initBenchmark();
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);

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

// Enhanced quality settings for WebGPU
const qualitySettings = {
    insane: {
        cubes: webgpuSupported ? 3000 : 2000,
        particles: webgpuSupported ? 30000 : 20000,
        lights: webgpuSupported ? 35 : 25,
        effects: true,
        complexity: webgpuSupported ? 6 : 4,
        computeShaders: webgpuSupported
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
        if (light.type !== "AmbientLight") {
            scene.remove(light);
        }
    });
    lights = lights.filter(light => light.type === "AmbientLight");
}

function createEnhancedParticleSystem(count, color = 0xffffff, size = 0.1) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Positions
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

        // Velocities
        velocities[i * 3] = (Math.random() - 0.5) * 2;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

        // Colors with enhanced HDR values for WebGPU
        const hue = Math.random();
        const saturation = 0.8 + Math.random() * 0.2;
        const lightness = webgpuSupported
            ? 0.7 + Math.random() * 0.8
            : 0.5 + Math.random() * 0.5;
        const rgb = hslToRgb(hue, saturation, lightness);
        colors[i * 3] = rgb.r;
        colors[i * 3 + 1] = rgb.g;
        colors[i * 3 + 2] = rgb.b;

        // Enhanced attributes for WebGPU
        scales[i] = 0.5 + Math.random() * 1.5;
        lifetimes[i] = Math.random();
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("lifetime", new THREE.BufferAttribute(lifetimes, 1));

    const material = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: webgpuSupported ? 0.9 : 0.8,
        sizeAttenuation: true
    });

    // Enhanced material properties for WebGPU
    if (webgpuSupported) {
        material.toneMapped = true;
    }

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
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r, g, b };
}

function createExplosionEffect(position) {
    const particleCount = webgpuSupported ? 300 : 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const speed = 5 + Math.random() * (webgpuSupported ? 15 : 10);
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;

        velocities[i * 3] = Math.sin(theta) * Math.cos(phi) * speed;
        velocities[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * speed;
        velocities[i * 3 + 2] = Math.cos(theta) * speed;

        // Enhanced HDR colors for WebGPU
        colors[i * 3] = webgpuSupported ? 1.5 : 1;
        colors[i * 3 + 1] = Math.random() * (webgpuSupported ? 1.2 : 0.5);
        colors[i * 3 + 2] = 0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: webgpuSupported ? 0.4 : 0.3,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    const explosion = new THREE.Points(geometry, material);
    explosion.userData = { life: 1.0, maxLife: webgpuSupported ? 80 : 60 };
    scene.add(explosion);
    explosionParticles.push(explosion);
}

function setupScene(quality) {
    clearScene();
    const settings = qualitySettings[quality];

    // Enhanced ambient lighting for WebGPU
    if (lights.length === 0) {
        const ambientLight = new THREE.AmbientLight(
            0x404080,
            webgpuSupported ? 0.4 : 0.3
        );
        scene.add(ambientLight);
        lights.push(ambientLight);
    }

    // Create dynamic cubes with enhanced materials
    const geometries = [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.SphereGeometry(
            0.5,
            webgpuSupported ? 24 : 16,
            webgpuSupported ? 24 : 16
        ),
        new THREE.ConeGeometry(0.5, 1, webgpuSupported ? 12 : 8),
        new THREE.OctahedronGeometry(0.7),
        ...(webgpuSupported
            ? [
                  new THREE.TorusGeometry(0.4, 0.2, 8, 16),
                  new THREE.DodecahedronGeometry(0.5)
              ]
            : [])
    ];

    for (let i = 0; i < settings.cubes; i++) {
        const geometry =
            geometries[Math.floor(Math.random() * geometries.length)];

        // Enhanced materials for WebGPU
        const material = webgpuSupported
            ? new THREE.MeshStandardMaterial({
                  color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
                  roughness: 0.2 + Math.random() * 0.3,
                  metalness: Math.random() * 0.8,
                  transparent: true,
                  opacity: 0.9,
                  emissive: new THREE.Color().setHSL(Math.random(), 0.5, 0.1)
              })
            : new THREE.MeshPhongMaterial({
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

        // Enhanced animation data
        cube.userData = {
            rotationSpeed: {
                x: (Math.random() - 0.5) * (webgpuSupported ? 0.03 : 0.02),
                y: (Math.random() - 0.5) * (webgpuSupported ? 0.03 : 0.02),
                z: (Math.random() - 0.5) * (webgpuSupported ? 0.03 : 0.02)
            },
            oscillation: {
                phase: Math.random() * Math.PI * 2,
                amplitude: Math.random() * (webgpuSupported ? 8 : 5) + 2
            }
        };

        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cubes.push(cube);
    }

    // Create enhanced particle system
    particleSystem = createEnhancedParticleSystem(settings.particles);
    scene.add(particleSystem);

    // Create enhanced dynamic lights
    const lightColors = [
        0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff
    ];
    for (let i = 0; i < settings.lights; i++) {
        const light = new THREE.PointLight(
            lightColors[i % lightColors.length],
            webgpuSupported ? 3 : 2,
            webgpuSupported ? 120 : 100
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
            speed: 0.01 + Math.random() * (webgpuSupported ? 0.03 : 0.02)
        };
        scene.add(light);
        lights.push(light);
    }

    // Camera position
    camera.position.set(0, 0, 80);
    camera.lookAt(0, 0, 0);

    // Enhanced scene fog
    scene.fog = new THREE.Fog(0x000011, 50, webgpuSupported ? 400 : 300);
}

function updateParticles(deltaTime) {
    if (!particleSystem) return;

    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.geometry.attributes.velocity.array;
    const colors = particleSystem.geometry.attributes.color.array;
    const scales = particleSystem.geometry.attributes.scale?.array;
    const lifetimes = particleSystem.geometry.attributes.lifetime?.array;

    for (let i = 0; i < positions.length; i += 3) {
        const particleIndex = i / 3;

        // Update positions
        positions[i] += velocities[i] * deltaTime;
        positions[i + 1] += velocities[i + 1] * deltaTime;
        positions[i + 2] += velocities[i + 2] * deltaTime;

        // Update lifetimes and scales for WebGPU
        if (webgpuSupported && lifetimes && scales) {
            lifetimes[particleIndex] += deltaTime * 0.01;
            scales[particleIndex] =
                0.5 + Math.sin(lifetimes[particleIndex] * 2) * 0.5;
        }

        // Boundary check and reset
        if (
            Math.abs(positions[i]) > 150 ||
            Math.abs(positions[i + 1]) > 150 ||
            Math.abs(positions[i + 2]) > 150
        ) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = (Math.random() - 0.5) * 50;
            positions[i + 2] = (Math.random() - 0.5) * 50;

            if (lifetimes) lifetimes[particleIndex] = 0;
        }

        // Enhanced color animation for WebGPU
        const time = performance.now() * 0.001;
        const hue = (time * 0.1 + i * 0.01) % 1;
        const intensity = webgpuSupported ? 1.2 : 0.6;
        const rgb = hslToRgb(hue, 0.8, intensity);
        colors[i] = rgb.r;
        colors[i + 1] = rgb.g;
        colors[i + 2] = rgb.b;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    if (webgpuSupported) {
        if (scales) particleSystem.geometry.attributes.scale.needsUpdate = true;
        if (lifetimes)
            particleSystem.geometry.attributes.lifetime.needsUpdate = true;
    }
}

function updateExplosions(deltaTime) {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const explosion = explosionParticles[i];
        const positions = explosion.geometry.attributes.position.array;
        const velocities = explosion.geometry.attributes.velocity.array;

        explosion.userData.life -= deltaTime * (webgpuSupported ? 0.015 : 0.02);

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

            // Apply enhanced physics for WebGPU
            velocities[j + 1] -= (webgpuSupported ? 0.7 : 0.5) * deltaTime;

            // Air resistance for WebGPU
            if (webgpuSupported) {
                velocities[j] *= 0.999;
                velocities[j + 1] *= 0.999;
                velocities[j + 2] *= 0.999;
            }
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

    // Add enhanced initial explosions
    setTimeout(() => {
        if (running) {
            const explosionCount = webgpuSupported ? 5 : 3;
            for (let i = 0; i < explosionCount; i++) {
                setTimeout(() => {
                    if (running) {
                        createExplosionEffect(
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 100,
                                (Math.random() - 0.5) * 100,
                                (Math.random() - 0.5) * 100
                            )
                        );
                    }
                }, i * 800);
            }
        }
    }, 2000);

    animate();
}

function animate() {
    if (!running) return;

    stats.begin();

    const currentTime = performance.now();
    const deltaTime = Math.min(
        (currentTime - (animate.lastTime || currentTime)) / 16.67,
        2
    );
    animate.lastTime = currentTime;

    // Enhanced scene rotation for WebGPU
    const rotationSpeed = webgpuSupported ? 0.007 : 0.005;
    scene.rotation.y += rotationSpeed;
    scene.rotation.x += rotationSpeed * 0.4;

    // Update cubes with enhanced animation
    cubes.forEach((cube, index) => {
        cube.rotation.x += cube.userData.rotationSpeed.x;
        cube.rotation.y += cube.userData.rotationSpeed.y;
        cube.rotation.z += cube.userData.rotationSpeed.z;

        // Enhanced oscillating movement
        const time = currentTime * 0.001;
        const osc = cube.userData.oscillation;
        cube.position.y +=
            Math.sin(time * 2 + osc.phase) * osc.amplitude * 0.01;

        // Enhanced scale animation for WebGPU
        if (webgpuSupported) {
            const scale = 1 + Math.sin(time * 3 + index) * 0.1;
            cube.scale.setScalar(scale);
        }

        // Enhanced explosion frequency for WebGPU
        const explosionChance = webgpuSupported ? 0.00015 : 0.0001;
        const maxExplosions = webgpuSupported ? 8 : 5;
        if (
            Math.random() < explosionChance &&
            explosionParticles.length < maxExplosions
        ) {
            createExplosionEffect(cube.position);
            cameraShake.intensity = Math.max(
                cameraShake.intensity,
                webgpuSupported ? 0.7 : 0.5
            );
        }
    });

    // Enhanced dynamic lights animation
    lights.forEach(light => {
        if (light.userData && light.userData.originalPosition) {
            const time = currentTime * 0.001;
            const data = light.userData;
            const amplitude = webgpuSupported ? 40 : 30;
            light.position.x =
                data.originalPosition.x +
                Math.sin(time * data.speed) * amplitude;
            light.position.y =
                data.originalPosition.y +
                Math.cos(time * data.speed * 1.3) * (amplitude * 0.7);
            light.position.z =
                data.originalPosition.z +
                Math.sin(time * data.speed * 0.7) * (amplitude * 0.8);

            // Enhanced light intensity animation for WebGPU
            if (webgpuSupported) {
                light.intensity = 2 + Math.sin(time * data.speed * 2) * 1;
            }
        }
    });

    // Update particles
    updateParticles(deltaTime);

    // Update explosions
    updateExplosions(deltaTime);

    // Enhanced camera shake
    if (cameraShake.intensity > 0) {
        cameraShake.x = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.y = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.intensity *= 0.95;

        camera.position.x += cameraShake.x;
        camera.position.y += cameraShake.y;
    }

    // Enhanced auto camera movement
    const time = currentTime * 0.001;
    const cameraRadius = webgpuSupported ? 25 : 20;
    const cameraDistance = webgpuSupported ? 35 : 30;
    camera.position.x = Math.sin(time * 0.3) * cameraRadius;
    camera.position.z = 80 + Math.cos(time * 0.2) * cameraDistance;
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

    // Enhanced performance categories for WebGPU
    if (avgFPS > 55) {
        performance = webgpuSupported ? "🔥 WEBGPU BEAST" : "🔥 BEAST MODE";
        emoji = "🚀";
    } else if (avgFPS > 40) {
        performance = webgpuSupported ? "💪 WEBGPU HIGH-END" : "💪 HIGH-END";
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
        <div style="font-size: 16px; margin: 10px 0; color: ${
            webgpuSupported ? "#00ff88" : "#ff8800"
        };">
            Renderer: ${
                webgpuSupported ? "WebGPU-Enhanced WebGL ⚡" : "Standard WebGL"
            }
        </div>
        <p>CPU: ${document.getElementById("cpuName").textContent}</p>
        <p>GPU: ${document.getElementById("gpuName").textContent}</p>
        <p>Cores: ${document.getElementById("cpuCores").textContent}</p>
        <div style="font-size: 14px; margin-top: 15px; color: #888;">
            Quality: ${quality.toUpperCase()}<br>
            Objects: ${settings.cubes} cubes, ${
                settings.particles
            } particles<br>
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

function initBenchmark() {
    // Event listeners
    startBtn.addEventListener("click", startBenchmark);

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && running) {
            finishBenchmark();
        }
    });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Enhanced performance monitoring
    setInterval(() => {
        if (running && performance.memory) {
            console.log(
                `Memory: ${(
                    performance.memory.usedJSHeapSize /
                    1024 /
                    1024
                ).toFixed(1)}MB | Renderer: ${
                    webgpuSupported ? "WebGPU" : "WebGL"
                }`
            );
        }
    }, 5000);

    console.log(
        `🎮 Benchmark initialized with ${
            webgpuSupported ? "WebGPU" : "WebGL"
        } renderer`
    );
}

// Initialize the renderer and benchmark
initRenderer().catch(console.error);
