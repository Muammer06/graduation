import { Point3D } from './models.js';

class AntColonyOptimization {
    constructor(satellites, moon, rocket, options = {}) {
        this.satellites = satellites;
        this.moon = moon;
        this.rocket = rocket;
        this.numAnts = options.numAnts || 100;
        this.iterations = options.iterations || 100;
        this.evaporationRate = options.evaporationRate || 0.1;
        this.alpha = options.alpha || 1.0;
        this.beta = options.beta || 5.0;
        this.Q = options.Q || 100;

        this.numNodes = satellites.length + 1;
        this.distances = Array(this.numNodes).fill().map(() => Array(this.numNodes).fill(0));
        this.pheromones = Array(this.numNodes).fill().map(() => Array(this.numNodes).fill(1));

        this.bestSolution = null;
        this.bestCost = Infinity;
        this.onNewBestSolution = null;

        this.initializeDistances();
        this.timeStep = 3600; // 1 saatlik zaman adımı (saniye)
        this.fuelConsumptionPerHour = 0.005; // Saatlik doğal yakıt tüketimi
    }

    initializeDistances() {
        for (let i = 0; i < this.numNodes; i++) {
            for (let j = 0; j < this.numNodes; j++) {
                if (i === j) continue;

                const pos1 = i === 0 ? this.moon.getPosition() : this.satellites[i - 1].currentPosition;
                const pos2 = j === 0 ? this.moon.getPosition() : this.satellites[j - 1].currentPosition;

                this.distances[i][j] = pos1.distanceTo(pos2);
            }
        }
    }

    calculatePriorities(satelliteStates) {
        return satelliteStates.map((sat, index) => {
            const fuelLevel = sat.fuel / 100;
            const priorityScore = (1 - fuelLevel) * 2; // Yakıt seviyesi azaldıkça öncelik artar

            return {
                index: index,
                score: priorityScore,
                fuelLevel: fuelLevel,
                position: sat.position
            };
        });
    }

    constructSolution() {
        const visited = new Set([0]);
        const path = [0];
        let currentNode = 0;
        let currentFuel = this.rocket.maxFuel;
        let totalDistance = 0;

        const satelliteStates = this.satellites.map(sat => ({
            fuel: sat.fuel,
            position: {...sat.currentPosition},
            orbitRadius: sat.orbitRadius,
            orbitSpeed: sat.orbitSpeed,
            currentAngle: sat.currentAngle,
            inclination: sat.inclination,
            fuelConsumptionRate: sat.fuelConsumptionRate
        }));

        while (visited.size < this.satellites.length + 1) { // Ay dahil
            const currentPos = currentNode === 0 ? 
                this.moon.getPosition() : 
                satelliteStates[currentNode - 1].position;

            this.updateSatelliteStates(satelliteStates, this.timeStep);

            const priorities = this.calculatePriorities(satelliteStates);
            const candidates = priorities.filter(p => !visited.has(p.index + 1)).sort((a, b) => b.score - a.score);

            console.log(`\nMevcut Durum:`);
            console.log(`Roket Yakıtı: ${currentFuel.toFixed(1)}`);
            console.log(`Ziyaret Edilen Uydular: ${Array.from(visited).join(', ')}`);
            console.log(`Mevcut Konum: ${currentNode === 0 ? 'Ay' : `Uydu ${currentNode}`}`);

            let selectedNext = null;

            if (candidates.length > 0) {
                selectedNext = candidates[0]; // En yüksek öncelikli adayı seç
                console.log(`Seçilen Hedef: Uydu ${selectedNext.index + 1}`);
            } else {
                console.log(`Hiçbir uyduya gidilemiyor, mevcut yakıt: ${currentFuel}`);
                break; // Hiçbir uyduya gidilemiyorsa döngüyü kır
            }

            path.push(selectedNext.index + 1);
            totalDistance += this.distances[currentNode][selectedNext.index + 1];

            const distanceToNext = this.distances[currentNode][selectedNext.index + 1];
            const fuelNeeded = this.rocket.calculateFuelConsumption(distanceToNext);

            if (currentFuel < fuelNeeded) {
                console.log(`Roket, Uydu ${selectedNext.index + 1}'e gitmek için yeterli yakıta sahip değil.`);
                console.log(`Ay'a dönüyorum...`);

                // Ay'a dönüş
                const returnDistance = this.calculateDynamicDistance(currentPos, this.moon.getPosition());
                const returnFuelNeeded = this.rocket.calculateFuelConsumption(returnDistance);

                if (currentFuel < returnFuelNeeded) {
                    console.log(`Roket Ay'a dönmek için yeterli yakıta sahip değil.`);
                    break; // Yeterli yakıt yoksa döngüyü kır
                }

                // Ay'a dön
                currentFuel -= returnFuelNeeded; // Ay'a dönüş için yakıtı düş
                path.push(0); // Ay'a dönüş
                totalDistance += returnDistance;

                // Ay'da yakıt doldur
                currentFuel = this.rocket.maxFuel; // Ay'da yakıt doldur
                console.log(`Ay'a ulaşıldı, yakıt dolduruldu. Mevcut Yakıt: ${currentFuel.toFixed(1)}`);
                currentNode = 0; // Ay'da
                continue; // Döngüye devam et
            }

            currentFuel -= fuelNeeded; // Yakıtı düş
            currentNode = selectedNext.index + 1; // Geçerli konumu güncelle
            visited.add(currentNode); // Ziyaret edilenleri güncelle
        }

        // Geçerli çözüm kontrolü
        const allSatellitesVisited = visited.size === this.satellites.length + 1; // Ay dahil
        if (!allSatellitesVisited) {
            console.log(`Geçerli bir çözüm bulunamadı, tüm uydular ziyaret edilmedi.`);
            return null;
        }

        console.log(`Geçerli bir çözüm bulundu!`);
        return {
            path,
            cost: totalDistance,
            fuelStates: satelliteStates.map(state => state.fuel),
            timeElapsed: 0 // Zaman kısıtını kaldırdık, bu yüzden 0
        };
    }

