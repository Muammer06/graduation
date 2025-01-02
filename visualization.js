import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SpaceVisualizer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        
        // Renderer ayarları
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false,
            powerPreference: "high-performance",
            precision: "mediump"
        });
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1000, 1000000000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        // Performans optimizasyonları
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.maxVisibleSatellites = 30;
        this.rocketPathLength = 50;
        
        // Bellek yönetimi için
        this.disposables = new Set();
        
        // Geometrileri önbelleğe al
        this.geometries = {
            satellite: new THREE.SphereGeometry(2000, 8, 8),
            rocket: new THREE.ConeGeometry(1000, 4000, 8)
        };
        
        // Animasyon kontrolü
        this.animationSpeed = 1;
        this.currentStep = 0;
        this.solution = null;
        this.isPlaying = false;
        this.lastTime = 0;
        this.targetStep = 0;
        
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
        if (!data) return;
        
        try {
            // Sadece görünür uyduları güncelle
            if (data.satellites) {
                const visibleSatellites = data.satellites.slice(0, this.maxVisibleSatellites);
                this.updateSatellites(visibleSatellites);
            }
            
            if (data.moon) {
                this.updateMoon(data.moon);
            }
            
            if (data.rocketPath) {
                // Roket izini sınırla
                const limitedPath = data.rocketPath.slice(-this.rocketPathLength);
                this.updateRocketPath(limitedPath);
            }
            
            if (data.rocketPosition && data.rocketFuel !== undefined) {
                this.updateRocket(data.rocketPosition, data.rocketFuel, data.totalDistance);
            }
            
            this.updateFuelPanel(data);
            this.updateNextTarget(this.currentStep);
            
        } catch (error) {
            console.warn('Scene güncelleme hatası:', error);
            this.handleWebGLError();
        }
    }

    // WebGL hata yönetimi
    handleWebGLError() {
        if (this.renderer.getContext().isContextLost()) {
            console.log('WebGL context kaybedildi, yenileniyor...');
            this.renderer.setAnimationLoop(null);
            this.initRenderer();
        }
    }

    initRenderer() {
        // Renderer'ı yeniden başlat
        this.renderer.dispose();
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            precision: "mediump"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
    }

    // Adım kontrolü için yeni metodlar
    setStep(step) {
        if (!this.solution) return;
        
        step = Math.max(0, Math.min(step, this.solution.length - 1));
        this.currentStep = step;
        this.targetStep = step;
        
        const data = this.getStepData();
        if (data) {
            this.updateScene(data);
            this.updateProgressUI();
        }
    }

    updateProgressUI() {
        const progress = document.getElementById('progress');
        const stepInfo = document.getElementById('step-info');
        
        if (progress && this.solution) {
            progress.value = (this.currentStep / (this.solution.length - 1)) * 100;
        }
        
        if (stepInfo && this.solution) {
            stepInfo.textContent = `Adım: ${this.currentStep}/${this.solution.length - 1}`;
        }
    }

    updateSatellites(satellites) {
        // Mevcut uyduları temizle
        this.scene.children
            .filter(child => child.userData.type === 'satellite')
            .forEach(satellite => {
                this.scene.remove(satellite);
            });

        // Yeni uyduları ekle
        satellites.forEach((sat, index) => {
            const satellite = new THREE.Group();
            
            // Ana gövde
            const bodyMaterial = new THREE.MeshPhongMaterial({
                color: 0xff4400,
                emissive: 0x441100,
                specular: 0x333333,
                shininess: 25
            });
            
            const body = new THREE.Mesh(this.geometries.satellite, bodyMaterial);
            satellite.add(body);
            
            // Etiket ekle
            const sprite = this.createSatelliteLabel(index + 1, sat.fuel);
            satellite.add(sprite);
            
            satellite.position.set(sat.position.x, sat.position.y, sat.position.z);
            satellite.userData.type = 'satellite';
            
            this.scene.add(satellite);
        });
    }

    createSatelliteLabel(index, fuel) {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, size, size);
        
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`Uydu-${index}`, size/2, size/2 - 10);
        ctx.fillText(`${fuel.toFixed(1)}`, size/2, size/2 + 10);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.scale.set(5000, 5000, 1);
        sprite.position.y = 3000;
        
        this.disposables.add(spriteMaterial);
        this.disposables.add(texture);
        
        return sprite;
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
        // Mevcut yolu temizle ve belleği serbest bırak
        this.scene.children
            .filter(child => child.userData.type === 'rocketPath')
            .forEach(path => {
                this.scene.remove(path);
                if (path.geometry) path.geometry.dispose();
                if (path.material) path.material.dispose();
            });

        // Yolu optimize et
        const simplifiedPath = this.simplifyPath(path);
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(simplifiedPath.flatMap(p => [p.x, p.y, p.z]));
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const rocketPath = new THREE.Line(geometry, material);
        rocketPath.userData.type = 'rocketPath';
        
        this.scene.add(rocketPath);
        this.disposables.add(rocketPath);
    }

    // Yolu basitleştir
    simplifyPath(path) {
        if (path.length <= 2) return path;
        
        const tolerance = 1000; // metre cinsinden basitleştirme toleransı
        const simplified = [path[0]];
        
        for (let i = 1; i < path.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = path[i];
            const next = path[i + 1];
            
            const d = this.pointLineDistance(curr, prev, next);
            if (d > tolerance) {
                simplified.push(curr);
            }
        }
        
        simplified.push(path[path.length - 1]);
        return simplified;
    }

    pointLineDistance(point, lineStart, lineEnd) {
        const numerator = Math.abs(
            (lineEnd.x - lineStart.x) * (lineStart.y - point.y) -
            (lineStart.x - point.x) * (lineEnd.y - lineStart.y)
        );
        const denominator = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) +
            Math.pow(lineEnd.y - lineStart.y, 2)
        );
        return numerator / denominator;
    }

    updateRocket(position, fuel, totalDistance) {
        if (!this.rocket) {
            const material = new THREE.MeshPhongMaterial({
                color: 0xcccccc,
                emissive: 0x444444,
                specular: 0x666666,
                shininess: 30
            });
            
            this.rocket = new THREE.Mesh(this.geometries.rocket, material);
            this.rocket.userData.type = 'rocket';
            this.scene.add(this.rocket);
            
            // Roket izi için
            this.trailPositions = [];
            const trailGeometry = new THREE.BufferGeometry();
            const trailMaterial = new THREE.LineBasicMaterial({ 
                color: 0x00ff00,
                opacity: 0.5,
                transparent: true
            });
            this.rocketTrail = new THREE.Line(trailGeometry, trailMaterial);
            this.scene.add(this.rocketTrail);
        }

        // Roket pozisyonunu güncelle
        this.rocket.position.set(position.x, position.y, position.z);
        
        // Roket izini güncelle
        this.updateRocketTrail(position);
        
        // UI bilgilerini güncelle
        document.getElementById('rocket-fuel').innerHTML = 
            `Yakıt: <span class="highlight" style="color: ${this.getFuelColor(fuel/100)}">${fuel.toFixed(1)} birim</span>`;
        document.getElementById('rocket-position').innerHTML = 
            `Konum: <span class="highlight">${(position.x/1000).toFixed(0)}, ${(position.y/1000).toFixed(0)}, ${(position.z/1000).toFixed(0)} km</span>`;
        document.getElementById('total-distance').innerHTML = 
            `Toplam Mesafe: <span class="highlight">${(totalDistance/1000).toFixed(0)} km</span>`;
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
        const deltaTime = (currentTime - this.lastTime) / 1000;
        
        if (deltaTime >= 1 / this.animationSpeed) {
            if (this.currentStep >= (this.solution?.length - 1 || 0)) {
                this.currentStep = 0;
            } else {
                this.currentStep++;
            }
            
            this.setStep(this.currentStep);
            this.lastTime = currentTime;
        }
        
        try {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(() => this.animate());
        } catch (error) {
            console.warn('Animasyon hatası:', error);
            this.handleWebGLError();
        }
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
                <button id="step-backward">⏪</button>
                <button id="step-forward">⏩</button>
                <input type="range" id="speed" min="0.1" max="5" step="0.1" value="1">
                <span id="speed-value">1x</span>
            </div>
            <div>
                <input type="range" id="progress" min="0" max="100" value="0" step="1">
                <span id="step-info">Adım: 0/0</span>
            </div>
        `;
        
        this.container.appendChild(controls);
        
        // Event listeners
        document.getElementById('play-pause').onclick = () => this.togglePlayPause();
        document.getElementById('reset').onclick = () => this.resetAnimation();
        document.getElementById('step-backward').onclick = () => this.setStep(this.currentStep - 1);
        document.getElementById('step-forward').onclick = () => this.setStep(this.currentStep + 1);
        document.getElementById('speed').oninput = (e) => {
            this.animationSpeed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = `${this.animationSpeed}x`;
        };
        document.getElementById('progress').oninput = (e) => {
            const step = Math.floor((e.target.value / 100) * (this.solution?.length - 1 || 0));
            this.setStep(step);
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

    // Yeni metod: Yakıt durumu paneli
    updateFuelPanel(data) {
        let panel = document.getElementById('fuel-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'fuel-panel';
            panel.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                padding: 10px;
                border-radius: 5px;
                color: white;
                font-family: monospace;
                min-width: 200px;
            `;
            this.container.appendChild(panel);
        }

        // Roket ve uydu yakıt durumlarını göster
        let html = `<div style="border-bottom: 1px solid #444; margin-bottom: 5px; padding-bottom: 5px;">
            <div>🚀 Roket Yakıtı: <span style="color: ${this.getFuelColor(data.rocketFuel/100)}">${data.rocketFuel.toFixed(1)} birim</span></div>
            <div>📍 Adım: ${this.currentStep}/${this.solution?.length || 0}</div>
            <div>🛣️ Toplam Mesafe: ${(data.totalDistance/1000).toFixed(0)} km</div>
        </div>`;

        // Uyduların yakıt durumları
        if (data.satellites) {
            html += '<div style="max-height: 200px; overflow-y: auto;">';
            data.satellites.forEach((sat, idx) => {
                const fuelPercentage = (sat.fuel / 100) * 100;
                html += `<div style="margin: 2px 0;">
                    🛰️ Uydu-${idx + 1}: <span style="color: ${this.getFuelColor(sat.fuel/100)}">${sat.fuel.toFixed(1)} birim</span>
                </div>`;
            });
            html += '</div>';
        }

        panel.innerHTML = html;
    }

    // Yakıt seviyesine göre renk döndür
    getFuelColor(fuelRatio) {
        if (fuelRatio > 0.6) return '#4CAF50'; // Yeşil
        if (fuelRatio > 0.3) return '#FFC107'; // Sarı
        return '#F44336'; // Kırmızı
    }

    dispose() {
        // Tüm nesneleri temizle
        this.disposables.forEach(item => {
            if (item.geometry) item.geometry.dispose();
            if (item.material) item.material.dispose();
            if (item.texture) item.texture.dispose();
        });
        this.disposables.clear();
        
        // Scene'i temizle
        while(this.scene.children.length > 0) { 
            this.scene.remove(this.scene.children[0]); 
        }
    }
}

export { SpaceVisualizer }; 