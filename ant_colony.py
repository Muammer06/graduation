import random
from models import Point3D, Satellite, Moon, Rocket
import math
import numpy as np

class AntColonyOptimization:
    def __init__(self, satellites, moon, rocket, options=None):
        if options is None:
            options = {}
        self.satellites = satellites
        self.moon = moon
        self.rocket = rocket
        self.num_ants = options.get('num_ants', 100)
        self.iterations = options.get('iterations', 100)
        self.evaporation_rate = options.get('evaporation_rate', 0.1)
        self.alpha = options.get('alpha', 1.0)
        self.beta = options.get('beta', 5.0)
        self.Q = options.get('Q', 100)

        self.num_nodes = len(satellites) + 1
        self.distances = [[0] * self.num_nodes for _ in range(self.num_nodes)]
        self.pheromones = [[1] * self.num_nodes for _ in range(self.num_nodes)]
        self.time_step = 3600  # 1 saatlik zaman adımı (saniye)
        self.fuelConsumptionPerHour = 0.005  # Saatlik yakıt tüketimi

        self.initialize_distances()
        self.iteration_callback = None

    def initialize_distances(self):
        for i in range(self.num_nodes):
            for j in range(self.num_nodes):
                if i == j:
                    continue
                pos1 = self.moon.get_position() if i == 0 else self.satellites[i - 1].current_position
                pos2 = self.moon.get_position() if j == 0 else self.satellites[j - 1].current_position
                self.distances[i][j] = pos1.distance_to(pos2)

    def calculate_priorities(self, satellite_states, current_node, current_fuel, elapsed_time):
        priorities = []
        current_pos = self.moon.get_position() if current_node == 0 else satellite_states[current_node - 1]['position']
        moon_pos = self.moon.get_position()
        
        for index, sat in enumerate(satellite_states):
            # Temel faktörler
            fuel_level = sat['fuel'] / 100
            distance_to_target = current_pos.distance_to(sat['position'])
            travel_time = distance_to_target / self.rocket.speed
            fuel_needed = self.rocket.calculate_fuel_consumption(distance_to_target)
            
            # Feromon değerini al
            pheromone = self.pheromones[current_node][index + 1]
            
            # Sezgisel bilgi hesapla
            heuristic = 1.0 / (distance_to_target + 1)
            
            # Olasılık hesapla (ACO formülü)
            probability = (pheromone ** self.alpha) * (heuristic ** self.beta)
            
            # Yakıt ve zaman faktörlerini ekle
            fuel_factor = (1 - fuel_level) ** 2  # Düşük yakıtlı uyduları tercih et
            time_factor = 1.0 / (travel_time + 1)
            
            # Toplam skoru hesapla
            total_score = probability * (1 + fuel_factor + time_factor)
            
            priorities.append({
                'index': index,
                'score': total_score,
                'probability': probability,
                'fuel_level': fuel_level,
                'position': sat['position'],
                'distance': distance_to_target,
                'travel_time': travel_time,
                'fuel_needed': fuel_needed
            })
        
        return priorities

    def construct_solution(self):
        visited = set()
        path = [0]
        current_node = 0
        current_fuel = self.rocket.max_fuel
        total_distance = 0
        elapsed_time = 0
        total_fuel_consumed = 0
        
        # Başlangıç durumları...
        satellite_states = [{
            'fuel': sat.fuel,
            'position': sat.current_position,
            'orbit_radius': sat.orbit_radius,
            'orbit_speed': sat.orbit_speed,
            'current_angle': sat.current_angle,
            'inclination': sat.inclination
        } for sat in self.satellites]

        while len(visited) < self.num_nodes - 1:
            self.update_satellite_states(satellite_states, elapsed_time)
            self.moon.update_position(elapsed_time)
            
            current_pos = self.moon.get_position() if current_node == 0 else satellite_states[current_node - 1]['position']
            moon_pos = self.moon.get_position()

            # Ay'a dönüş için gereken yakıt hesabı
            return_distance = current_pos.distance_to(moon_pos)
            return_fuel_needed = self.rocket.calculate_fuel_consumption(return_distance)

            # Eğer Ay'a dönecek yakıt kalmadıysa, önce Ay'a git
            if current_fuel < return_fuel_needed and current_node != 0:
                path.append(0)
                total_distance += return_distance
                total_fuel_consumed += current_fuel  # Kalan yakıtı kullan
                elapsed_time += return_distance / self.rocket.speed
                current_fuel = self.rocket.max_fuel
                current_node = 0
                current_pos = moon_pos
                continue

            # Adayları değerlendir
            priorities = self.calculate_priorities(satellite_states, current_node, current_fuel, elapsed_time)
            candidates = [p for p in priorities if p['index'] + 1 not in visited]

            if not candidates:
                if current_node != 0:
                    path.append(0)
                    total_distance += return_distance
                    total_fuel_consumed += return_fuel_needed
                    elapsed_time += return_distance / self.rocket.speed
                break

            # Rulet tekerleği seçimi
            total_score = sum(c['score'] for c in candidates)
            if total_score == 0:
                probabilities = [1.0 / len(candidates)] * len(candidates)
            else:
                probabilities = [c['score'] / total_score for c in candidates]
            
            selected_index = random.choices(range(len(candidates)), probabilities)[0]
            selected = candidates[selected_index]
            
            # Seçilen uyduya gidiş maliyeti
            distance_to_selected = current_pos.distance_to(selected['position'])
            fuel_needed = self.rocket.calculate_fuel_consumption(distance_to_selected)

            # Yakıt kontrolü
            if fuel_needed > current_fuel:
                # Ay üzerinden gitmeyi dene
                moon_distance = current_pos.distance_to(moon_pos)
                moon_to_target = moon_pos.distance_to(selected['position'])
                via_moon_distance = moon_distance + moon_to_target
                via_moon_fuel = self.rocket.calculate_fuel_consumption(via_moon_distance)

                if via_moon_fuel <= self.rocket.max_fuel:
                    # Önce Ay'a git
                    path.append(0)
                    total_distance += moon_distance
                    total_fuel_consumed += current_fuel
                    elapsed_time += moon_distance / self.rocket.speed
                    
                    # Sonra hedef uyduya git
                    path.append(selected['index'] + 1)
                    total_distance += moon_to_target
                    current_fuel = self.rocket.max_fuel - via_moon_fuel
                    total_fuel_consumed += via_moon_fuel
                    elapsed_time += moon_to_target / self.rocket.speed
                    current_node = selected['index'] + 1
                    visited.add(current_node)
                else:
                    continue  # Bu uyduya gidemiyoruz, başka seç
            else:
                # Direkt gidiş mümkün
                path.append(selected['index'] + 1)
                total_distance += distance_to_selected
                current_fuel -= fuel_needed
                total_fuel_consumed += fuel_needed
                elapsed_time += distance_to_selected / self.rocket.speed
                current_node = selected['index'] + 1
                visited.add(current_node)

        # Son konum Ay değilse, Ay'a dön
        if path[-1] != 0:
            final_pos = satellite_states[path[-1] - 1]['position']
            final_distance = final_pos.distance_to(moon_pos)
            final_fuel_needed = self.rocket.calculate_fuel_consumption(final_distance)
            
            if final_fuel_needed > current_fuel:
                # Son kez Ay'a dönüş için yakıt doldurmaya git
                path.append(0)
                total_distance += final_distance
                total_fuel_consumed += current_fuel
                elapsed_time += final_distance / self.rocket.speed

        # Çözüm geçerliliği kontrolü
        if total_distance <= 0 or len(path) < 3:
            return None

        return {
            'path': path,
            'cost': total_distance,
            'fuel_states': [sat['fuel'] for sat in satellite_states],
            'time_elapsed': elapsed_time,
            'total_fuel_consumption': total_fuel_consumed
        }

    def update_satellite_states(self, satellite_states, elapsed_time):
        """
        Uyduların pozisyonlarını ve yakıt durumlarını günceller
        Args:
            satellite_states: Uydu durumlarını içeren liste
            elapsed_time: Geçen toplam süre (saniye)
        """
        for state in satellite_states:
            # Açısal hızı kullanarak yeni açıyı hesapla
            angular_velocity = state['orbit_speed']  # rad/s
            new_angle = state['current_angle'] + (angular_velocity * elapsed_time)
            state['current_angle'] = new_angle % (2 * math.pi)  # 0-2π arasında tut
            
            # Yeni pozisyonu hesapla
            x = state['orbit_radius'] * math.cos(state['current_angle'])
            y = state['orbit_radius'] * math.sin(state['current_angle']) * math.cos(state['inclination'])
            z = state['orbit_radius'] * math.sin(state['current_angle']) * math.sin(state['inclination'])
            state['position'] = Point3D(x, y, z)

            # Yakıt tüketimini hesapla
            hours_passed = elapsed_time / 3600
            fuel_consumed = hours_passed * self.fuelConsumptionPerHour
            state['fuel'] = max(0, state['fuel'] - fuel_consumed)

    def calculate_dynamic_distance(self, pos1, pos2):
        return pos1.distance_to(pos2)

    def update_pheromones(self, solutions):
        if not solutions:  # Çözüm yoksa güncelleme yapma
            return
        
        # Feromonları buharlaştır
        for i in range(self.num_nodes):
            for j in range(self.num_nodes):
                self.pheromones[i][j] *= (1 - self.evaporation_rate)
        
        # En iyi çözümlere daha fazla feromon ekle
        solutions.sort(key=lambda x: x['cost'])
        top_solutions = solutions[:max(1, len(solutions)//4)]  # En iyi %25
        
        for solution in top_solutions:
            # Sıfıra bölünmeyi önle
            if solution['cost'] == 0:
                continue
            
            # Çözümün kalitesine göre feromon miktarını belirle
            quality = 1.0 / max(solution['cost'], 1e-10)  # Çok küçük bir değerle böl
            
            # Yakıt tasarrufunu da hesaba kat
            total_fuel_saved = sum(100 - fuel for fuel in solution['fuel_states'])
            fuel_factor = 1 + (total_fuel_saved / 1000)
            
            # Zaman faktörünü de hesaba kat
            time_factor = 1 + (max(solution['time_elapsed'], 1) / 3600)  # Sıfır olamaz
            
            # Feromon miktarını sınırla
            pheromone_amount = min(
                self.Q * quality * fuel_factor / time_factor,
                10.0  # Maksimum feromon miktarı
            )
            
            # Yol üzerindeki her ardışık düğüm çifti için feromon ekle
            path = solution['path']
            for i in range(len(path) - 1):
                from_node = path[i]
                to_node = path[i + 1]
                self.pheromones[from_node][to_node] += pheromone_amount
                self.pheromones[to_node][from_node] += pheromone_amount  # Simetrik güncelleme

    def set_iteration_callback(self, callback):
        """İterasyon callback'ini ayarlar"""
        self.iteration_callback = callback

    def optimize(self):
        best_solution = None
        all_solutions = []
        stagnation_counter = 0
        
        print("\nKarınca Kolonisi Optimizasyonu Başlıyor...")
        print("=" * 50)
        
        for iteration in range(self.iterations):
            if self.iteration_callback:
                self.iteration_callback(iteration)
            
            print(f"\nİterasyon {iteration + 1}/{self.iterations}")
            print("-" * 30)
            
            iteration_solutions = []
            
            # Her karınca için çözüm oluştur
            for ant in range(self.num_ants):
                solution = self.construct_solution()
                if solution and solution['path'] and len(solution['path']) >= 3:
                    iteration_solutions.append(solution)
                    
                    print(f"\nKarınca {ant + 1}:")
                    print(f"Yol: {' -> '.join(map(str, solution['path']))}")
                    print(f"Mesafe: {solution['cost']/1000:.1f} km")
                    print(f"Geçen Süre: {solution['time_elapsed']/3600:.1f} saat")
                    print(f"Yakıt Tüketimi: {solution['total_fuel_consumption']:.1f} birim")
                    
                    # En iyi çözümü güncelle
                    if not best_solution or solution['cost'] < best_solution['cost']:
                        best_solution = solution.copy()
                        stagnation_counter = 0
                        print("*** Yeni en iyi çözüm! ***")
                    else:
                        stagnation_counter += 1
            
            # Feromon güncellemesi detayları
            print("\nFeromon Güncellemesi:")
            print("-" * 20)
            
            if not iteration_solutions:
                print("Bu iterasyonda geçerli çözüm bulunamadı.")
                continue
            
            # Feromon buharlaşması
            old_pheromones = [row[:] for row in self.pheromones]
            for i in range(self.num_nodes):
                for j in range(self.num_nodes):
                    self.pheromones[i][j] *= (1 - self.evaporation_rate)
            
            print(f"Buharlaşma oranı: {self.evaporation_rate}")
            
            # En iyi çözümleri seç (solutions yerine iteration_solutions kullan)
            iteration_solutions.sort(key=lambda x: x['cost'])
            top_solutions = iteration_solutions[:max(1, len(iteration_solutions)//4)]
            print(f"En iyi {len(top_solutions)} çözüm için feromon güncelleniyor")
            
            # Her çözüm için feromon güncelle
            for idx, solution in enumerate(top_solutions):
                if solution['cost'] == 0:
                    continue
                    
                # Kalite hesaplamasını düzelt
                normalized_cost = solution['cost'] / 1000  # km cinsinden
                quality = 1.0 / (normalized_cost + 1)  # +1 ekleyerek sıfıra bölünmeyi önle
                
                # Yakıt faktörünü normalize et
                total_fuel_saved = sum(100 - fuel for fuel in solution['fuel_states'])
                max_possible_fuel_save = 100 * len(solution['fuel_states'])  # Maksimum tasarruf
                fuel_factor = 1 + (total_fuel_saved / max_possible_fuel_save)  # 1-2 arası değer
                
                # Zaman faktörünü normalize et
                time_hours = solution['time_elapsed'] / 3600
                time_factor = 1 + (1 / (time_hours + 1))  # Daha kısa süre daha iyi
                
                # Feromon miktarını hesapla
                pheromone_amount = min(
                    self.Q * quality * fuel_factor * time_factor,
                    10.0  # Üst sınır
                )
                
                print(f"\nÇözüm {idx + 1} Detayları:")
                print(f"Maliyet: {normalized_cost:.2f} km")
                print(f"Kalite: {quality:.6f}")
                print(f"Yakıt Tasarrufu: {total_fuel_saved:.1f}/{max_possible_fuel_save}")
                print(f"Yakıt Faktörü: {fuel_factor:.2f}")
                print(f"Süre: {time_hours:.1f} saat")
                print(f"Zaman Faktörü: {time_factor:.2f}")
                print(f"Feromon Miktarı: {pheromone_amount:.2f}")
                
                # Yol üzerindeki kenarları güncelle
                path = solution['path']
                for i in range(len(path) - 1):
                    from_node = path[i]
                    to_node = path[i + 1]
                    old_value = self.pheromones[from_node][to_node]
                    new_value = old_value + pheromone_amount
                    self.pheromones[from_node][to_node] = new_value
                    self.pheromones[to_node][from_node] = new_value  # Simetrik güncelleme
                    print(f"Kenar {from_node}->{to_node}: {old_value:.2f} -> {new_value:.2f}")
            
            # Feromon sınırlaması
            for i in range(self.num_nodes):
                for j in range(self.num_nodes):
                    self.pheromones[i][j] = max(0.1, min(2.0, self.pheromones[i][j]))
            
            # Durağanlık kontrolü
            if stagnation_counter > 20:
                print("\n!!! Çözüm iyileşmiyor, feromon matrisi yenileniyor !!!")
                reset_count = 0
                for i in range(self.num_nodes):
                    for j in range(self.num_nodes):
                        if random.random() < 0.5:
                            self.pheromones[i][j] = 1.0
                            reset_count += 1
                print(f"Sıfırlanan feromon sayısı: {reset_count}")
                stagnation_counter = 0
            
            all_solutions.extend(iteration_solutions)
            
            print(f"\nİterasyon {iteration + 1} tamamlandı")
            print(f"En iyi çözüm maliyeti: {best_solution['cost']/1000:.1f} km")
            print(f"Durağanlık sayacı: {stagnation_counter}")
        
        # Final sonuçları
        if best_solution and best_solution['path'] and len(best_solution['path']) >= 3:
            print("\n=== Optimizasyon Tamamlandı ===")
            print(f"En iyi çözüm maliyeti: {best_solution['cost']/1000:.1f} km")
            print(f"En iyi yol: {' -> '.join(map(str, best_solution['path']))}")
            print(f"Toplam süre: {best_solution['time_elapsed']/3600:.1f} saat")
            print(f"Toplam yakıt: {best_solution['total_fuel_consumption']:.1f} birim")
            return {
                'solution': best_solution['path'],
                'cost': best_solution['cost'],
                'fuel_states': best_solution['fuel_states'],
                'time_elapsed': best_solution['time_elapsed']
            }
        else:
            print("\n!!! Geçerli bir çözüm bulunamadı !!!")
            return {
                'solution': None,
                'cost': float('inf'),
                'fuel_states': [],
                'time_elapsed': 0
            }