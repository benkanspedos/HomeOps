from PIL import Image, ImageDraw, ImageFilter
import random
import numpy as np
import os

def create_cyberpunk_city():
    """Create a cyberpunk-style city image using PIL"""
    
    print("Creating cyberpunk city artwork...")
    
    # Create output directory
    os.makedirs('ai-output', exist_ok=True)
    
    # Create canvas
    width, height = 512, 512
    img = Image.new('RGB', (width, height), (10, 10, 30))  # Dark blue background
    draw = ImageDraw.Draw(img)
    
    # Create gradient background (sunset effect)
    for y in range(height):
        # Purple to dark blue gradient
        purple = int(60 * (1 - y / height))
        blue = int(30 + 40 * (y / height))
        color = (purple + 20, 10, blue)
        draw.line([(0, y), (width, y)], fill=color)
    
    # Draw skyscrapers
    building_count = 15
    for i in range(building_count):
        # Random building dimensions
        bx = random.randint(0, width - 80)
        by = random.randint(height // 3, height - 50)
        bw = random.randint(30, 80)
        bh = height - by
        
        # Building base color (dark grey to black)
        base_color = (random.randint(10, 30), random.randint(10, 30), random.randint(10, 30))
        draw.rectangle([bx, by, bx + bw, by + bh], fill=base_color)
        
        # Add neon windows
        window_rows = bh // 20
        window_cols = bw // 15
        
        for row in range(window_rows):
            for col in range(window_cols):
                if random.random() > 0.3:  # 70% chance of window being lit
                    wx = bx + col * 15 + 5
                    wy = by + row * 20 + 5
                    
                    # Neon colors (cyan, magenta, yellow)
                    neon_colors = [
                        (0, 255, 255),    # Cyan
                        (255, 0, 255),    # Magenta
                        (255, 255, 0),    # Yellow
                        (0, 255, 100),    # Green
                        (255, 100, 0),    # Orange
                        (100, 100, 255),  # Light blue
                    ]
                    color = random.choice(neon_colors)
                    
                    # Draw glowing window
                    draw.rectangle([wx, wy, wx + 8, wy + 12], fill=color)
    
    # Add flying cars (small glowing dots moving across)
    car_count = 8
    for i in range(car_count):
        cx = random.randint(0, width)
        cy = random.randint(height // 4, height // 2)
        car_color = random.choice([(255, 0, 255), (0, 255, 255), (255, 255, 0)])
        
        # Car body
        draw.ellipse([cx - 3, cy - 2, cx + 3, cy + 2], fill=car_color)
        
        # Light trail
        trail_length = random.randint(15, 30)
        for j in range(trail_length):
            alpha = 1 - (j / trail_length)
            trail_color = tuple(int(c * alpha * 0.5) for c in car_color)
            draw.ellipse([cx - j - 1, cy - 1, cx - j + 1, cy + 1], fill=trail_color)
    
    # Add neon signs
    sign_count = 6
    for i in range(sign_count):
        sx = random.randint(50, width - 100)
        sy = random.randint(height // 3, height // 2)
        sign_color = random.choice([(255, 0, 255), (0, 255, 255), (255, 255, 0)])
        
        # Simple rectangular neon sign
        draw.rectangle([sx, sy, sx + 60, sy + 20], outline=sign_color, width=2)
        
        # Add inner glow effect
        for glow in range(3):
            glow_color = tuple(int(c * (0.8 - glow * 0.2)) for c in sign_color)
            draw.rectangle([sx - glow, sy - glow, sx + 60 + glow, sy + 20 + glow], 
                         outline=glow_color, width=1)
    
    # Add rain effect
    rain_lines = 200
    for i in range(rain_lines):
        rx = random.randint(0, width)
        ry = random.randint(0, height - 50)
        rain_color = (100, 150, 200, 128)  # Semi-transparent blue
        draw.line([(rx, ry), (rx - 2, ry + 15)], fill=rain_color[:3], width=1)
    
    # Add some atmospheric glow
    # Create a glow layer
    glow_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Add purple/pink atmospheric glow
    for i in range(10):
        gx = random.randint(0, width)
        gy = random.randint(0, height // 2)
        radius = random.randint(30, 80)
        
        # Create circular gradient
        for r in range(radius, 0, -5):
            alpha = int(30 * (radius - r) / radius)
            glow_color = (255, 100, 255, alpha)
            glow_draw.ellipse([gx - r, gy - r, gx + r, gy + r], fill=glow_color)
    
    # Blend glow layer
    img = Image.alpha_composite(img.convert('RGBA'), glow_layer).convert('RGB')
    
    # Apply slight blur for atmospheric effect
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    # Save the image
    output_path = 'ai-output/cyberpunk-city.png'
    img.save(output_path)
    print(f"Cyberpunk city artwork saved to: {output_path}")
    
    # Also create a variation with enhanced effects
    enhanced_img = img.copy()
    enhanced_img = enhanced_img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))
    enhanced_path = 'ai-output/cyberpunk-city-enhanced.png'
    enhanced_img.save(enhanced_path)
    print(f"Enhanced version saved to: {enhanced_path}")
    
    return output_path, enhanced_path

if __name__ == "__main__":
    try:
        paths = create_cyberpunk_city()
        print("✅ Success! Cyberpunk city artwork created.")
        print(f"Generated files:")
        for path in paths:
            print(f"  - {path}")
    except Exception as e:
        print(f"❌ Error creating artwork: {e}")
        import traceback
        traceback.print_exc()