    updateSatelliteStates(satelliteStates, timeStep) {
        satelliteStates.forEach(state => {
            state.currentAngle += state.orbitSpeed * timeStep;
            const x = state.orbitRadius * Math.cos(state.currentAngle);
            const y = state.orbitRadius * Math.sin(state.currentAngle) * Math.cos(state.inclination);
            const z = state.orbitRadius * Math.sin(state.currentAngle) * Math.sin(state.inclination);
            state.position = new Point3D(x, y, z);

            const hoursPassed = timeStep / 3600;
            const fuelConsumed = hoursPassed * this.fuelConsumptionPerHour;
            state.fuel = Math.max(0, state.fuel - fuelConsumed);
        });
    }

    updatePheromones(solutions) {
        // Feromonları buharlaştır
        for (let i = 0; i < this.numNodes; i++) {
            for (let j = 0; j < this.numNodes; j++) {
                this.pheromones[i][j] *= (1 - this.evaporationRate);
            }
        }

        // Yeni çözümler üzerinden feromon ekle
        for (const solution of solutions) {
            if (!solution) continue;

            let totalFuelSaved = 0;
            for (let i = 0; i < solution.path.length - 1; i++) {
                const from = solution.path[i];
                const to = solution.path[i + 1];
                if (to !== 0) {
                    const satFuel = this.satellites[to - 1].fuel;
                    totalFuelSaved += (100 - satFuel); // Yakıt tasarrufu
                }
            }

            const pheromoneAmount = (this.Q / solution.cost) * (1 + totalFuelSaved / 1000);
            
            for (let i = 0; i < solution.path.length - 1; i++) {
                const from = solution.path[i];
                const to = solution.path[i + 1];
                this.pheromones[from][to] += pheromoneAmount;
                this.pheromones[to][from] += pheromoneAmount; // Simetrik güncelleme
            }
        }
    }

    async optimize() {
        const solutions = [];
        
        for (let iteration = 0; iteration < this.iterations; iteration++) {
            for (let ant = 0; ant < this.numAnts; ant++) {
                const solution = this.constructSolution();
                if (solution) {
                    solutions.push(solution);
                    
                    console.log(`\nIterasyon ${iteration + 1}, Karınca ${ant + 1}`);
                    console.log(`Roket Yakıtı: ${solution.fuelStates.reduce((acc, fuel) => acc + fuel, 0).toFixed(1)}`);
                    console.log(`Uyduların Yakıt Durumları: ${solution.fuelStates.map(f => f.toFixed(1)).join(', ')}`);
                    console.log(`Path: ${solution.path.join(' -> ')}`);
                } else {
                    console.log(`Iterasyon ${iteration + 1}, Karınca ${ant + 1}: Geçerli bir çözüm bulunamadı.`);
                }
            }

            this.updatePheromones(solutions);

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        const bestSolution = solutions.reduce((best, current) => 
            !best || current.cost < best.cost ? current : best, null);

        return {
            solution: bestSolution ? bestSolution.path : null,
            cost: bestSolution ? bestSolution.cost : Infinity,
            fuelStates: bestSolution ? bestSolution.fuelStates : null
        };
    }

    calculateDynamicDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2) +
            Math.pow(pos2.z - pos1.z, 2)
        );
    }

    calculateTransferTime(pos1, pos2) {
        const distance = this.calculateDynamicDistance(pos1, pos2);
        const mu = 3.986e14; // Dünya'nın standart gravitasyonel parametresi
        const r1 = Math.sqrt(pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z);
        const r2 = Math.sqrt(pos2.x * pos2.x + pos2.y * pos2.y + pos2.z * pos2.z);
        const a = (r1 + r2) / 2;
        return Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
    }
}

export { AntColonyOptimization }; 