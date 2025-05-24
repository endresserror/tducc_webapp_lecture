class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.width = 60
        self.height = 30
        self.health = 3
        self.speed = 5  # Player movement speed
        self.reload_time = 0  # Cooldown for shooting
        self.max_reload_time = 15  # Frames between shots

    def move(self, dx):
        self.x += dx * self.speed
        # Keep player within screen bounds
        if self.x < 0:
            self.x = 0
        elif self.x > 800 - self.width:  # Assuming screen width is 800
            self.x = 800 - self.width

    def shoot(self):
        if self.reload_time <= 0:
            self.reload_time = self.max_reload_time
            return Bullet(self.x + self.width // 2, self.y, -1)
        return None
    
    def update(self):
        if self.reload_time > 0:
            self.reload_time -= 1

class Enemy:
    def __init__(self, x, y, type=1):
        self.x = x
        self.y = y
        self.width = 50
        self.height = 40
        self.health = 1
        self.type = type  # Different types of enemies (1-3) like original game
        self.direction = 1  # 1 for right, -1 for left
        self.speed = 1
        self.points = 10 * type  # Different enemies are worth different points
        self.shoot_chance = 0.001 * type  # Chance to shoot each frame

    def move(self, dx):
        self.x += dx * self.speed * self.direction

    def move_down(self):
        self.y += self.height // 2
        self.direction *= -1  # Change direction when hitting edge

    def shoot(self):
        import random
        if random.random() < self.shoot_chance:
            return Bullet(self.x + self.width // 2, self.y + self.height, 1)
        return None

class Bullet:
    def __init__(self, x, y, direction=-1):
        self.x = x
        self.y = y
        self.width = 3
        self.height = 15
        self.speed = 10
        self.direction = direction  # -1 for player bullets (up), 1 for enemy bullets (down)

    def update(self):
        self.y += self.speed * self.direction

    def is_off_screen(self, height):
        return self.y < 0 or self.y > height

class Shield:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.width = 80
        self.height = 40
        self.health = 8
        self.segments = []
        self._create_segments()
    
    def _create_segments(self):
        segment_width = 10
        segment_height = 10
        for row in range(4):
            for col in range(8):
                # Skip corners to create the classic shield shape
                if (row == 0 and (col == 0 or col == 7)) or (row == 1 and (col == 0 or col == 7)):
                    continue
                self.segments.append({
                    'x': self.x + col * segment_width,
                    'y': self.y + row * segment_height,
                    'width': segment_width,
                    'height': segment_height,
                    'health': 2
                })
    
    def check_collision(self, bullet):
        for i, segment in enumerate(self.segments):
            if (bullet.x < segment['x'] + segment['width'] and
                bullet.x + bullet.width > segment['x'] and
                bullet.y < segment['y'] + segment['height'] and
                bullet.y + bullet.height > segment['y']):
                segment['health'] -= 1
                if segment['health'] <= 0:
                    self.segments.pop(i)
                return True
        return False

class UFO:
    def __init__(self, screen_width):
        self.width = 70
        self.height = 30
        self.x = -self.width
        self.y = 40
        self.speed = 2
        self.points = [50, 100, 150, 300]  # Random point values like original game
        self.active = False
        self.screen_width = screen_width
    
    def update(self):
        if self.active:
            self.x += self.speed
            if self.x > self.screen_width:
                self.active = False
        
    def spawn(self, chance=0.002):
        import random
        if not self.active and random.random() < chance:
            self.x = -self.width
            self.active = True
            
    def get_points(self):
        import random
        return random.choice(self.points)