from models import Point3D, Satellite, Moon, Rocket
from ant_colony import AntColonyOptimization
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import math
import random
from matplotlib.animation import FuncAnimation
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

class Simulation:
    def __init__(self, num_satellites=10, rocket_fuel=200000):
        self.num_satellites = num_satellites
        self.moon = Moon()
        self.rocket = Rocket(rocket_fuel)
        self.satellites = self.create_satellites()
        self.time = 0
        self.time_step = 3600  # 1 saat
        self.best_path = None
        self.current_path_index = 0
        self.rocket_position = self.moon.get_position()  # Roket başlangıçta Ay'da
        self.target_position = None
        self.movement_progress = 0  # 0 ile 1 arası, hedef noktaya ilerleme
        self.movement_speed = 0.05  # Her frame'de ne kadar ilerleyeceği
        self.aco_options = {}
        self.progress_callback = None  # Callback fonksiyonu için

    def create_satellites(self):
        satellites = []
        GEO_RADIUS = 42164e3  # Jeosenkron yörünge yarıçapı
        GEO_VARIATION = 1000e3  # Varyasyon

        for i in range(self.num_satellites):
            initial_angle = (2 * math.pi * i) / self.num_satellites
            orbit_radius = GEO_RADIUS + (random.random() - 0.5) * GEO_VARIATION
            inclination = (random.random() - 0.5) * math.pi / 90
            initial_fuel = 60 + random.random() * 20

            satellite = Satellite(
                i, orbit_radius, initial_angle, inclination, initial_fuel
            )
            satellites.append(satellite)

        return satellites

    def set_callback(self, callback):
        """İlerleme durumunu raporlamak için callback fonksiyonu ayarlar"""
        self.progress_callback = callback

    def calculate_path(self):
        """Sadece yol hesaplaması yapar, görselleştirme olmadan"""
        if not hasattr(self, 'progress_callback'):
            self.progress_callback = lambda p, m: None
            
        self.progress_callback(0, "ACO algoritması başlatılıyor...")
        
        # ACO parametrelerini ayarla
        aco = AntColonyOptimization(
            satellites=self.satellites,
            moon=self.moon,
            rocket=self.rocket,
            options={
                'num_ants': self.aco_options.get('num_ants', 50),
                'iterations': self.aco_options.get('iterations', 100),
                'evaporation_rate': self.aco_options.get('evaporation_rate', 0.1),
                'alpha': self.aco_options.get('alpha', 1.0),
                'beta': self.aco_options.get('beta', 2.0),
                'Q': self.aco_options.get('Q', 100),
                'time_step': self.time_step
            }
        )
        
        # Her iterasyonda ilerlemeyi bildir
        total_iterations = self.aco_options.get('iterations', 100)
        current_iteration = 0

        def iteration_callback(iteration):
            nonlocal current_iteration
            current_iteration = iteration
            percent = int((iteration / total_iterations) * 100)
            self.progress_callback(percent, f"İterasyon {iteration}/{total_iterations}")
        
        aco.set_iteration_callback(iteration_callback)
        
        # Optimize edilmiş yolu al
        result = aco.optimize()
        self.progress_callback(100, "Optimizasyon tamamlandı!")
        
        if result['solution']:
            self.best_path = result['solution']
            
        return result

    def set_next_target(self):
        """Bir sonraki hedef noktayı belirler"""
        if self.current_path_index < len(self.best_path):
            next_node = self.best_path[self.current_path_index]
            if next_node == 0:
                self.target_position = self.moon.get_position()
            else:
                self.target_position = self.satellites[next_node-1].current_position
            self.movement_progress = 0
            return True
        return False

    def update_rocket_position(self):
        """Roketi hedefe doğru hareket ettirir"""
        if self.target_position is None:
            return False

        # Doğrusal interpolasyon ile roketi hareket ettir
        self.movement_progress += self.movement_speed
        if self.movement_progress >= 1:
            self.rocket_position = self.target_position
            self.current_path_index += 1
            if not self.set_next_target():
                return False
        else:
            # Bezier eğrisi üzerinde hareket
            trajectory = self.rocket.calculate_trajectory(
                self.rocket_position,
                self.target_position,
                [self.moon]
            )
            self.rocket_position = trajectory.calculate_point(self.movement_progress)
        return True

    def update(self, frame):
        self.time += self.time_step
        
        # Update positions
        self.moon.update_position(self.time)
        for sat in self.satellites:
            sat.update_position(self.time_step)

        # Update rocket position
        self.update_rocket_position()

        # Clear and redraw
        self.ax.clear()
        
        # Plot Earth
        u = np.linspace(0, 2 * np.pi, 100)
        v = np.linspace(0, np.pi, 100)
        earth_radius = 6371e3
        x = earth_radius * np.outer(np.cos(u), np.sin(v))
        y = earth_radius * np.outer(np.sin(u), np.sin(v))
        z = earth_radius * np.outer(np.ones(np.size(u)), np.cos(v))
        self.ax.plot_surface(x, y, z, color='blue', alpha=0.1)

        # Plot Moon
        moon_pos = self.moon.get_position()
        self.ax.scatter(moon_pos.x, moon_pos.y, moon_pos.z, color='gray', s=100, label='Moon')

        # Plot Satellites
        for i, sat in enumerate(self.satellites):
            pos = sat.current_position
            color = 'green' if i+1 in self.best_path else 'red'
            self.ax.scatter(pos.x, pos.y, pos.z, color=color, s=20)

        # Plot Rocket
        self.ax.scatter(self.rocket_position.x, self.rocket_position.y, self.rocket_position.z,
                       color='yellow', s=100, label='Rocket')

        # Plot current trajectory
        if self.target_position:
            trajectory = self.rocket.calculate_trajectory(
                self.rocket_position,
                self.target_position,
                [self.moon]
            )
            trajectory_points = [trajectory.calculate_point(t) for t in np.linspace(0, 1, 50)]
            xs = [p.x for p in trajectory_points]
            ys = [p.y for p in trajectory_points]
            zs = [p.z for p in trajectory_points]
            self.ax.plot(xs, ys, zs, 'y--', alpha=0.5)

        # Set plot limits and labels
        limit = 450000e3  # 450,000 km
        self.ax.set_xlim([-limit, limit])
        self.ax.set_ylim([-limit, limit])
        self.ax.set_zlim([-limit, limit])
        self.ax.set_xlabel('X (km)')
        self.ax.set_ylabel('Y (km)')
        self.ax.set_zlabel('Z (km)')
        self.ax.set_title(f'Time: {self.time/3600:.1f} hours\nVisiting: {self.current_path_index}/{len(self.best_path)}')

    def show_3d_view(self):
        """3D görünümü gösterir"""
        # Yeni bir pencere oluştur
        from PyQt5.QtWidgets import QDialog, QVBoxLayout
        dialog = QDialog()
        dialog.setWindowTitle("3D Görünüm")
        dialog.resize(1000, 800)
        
        # Matplotlib figure oluştur
        fig = Figure(figsize=(12, 8))
        canvas = FigureCanvas(fig)
        
        # Layout ayarla
        layout = QVBoxLayout()
        layout.addWidget(canvas)
        dialog.setLayout(layout)
        
        # 3D axes oluştur
        self.ax = fig.add_subplot(111, projection='3d')
        
        # Animasyon fonksiyonu
        def update_plot(frame):
            self.update(frame)
            canvas.draw()
        
        # Timer ile güncelleme
        from PyQt5.QtCore import QTimer
        timer = QTimer()
        timer.timeout.connect(lambda: update_plot(0))
        timer.start(50)  # 50ms'de bir güncelle
        
        # Pencereyi göster
        dialog.exec_()

def main():
    sim = Simulation(num_satellites=10)
    sim.run()

if __name__ == "__main__":
    main()
