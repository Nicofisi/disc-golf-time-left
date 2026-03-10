"""
Optimize drone photos for web usage.
Resizes to 2400px wide and converts to WebP quality 85.

Reads from images_original/, outputs to images/.
"""

import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images_original")
OUTPUT_DIR = os.path.join(BASE_DIR, "images")

TARGET_WIDTH = 2400
WEBP_QUALITY = 85

FOLDERS = [
    "",
    "a alt",
    "b alt",
    "c alt",
]


def optimize_image(src_path, dest_path):
    """Resize and convert a single image to WebP."""
    img = Image.open(src_path)

    w, h = img.size
    ratio = TARGET_WIDTH / w
    target_height = int(h * ratio)

    img = img.resize((TARGET_WIDTH, target_height), Image.LANCZOS)
    img.save(dest_path, "WEBP", quality=WEBP_QUALITY, method=6)

    return os.path.getsize(src_path), os.path.getsize(dest_path)


def main():
    total_original = 0
    total_optimized = 0
    count = 0

    for subfolder in FOLDERS:
        src_folder = os.path.join(IMAGES_DIR, subfolder) if subfolder else IMAGES_DIR
        out_folder = os.path.join(OUTPUT_DIR, subfolder) if subfolder else OUTPUT_DIR

        if not os.path.exists(src_folder):
            continue

        os.makedirs(out_folder, exist_ok=True)

        for filename in os.listdir(src_folder):
            if not filename.upper().endswith(".JPG"):
                continue

            src = os.path.join(src_folder, filename)
            if not os.path.isfile(src):
                continue

            webp_name = os.path.splitext(filename)[0] + ".webp"
            dest = os.path.join(out_folder, webp_name)

            orig_size, new_size = optimize_image(src, dest)
            total_original += orig_size
            total_optimized += new_size
            count += 1

            print(f"  {filename} -> {webp_name}: {orig_size/1024/1024:.1f} MB -> {new_size/1024:.0f} KB")

    print(f"\n{'='*50}")
    print(f"Processed {count} images")
    print(f"Total: {total_original/1024/1024:.1f} MB -> {total_optimized/1024/1024:.1f} MB")
    print(f"Saved: {(total_original - total_optimized)/1024/1024:.1f} MB ({(1 - total_optimized/total_original)*100:.0f}%)")
    print(f"Output in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

