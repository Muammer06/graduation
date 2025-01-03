import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SpaceVisualizer {
    constructor(container) {
        // Temel ayarlar
        this.container = container;
        this.scene = new THREE.Scene();
        
        // Performans ayarları
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance",
            precision: "highp",
            alpha: false,
            stencil: false,
            logarithmicDepthBuffer: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Kamera ayarları
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            1000,
            1e9
        );
        this.camera.position.set(100000, 100000, 100000);
        
        // Ölçek faktörleri
        this.SCALE = {
            EARTH: 6371000,     // Dünya yarıçapı (6371 km)
            MOON: 1737000,      // Ay yarıçapı (1737 km)
            SATELLITE: 100000,   // Uydu boyutu (görünürlük için büyütülmüş)
            ROCKET: 150000,     // Roket boyutu (görünürlük için büyütülmüş)
            GEO_ORBIT: 42164000 // Jeosenkron yörünge (42,164 km)
        };

        // Kontrol optimizasyonları
        this.setupControls();

        // Performans limitleri
        this.maxVisibleSatellites = 20;
        this.rocketPathLength = 30;
        this.maxOrbitSegments = 50;
        
        // Renk paleti
        this.satelliteColors = [
            0xff4444, // Kırmızı
            0x44ff44, // Yeşil
            0x4444ff, // Mavi
            0xffff44, // Sarı
            0xff44ff, // Mor
            0x44ffff  // Turkuaz
        ];
        
        // Animasyon durumu
        this.isPlaying = false;
        this.currentStep = 0;
        this.solution = null;
        this.animationSpeed = 1;
        this.lastTime = 0;

        // Sahne kurulumu sırası önemli!
        this.setupScene();
        this.createEarth();
        this.createMoon();
        this.createRocket();
        
        // Event listener'ları ekle
        this.setupEventListeners();
        
        // Animasyon döngüsünü başlat
        this.animate();
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        
        // Kamera sınırlarını güncelle
        this.controls.minDistance = this.SCALE.EARTH * 1.5;  // Dünya'ya yakın
        this.controls.maxDistance = this.SCALE.GEO_ORBIT * 3; // Jeosenkron yörüngenin 3 katı kadar uzak
        
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 0.8;
        
        // Otomatik rotasyonu yavaşlat
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.2;
    }

    setupScene() {
        // Arka plan rengi
        this.scene.background = new THREE.Color(0x000510);
        
        // Işıklandırma
        const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(1, 1, 1).normalize();
        
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        this.scene.add(ambientLight, directionalLight, hemisphereLight);

        // Yörünge çizgileri için konteyner
        this.orbitLines = new THREE.Group();
        this.scene.add(this.orbitLines);

        // Dünyayı merkeze al
        this.scene.position.set(0, 0, 0);

        // Kamera pozisyonunu ayarla - daha iyi bir genel görünüm için
        const viewDistance = this.SCALE.GEO_ORBIT * 1.5; // Jeosenkron yörüngenin 1.5 katı uzaklık
        this.camera.position.set(
            viewDistance,
            viewDistance * 0.5,
            viewDistance
        );
        this.camera.lookAt(0, 0, 0);
        
        // Kontrol paneli
        this.createControlPanel();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(this.SCALE.EARTH, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            color: 0x2233ff,
            emissive: 0x112244,
            specular: 0x555555,
            shininess: 25
        });
        const earth = new THREE.Mesh(geometry, material);
        earth.userData.type = 'earth';
        this.scene.add(earth);
    }

    createMoon() {
        const geometry = new THREE.SphereGeometry(this.SCALE.MOON, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xcccccc,
            emissive: 0x222222,
            specular: 0x444444,
            shininess: 20
        });
        const moon = new THREE.Mesh(geometry, material);
        moon.userData.type = 'moon';
        this.scene.add(moon);
    }

    createRocket() {
        const geometry = new THREE.CylinderGeometry(this.SCALE.ROCKET, this.SCALE.ROCKET, this.SCALE.ROCKET * 4, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffaa00,
            emissive: 0x552200,
            specular: 0x333333,
            shininess: 30
        });
        const rocket = new THREE.Mesh(geometry, material);
        rocket.userData.type = 'rocket';
        this.scene.add(rocket);
    }

    createControlPanel() {
        // Kontrol paneli oluşturma
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            controlPanel.innerHTML = `
                <h3>Simülasyon Kontrolü</h3>
                <div id="rocket-info">Yakıt: <span class="highlight">100%</span></div>
                <div id="next-target">Hedef: <span class="highlight">-</span></div>
                <div id="total-distance">Mesafe: <span class="highlight">0 km</span></div>
                <div id="info-content" style="margin-top: 10px; max-height: 300px; overflow-y: auto;"></div>
            `;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        // Kontrol butonları için event listener'lar
        const playPauseBtn = document.getElementById('play-pause');
        const resetBtn = document.getElementById('reset');
        const stepForwardBtn = document.getElementById('step-forward');
        const stepBackwardBtn = document.getElementById('step-backward');
        const progressBar = document.getElementById('progress');

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAnimation());
        }
        if (stepForwardBtn) {
            stepForwardBtn.addEventListener('click', () => this.nextStep());
        }
        if (stepBackwardBtn) {
            stepBackwardBtn.addEventListener('click', () => this.previousStep());
        }
        if (progressBar) {
            progressBar.addEventListener('input', (event) => {
                this.currentStep = parseInt(event.target.value, 10);
                this.updateScene(this.solution[this.currentStep]);
            });
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        
        if (this.isPlaying && this.solution) {
            const now = Date.now();
            const delta = now - this.lastTime;
            if (delta > 1000 / this.animationSpeed) {
                this.nextStep();
                this.lastTime = now;
            }
        }
    }

    setSolution(solution) {
        this.solution = solution;
        this.currentStep = 0;
        this.isPlaying = true;
        this.updateScene(this.solution[this.currentStep]);
    }

    updateScene(data) {
        if (!data) return;
        
        // Roket ve uydu pozisyonlarını güncelle
        const rocketPosition = data.rocketPosition;
        const rocketFuel = data.rocketFuel;
        const totalDistance = data.totalDistance;
        
        this.updateRocket(rocketPosition, rocketFuel, totalDistance);
        
        if (data.satellites) {
            data.satellites.forEach((sat, idx) => {
                this.updateSatellite(idx, sat.position, sat.fuel);
            });
        }
        
        this.updateTargetInfo(data.targetIndex);
    }

    updateRocket(position, fuel, totalDistance) {
        let rocket = this.scene.children.find(child => child.userData.type === 'rocket');
        
        if (!rocket) {
            rocket = this.createRocket();
        }

        if (position) {
            rocket.position.set(position.x, position.y, position.z);
        }

        // Yakıt durumuna göre renk değiştir
        const fuelRatio = fuel / 500;
        const rocketBody = rocket.children[0];
        if (rocketBody) {
            rocketBody.material.emissive.setRGB(
                0.3 * (1 - fuelRatio),
                0.3 * fuelRatio,
                0
            );
        }
    }

    updateSatellite(index, position, fuel) {
        let satellite = this.scene.children.find(child => child.userData.type === 'satellite' && child.userData.index === index);
        
        if (!satellite) {
            satellite = this.createSatellite();
            satellite.userData.index = index;
            this.scene.add(satellite);
        }

        if (position) {
            satellite.position.set(position.x, position.y, position.z);
        }

        // Yakıt durumuna göre renk ve parlaklık ayarla
        const fuelRatio = fuel / 100;
        const baseColor = this.satelliteColors[index % this.satelliteColors.length];
        const color = new THREE.Color(baseColor);
        
        // Ana gövde rengi
        const body = satellite.children[0];
        body.material = body.material.clone();
        body.material.color = color;
        body.material.emissive.setRGB(
            0.2 * (1 - fuelRatio),
            0.2 * fuelRatio,
            0.2 * fuelRatio
        );

        // Halka rengi
        const ring = satellite.children[1];
        ring.material = ring.material.clone();
        ring.material.color = color;
        ring.material.opacity = 0.3 * fuelRatio;

        // Parıltı rengi
        const glow = satellite.children[2];
        glow.material = glow.material.clone();
        glow.material.color = color;
        glow.material.opacity = 0.15 * fuelRatio;
    }

    updateTargetInfo(targetIndex) {
        const targetInfo = document.getElementById('next-target');
        if (targetInfo) {
            const targetName = targetIndex === 0 ? "Ay" : `Uydu-${targetIndex}`;
            targetInfo.textContent = `Hedef: ${targetName}`;
        }
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        const button = document.getElementById('play-pause');
        if (button) {
            button.textContent = this.isPlaying ? '⏸️ Duraklat' : '▶️ Oynat';
        }
    }

    resetAnimation() {
        this.currentStep = 0;
        this.isPlaying = false;
        if (this.solution && this.solution.length > 0) {
            this.updateScene(this.solution[0]);
        }
        this.updateProgressUI();
    }

    nextStep() {
        if (this.solution && this.currentStep < this.solution.length - 1) {
            this.currentStep++;
            this.updateScene(this.solution[this.currentStep]);
            this.updateProgressUI();
        }
    }

    previousStep() {
        if (this.solution && this.currentStep > 0) {
            this.currentStep--;
            this.updateScene(this.solution[this.currentStep]);
            this.updateProgressUI();
        }
    }

    updateProgressUI() {
        const progressBar = document.getElementById('progress');
        const stepInfo = document.getElementById('step-info');
        
        if (progressBar && this.solution) {
            progressBar.max = this.solution.length - 1;
            progressBar.value = this.currentStep;
        }
        
        if (stepInfo && this.solution) {
            stepInfo.textContent = `Adım: ${this.currentStep + 1}/${this.solution.length}`;
        }
    }

    createSatellite() {
        const satellite = new THREE.Group();

        // Ana gövdeyi küresel yap ve büyüt
        const bodyGeometry = new THREE.SphereGeometry(
            this.SCALE.SATELLITE * 2, // Boyutu 2 kat büyüt
            32, // Daha yüksek detay
            32
        );
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xdddddd,
            emissive: 0x444444,
            specular: 0x666666,
            shininess: 30
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        satellite.add(body);

        // Yörünge halkası ekle (uyduya özel)
        const ringGeometry = new THREE.RingGeometry(
            this.SCALE.SATELLITE * 2.5,
            this.SCALE.SATELLITE * 2.7,
            32
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        satellite.add(ring);

        // Parıltı efekti ekle
        const glowGeometry = new THREE.SphereGeometry(
            this.SCALE.SATELLITE * 2.2,
            32,
            32
        );
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        satellite.add(glow);

        satellite.userData.type = 'satellite';
        return satellite;
    }
}

export { SpaceVisualizer }; 