import os
import torch
# Force CPU-only mode by setting environment variables before importing anything else
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:0"

from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
import warnings

def generate_cyberpunk_city():
    """Generate cyberpunk city image using Stable Diffusion (Pure CPU mode)"""
    
    print("Loading Stable Diffusion model (Pure CPU mode)...")
    print("CUDA disabled via environment variables")
    
    # Use SD 1.5 by default (lighter than SDXL)
    model_id = "runwayml/stable-diffusion-v1-5"
    
    # Create output directory
    os.makedirs('ai-output', exist_ok=True)
    
    try:
        # Verify CUDA is disabled
        print(f"CUDA available: {torch.cuda.is_available()}")
        print(f"Device count: {torch.cuda.device_count()}")
        
        # Load pipeline with CPU-only settings
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,  # Use float32 for CPU
            safety_checker=None,
            requires_safety_checker=False,
            low_cpu_mem_usage=True,
            device_map=None  # Don't use device mapping
        )
        
        # Use DPM solver for faster generation
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        
        # Explicitly move to CPU
        pipe = pipe.to("cpu")
        
        # Enable CPU optimizations
        pipe.enable_attention_slicing()
        try:
            pipe.enable_sequential_cpu_offload()
        except:
            print("Sequential CPU offload not available, continuing...")
        
        # Cyberpunk city prompt
        prompt = "futuristic cyberpunk city at sunset, neon lights, skyscrapers, flying cars, detailed architecture, masterpiece"
        negative_prompt = "blurry, bad quality, low resolution, ugly"
        
        print(f"Generating image: {prompt}")
        print("This may take 5-15 minutes on CPU...")
        
        # Generate image with reduced settings for CPU
        with torch.no_grad():  # Reduce memory usage
            image = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=512,
                height=512,
                num_inference_steps=15,  # Reduced steps for faster CPU generation
                guidance_scale=7.5,
            ).images[0]
        
        # Save image
        output_path = "ai-output/cyberpunk-city.png"
        image.save(output_path)
        print(f"Image saved to: {output_path}")
        print("Success! Cyberpunk city image generated.")
        
        return output_path
        
    except Exception as e:
        print(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # Suppress warnings
    warnings.filterwarnings("ignore")
    
    result = generate_cyberpunk_city()
    if not result:
        print("Failed to generate image.")