import { Point3D, Satellite, Moon, Rocket } from './models.js';
import { GeneticAlgorithm } from './genetic-algorithm.js';
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
    const numSatellites = 20;
    const rocketFuel = 20   0e3; // metre cinsinden
    
    console.log(`\n${numSatellites} uydu oluşturuluyor...`);
    const satellites = [];
    for (let i = 0; i < numSatellites; i++) {
        // Başlangıç açısını eşit aralıklarla dağıt
        const initialAngle = (2 * Math.PI * i) / numSatellites;
        
        // Rastgele yörünge parametreleri
        const orbitRadius = 20000e3 + Math.random() * 40000e3; // 20,000 km ile 60,000 km arası
        const inclination = (Math.random() - 0.5) * Math.PI / 3; // ±30 derece
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
            `  Yörünge yarıçapı: ${(orbitRadius/1000).toFixed(0)} km\n` +
            `  Başlangıç açısı: ${(initialAngle * 180/Math.PI).toFixed(1)}°\n` +
            `  Eğim: ${(inclination * 180/Math.PI).toFixed(1)}°\n` +
            `  Periyot: ${(satellite.orbitPeriod/3600).toFixed(1)} saat\n` +
            `  Yakıt: ${initialFuel.toFixed(1)}`
        );
    }
    
    const moon = new Moon();
    const rocket = new Rocket(rocketFuel);
    
    console.log(`\nRoket yakıt kapasitesi: ${rocketFuel/1000} km`);
    
    // Genetik Algoritma'yı başlat
    const ga = new GeneticAlgorithm(satellites, moon, rocket, {
        populationSize: 100,
        generations: 100,
        mutationRate: 0.1,
        eliteSize: 10
    });

    // Yeni en iyi çözüm bulunduğunda görselleştirmeyi güncelle
    ga.onNewBestSolution = (data) => {
        // Animasyon için çözüm adımlarını hazırla
        const animationSteps = [];
        let currentTime = 0;
        
        for (let i = 0; i < data.solution.length - 1; i++) {
            const currentIdx = data.solution[i];
            const nextIdx = data.solution[i + 1];
            
            // Her adım için 10 ara kare oluştur
            const frames = 10;
            for (let frame = 0; frame <= frames; frame++) {
                const t = frame / frames;
                
                // Pozisyonları interpolate et
                const startPos = currentIdx === 0 ? 
                    moon.getPosition(currentTime) : 
                    satellites[currentIdx - 1].currentPosition;
                
                const endPos = nextIdx === 0 ? 
                    moon.getPosition(currentTime) : 
                    satellites[nextIdx - 1].currentPosition;
                
                const currentPos = {
                    x: startPos.x + (endPos.x - startPos.x) * t,
                    y: startPos.y + (endPos.y - startPos.y) * t,
                    z: startPos.z + (endPos.z - startPos.z) * t
                };
                
                animationSteps.push({
                    satellites: satellites.map(sat => ({
                        position: sat.currentPosition,
                        fuel: sat.fuel
                    })),
                    moon: moon.getPosition(currentTime),
                    rocketPath: data.solution.map((idx, i) => {
                        if (idx === 0) return moon.getPosition(i);
                        return satellites[idx - 1].currentPosition;
                    }),
                    rocketPosition: currentPos,
                    rocketFuel: data.fuelStates[currentIdx] || rocket.fuel,
                    targetIndex: nextIdx
                });
            }
            
            currentTime += calculateHohmannTime(
                currentIdx === 0 ? moon.semiMajorAxis : satellites[currentIdx - 1].semiMajorAxis,
                nextIdx === 0 ? moon.semiMajorAxis : satellites[nextIdx - 1].semiMajorAxis
            );
        }
        
        // Animasyonu başlat
        visualizer.setSolution(animationSteps);
    };
    
    // Optimizasyonu başlat
    const result = await ga.optimize();
    
    // Sonuçları göster
    console.log("\nFinal Sonuçları:");
    console.log("=".repeat(50));
    console.log(`En iyi rota: ${result.solution}`);
    console.log(`Toplam delta-v: ${(result.cost/1000).toFixed(2)} km/s`);
    console.log("\nUyduların Son Yakıt Durumları:");
    result.fuelStates.forEach((fuel, idx) => {
        console.log(`Uydu ${idx + 1}: ${fuel.toFixed(1)} birim yakıt`);
    });
    console.log("=".repeat(50));
}

// Programı başlat
main().catch(console.error); 