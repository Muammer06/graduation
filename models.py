import math
import numpy as np
from scipy.special import comb

class Point3D:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

    def distance_to(self, other):
        return math.sqrt(
            (self.x - other.x) ** 2 +
            (self.y - other.y) ** 2 +
            (self.z - other.z) ** 2
        )

class Moon:
    def __init__(self):
        self.radius = 1737e3  # Ay yarıçapı (metre)
        self.orbit_radius = 384400e3  # Ay'ın Dünya'ya ortalama uzaklığı
        self.orbital_period = 27.32 * 24 * 3600  # Ay'ın yörünge periyodu (saniye)
        self.current_angle = 0
        
    def update_position(self, time):
        # Ay'ın açısal hızı
        angular_velocity = 2 * math.pi / self.orbital_period
        self.current_angle = (angular_velocity * time) % (2 * math.pi)
        
    def get_position(self):
        x = self.orbit_radius * math.cos(self.current_angle)
        y = self.orbit_radius * math.sin(self.current_angle)
        z = 0  # Ay'ın yörüngesini basitleştirmek için düzlemsel kabul ediyoruz
        return Point3D(x, y, z)

class BezierTrajectory:
    def __init__(self, control_points):
        self.control_points = control_points
    
    def calculate_point(self, t):
        n = len(self.control_points) - 1
        point = Point3D(0, 0, 0)
        
        for i in range(n + 1):
            coef = comb(n, i) * (t ** i) * ((1 - t) ** (n - i))
            point.x += coef * self.control_points[i].x
            point.y += coef * self.control_points[i].y
            point.z += coef * self.control_points[i].z
            
        return point

class Rocket:
    def __init__(self, max_fuel):
        self.max_fuel = max_fuel
        self.current_fuel = max_fuel
        self.fuel_consumption_rate = 0.0001  # kg/m
        self.refuel_consumption_rate = 0.1  # kg/kg transferred
        self.speed = 10000  # m/s (36,000 km/h ortalama uzay aracı hızı)
        
    def calculate_fuel_consumption(self, distance):
        """
        Belirli bir mesafe için gereken yakıt miktarını hesaplar
        Args:
            distance: Kat edilecek mesafe (metre)
        Returns:
            float: Gereken yakıt miktarı
        """
        return distance * self.fuel_consumption_rate
        
    def calculate_trajectory(self, start_pos, end_pos, gravity_bodies):
        # Ara kontrol noktaları oluştur
        control_points = [start_pos]
        
        # Yerçekimi etkisini hesaba katarak ara noktaları belirle
        mid_point = Point3D(
            (start_pos.x + end_pos.x) / 2,
            (start_pos.y + end_pos.y) / 2,
            (start_pos.z + end_pos.z) / 2
        )
        
        # Yerçekimi etkisiyle eğrilik ekle
        for body in gravity_bodies:
            body_pos = body.get_position()
            gravity_factor = 1000000  # Yerçekimi etkisinin şiddeti
            mid_point.x += (body_pos.x - mid_point.x) / gravity_factor
            mid_point.y += (body_pos.y - mid_point.y) / gravity_factor
            mid_point.z += (body_pos.z - mid_point.z) / gravity_factor
        
        control_points.append(mid_point)
        control_points.append(end_pos)
        
        return BezierTrajectory(control_points)

    def has_enough_fuel(self, required_fuel):
        """
        Yeterli yakıt olup olmadığını kontrol eder
        """
        return self.current_fuel >= required_fuel

    def consume_fuel(self, amount):
        """
        Yakıt tüketir
        """
        if self.has_enough_fuel(amount):
            self.current_fuel -= amount
            return True
        return False

    def refuel(self):
        """
        Yakıt deposunu doldurur
        """
        self.current_fuel = self.max_fuel

class Satellite:
    def __init__(self, id, orbit_radius, initial_angle, inclination, initial_fuel):
        self.id = id
        self.orbit_radius = orbit_radius
        self.current_angle = initial_angle
        self.inclination = inclination
        self.fuel = initial_fuel
        self.orbit_speed = math.sqrt(3.986e14 / orbit_radius)  # Kepler'in 3. yasası

    @property
    def current_position(self):
        x = self.orbit_radius * math.cos(self.current_angle)
        y = self.orbit_radius * math.sin(self.current_angle) * math.cos(self.inclination)
        z = self.orbit_radius * math.sin(self.current_angle) * math.sin(self.inclination)
        return Point3D(x, y, z)

    def update_position(self, time_step):
        self.current_angle += self.orbit_speed * time_step