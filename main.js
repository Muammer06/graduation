import { Point3D, Satellite, Moon, Rocket } from './models.js';
import { AntColonyOptimization } from './ant-colony.js';
import { SpaceVisualizer } from './visualization.js';

async function main() {
    console.log("Program başlatılıyor...");
    
    // Görselleştirme için container oluştur
    const container = document.getElementById('visualization');
    const visualizer = new SpaceVisualizer(container);
    
    // Problem parametrelerini ayarla
    const numSatellites = 10;
    const rocketFuel = 30000; // Yakıt birimi (1000 birim)
    
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
        
        const initialFuel = 60 + Math.random() * 20; // 60-80 arası
        
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
    
    // Ant Colony Optimization kullan
    const aco = new AntColonyOptimization(satellites, moon, rocket, {
        numAnts: 100,
        iterations: 1000,
        evaporationRate: 0.2,
        alpha: 5.0,
        beta: 2.0,
        Q: 100
    });

    aco.onNewBestSolution = (data) => {
        console.log(`\nYeni en iyi çözüm (iterasyon ${data.iteration}):`);
        console.log(`Rota: ${data.solution}`);
        console.log(`Maliyet: ${data.cost.toFixed(2)}`);
        console.log(`Yakıt Durumları: ${data.fuelStates.map(f => f.toFixed(1)).join(', ')}`);
    };

    const result = await aco.optimize();
    
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

    // Simülasyon çözümünü görselleştiriciye aktar
    if (result.solution) {
        visualizer.setSolution({
            rocketPosition: { x: 0, y: 0, z: 0 }, // Başlangıç pozisyonu
            rocketFuel: rocket.maxFuel,
            totalDistance: 0,
            satellites: result.fuelStates.map((fuel, idx) => ({
                position: satellites[idx].currentPosition,
                fuel: fuel
            })),
            targetIndex: 0 // Başlangıç hedefi
        });
    }
}

main().catch(console.error); 