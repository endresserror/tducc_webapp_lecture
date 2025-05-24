from .models import Player, Enemy, Bullet, Shield, UFO
import random

def start_game():
    # Initialize game state with classic Space Invaders setup
    game_state = {
        'player': Player(400, 550),  # Middle bottom of screen
        'enemies': [],
        'bullets': [],
        'enemy_bullets': [],
        'shields': [],
        'ufo': UFO(800),  # Assuming screen width is 800px
        'score': 0,
        'level': 1,
        'lives': 3,
        'game_over': False,
        'game_won': False,
        'direction': 1,  # Current enemy movement direction: 1=right, -1=left
        'speed_factor': 1.0,  # Enemy speed increases with level
        'move_down': False,  # Flag to move enemies down
        'enemy_move_timer': 0,
        'enemy_move_delay': 30  # Frames between enemy movements (decreases with level)
    }
    
    # Create classic formations of enemies (5 rows, 11 enemies per row)
    create_enemies(game_state)
    
    # Create shields like in the original game (4 shields)
    create_shields(game_state)
    
    return game_state

def create_enemies(game_state):
    game_state['enemies'] = []
    rows = 5
    cols = 11
    spacing_x = 50  # Horizontal spacing between enemies
    spacing_y = 40  # Vertical spacing between enemy rows
    start_x = 50
    start_y = 100
    
    for row in range(rows):
        enemy_type = 3 if row == 0 else (2 if row < 3 else 1)  # Different types like original
        for col in range(cols):
            x = start_x + col * spacing_x
            y = start_y + row * spacing_y
            game_state['enemies'].append(Enemy(x, y, enemy_type))

def create_shields(game_state):
    game_state['shields'] = []
    shield_count = 4
    shield_spacing = 160
    start_x = 100
    shield_y = 450  # Position shields above player
    
    for i in range(shield_count):
        game_state['shields'].append(Shield(start_x + i * shield_spacing, shield_y))

def update_game_state(game_state, player_action):
    if game_state['game_over'] or game_state['game_won']:
        return game_state
        
    # Update player based on action
    if player_action.get('move_left', False):
        game_state['player'].move(-1)  # Move left
    if player_action.get('move_right', False):
        game_state['player'].move(1)  # Move right
    if player_action.get('shoot', False):
        bullet = game_state['player'].shoot()
        if bullet:
            game_state['bullets'].append(bullet)
    
    game_state['player'].update()  # Update player reload timer
    
    # Update UFO
    game_state['ufo'].spawn()  # Chance to spawn UFO
    game_state['ufo'].update()
    
    # Periodic enemy movement (similar to original game's timing)
    game_state['enemy_move_timer'] += 1
    if game_state['enemy_move_timer'] >= game_state['enemy_move_delay']:
        game_state['enemy_move_timer'] = 0
        update_enemies(game_state)
    
    # Update bullets
    update_bullets(game_state)
    
    # Enemy shooting
    enemy_shooting(game_state)
    
    # Check for level completion
    if len(game_state['enemies']) == 0:
        game_state['level'] += 1
        game_state['speed_factor'] += 0.2  # Enemies get faster each level
        game_state['enemy_move_delay'] = max(5, int(30 - game_state['level'] * 2))  # Speed up enemies each level
        create_enemies(game_state)
    
    # Check game over condition
    for enemy in game_state['enemies']:
        if enemy.y + enemy.height >= game_state['player'].y:
            game_state['game_over'] = True
            break
    
    if game_state['lives'] <= 0:
        game_state['game_over'] = True
    
    return game_state

def update_enemies(game_state):
    enemies = game_state['enemies']
    move_down = False
    
    # Check if any enemy has reached screen edge
    for enemy in enemies:
        if (enemy.x + enemy.width >= 800 and game_state['direction'] == 1) or \
           (enemy.x <= 0 and game_state['direction'] == -1):
            move_down = True
            break
    
    # Move all enemies
    dx = 5 * game_state['speed_factor']
    
    if move_down:
        game_state['direction'] *= -1  # Reverse direction
        for enemy in enemies:
            enemy.move_down()
    else:
        for enemy in enemies:
            enemy.move(dx)

def enemy_shooting(game_state):
    # Random enemies may shoot
    for enemy in game_state['enemies']:
        bullet = enemy.shoot()
        if bullet:
            game_state['enemy_bullets'].append(bullet)

def update_bullets(game_state):
    # Update player bullets
    for bullet in game_state['bullets'][:]:
        bullet.update()
        
        # Check for enemy hits
        for enemy in game_state['enemies'][:]:
            if check_collision(bullet, enemy):
                game_state['bullets'].remove(bullet)
                game_state['enemies'].remove(enemy)
                game_state['score'] += enemy.points
                break
        
        # Check for UFO hit
        if game_state['ufo'].active and check_collision(bullet, game_state['ufo']):
            game_state['bullets'].remove(bullet)
            game_state['score'] += game_state['ufo'].get_points()
            game_state['ufo'].active = False
            break
            
        # Check for shield collision
        for shield in game_state['shields']:
            if shield.check_collision(bullet):
                if bullet in game_state['bullets']:
                    game_state['bullets'].remove(bullet)
                break
                
        # Remove bullets that go off screen
        if bullet.is_off_screen(600):  # Assuming screen height is 600
            if bullet in game_state['bullets']:
                game_state['bullets'].remove(bullet)
    
    # Update enemy bullets
    for bullet in game_state['enemy_bullets'][:]:
        bullet.update()
        
        # Check for player hit
        if check_collision(bullet, game_state['player']):
            game_state['enemy_bullets'].remove(bullet)
            game_state['lives'] -= 1
            break
            
        # Check for shield collision
        for shield in game_state['shields']:
            if shield.check_collision(bullet):
                if bullet in game_state['enemy_bullets']:
                    game_state['enemy_bullets'].remove(bullet)
                break
                
        # Remove bullets that go off screen
        if bullet.is_off_screen(600):
            if bullet in game_state['enemy_bullets']:
                game_state['enemy_bullets'].remove(bullet)

def check_collision(obj1, obj2):
    # Simple collision detection logic
    return (obj1.x < obj2.x + obj2.width and
            obj1.x + obj1.width > obj2.x and
            obj1.y < obj2.y + obj2.height and
            obj1.y + obj1.height > obj2.y)

def end_game(game_state):
    game_state['game_over'] = True
    return game_state