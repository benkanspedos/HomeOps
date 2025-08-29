import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
import os

def generate_cyberpunk_city():
    """Generate cyberpunk city image using Stable Diffusion"""
    
    print("Loading Stable Diffusion model...")
    
    # Use SD 1.5 by default (lighter than SDXL)
    model_id = "runwayml/stable-diffusion-v1-5"
    
    # Create output directory
    os.makedirs('ai-output', exist_ok=True)
    
    try:
        # Load pipeline
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            safety_checker=None,
            requires_safety_checker=False
        )
        
        # Use DPM solver for faster generation
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        
        # Move to GPU if available, otherwise CPU
        if torch.cuda.is_available():
            print("Using GPU acceleration")
            pipe = pipe.to("cuda")
        else:
            print("Using CPU (this will be slower)")
            pipe = pipe.to("cpu")
        
        # Skip xformers if not available
        try:
            pipe.enable_xformers_memory_efficient_attention()
            print("Using xformers memory efficient attention")
        except:
            print("Xformers not available, using standard attention")
            pass
        
        # Cyberpunk city prompt
        prompt = "futuristic city at sunset, cyberpunk style, neon lights, ultra detailed, 8k, masterpiece, high quality, skyscrapers with glowing windows, flying cars, rain reflections"
        negative_prompt = "blurry, bad quality, low resolution, ugly, deformed, extra limbs"
        
        print(f"Generating image: {prompt}")
        
        # Generate image
        image = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=512,
            height=512,
            num_inference_steps=30,
            guidance_scale=7.5,
        ).images[0]
        
        # Save image
        output_path = "ai-output/cyberpunk-city.png"
        image.save(output_path)
        print(f"Image saved to: {output_path}")
        
        return output_path
        
    except Exception as e:
        print(f"Error generating image: {e}")
        print("This might be due to missing dependencies or insufficient memory")
        return None

if __name__ == "__main__":
    generate_cyberpunk_city()