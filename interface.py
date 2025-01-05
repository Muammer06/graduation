from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QLabel, QSpinBox, QDoubleSpinBox, 
                            QPushButton, QTextEdit, QGroupBox, QFormLayout,
                            QProgressBar, QFileDialog)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
import sys
from main import Simulation
import json
from datetime import datetime
import time
from PyQt5.QtCore import QTimer

class SimulationThread(QThread):
    progress = pyqtSignal(int)
    finished = pyqtSignal(dict)
    log = pyqtSignal(str)

    def __init__(self, params):
        super().__init__()
        self.params = params
        self.is_running = True

    def run(self):
        try:
            sim = Simulation(
                num_satellites=self.params['simulation']['num_satellites'],
                rocket_fuel=self.params['simulation']['rocket_fuel']
            )
            sim.rocket.speed = self.params['simulation']['rocket_speed']
            sim.aco_options = self.params['aco']
            
            def progress_callback(percent, message):
                if not self.is_running:  # Durdurma kontrolü
                    raise InterruptedError("Simülasyon durduruldu")
                self.progress.emit(percent)
                self.log.emit(message)
            
            sim.set_callback(progress_callback)
            result = sim.calculate_path()
            
            if self.is_running:  # Sadece hala çalışıyorsa sonucu gönder
                self.finished.emit(result)
            
        except InterruptedError as e:
            self.log.emit(f"\n{str(e)}")
            self.finished.emit({  # Durdurma durumunda boş sonuç gönder
                'solution': None,
                'cost': float('inf'),
                'fuel_states': [],
                'time_elapsed': 0
            })
        except Exception as e:
            self.log.emit(f"Hata: {str(e)}")

    def stop(self):
        """Thread'i güvenli bir şekilde durdur"""
        self.is_running = False

class EditableSpinBox(QSpinBox):
    def __init__(self):
        super().__init__()
        self.setKeyboardTracking(True)
        self.setButtonSymbols(QSpinBox.NoButtons)  # Ok butonlarını kaldır
        self.setFocusPolicy(Qt.StrongFocus)

