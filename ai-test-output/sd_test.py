import sys
import os
from PIL import Image
import numpy as np

# Create a test image (gradient) to simulate SD output
width, height = 512, 512
array = np.zeros((height, width, 3), dtype=np.uint8)
for i in range(height):
    for j in range(width):
        array[i, j] = [int(i * 255 / height), int(j * 255 / width), 128]

img = Image.fromarray(array, 'RGB')
img.save('C:\Projects\HomeOps\ai-test-output\test-image.png'.replace('\\', '/'))
print(f"Test image saved to: C:\Projects\HomeOps\ai-test-output\test-image.png")
