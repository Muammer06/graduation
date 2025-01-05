class SpaceSimulation {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000000000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            logarithmicDepthBuffer: true 
        });
        this.clock = new THREE.Clock();
        this.rocketTrail = [];
        this.maxTrailLength = 50;
        this.isPlaying = false;
        this.isFirstMove = true;
        
        this.rocketStartPosition = new THREE.Vector3(384400000, 0, 0);
        
        this.pathSolution = null;
        this.currentNodeIndex = 0;
        this.totalDistance = 0;
        
        this.init();
        this.createObjects();
        this.setupLights();
        this.setupControls();
        
        if (this.rocket) {
            this.rocket.position.copy(this.rocketStartPosition);
        }
        
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        
        this.camera.position.set(0, 200000000, 200000000);
        this.camera.lookAt(0, 0, 0);
        
        this.scene.background = new THREE.Color(0x000000);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10000000;
        this.controls.maxDistance = 1000000000;
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createObjects() {
        // Earth with atmosphere
        const earthGeometry = new THREE.SphereGeometry(6371000, 64, 64);
        const earthMaterial = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
            bumpMap: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
            bumpScale: 100000,
            specularMap: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
            specular: new THREE.Color(0x333333),
            shininess: 25
        });
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earth.castShadow = true;
        this.earth.receiveShadow = true;
        this.scene.add(this.earth);

        // Earth atmosphere glow
        const atmosphereGeometry = new THREE.SphereGeometry(6371000 * 1.01, 64, 64);
        const atmosphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x0033ff,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);

        // Moon with detailed texture
        const moonGeometry = new THREE.SphereGeometry(1737000, 32, 32);
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpMap: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpScale: 50000,
            shininess: 5
        });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        this.moon.castShadow = true;
        this.moon.receiveShadow = true;
        this.scene.add(this.moon);

        // Satellites with glow effect
        this.satellites = [];
        for (let i = 0; i < 10; i++) {
            const satGeometry = new THREE.SphereGeometry(200000, 16, 16);
            const satMaterial = new THREE.MeshPhongMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 0.5,
                shininess: 50
            });
            const satellite = new THREE.Mesh(satGeometry, satMaterial);
            
            // Glow effect
            const glowGeometry = new THREE.SphereGeometry(250000, 16, 16);
            const glowMaterial = new THREE.MeshPhongMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            satellite.add(glow);
            
            // Orbit parameters ve yakıt değeri
            const orbitRadius = 42164000 + (Math.random() - 0.5) * 2000000;
            const inclination = (Math.random() - 0.5) * Math.PI / 32;
            const phase = Math.random() * Math.PI * 2;
            const fuel = 60 + Math.random() * 40; // 60-100 arası rastgele yakıt değeri
            
            satellite.userData = { 
                orbitRadius, 
                inclination, 
                phase,
                fuel  // Yakıt değerini ekledik
            };
            
            this.satellites.push(satellite);
            this.scene.add(satellite);
        }

        // Rocket with engine glow
        const rocketGeometry = new THREE.ConeGeometry(300000, 1000000, 8);
        const rocketMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            shininess: 50
        });
        this.rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
        
        // Rocket engine glow
        const engineGlowGeometry = new THREE.ConeGeometry(400000, 600000, 8);
        const engineGlowMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3300,
            emissive: 0xff3300,
            transparent: true,
            opacity: 0.7,
            side: THREE.BackSide
        });
        this.engineGlow = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
        this.rocket.add(this.engineGlow);
        
        this.rocket.position.copy(this.rocketStartPosition);
        
        this.scene.add(this.rocket);
    }

    setupLights() {
        // Main sunlight
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(1, 0.5, 1).normalize();
        sunLight.castShadow = true;
        this.scene.add(sunLight);
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Point lights for better illumination
        const pointLight1 = new THREE.PointLight(0xffffff, 1, 1000000000);
        pointLight1.position.set(500000000, 0, 0);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xffffff, 1, 1000000000);
        pointLight2.position.set(-500000000, 0, 0);
        this.scene.add(pointLight2);
    }

    setupControls() {
        // Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10000000;
        this.controls.maxDistance = 1000000000;
        
        // Button Controls
        document.getElementById('start').addEventListener('click', () => {
            this.isPlaying = true;
            this.clock.start();
        });
        
        document.getElementById('pause').addEventListener('click', () => {
            this.isPlaying = false;
            this.clock.stop();
        });
        
        document.getElementById('reset').addEventListener('click', () => {
            this.clock.stop();
            this.clock.start();
            this.isPlaying = false;
            
            // Reset positions
            this.moon.position.set(384400000, 0, 0);
            this.rocket.position.set(0, 0, 0);
            
            // Clear rocket trail
            this.rocketTrail.forEach(point => {
                this.scene.remove(point);
            });
            this.rocketTrail = [];
            
            // Reset satellites
            this.satellites.forEach(sat => {
                const { orbitRadius } = sat.userData;
                sat.position.set(orbitRadius, 0, 0);
            });
            
            // Reset camera
            this.camera.position.set(0, 200000000, 200000000);
            this.camera.lookAt(0, 0, 0);
            this.controls.reset();
        });
    }

    updateRocketTrail() {
        // Add current position to trail
        if (this.rocketTrail.length >= this.maxTrailLength) {
            const oldPoint = this.rocketTrail.shift();
            this.scene.remove(oldPoint);
        }
        
        const trailGeometry = new THREE.SphereGeometry(100000, 8, 8);
        const trailMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3300,
            emissive: 0xff3300,
            transparent: true,
            opacity: 0.5
        });
        const trailPoint = new THREE.Mesh(trailGeometry, trailMaterial);
        trailPoint.position.copy(this.rocket.position);
        this.scene.add(trailPoint);
        this.rocketTrail.push(trailPoint);
        
        // Fade out trail points
        this.rocketTrail.forEach((point, index) => {
            point.material.opacity = 0.5 * (index / this.rocketTrail.length);
        });
    }

    updateObjects() {
        if (!this.isPlaying) return;
        
        const time = this.clock.getElapsedTime();

        // Update Earth rotation
        this.earth.rotation.y = time * 0.1;

        // Update Moon position and rotation
        const moonAngle = time * 0.05;
        this.moon.position.x = Math.cos(moonAngle) * 384400000;
        this.moon.position.z = Math.sin(moonAngle) * 384400000;
        this.moon.rotation.y = moonAngle;

        // Update Satellites
        this.satellites.forEach(sat => {
            const { orbitRadius, inclination, phase } = sat.userData;
            const angle = time * 0.1 + phase;
            
            sat.position.x = orbitRadius * Math.cos(angle);
            sat.position.y = orbitRadius * Math.sin(angle) * Math.sin(inclination);
            sat.position.z = orbitRadius * Math.sin(angle) * Math.cos(inclination);
            
            // Rotate satellite
            sat.rotation.y += 0.01;
        });

        // Update Rocket position and trail
        if (this.pathSolution) {
            if (this.isFirstMove) {
                this.rocket.position.copy(this.moon.position);
                this.isFirstMove = false;
            } else {
                const currentNode = this.pathSolution[this.currentNodeIndex];
                const nextNode = this.pathSolution[this.currentNodeIndex + 1];
                
                if (nextNode !== undefined) {
                    let startPos = currentNode === 0 ? this.moon.position : this.satellites[currentNode - 1].position;
                    let endPos = nextNode === 0 ? this.moon.position : this.satellites[nextNode - 1].position;
                    
                    const progress = (time * 0.1) % 1; // Daha yavaş hareket
                    
                    // Daha karmaşık yörünge hesaplaması
                    const distance = startPos.distanceTo(endPos);
                    const midHeight = distance * 0.2; // Yörünge yüksekliği
                    
                    // İki kontrol noktası kullan
                    const control1 = new THREE.Vector3().copy(startPos).add(
                        new THREE.Vector3(0, midHeight, 0)
                    );
                    const control2 = new THREE.Vector3().copy(endPos).add(
                        new THREE.Vector3(0, midHeight, 0)
                    );
                    
                    // Cubic Bezier eğrisi
                    this.rocket.position.x = this.cubicBezier(startPos.x, control1.x, control2.x, endPos.x, progress);
                    this.rocket.position.y = this.cubicBezier(startPos.y, control1.y, control2.y, endPos.y, progress);
                    this.rocket.position.z = this.cubicBezier(startPos.z, control1.z, control2.z, endPos.z, progress);
                    
                    // Roketin yönünü hareket yönüne çevir
                    const tangent = this.calculateTangent(startPos, control1, control2, endPos, progress);
                    this.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
                    
                    if (progress >= 0.99) {
                        this.currentNodeIndex++;
                    }
                }
            }
        }
        
        // Update rocket trail
        this.updateRocketTrail();
        
        // Update engine glow
        this.engineGlow.material.opacity = 0.5 + Math.sin(time * 10) * 0.2;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.updateObjects();
        this.updateMissionInfo();  // Mission info güncelleme
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateMissionInfo() {
        const time = this.clock.getElapsedTime();
        let infoText = `
            <b>Simülasyon Zamanı:</b> ${(time/3600).toFixed(1)} saat<br>
        `;

        if (this.pathSolution && this.segmentData) {
            const currentSegment = this.segmentData[this.currentNodeIndex];
            if (currentSegment) {
                const fromNode = currentSegment.from_node;
                const toNode = currentSegment.to_node;
                
                let fromInfo = fromNode === 0 ? "Ay" : `Uydu-${fromNode}`;
                let toInfo = toNode === 0 ? "Ay" : `Uydu-${toNode}`;
                
                infoText += `<br>
                    <b>Mevcut Rota:</b> ${this.pathSolution.join(' → ')}<br>
                    <b>Şu anki Hareket:</b> ${fromInfo} → ${toInfo}<br>
                    <b>Segment Mesafesi:</b> ${currentSegment.distance.toFixed(0)} km<br>
                    <b>Gerekli Yakıt:</b> ${currentSegment.fuel_required.toFixed(1)} birim<br>
                    <b>Tahmini Süre:</b> ${(currentSegment.estimated_time/3600).toFixed(1)} saat<br>
                    <b>Mevcut Konum Yakıt:</b> ${fromNode === 0 ? "-" : this.satellites[fromNode-1].userData.fuel.toFixed(1)}%<br>
                    <b>Hedef Konum Yakıt:</b> ${toNode === 0 ? "-" : this.satellites[toNode-1].userData.fuel.toFixed(1)}%<br>
                    <b>Toplam İlerleme:</b> ${((this.currentNodeIndex / (this.pathSolution.length-1)) * 100).toFixed(1)}%<br>
                    <b>Toplam Mesafe:</b> ${(this.totalDistance/1000).toFixed(0)} km<br>
                    <b>Toplam Yakıt Tüketimi:</b> ${this.totalFuelConsumption.toFixed(1)} birim<br>
                    <b>Toplam Süre:</b> ${(this.totalTime/3600).toFixed(1)} saat
                `;
            }
        }

        document.getElementById('mission-info').innerHTML = infoText;
    }

    // Yeni metod: Simülasyon sonuçlarını ayarla
    setSimulationResult(data) {
        if (!data) return;  // Veri kontrolü
        
        this.pathSolution = data.path || [];
        this.totalDistance = data.cost || 0;
        this.currentNodeIndex = 0;
        this.segmentData = data.segments || [];
        this.totalFuelConsumption = data.total_fuel_consumption || 0;
        this.totalTime = data.total_time || 0;
        
        // Uyduları güncelle
        if (data.satellites && Array.isArray(data.satellites)) {
            data.satellites.forEach((satData, index) => {
                const satellite = this.satellites[index];
                if (satellite && satData) {
                    // Uydu özelliklerini güncelle
                    satellite.userData = {
                        id: satData.id,
                        orbitRadius: satData.orbit_radius,
                        inclination: satData.inclination,
                        phase: satData.initial_angle,
                        fuel: satData.fuel,
                        originalFuel: satData.fuel
                    };
                    
                    // Uyduları renklendir
                    if (this.pathSolution.includes(satData.id)) {
                        satellite.material.color.setHex(0x00ff00);
                        satellite.material.emissive.setHex(0x00ff00);
                    } else {
                        satellite.material.color.setHex(0xff0000);
                        satellite.material.emissive.setHex(0xff0000);
                    }
                }
            });
        }
    }

    // Yardımcı metodlar
    cubicBezier(p0, p1, p2, p3, t) {
        const oneMinusT = 1 - t;
        return Math.pow(oneMinusT, 3) * p0 +
               3 * Math.pow(oneMinusT, 2) * t * p1 +
               3 * oneMinusT * Math.pow(t, 2) * p2 +
               Math.pow(t, 3) * p3;
    }

    calculateTangent(p0, p1, p2, p3, t) {
        const oneMinusT = 1 - t;
        return new THREE.Vector3(
            3 * Math.pow(oneMinusT, 2) * (p1.x - p0.x) +
            6 * oneMinusT * t * (p2.x - p1.x) +
            3 * Math.pow(t, 2) * (p3.x - p2.x),
            3 * Math.pow(oneMinusT, 2) * (p1.y - p0.y) +
            6 * oneMinusT * t * (p2.y - p1.y) +
            3 * Math.pow(t, 2) * (p3.y - p2.y),
            3 * Math.pow(oneMinusT, 2) * (p1.z - p0.z) +
            6 * oneMinusT * t * (p2.z - p1.z) +
            3 * Math.pow(t, 2) * (p3.z - p2.z)
        );
    }
}

// Simülasyonu başlat
window.onload = () => {
    const simulation = new SpaceSimulation();
    
    // Test için örnek bir çözüm
    // Bu kısmı interface.py'dan gelen gerçek verilerle değiştireceğiz
    window.setSimulationPath = function(path, distance) {
        simulation.setSimulationResult(path, distance);
    };
}; 