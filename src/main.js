import * as THREE from "three";
import Stats from "stats.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const stats = new Stats();
stats.showPanel(0);
document.getElementById("fps").appendChild(stats.dom);

const resultBox = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const qualitySelect = document.getElementById("quality");

let cubes = [];
let frameCount = 0;
let totalTime = 0;
const maxTime = 30;
let running = false;

function clearScene() {
    for (let obj of cubes) {
        scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
    }
    cubes = [];
}

function setupScene(quality) {
    clearScene();

    let count = 0;
    let lightIntensity = 1;
    switch (quality) {
        case "low":
            count = 50;
            lightIntensity = 0.5;
            break;
        case "medium":
            count = 200;
            lightIntensity = 1;
            break;
        case "high":
            count = 800;
            lightIntensity = 1.5;
            break;
    }

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });

    for (let i = 0; i < count; i++) {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        scene.add(cube);
        cubes.push(cube);
    }

    scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, lightIntensity);
    light.position.set(10, 10, 10);
    scene.add(light);

    camera.position.z = 50;
}

function startBenchmark() {
    running = true;
    frameCount = 0;
    totalTime = 0;
    resultBox.style.display = "none";
    setupScene(qualitySelect.value);
    animate();
}

function animate() {
    if (!running) return;

    stats.begin();
    scene.rotation.y += 0.001;
    renderer.render(scene, camera);
    stats.end();

    frameCount++;

    if (frameCount < maxTime * 60) {
        requestAnimationFrame(animate);
    } else {
        running = false;
        const avgFPS = frameCount / maxTime;
        resultBox.style.display = "block";
        resultBox.textContent = `Test complete - Avg FPS: ${avgFPS.toFixed(
            2
        )}\nPerformance: ${
            avgFPS > 50
                ? "🔥 High-end"
                : avgFPS > 30
                ? "👍 Mid-range"
                : "🐢 Low-end"
        }`;
    }
}

startBtn.addEventListener("click", startBenchmark);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
