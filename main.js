import { Point3D, Satellite, Moon, Rocket } from './models.js';
import { AntColonyOptimization } from './ant-colony.js';
import { SpaceVisualizer } from './visualization.js';

// Hohmann transfer süresini hesapla
function calculateHohmannTime(r1, r2) {
    const mu = 3.986e14; // Dünya'nın standart gravitasyonel parametresi
    const a = (r1 + r2) / 2;
    return Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
}

async function main() {
    console.log("Program başlatılıyor...");
    
    // Görselleştirme için container oluştur
    const container = document.getElementById('visualization');
    const visualizer = new SpaceVisualizer(container);
    
    // Problem parametrelerini ayarla
    const numSatellites = 30;
    const rocketFuel = 500; // Yakıt birimi (1000 birim)
    
    console.log(`\n${numSatellites} uydu oluşturuluyor...`);
    const satellites = [];
    
    // Jeosenkron yörünge parametreleri
    const GEO_RADIUS = 35786e3 + 6371e3; // metre cinsinden (42,157 km)
    const GEO_VARIATION = 1000e3; // metre cinsinden (±1000 km)

    for (let i = 0; i < numSatellites; i++) {
        // Başlangıç açısını eşit aralıklarla dağıt
        const initialAngle = (2 * Math.PI * i) / numSatellites;
        
        // Jeosenkron yörünge etrafında küçük varyasyonlar
        const orbitRadius = GEO_RADIUS + (Math.random() - 0.5) * GEO_VARIATION;
        
        // Küçük eğim açıları (±2 derece)
        const inclination = (Math.random() - 0.5) * Math.PI / 90;
        
        const initialFuel = 80 + Math.random() * 20; // 80-100 arası
        
        const satellite = new Satellite(
            i,
            orbitRadius,
            initialAngle,
            inclination,
            initialFuel
        );

        satellites.push(satellite);
        console.log(
            `Uydu ${i + 1} oluşturuldu:\n` +
            `  Yörünge yarıçapı: ${((orbitRadius-6371e3)/1000).toFixed(0)} km\n` + // Yüksekliği göster
            `  Başlangıç açısı: ${(initialAngle * 180/Math.PI).toFixed(1)}°\n` +
            `  Eğim: ${(inclination * 180/Math.PI).toFixed(3)}°\n` +
            `  Periyot: ${(satellite.orbitPeriod/3600).toFixed(1)} saat\n` +
            `  Yakıt: ${initialFuel.toFixed(1)}`
        );
    }
    
    const moon = new Moon();
    const rocket = new Rocket(rocketFuel);
    
    console.log(`\nRoket yakıt kapasitesi: ${rocketFuel} birim`);
    
    // Genetik Algoritma yerine Ant Colony kullan
    const aco = new AntColonyOptimization(satellites, moon, rocket, {
        numAnts: 200,
        iterations: 500,
        evaporationRate: 0.3,
        alpha: 1.0,
        beta: 3.0,
        Q: 150
    });

    // Event handler'ı güncelle
    aco.onNewBestSolution = (data) => {
        const animationSteps = [];
        let currentTime = 0;
        let currentFuel = rocket.maxFuel;
        let totalDistance = 0;
        
        // Tüm uyduların başlangıç durumlarını kopyala
        const satelliteStates = satellites.map(sat => ({
            orbitRadius: sat.orbitRadius,
            currentAngle: sat.currentAngle,
            inclination: sat.inclination,
            fuel: sat.fuel
        }));

        for (let i = 0; i < data.solution.length - 1; i++) {
            const currentIdx = data.solution[i];
            const nextIdx = data.solution[i + 1];
            
            // Hohmann transfer süresi
            const startRadius = currentIdx === 0 ? moon.semiMajorAxis : 
                satellites[currentIdx - 1].orbitRadius;
            const endRadius = nextIdx === 0 ? moon.semiMajorAxis : 
                satellites[nextIdx - 1].orbitRadius;
            const transferTime = calculateHohmannTime(startRadius, endRadius);
            
            // Her adım için 20 ara kare oluştur
            const frames = 20;
            const timePerFrame = transferTime / frames;
            
            for (let frame = 0; frame <= frames; frame++) {
                // Tüm uyduların pozisyonlarını güncelle
                satelliteStates.forEach((state, idx) => {
                    const sat = satellites[idx];
                    state.currentAngle += sat.orbitSpeed * timePerFrame;
                    
                    // Yeni pozisyonu hesapla
                    const x = state.orbitRadius * Math.cos(state.currentAngle);
                    const y = state.orbitRadius * Math.sin(state.currentAngle);
                    const yRotated = y * Math.cos(state.inclination);
                    const z = y * Math.sin(state.inclination);
                    
                    satellites[idx].currentPosition = new Point3D(x, yRotated, z);
                    
                    // Yakıt tüketimi
                    if (state.fuel > 0) {
                        state.fuel = Math.max(0, state.fuel - 0.01); // Zamanla azalan yakıt
                    }
                });

                // Ay'ın pozisyonunu güncelle
                const moonPos = moon.getPosition(currentTime + frame * timePerFrame);
                
                // Roketin pozisyonunu hesapla
                const startPos = currentIdx === 0 ? moonPos : 
                    satellites[currentIdx - 1].currentPosition;
                const endPos = nextIdx === 0 ? moonPos : 
                    satellites[nextIdx - 1].currentPosition;
                
                const t = frame / frames;
                const currentPos = {
                    x: startPos.x + (endPos.x - startPos.x) * t,
                    y: startPos.y + (endPos.y - startPos.y) * t,
                    z: startPos.z + (endPos.z - startPos.z) * t
                };

                // Yakıt tüketimi
                const segmentDistance = rocket.calculateAxisDistance(startPos, endPos);
                const fuelNeeded = rocket.calculateFuelConsumption(segmentDistance);
                const fuelPerFrame = fuelNeeded / frames;
                
                if (frame < frames) {
                    currentFuel = Math.max(0, currentFuel - fuelPerFrame);
                    totalDistance += segmentDistance / frames;
                }

                // Yakıt ikmal kontrolü
                if (frame === frames) {
                    if (nextIdx === 0) {
                        // Ay'da yakıt doldur
                        currentFuel = rocket.maxFuel;
                    } else if (currentFuel < rocket.maxFuel * 0.2) {
                        // Yakıt kritik seviyede, Ay'a dönüş zorunlu
                        console.log("Kritik yakıt seviyesi - Ay'a dönüş gerekli");
                        return null;
                    }
                }

                animationSteps.push({
                    satellites: satellites.map((sat, idx) => ({
                        position: sat.currentPosition,
                        fuel: satelliteStates[idx].fuel
                    })),
                    moon: moonPos,
                    rocketPath: data.solution.slice(0, i + 1).map((idx, j) => {
                        if (idx === 0) return moon.getPosition(currentTime + j * timePerFrame);
                        return satellites[idx - 1].currentPosition;
                    }),
                    rocketPosition: currentPos,
                    rocketFuel: currentFuel,
                    targetIndex: nextIdx,
                    totalDistance: totalDistance
                });
            }
            
            currentTime += transferTime;
        }
        
        visualizer.setSolution(animationSteps);
    };
    
    // Optimizasyonu başlat
    const result = await aco.optimize();
    
    // Sonuçları göster
    console.log("\nFinal Sonuçları:");
    console.log("=".repeat(50));
    console.log(`En iyi rota: ${result.solution || 'Bulunamadı'}`);
    console.log(`Toplam delta-v: ${result.cost === Infinity ? 'Hesaplanamadı' : (result.cost/1000).toFixed(2) + ' km/s'}`);

    if (result.fuelStates) {
        console.log("\nUyduların Son Yakıt Durumları:");
        result.fuelStates.forEach((fuel, idx) => {
            console.log(`Uydu ${idx}: ${fuel.toFixed(1)} birim yakıt`);
        });
    } else {
        console.log("\nUyarı: Geçerli bir çözüm bulunamadı!");
    }
    console.log("=".repeat(50));
}

// Programı başlat
main().catch(console.error); 