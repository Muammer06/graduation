class AntColonyOptimization {
    constructor(satellites, moon, rocket, options = {}) {
        this.satellites = satellites;
        this.moon = moon;
        this.rocket = rocket;
        this.numAnts = options.numAnts || 50;
        this.iterations = options.iterations || 100;
        this.evaporationRate = options.evaporationRate || 0.1;
        this.alpha = options.alpha || 1.0;  // Feromon önem faktörü
        this.beta = options.beta || 2.0;    // Sezgisel önem faktörü
        this.Q = options.Q || 100;          // Feromon güncelleme sabiti
        
        // Düğümler arası mesafe ve feromon matrisleri
        this.numNodes = satellites.length + 1; // +1 for moon
        this.distances = Array(this.numNodes).fill().map(() => Array(this.numNodes).fill(0));
        this.pheromones = Array(this.numNodes).fill().map(() => Array(this.numNodes).fill(1));
        
        this.bestSolution = null;
        this.bestCost = Infinity;
        this.onNewBestSolution = null;
        
        this.initializeDistances();
        this.minFuelThreshold = 0.3; // Ay'a dönüş için minimum yakıt seviyesi (%30)
        this.maxVisitsBeforeMoon = 3; // Ay'a dönmeden önce maksimum uydu ziyareti
    }

    initializeDistances() {
        // Ay (indeks 0) ve tüm uydular arasındaki mesafeleri hesapla
        for (let i = 0; i < this.numNodes; i++) {
            for (let j = 0; j < this.numNodes; j++) {
                if (i === j) continue;
                
                const pos1 = i === 0 ? this.moon.getPosition(0) : 
                    this.satellites[i - 1].currentPosition;
                const pos2 = j === 0 ? this.moon.getPosition(0) : 
                    this.satellites[j - 1].currentPosition;
                
                this.distances[i][j] = pos1.distanceTo(pos2);
            }
        }
    }

    calculateDeltaV(from, to) {
        const r1 = from === 0 ? this.moon.semiMajorAxis : 
            this.satellites[from - 1].orbitRadius;
        const r2 = to === 0 ? this.moon.semiMajorAxis : 
            this.satellites[to - 1].orbitRadius;
        
        const mu = 3.986e14;
        const v1 = Math.sqrt(mu/r1);
        const v2 = Math.sqrt(mu/r2);
        const a = (r1 + r2) / 2;
        const vt1 = Math.sqrt(mu * (2/r1 - 1/a));
        const vt2 = Math.sqrt(mu * (2/r2 - 1/a));
        return Math.abs(vt1 - v1) + Math.abs(v2 - vt2);
    }

    constructSolution() {
        const visited = new Set([0]); // Başlangıç noktası olarak Ay
        const path = [0];
        let currentNode = 0;
        let totalDistance = 0;
        let currentFuel = this.rocket.maxFuel;
        let visitsAfterMoon = 0;
        let attempts = 0; // Sonsuz döngüyü önlemek için
        const maxAttempts = this.numNodes * 3; // Maksimum deneme sayısı
        
        const satelliteFuel = new Map(
            this.satellites.map((sat, i) => [i + 1, sat.fuel])
        );

        while (visited.size < this.numNodes && attempts < maxAttempts) {
            attempts++;
            const currentPos = currentNode === 0 ? 
                this.moon.getPosition(0) : 
                this.satellites[currentNode - 1].currentPosition;
            
            // Ay'a dönüş mesafesini hesapla
            const moonPos = this.moon.getPosition(0);
            const returnDistance = this.rocket.calculateAxisDistance(currentPos, moonPos);
            const returnFuel = this.rocket.calculateFuelConsumption(returnDistance);

            // Ay'a dönüş zorunluluğu kontrolü
            const needsToReturnToMoon = 
                currentFuel < (this.rocket.maxFuel * this.minFuelThreshold) || 
                visitsAfterMoon >= this.maxVisitsBeforeMoon || 
                (currentNode !== 0 && returnFuel >= currentFuel * 0.8);

            if (needsToReturnToMoon && currentNode !== 0) {
                if (!this.rocket.canTravel(returnDistance)) {
                    return null;
                }
                path.push(0);
                totalDistance += returnDistance;
                currentFuel = this.rocket.maxFuel;
                currentNode = 0;
                visitsAfterMoon = 0;
                continue;
            }

            // Gidilebilecek düğümleri değerlendir
            const probabilities = [];
            for (let next = 0; next < this.numNodes; next++) {
                if (visited.has(next)) continue;
                
                const nextPos = next === 0 ? 
                    this.moon.getPosition(0) : 
                    this.satellites[next - 1].currentPosition;
                
                const distance = this.rocket.calculateAxisDistance(currentPos, nextPos);
                const fuelNeeded = this.rocket.calculateFuelConsumption(distance);
                
                // Yakıt ve dönüş kontrolü
                if (fuelNeeded <= currentFuel * 0.7) {
                    const pheromone = this.pheromones[currentNode][next];
                    const distanceHeuristic = 1 / distance;
                    const fuelHeuristic = next === 0 ? 2 : 
                        (satelliteFuel.get(next) || 0) / 100;
                    
                    const heuristic = distanceHeuristic * Math.pow(fuelHeuristic, 2);
                    const probability = Math.pow(pheromone, this.alpha) * 
                                     Math.pow(heuristic, this.beta);
                    
                    probabilities.push({ node: next, probability, distance });
                }
            }

            if (probabilities.length === 0) {
                // Hiçbir yere gidemiyorsak ve Ay'a da dönemiyorsak
                if (currentNode !== 0) {
                    if (!this.rocket.canTravel(returnDistance)) {
                        return null;
                    }
                    path.push(0);
                    totalDistance += returnDistance;
                    currentFuel = this.rocket.maxFuel;
                    currentNode = 0;
                    visitsAfterMoon = 0;
                } else {
                    return null; // Ay'dayız ve hiçbir yere gidemiyoruz
                }
                continue;
            }

            // Sonraki hedefi seç
            const selected = this.selectNext(probabilities);
            currentFuel -= this.rocket.calculateFuelConsumption(selected.distance);
            totalDistance += selected.distance;
            
            if (selected.node !== 0) {
                visitsAfterMoon++;
                const currentSatFuel = satelliteFuel.get(selected.node) || 0;
                const refuelAmount = Math.min(
                    currentSatFuel,
                    this.rocket.maxFuel - currentFuel
                );
                currentFuel += refuelAmount * 0.9;
                satelliteFuel.set(selected.node, currentSatFuel - refuelAmount);
            } else {
                currentFuel = this.rocket.maxFuel;
                visitsAfterMoon = 0;
            }

            path.push(selected.node);
            visited.add(selected.node);
            currentNode = selected.node;
        }

        // Eğer tüm düğümleri ziyaret edemediyse geçersiz çözüm
        if (visited.size < this.numNodes) {
            return null;
        }

        return { 
            path, 
            cost: totalDistance, 
            fuelStates: Array.from(satelliteFuel.values())
        };
    }

    // Yardımcı metod: Sonraki hedefi seç
    selectNext(probabilities) {
        const total = probabilities.reduce((sum, p) => sum + p.probability, 0);
        let r = Math.random() * total;
        
        for (const p of probabilities) {
            r -= p.probability;
            if (r <= 0) return p;
        }
        return probabilities[0];
    }

    updatePheromones(solutions) {
        // Feromon buharlaşması
        for (let i = 0; i < this.numNodes; i++) {
            for (let j = 0; j < this.numNodes; j++) {
                this.pheromones[i][j] *= (1 - this.evaporationRate);
            }
        }

        // Yeni feromon ekleme
        for (const solution of solutions) {
            if (!solution) continue;
            
            const pheromoneAmount = this.Q / solution.cost;
            for (let i = 0; i < solution.path.length - 1; i++) {
                const from = solution.path[i];
                const to = solution.path[i + 1];
                this.pheromones[from][to] += pheromoneAmount;
                this.pheromones[to][from] += pheromoneAmount; // Simetrik güncelleme
            }
        }
    }

    async optimize() {
        for (let iteration = 0; iteration < this.iterations; iteration++) {
            const solutions = [];
            
            // Her karınca için çözüm oluştur
            for (let ant = 0; ant < this.numAnts; ant++) {
                const solution = this.constructSolution();
                if (solution) solutions.push(solution);
            }

            // En iyi çözümü güncelle
            const bestIteration = solutions.reduce((best, current) => 
                !best || current.cost < best.cost ? current : best, null);

            if (bestIteration && (!this.bestSolution || bestIteration.cost < this.bestCost)) {
                this.bestSolution = bestIteration.path;
                this.bestCost = bestIteration.cost;
                this.bestFuelStates = bestIteration.fuelStates; // Yakıt durumlarını sakla
                
                if (this.onNewBestSolution) {
                    this.onNewBestSolution({
                        iteration,
                        solution: this.bestSolution,
                        cost: this.bestCost,
                        fuelStates: this.bestFuelStates
                    });
                }
            }

            // Feromonları güncelle
            this.updatePheromones(solutions);
        }

        return {
            solution: this.bestSolution,
            cost: this.bestCost,
            fuelStates: this.bestFuelStates // Saklanan yakıt durumlarını kullan
        };
    }
}

export { AntColonyOptimization }; 