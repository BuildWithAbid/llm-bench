import json
import sys
from pathlib import Path

from PIL import Image


def resize_frame(image: Image.Image, max_width: int) -> Image.Image:
    if image.width <= max_width:
        return image

    ratio = max_width / image.width
    new_size = (max_width, int(image.height * ratio))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def quantize_frame(image: Image.Image) -> Image.Image:
    return image.convert("P", palette=Image.Palette.ADAPTIVE, colors=64)


def main() -> int:
    if len(sys.argv) != 2:
      raise SystemExit("Usage: build-demo-gif.py <manifest.json>")

    manifest_path = Path(sys.argv[1])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    output_path = Path(manifest["output"])
    max_width = manifest.get("max_width", 1100)
    frames = manifest["frames"]

    images = []
    durations = []

    for frame in frames:
        frame_path = Path(frame["path"])
        duration = int(frame["duration"])

        image = Image.open(frame_path).convert("RGBA")
        image = resize_frame(image, max_width)
        image = quantize_frame(image)

        images.append(image)
        durations.append(duration)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        output_path,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )

    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
