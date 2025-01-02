class GeneticAlgorithm {
    constructor(satellites, moon, rocket, options = {}) {
        this.satellites = satellites;
        this.moon = moon;
        this.rocket = rocket;
        this.populationSize = options.populationSize || 100;
        this.generations = options.generations || 100;
        this.mutationRate = options.mutationRate || 0.1;
        this.eliteSize = options.eliteSize || 10;
        this.satelliteFuelStates = new Map();
        this.onNewBestSolution = null;
    }

    createInitialPopulation() {
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            // Her kromozom [0, 1, ..., n, 0] formatında, 0=Ay
            const chromosome = [0];
            const satelliteIndices = Array.from(
                {length: this.satellites.length}, 
                (_, i) => i + 1
            );
            
            // Rastgele karıştır
            for (let j = satelliteIndices.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [satelliteIndices[j], satelliteIndices[k]] = 
                [satelliteIndices[k], satelliteIndices[j]];
            }
            
            chromosome.push(...satelliteIndices, 0);
            population.push(chromosome);
        }
        return population;
    }

    calculateFitness(chromosome) {
        let totalDeltaV = 0;
        let currentTime = 0;
        this.rocket.fuel = this.rocket.maxFuel;
        const currentFuelStates = new Map(
            this.satellites.map((sat, i) => [i, sat.fuel])
        );
        let routeValid = true;

        // Her uyduyu güncelle
        this.satellites.forEach(sat => sat.updatePosition(currentTime));
        
        for (let i = 0; i < chromosome.length - 1; i++) {
            const currentIdx = chromosome[i];
            const nextIdx = chromosome[i + 1];
            
            // Mevcut ve sonraki konumları al
            const currentPos = currentIdx === 0 ? 
                this.moon.getPosition(currentTime) : 
                this.satellites[currentIdx - 1].currentPosition;
            
            const nextPos = nextIdx === 0 ? 
                this.moon.getPosition(currentTime) : 
                this.satellites[nextIdx - 1].currentPosition;
            
            // Hohmann transfer için delta-v hesapla
            const deltaV = this.calculateHohmannTransfer(
                currentPos.distanceTo({x: 0, y: 0, z: 0}),
                nextPos.distanceTo({x: 0, y: 0, z: 0})
            );
            
            const fuelNeeded = this.rocket.calculateFuelConsumption(deltaV);
            
            if (fuelNeeded > this.rocket.fuel) {
                routeValid = false;
                break;
            }

            // Uydu yakıtını güncelle
            if (currentIdx !== 0) {
                const currentFuel = currentFuelStates.get(currentIdx - 1) - 1;
                currentFuelStates.set(currentIdx - 1, currentFuel);
                if (currentFuel < 0) {
                    routeValid = false;
                    break;
                }
            }

            this.rocket.fuel -= fuelNeeded;
            totalDeltaV += deltaV;
            currentTime += this.calculateHohmannTime(
                currentIdx === 0 ? this.moon.semiMajorAxis : this.satellites[currentIdx - 1].orbitRadius,
                nextIdx === 0 ? this.moon.semiMajorAxis : this.satellites[nextIdx - 1].orbitRadius
            );

            // Uyduları yeni zamana göre güncelle
            this.satellites.forEach(sat => sat.updatePosition(currentTime));
        }

        if (routeValid) {
            this.satelliteFuelStates.set(chromosome.toString(), currentFuelStates);
        }

        return routeValid ? 1 / (totalDeltaV + 1) : 0;
    }

    selectParents(population, fitnessScores) {
        const parents = [];
        for (let i = 0; i < this.populationSize; i++) {
            // Turnuva seçimi
            const tournamentSize = 5;
            const tournament = Array.from({length: tournamentSize}, () => {
                const idx = Math.floor(Math.random() * population.length);
                return { idx, fitness: fitnessScores[idx] };
            });
            
            const winner = tournament.reduce((prev, current) => 
                (prev.fitness > current.fitness) ? prev : current
            );
            
            parents.push([...population[winner.idx]]);
        }
        return parents;
    }

    crossover(parent1, parent2) {
        const child = Array(parent1.length).fill(0);
        
        // İlk ve son nokta her zaman Ay (0)
        child[0] = 0;
        child[child.length - 1] = 0;
        
        // Orta noktaları karıştır
        const mid = Math.floor(parent1.length / 2);
        const segment = parent1.slice(1, mid);
        const remaining = parent2.slice(1, -1).filter(x => !segment.includes(x));
        
        child.splice(1, segment.length, ...segment);
        child.splice(mid, remaining.length, ...remaining);
        
        return child;
    }

    mutate(chromosome) {
        if (Math.random() < this.mutationRate) {
            // İlk ve son hariç (Ay noktaları) rastgele iki noktayı değiştir
            const idx1 = 1 + Math.floor(Math.random() * (chromosome.length - 2));
            const idx2 = 1 + Math.floor(Math.random() * (chromosome.length - 2));
            [chromosome[idx1], chromosome[idx2]] = [chromosome[idx2], chromosome[idx1]];
        }
    }

    async optimize() {
        let population = this.createInitialPopulation();
        let bestSolution = null;
        let bestFitness = 0;

        for (let generation = 0; generation < this.generations; generation++) {
            // Uygunluk değerlerini hesapla
            const fitnessScores = population.map(chromosome => 
                this.calculateFitness(chromosome)
            );
            
            // En iyi çözümü güncelle
            const maxFitnessIdx = fitnessScores.indexOf(Math.max(...fitnessScores));
            if (fitnessScores[maxFitnessIdx] > bestFitness) {
                bestFitness = fitnessScores[maxFitnessIdx];
                bestSolution = [...population[maxFitnessIdx]];
                
                if (this.onNewBestSolution) {
                    this.onNewBestSolution({
                        generation,
                        solution: bestSolution,
                        fitness: bestFitness,
                        fuelStates: this.satelliteFuelStates.get(bestSolution.toString())
                    });
                }
            }

            // Elitizm
            const elite = Array.from({length: this.eliteSize}, () => 0)
                .map((_, i) => {
                    const idx = fitnessScores.indexOf(Math.max(...fitnessScores));
                    fitnessScores[idx] = -1;
                    return [...population[idx]];
                });

            // Ebeveyn seçimi
            const parents = this.selectParents(population, fitnessScores);

            // Yeni nesil oluştur
            const newPopulation = [...elite];
            while (newPopulation.length < this.populationSize) {
                const parent1 = parents[Math.floor(Math.random() * parents.length)];
                const parent2 = parents[Math.floor(Math.random() * parents.length)];
                const child = this.crossover(parent1, parent2);
                this.mutate(child);
                newPopulation.push(child);
            }

            population = newPopulation;
        }

        return {
            solution: bestSolution,
            cost: bestFitness > 0 ? 1 / bestFitness - 1 : Infinity,
            fuelStates: this.satelliteFuelStates.get(bestSolution.toString())
        };
    }

    calculateHohmannTransfer(r1, r2) {
        const mu = 3.986e14; // Dünya'nın gravitasyonel parametresi
        const v1 = Math.sqrt(mu/r1);
        const v2 = Math.sqrt(mu/r2);
        const a = (r1 + r2) / 2;
        const vt1 = Math.sqrt(mu * (2/r1 - 1/a));
        const vt2 = Math.sqrt(mu * (2/r2 - 1/a));
        return Math.abs(vt1 - v1) + Math.abs(v2 - vt2);
    }

    calculateHohmannTime(r1, r2) {
        const mu = 3.986e14;
        const a = (r1 + r2) / 2;
        return Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
    }
}

export { GeneticAlgorithm }; 