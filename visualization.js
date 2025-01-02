import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SpaceVisualizer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000000000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        // Animasyon parametreleri
        this.animationSpeed = 1; // saniye başına adım
        this.currentStep = 0;
        this.solution = null;
        this.isPlaying = false;
        this.lastTime = 0;
        
        this.init();
    }

    init() {
        // Renderer ayarları
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Kamera pozisyonu
        this.camera.position.set(500000, 500000, 500000);
        this.controls.update();

        // Işıklandırma
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Dünya
        this.createEarth();

        // Animasyon döngüsü
        this.animate();

        // Pencere boyutu değişikliğini dinle
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Kontrol paneli ekle
        this.addControlPanel();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(6371000, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x2233ff,
            emissive: 0x112244,
            specular: 0x333333,
            shininess: 25
        });
        const earth = new THREE.Mesh(geometry, material);
        this.scene.add(earth);
    }

    updateScene(data) {
        // Veri kontrolü
        if (!data) return;
        
        // Uyduları güncelle
        if (data.satellites) {
            this.updateSatellites(data.satellites);
        }
        
        // Ay'ı güncelle
        if (data.moon) {
            this.updateMoon(data.moon);
        }
        
        // Roket yolunu güncelle
        if (data.rocketPath) {
            this.updateRocketPath(data.rocketPath);
        }

        // Roket pozisyonunu güncelle
        if (data.rocketPosition && data.rocketFuel) {
            this.updateRocket(data.rocketPosition, data.rocketFuel);
        }

        // Sonraki hedefi güncelle
        this.updateNextTarget(this.currentStep);
    }

    updateSatellites(satellites) {
        // Mevcut uyduları temizle
        this.scene.children
            .filter(child => child.userData.type === 'satellite')
            .forEach(satellite => this.scene.remove(satellite));

        // Yeni uyduları ekle
        satellites.forEach((sat, index) => {
            // Ana uydu gövdesi
            const bodyGeometry = new THREE.SphereGeometry(2000, 12, 12);
            const bodyMaterial = new THREE.MeshPhongMaterial({
                color: 0xff4400,
                emissive: 0x441100,
                specular: 0x333333,
                shininess: 25
            });
            const satellite = new THREE.Mesh(bodyGeometry, bodyMaterial);
            
            // Güneş panelleri
            const panelGeometry = new THREE.BoxGeometry(8000, 100, 2000);
            const panelMaterial = new THREE.MeshPhongMaterial({
                color: 0x2244ff,
                emissive: 0x112244,
                specular: 0x888888,
                shininess: 100
            });
            const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
            const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
            
            leftPanel.position.x = -5000;
            rightPanel.position.x = 5000;
            
            satellite.add(leftPanel);
            satellite.add(rightPanel);
            
            // Anten
            const antennaGeometry = new THREE.CylinderGeometry(100, 100, 3000, 8);
            const antennaMaterial = new THREE.MeshPhongMaterial({
                color: 0xcccccc,
                emissive: 0x222222
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.rotation.x = Math.PI / 2;
            antenna.position.z = 1500;
            satellite.add(antenna);
            
            // Yörünge çizgisi
            const orbitGeometry = new THREE.BufferGeometry();
            const orbitPoints = [];
            const segments = 100;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = Math.cos(angle) * sat.position.x - Math.sin(angle) * sat.position.y;
                const y = Math.sin(angle) * sat.position.x + Math.cos(angle) * sat.position.y;
                const z = sat.position.z;
                orbitPoints.push(new THREE.Vector3(x, y, z));
            }
            orbitGeometry.setFromPoints(orbitPoints);
            const orbitMaterial = new THREE.LineBasicMaterial({
                color: 0x444444,
                opacity: 0.5,
                transparent: true
            });
            const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
            this.scene.add(orbit);
            
            // Uydu etiketini ekle
            const sprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: this.createTextTexture(`Uydu-${index + 1}\nYakıt: ${sat.fuel.toFixed(1)}`)
                })
            );
            sprite.scale.set(10000, 5000, 1);
            sprite.position.y = 3000;
            satellite.add(sprite);
            
            // Uydu pozisyonunu ayarla
            satellite.position.set(sat.position.x, sat.position.y, sat.position.z);
            satellite.userData.type = 'satellite';
            satellite.userData.fuel = sat.fuel;
            satellite.userData.index = index;
            
            // Yakıt durumuna göre renk değiştir
            const fuelRatio = sat.fuel / 100;
            bodyMaterial.emissive.setRGB(
                0.4 * (1 - fuelRatio),
                0.4 * fuelRatio,
                0
            );
            
            this.scene.add(satellite);
        });
    }

    updateMoon(moonPosition) {
        if (!this.moon) {
            const geometry = new THREE.SphereGeometry(17371000, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: 0xcccccc,
                emissive: 0x222222
            });
            this.moon = new THREE.Mesh(geometry, material);
            this.moon.userData.type = 'moon';
            this.scene.add(this.moon);
        }
        
        this.moon.position.set(moonPosition.x, moonPosition.y, moonPosition.z);
    }

    updateRocketPath(path) {
        // Mevcut yolu temizle
        this.scene.children
            .filter(child => child.userData.type === 'rocketPath')
            .forEach(path => this.scene.remove(path));

        // Yeni yolu çiz
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(path.flatMap(p => [p.x, p.y, p.z]));
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2
        });
        
        const rocketPath = new THREE.Line(geometry, material);
        rocketPath.userData.type = 'rocketPath';
        this.scene.add(rocketPath);
    }

    updateRocket(position, fuel) {
        if (!this.rocket) {
            // Roket geometrisi oluştur (konik şekil)
            const geometry = new THREE.ConeGeometry(2000, 8000, 8);
            const material = new THREE.MeshPhongMaterial({
                color: 0x00ff00,
                emissive: 0x003300,
                specular: 0x111111,
                shininess: 30
            });
            this.rocket = new THREE.Mesh(geometry, material);
            this.rocket.userData.type = 'rocket';
            
            // Roket izi için parçacık sistemi
            this.rocketTrail = new THREE.Points(
                new THREE.BufferGeometry(),
                new THREE.PointsMaterial({
                    color: 0xff3300,
                    size: 1000,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    opacity: 0.8
                })
            );
            this.scene.add(this.rocketTrail);
            this.scene.add(this.rocket);
            this.rocket.maxFuel = 20000e3; // Roketin maksimum yakıt kapasitesi
        }
        
        // Position'ı THREE.Vector3'e dönüştür
        const pos = new THREE.Vector3(position.x, position.y, position.z);
        
        // Roket pozisyonunu güncelle
        this.rocket.position.copy(pos);
        
        // Roketin yönünü hareket yönüne çevir
        if (this.lastRocketPos) {
            const direction = new THREE.Vector3()
                .subVectors(pos, this.lastRocketPos)
                .normalize();
            this.rocket.lookAt(pos.clone().add(direction));
        }
        this.lastRocketPos = pos.clone();
        
        // Yakıt durumuna göre renk değiştir
        const fuelRatio = fuel / this.rocket.maxFuel;
        const fuelColor = new THREE.Color(
            Math.min(2 - 2 * fuelRatio, 1),
            Math.min(2 * fuelRatio, 1),
            0
        );
        this.rocket.material.emissive.setHex(fuelColor.getHex());
        
        // Roket izini güncelle
        this.updateRocketTrail(pos);
        
        // UI bilgilerini güncelle
        document.getElementById('rocket-fuel').innerHTML = 
            `Yakıt: <span class="highlight">${(fuelRatio * 100).toFixed(1)}%</span>`;
        document.getElementById('rocket-position').innerHTML = 
            `Konum: <span class="highlight">${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)}</span>`;
    }

    updateRocketTrail(position) {
        const trailLength = 50;
        if (!this.trailPositions) {
            this.trailPositions = [];
        }
        
        // Position'ı THREE.Vector3 olarak ekle
        this.trailPositions.unshift(new THREE.Vector3(position.x, position.y, position.z));
        if (this.trailPositions.length > trailLength) {
            this.trailPositions.pop();
        }
        
        const positions = new Float32Array(this.trailPositions.flatMap(p => [p.x, p.y, p.z]));
        this.rocketTrail.geometry.setAttribute('position', 
            new THREE.BufferAttribute(positions, 3)
        );
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isPlaying) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // saniyeye çevir
        
        if (deltaTime >= 1 / this.animationSpeed) {
            this.currentStep++;
            if (this.currentStep >= (this.solution?.length || 0)) {
                this.currentStep = 0;
            }
            
            const stepData = this.getStepData();
            if (stepData) {
                this.updateScene(stepData);
                document.getElementById('progress').value = 
                    (this.currentStep / (this.solution.length - 1)) * 100;
                document.getElementById('step-info').textContent = 
                    `Adım: ${this.currentStep}/${this.solution.length - 1}`;
            }
            
            this.lastTime = currentTime;
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }

    // Yardımcı metod: Metin dokusunu oluştur
    createTextTexture(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Arka plan
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Metin
        context.fillStyle = '#00ff00';
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            context.fillText(
                line, 
                canvas.width / 2,
                canvas.height / 2 + (i - lines.length/2 + 0.5) * 30
            );
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    addControlPanel() {
        const controls = document.createElement('div');
        controls.id = 'animation-controls';
        controls.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            color: white;
            font-family: monospace;
        `;
        
        controls.innerHTML = `
            <div>
                <button id="play-pause">▶️ Oynat</button>
                <button id="reset">⏮️ Başa Dön</button>
                <input type="range" id="speed" min="0.1" max="5" step="0.1" value="1">
                <span id="speed-value">1x</span>
            </div>
            <div>
                <input type="range" id="progress" min="0" max="100" value="0">
                <span id="step-info">Adım: 0/0</span>
            </div>
        `;
        
        this.container.appendChild(controls);
        
        // Event listeners
        document.getElementById('play-pause').onclick = () => this.togglePlayPause();
        document.getElementById('reset').onclick = () => this.resetAnimation();
        document.getElementById('speed').oninput = (e) => {
            this.animationSpeed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = `${this.animationSpeed}x`;
        };
        document.getElementById('progress').oninput = (e) => {
            this.currentStep = Math.floor((e.target.value / 100) * (this.solution?.length || 0));
            this.updateScene(this.getStepData());
        };
    }
    
    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        const button = document.getElementById('play-pause');
        button.textContent = this.isPlaying ? '⏸️ Duraklat' : '▶️ Oynat';
        if (this.isPlaying) {
            this.lastTime = performance.now();
            this.animate();
        }
    }
    
    resetAnimation() {
        this.currentStep = 0;
        const data = this.getStepData();
        if (data) {
            this.updateScene(data);
        }
        document.getElementById('progress').value = 0;
        document.getElementById('step-info').textContent = 
            `Adım: ${this.currentStep}/${this.solution?.length || 0}`;
    }
    
    setSolution(solution) {
        this.solution = solution || [];
        this.currentStep = 0;
        if (solution && solution.length > 0) {
            document.getElementById('progress').max = solution.length - 1;
        }
        this.resetAnimation();
    }
    
    getStepData() {
        if (!this.solution || this.currentStep >= this.solution.length) {
            return {
                satellites: [],
                moon: { x: 0, y: 0, z: 0 },
                rocketPath: [],
                rocketPosition: { x: 0, y: 0, z: 0 },
                rocketFuel: 100
            };
        }
        
        return {
            satellites: this.solution[this.currentStep].satellites || [],
            moon: this.solution[this.currentStep].moon || { x: 0, y: 0, z: 0 },
            rocketPath: this.solution[this.currentStep].rocketPath || [],
            rocketPosition: this.solution[this.currentStep].rocketPosition || { x: 0, y: 0, z: 0 },
            rocketFuel: this.solution[this.currentStep].rocketFuel || 100
        };
    }

    // Yeni metod: Sonraki hedefi güncelle
    updateNextTarget(currentStep) {
        if (!this.solution || currentStep >= this.solution.length - 1) {
            document.getElementById('next-target').innerHTML = 
                `Sonraki Hedef: <span class="highlight">-</span>`;
            return;
        }

        const currentTarget = this.solution[currentStep];
        const nextTarget = this.solution[currentStep + 1];
        
        let targetName = "Ay";
        if (nextTarget && nextTarget.targetIndex > 0) {
            targetName = `Uydu-${nextTarget.targetIndex}`;
        }
        
        document.getElementById('next-target').innerHTML = 
            `Sonraki Hedef: <span class="highlight">${targetName}</span>`;
    }
}

export { SpaceVisualizer }; 