class EditableDoubleSpinBox(QDoubleSpinBox):
    def __init__(self):
        super().__init__()
        self.setKeyboardTracking(True)
        self.setButtonSymbols(QDoubleSpinBox.NoButtons)  # Ok butonlarını kaldır
        self.setFocusPolicy(Qt.StrongFocus)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Uydu Yakıt İkmal Simülasyonu")
        self.setMinimumWidth(1000)
        self.simulation_result = None
        
        # Ana widget ve layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QHBoxLayout(main_widget)

        # Sol panel (Parametreler)
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)

        # Simülasyon Parametreleri
        sim_group = QGroupBox("Simülasyon Parametreleri")
        sim_form = QFormLayout()
        
        self.num_satellites = EditableSpinBox()
        self.num_satellites.setRange(1, 1000)
        self.num_satellites.setValue(10)
        self.num_satellites.setStyleSheet("QSpinBox { padding: 5px; }")
        sim_form.addRow("Uydu Sayısı:", self.num_satellites)

        self.rocket_fuel = EditableDoubleSpinBox()
        self.rocket_fuel.setRange(1000, 1000000)
        self.rocket_fuel.setValue(200000)
        self.rocket_fuel.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        sim_form.addRow("Roket Yakıtı:", self.rocket_fuel)

        self.time_step = EditableDoubleSpinBox()
        self.time_step.setRange(100, 7200)
        self.time_step.setValue(3600)
        self.time_step.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        sim_form.addRow("Zaman Adımı (s):", self.time_step)

        self.rocket_speed = EditableDoubleSpinBox()
        self.rocket_speed.setRange(1000, 50000)  # 1-50 km/s arası
        self.rocket_speed.setValue(10000)  # Varsayılan 10 km/s
        self.rocket_speed.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        sim_form.addRow("Roket Hızı (m/s):", self.rocket_speed)

        sim_group.setLayout(sim_form)
        left_layout.addWidget(sim_group)

        # ACO Parametreleri
        aco_group = QGroupBox("ACO Parametreleri")
        aco_form = QFormLayout()

        self.num_ants = EditableSpinBox()
        self.num_ants.setRange(0, 200)
        self.num_ants.setValue(10)
        self.num_ants.setStyleSheet("QSpinBox { padding: 5px; }")
        aco_form.addRow("Karınca Sayısı:", self.num_ants)

        self.iterations = EditableSpinBox()
        self.iterations.setRange(0, 1000)
        self.iterations.setValue(100)
        self.iterations.setStyleSheet("QSpinBox { padding: 5px; }")
        aco_form.addRow("İterasyon Sayısı:", self.iterations)

        self.evaporation_rate = EditableDoubleSpinBox()
        self.evaporation_rate.setRange(0.01, 0.99)
        self.evaporation_rate.setValue(0.1)
        self.evaporation_rate.setSingleStep(0.01)
        self.evaporation_rate.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        aco_form.addRow("Buharlaşma Oranı:", self.evaporation_rate)

        self.alpha = EditableDoubleSpinBox()
        self.alpha.setRange(0.1, 10.0)
        self.alpha.setValue(1.0)
        self.alpha.setSingleStep(0.1)
        self.alpha.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        aco_form.addRow("Alpha:", self.alpha)

        self.beta = EditableDoubleSpinBox()
        self.beta.setRange(0.1, 10.0)
        self.beta.setValue(2.0)
        self.beta.setSingleStep(0.1)
        self.beta.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        aco_form.addRow("Beta:", self.beta)

        self.Q = EditableDoubleSpinBox()
        self.Q.setRange(1, 1000)
        self.Q.setValue(100)
        self.Q.setStyleSheet("QDoubleSpinBox { padding: 5px; }")
        aco_form.addRow("Q:", self.Q)

        aco_group.setLayout(aco_form)
        left_layout.addWidget(aco_group)

        # İlerleme çubuğu
        self.progress_bar = QProgressBar()
        left_layout.addWidget(self.progress_bar)

        # Simülasyon süresi için etiket ekle
        self.simulation_time_label = QLabel("Simülasyon Süresi: 0:00:00")
        self.simulation_time_label.setStyleSheet("""
            QLabel {
                color: #00ff00;
                font-size: 14px;
                padding: 5px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 3px;
            }
        """)
        left_layout.addWidget(self.simulation_time_label)
        
        # Simülasyon başlangıç zamanını sakla
        self.simulation_start_time = None
        
        # Timer ekle
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_simulation_time)
        self.timer.setInterval(1000)  # Her saniye güncelle

        # Kontrol butonları
        control_group = QGroupBox("Kontroller")
        control_layout = QHBoxLayout()
        
        self.start_button = QPushButton("Simülasyonu Başlat")
        self.start_button.clicked.connect(self.start_simulation)
        control_layout.addWidget(self.start_button)
        
        # Durdurma butonu ekle
        self.stop_button = QPushButton("Simülasyonu Durdur")
        self.stop_button.clicked.connect(self.stop_simulation)
        self.stop_button.setEnabled(False)  # Başlangıçta devre dışı
        self.stop_button.setStyleSheet("""
            QPushButton {
                background-color: #8B0000;
                color: white;
            }
            QPushButton:hover {
                background-color: #FF0000;
            }
            QPushButton:disabled {
                background-color: #4A4A4A;
            }
        """)
        control_layout.addWidget(self.stop_button)
        
        self.save_params_button = QPushButton("Parametreleri Kaydet")
        self.save_params_button.clicked.connect(self.save_parameters)
        control_layout.addWidget(self.save_params_button)

        self.load_params_button = QPushButton("Parametreleri Yükle")
        self.load_params_button.clicked.connect(self.load_parameters)
        control_layout.addWidget(self.load_params_button)
        
        self.show_path_button = QPushButton("Yolu Göster")
        self.show_path_button.clicked.connect(self.show_path)
        self.show_path_button.setEnabled(False)
        control_layout.addWidget(self.show_path_button)

        self.save_path_button = QPushButton("Yolu Kaydet")
        self.save_path_button.clicked.connect(self.save_path)
        self.save_path_button.setEnabled(False)
        control_layout.addWidget(self.save_path_button)

        self.load_path_button = QPushButton("Yol Yükle")
        self.load_path_button.clicked.connect(self.load_path)
        control_layout.addWidget(self.load_path_button)
        
        self.show_3d_button = QPushButton("3D Görünüm")
        self.show_3d_button.clicked.connect(self.show_3d)
        self.show_3d_button.setEnabled(False)
        control_layout.addWidget(self.show_3d_button)
        
        control_group.setLayout(control_layout)
        left_layout.addWidget(control_group)

        # Sağ panel (Log)
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        right_layout.addWidget(self.log_text)
        
        layout.addWidget(left_panel)
        layout.addWidget(right_panel)

    def get_parameters(self):
        """Tüm parametreleri bir sözlük olarak döndürür"""
        return {
            'simulation': {
                'num_satellites': self.num_satellites.value(),
                'rocket_fuel': self.rocket_fuel.value(),
                'time_step': self.time_step.value(),
                'rocket_speed': self.rocket_speed.value()  # Yeni parametre
            },
            'aco': {
                'num_ants': self.num_ants.value(),
                'iterations': self.iterations.value(),
                'evaporation_rate': self.evaporation_rate.value(),
                'alpha': self.alpha.value(),
                'beta': self.beta.value(),
                'Q': self.Q.value()
            }
        }

    def save_parameters(self):
        """Parametreleri JSON dosyasına kaydeder"""
        params = self.get_parameters()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"parameters_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(params, f, indent=4)
        
        self.log_text.append(f"Parametreler {filename} dosyasına kaydedildi.")

    def start_simulation(self):
        """Simülasyonu başlatır"""
        self.progress_bar.setValue(0)
        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)  # Durdurma butonunu aktif et
        self.show_path_button.setEnabled(False)
        self.show_3d_button.setEnabled(False)
        
        # Simülasyon başlangıç zamanını kaydet ve timer'ı başlat
        self.simulation_start_time = datetime.now()
        self.timer.start()
        
        params = self.get_parameters()
        
        # Simülasyonu ayrı thread'de başlat
        self.sim_thread = SimulationThread(params)
        self.sim_thread.progress.connect(self.update_progress)
        self.sim_thread.finished.connect(self.simulation_finished)
        self.sim_thread.log.connect(self.log_text.append)
        self.sim_thread.start()

    def stop_simulation(self):
        """Simülasyonu durdurur"""
        if hasattr(self, 'sim_thread') and self.sim_thread.isRunning():
            self.sim_thread.stop()  # Önce güvenli durdurmayı dene
            
            # Thread'in durmasını bekle
            if not self.sim_thread.wait(3000):  # 3 saniye bekle
                self.sim_thread.terminate()  # Hala durmadıysa zorla sonlandır
            
            # Timer'ı durdur
            self.timer.stop()
            
            # Butonları güncelle
            self.start_button.setEnabled(True)
            self.stop_button.setEnabled(False)
            
            # Log'a bilgi ekle
            self.log_text.append("\nSimülasyon kullanıcı tarafından durduruldu!")
            
            # Son süreyi göster
            if self.simulation_start_time:
                elapsed = datetime.now() - self.simulation_start_time
                self.log_text.append(f"Geçen süre: {str(elapsed).split('.')[0]}")

    def update_progress(self, value):
        """İlerleme çubuğunu günceller"""
        self.progress_bar.setValue(value)

    def simulation_finished(self, result):
        """Simülasyon tamamlandığında çağrılır"""
        self.simulation_result = result
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)  # Durdurma butonunu devre dışı bırak
        self.show_path_button.setEnabled(True)
        self.show_3d_button.setEnabled(True)
        
        # Timer'ı durdur
        self.timer.stop()
        
        self.log_text.append("Simülasyon tamamlandı!")
        
        if result:
            self.log_text.append(f"Bulunan yol: {result['solution']}")
            self.log_text.append(f"Toplam mesafe: {result['cost']/1000:.2f} km")
            
            # Son süreyi göster
            if self.simulation_start_time:
                elapsed = datetime.now() - self.simulation_start_time
                self.log_text.append(f"Toplam simülasyon süresi: {str(elapsed).split('.')[0]}")
        else:
            self.log_text.append("Geçerli bir çözüm bulunamadı!")

    def show_path(self):
        """Bulunan yolu gösterir"""
        if self.simulation_result and self.simulation_result['solution']:
            path_str = "Yol: " + " -> ".join(map(str, self.simulation_result['solution']))
            self.log_text.append("\n" + path_str)
            
            # Yolu dosyaya kaydet
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"path_{timestamp}.txt"
            with open(filename, 'w') as f:
                f.write(path_str + "\n")
                f.write(f"Toplam mesafe: {self.simulation_result['cost']/1000:.2f} km\n")
            
            self.log_text.append(f"Yol {filename} dosyasına kaydedildi.")

    def show_3d(self):
        """3D görünümü web tarayıcısında gösterir"""
        if self.simulation_result:
            try:
                import webbrowser
                import os
                import http.server
                import socketserver
                import threading
                
                # Proje kök dizinini bul
                root_dir = os.path.dirname(os.path.abspath(__file__))
                
                # Web sunucusu için port
                PORT = 8000
                
                # Mevcut dizini değiştir
                os.chdir(root_dir)
                
                # UTF-8 destekli HTTP handler
                class UTF8Handler(http.server.SimpleHTTPRequestHandler):
                    def end_headers(self):
                        self.send_header('Content-Type', 'text/html; charset=utf-8')
                        super().end_headers()
                    
                    def log_message(self, format, *args):
                        # Sunucu loglarını devre dışı bırak
                        pass
                
                # Basit HTTP sunucusu
                def run_server():
                    try:
                        with socketserver.TCPServer(("", PORT), UTF8Handler) as httpd:
                            self.log_text.append(f"Sunucu http://localhost:{PORT} adresinde başlatıldı")
                            httpd.serve_forever()
                    except OSError as e:
                        if e.errno == 98:  # Port zaten kullanımda
                            self.log_text.append("Sunucu zaten çalışıyor, yeni pencere açılıyor...")
                        else:
                            raise e
                
                # Sunucuyu arka planda başlat
                server_thread = threading.Thread(target=run_server)
                server_thread.daemon = True
                server_thread.start()
                
                # Simülasyon verilerini hazırla ve kaydet
                # ... (önceki simülasyon veri hazırlama kodu aynı)
                
                # Kısa bir bekleme ekle
                time.sleep(0.5)  # Sunucunun başlaması için bekle
                
                # Tarayıcıda aç
                webbrowser.open(f'http://localhost:{PORT}/templates/index.html')
                
                self.log_text.append("3D görünüm web tarayıcısında açıldı.")
                
            except Exception as e:
                self.log_text.append(f"3D görünüm hatası: {str(e)}")

    def save_path(self):
        """Yolu TXT dosyasına kaydeder"""
        if self.simulation_result and self.simulation_result['solution']:
            try:
                filename, _ = QFileDialog.getSaveFileName(
                    self,
                    "Yolu Kaydet",
                    "",
                    "Text Dosyaları (*.txt);;Tüm Dosyalar (*)"
                )
                
                if filename:
                    if not filename.endswith('.txt'):
                        filename += '.txt'
                        
                    with open(filename, 'w') as f:
                        # Başlık
                        f.write("=== Uydu Yakıt İkmal Görevi Sonuçları ===\n\n")
                        
                        # Yol
                        path_str = " -> ".join(map(str, self.simulation_result['solution']))
                        f.write(f"Rota: {path_str}\n")
                        
                        # Mesafe
                        f.write(f"Toplam Mesafe: {self.simulation_result['cost']/1000:.2f} km\n")
                        
                        # Parametreler
                        f.write("\nKullanılan Parametreler:\n")
                        f.write("-" * 30 + "\n")
                        f.write(f"Uydu Sayısı: {self.num_satellites.value()}\n")
                        f.write(f"Roket Yakıtı: {self.rocket_fuel.value()}\n")
                        f.write(f"Zaman Adımı: {self.time_step.value()} s\n")
                        f.write(f"Karınca Sayısı: {self.num_ants.value()}\n")
                        f.write(f"İterasyon Sayısı: {self.iterations.value()}\n")
                        f.write(f"Buharlaşma Oranı: {self.evaporation_rate.value()}\n")
                        f.write(f"Alpha: {self.alpha.value()}\n")
                        f.write(f"Beta: {self.beta.value()}\n")
                        f.write(f"Q: {self.Q.value()}\n")
                        
                        # Tarih
                        f.write(f"\nTarih: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    
                    self.log_text.append(f"Yol {filename} dosyasına kaydedildi.")
            
            except Exception as e:
                self.log_text.append(f"Yol kaydetme hatası: {str(e)}")

    def load_path(self):
        """Kaydedilmiş yolu yükler"""
        try:
            filename, _ = QFileDialog.getOpenFileName(
                self,
                "Yol Yükle",
                "",
                "Text Dosyaları (*.txt);;Tüm Dosyalar (*)"
            )
            
            if filename:
                with open(filename, 'r') as f:
                    lines = f.readlines()
                    
                    # Yolu bul
                    for line in lines:
                        if line.startswith("Rota:"):
                            path_str = line.replace("Rota:", "").strip()
                            path = [int(x) for x in path_str.split("->")]
                            self.simulation_result = {
                                'solution': path,
                                'cost': 0  # Mesafe bilgisi txt'den okunabilir
                            }
                            break
                    
                    # Mesafeyi bul
                    for line in lines:
                        if line.startswith("Toplam Mesafe:"):
                            distance_str = line.replace("Toplam Mesafe:", "").replace("km", "").strip()
                            self.simulation_result['cost'] = float(distance_str) * 1000
                            break
                    
                    # Butonları aktifleştir
                    self.show_path_button.setEnabled(True)
                    self.save_path_button.setEnabled(True)
                    self.show_3d_button.setEnabled(True)
                    
                    self.log_text.append(f"Yol {filename} dosyasından yüklendi.")
                    self.log_text.append(f"Bulunan yol: {self.simulation_result['solution']}")
                    self.log_text.append(f"Toplam mesafe: {self.simulation_result['cost']/1000:.2f} km")
            
        except Exception as e:
            self.log_text.append(f"Yol yükleme hatası: {str(e)}")

    def load_parameters(self):
        """Kaydedilmiş parametreleri yükler"""
        try:
            filename, _ = QFileDialog.getOpenFileName(
                self,
                "Parametreleri Yükle",
                "",
                "JSON Dosyaları (*.json);;Tüm Dosyalar (*)"
            )
            
            if filename:
                with open(filename, 'r') as f:
                    params = json.load(f)
                
                # Simülasyon parametrelerini güncelle
                sim_params = params['simulation']
                self.num_satellites.setValue(sim_params['num_satellites'])
                self.rocket_fuel.setValue(sim_params['rocket_fuel'])
                self.time_step.setValue(sim_params['time_step'])
                
                # ACO parametrelerini güncelle
                aco_params = params['aco']
                self.num_ants.setValue(aco_params['num_ants'])
                self.iterations.setValue(aco_params['iterations'])
                self.evaporation_rate.setValue(aco_params['evaporation_rate'])
                self.alpha.setValue(aco_params['alpha'])
                self.beta.setValue(aco_params['beta'])
                self.Q.setValue(aco_params['Q'])
                
                self.log_text.append(f"Parametreler {filename} dosyasından yüklendi.")
        
        except Exception as e:
            self.log_text.append(f"Parametre yükleme hatası: {str(e)}")

    def update_simulation_time(self):
        """Simülasyon süresini günceller"""
        if self.simulation_start_time:
            elapsed = datetime.now() - self.simulation_start_time
            # Mikrosaniyeleri gösterme
            elapsed_str = str(elapsed).split('.')[0]
            self.simulation_time_label.setText(f"Simülasyon Süresi: {elapsed_str}")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main() 