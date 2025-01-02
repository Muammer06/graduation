class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    distanceTo(other) {
        return Math.sqrt(
            Math.pow(this.x - other.x, 2) + 
            Math.pow(this.y - other.y, 2) + 
            Math.pow(this.z - other.z, 2)
        );
    }
}

class CelestialObject {
    static G = 6.67430e-11; // Gravitational constant

    calculateOrbitalElements(semiMajorAxis, eccentricity, inclination, time) {
        // Kepler'in yörünge denklemleri
        const meanMotion = Math.sqrt(CelestialObject.G * this.centralMass / Math.pow(semiMajorAxis, 3));
        const meanAnomaly = meanMotion * time;
        
        // Kepler denklemi çözümü (iteratif)
        let eccentricAnomaly = meanAnomaly;
        for (let i = 0; i < 5; i++) {
            eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(eccentricAnomaly);
        }
        
        // Gerçek anomali
        const trueAnomaly = 2 * Math.atan(
            Math.sqrt((1 + eccentricity)/(1 - eccentricity)) * 
            Math.tan(eccentricAnomaly/2)
        );
        
        // Yörünge düzlemindeki koordinatlar
        const r = semiMajorAxis * (1 - Math.pow(eccentricity, 2)) / 
                 (1 + eccentricity * Math.cos(trueAnomaly));
        const x = r * Math.cos(trueAnomaly);
        const y = r * Math.sin(trueAnomaly);
        
        // 3D koordinatlara dönüştür
        const z = y * Math.sin(inclination);
        const newY = y * Math.cos(inclination);
        
        return new Point3D(x, newY, z);
    }
}

// Sabitler ekleyelim
const CONSTANTS = {
    GEO_ORBIT_RADIUS: 35786e3, // Jeosenkron yörünge yarıçapı (metre)
    SATELLITE_ORBIT_PERIOD: 86164, // Jeosenkron yörünge periyodu (saniye)
    NUM_SATELLITES: 20,
    ORBIT_MIN_RADIUS: 20000e3,
    ORBIT_MAX_RADIUS: 60000e3
};

class Satellite extends CelestialObject {
    constructor(index, orbitRadius, initialAngle, inclination, fuel) {
        super();
        this.index = index;
        this.orbitRadius = orbitRadius;
        this.currentAngle = initialAngle;
        this.inclination = inclination;
        this.fuel = fuel;
        this.initialFuel = fuel; // Başlangıç yakıt miktarını sakla
        this.centralMass = 5.972e24;
        this.currentPosition = null;
        this.totalDistance = 0; // Toplam kat edilen mesafe
        this.fuelConsumptionRate = 0.0002; // Her km için tüketilen yakıt
        
        // Yörünge hızını hesapla
        const mu = CelestialObject.G * this.centralMass;
        this.orbitPeriod = 2 * Math.PI * Math.sqrt(Math.pow(orbitRadius, 3) / mu);
        this.orbitSpeed = (2 * Math.PI) / this.orbitPeriod;
        
        this.updatePosition(0);
    }

    updatePosition(time) {
        const oldPosition = this.currentPosition;
        const angle = this.currentAngle + this.orbitSpeed * time;
        
        // Yörünge düzlemindeki koordinatlar
        const x = this.orbitRadius * Math.cos(angle);
        const y = this.orbitRadius * Math.sin(angle);
        
        // Eğim rotasyonu uygula
        const yRotated = y * Math.cos(this.inclination);
        const z = y * Math.sin(this.inclination);
        
        this.currentPosition = new Point3D(x, yRotated, z);
        this.currentAngle = angle;

        // Kat edilen mesafeyi hesapla ve yakıt tüket
        if (oldPosition) {
            const distance = this.currentPosition.distanceTo(oldPosition);
            this.totalDistance += distance;
            this.consumeFuel(distance);
        }
    }

    // Mesafeye bağlı yakıt tüketimi
    consumeFuel(distance) {
        const distanceInKm = distance / 1000;
        const consumption = distanceInKm * this.fuelConsumptionRate;
        this.fuel = Math.max(0, this.fuel - consumption);
    }

    // Yakıt yüzdesi
    getFuelPercentage() {
        return (this.fuel / this.initialFuel) * 100;
    }
}

class Moon extends CelestialObject {
    constructor() {
        super();
        this.semiMajorAxis = 384400e3; // metre
        this.eccentricity = 0.0549;
        this.inclination = 5.145 * Math.PI / 180; // radyan
        this.centralMass = 5.972e24; // Dünya kütlesi
    }

    getPosition(time) {
        return this.calculateOrbitalElements(
            this.semiMajorAxis,
            this.eccentricity,
            this.inclination,
            time
        );
    }
}

class Rocket {
    constructor(fuelCapacity) {
        this.fuel = fuelCapacity;
        this.maxFuel = fuelCapacity;
        this.currentPosition = null;
        this.fuelConsumptionRate = 0.0001; // Her km için tüketilen yakıt (0.0001 birim/km)
    }

    // Mesafeye göre yakıt tüketimini hesapla (metre -> km dönüşümü yaparak)
    calculateFuelConsumption(distance) {
        const distanceInKm = distance / 1000; // metreyi km'ye çevir
        return distanceInKm * this.fuelConsumptionRate;
    }

    // Yakıt ikmali yap (birim cinsinden)
    refuel(satellite) {
        const refuelAmount = Math.min(
            satellite.fuel,
            this.maxFuel - this.fuel
        );
        
        if (refuelAmount > 0) {
            satellite.fuel -= refuelAmount;
            this.fuel += refuelAmount;
            return refuelAmount;
        }
        return 0;
    }

    // İki nokta arasındaki mesafeyi metre cinsinden hesapla
    calculateAxisDistance(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const dz = Math.abs(to.z - from.z);
        return dx + dy + dz;
    }

    canTravel(distance) {
        const requiredFuel = this.calculateFuelConsumption(distance);
        return this.fuel >= requiredFuel;
    }
}

export { Point3D, Satellite, Moon, Rocket }; 