import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
import os
import warnings

def generate_cyberpunk_city():
    """Generate cyberpunk city image using Stable Diffusion (CPU-only)"""
    
    print("Loading Stable Diffusion model (CPU mode)...")
    
    # Use SD 1.5 by default (lighter than SDXL)
    model_id = "runwayml/stable-diffusion-v1-5"
    
    # Create output directory
    os.makedirs('ai-output', exist_ok=True)
    
    try:
        # Force CPU mode to avoid CUDA compatibility issues
        print("Using CPU mode (will be slower but more compatible)")
        
        # Load pipeline with CPU-friendly settings
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,  # Use float32 for CPU
            safety_checker=None,
            requires_safety_checker=False,
            low_cpu_mem_usage=True
        )
        
        # Use DPM solver for faster generation
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        
        # Force CPU
        pipe = pipe.to("cpu")
        
        # Enable CPU optimizations
        pipe.enable_attention_slicing()
        pipe.enable_sequential_cpu_offload()
        
        # Cyberpunk city prompt
        prompt = "futuristic cyberpunk city at sunset, neon lights, skyscrapers, flying cars, detailed architecture, masterpiece"
        negative_prompt = "blurry, bad quality, low resolution, ugly"
        
        print(f"Generating image: {prompt}")
        print("This may take several minutes on CPU...")
        
        # Generate image with reduced settings for CPU
        image = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=512,
            height=512,
            num_inference_steps=20,  # Reduced steps for faster CPU generation
            guidance_scale=7.5,
        ).images[0]
        
        # Save image
        output_path = "ai-output/cyberpunk-city.png"
        image.save(output_path)
        print(f"Image saved to: {output_path}")
        
        return output_path
        
    except Exception as e:
        print(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # Suppress some warnings
    warnings.filterwarnings("ignore", category=UserWarning)
    
    result = generate_cyberpunk_city()
    if result:
        print("✅ Success! Cyberpunk city image generated.")
    else:
        print("❌ Failed to generate image.")