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

class Satellite {
    constructor(id, orbitRadius, initialAngle, inclination, initialFuel) {
        this.id = id;
        this.orbitRadius = orbitRadius;
        this.initialAngle = initialAngle;
        this.inclination = inclination;
        this.currentAngle = initialAngle;
        this.fuel = initialFuel;
        this.orbitSpeed = Math.sqrt(3.986e14 / orbitRadius); // Basit yörünge hızı hesaplaması
    }

    get currentPosition() {
        const x = this.orbitRadius * Math.cos(this.currentAngle);
        const y = this.orbitRadius * Math.sin(this.currentAngle) * Math.cos(this.inclination);
        const z = this.orbitRadius * Math.sin(this.currentAngle) * Math.sin(this.inclination);
        return new Point3D(x, y, z);
    }
}

class Moon {
    constructor() {
        this.radius = 1737e3; // Ay yarıçapı (metre)
    }

    getPosition() {
        return new Point3D(0, 0, 0); // Ay'ın merkezi
    }
}

class Rocket {
    constructor(maxFuel) {
        this.maxFuel = maxFuel; // Roketin maksimum yakıt kapasitesi
    }

    calculateFuelConsumption(distance) {
        return distance * 0.0001; // Yakıt tüketimi mesafeye bağlı
    }
}

export { Point3D, Satellite, Moon, Rocket }; 