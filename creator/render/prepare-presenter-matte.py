"""Extract the real presenter into an alpha WebM, without generative processing.

Uses the pinned Apache-2.0 MODNet portrait model (ZHKKKe/MODNet).
Run with CREATOR_PYTHON and CREATOR_MATTE_MODEL from the production image.
The renderer supplies an owned local source and a private output path. Audio is
deliberately omitted: the final exporter muxes the unchanged original audio.
"""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter


def binary(name):
    folder = os.environ.get('CREATOR_MEDIA_BIN')
    return str(Path(folder) / name) if folder else name


def read_frame(stream, count):
    chunks = bytearray()
    while len(chunks) < count:
        chunk = stream.read(count - len(chunks))
        if not chunk:
            break
        chunks.extend(chunk)
    if chunks and len(chunks) != count:
        raise ValueError('PRESENTER_MATTE_TRUNCATED_FRAME')
    return chunks


def person_alpha(image, session, previous=None):
    # Preserve aspect ratio, using dimensions divisible by the model's stride.
    # Smaller 320/384 inputs can incorrectly remove hands / dark-shirt regions.
    scale = 512 / max(image.size)
    size = tuple(max(32, int(v * scale) // 32 * 32) for v in image.size)
    arr = np.asarray(image.resize(size, Image.Resampling.LANCZOS), dtype=np.float32)
    arr = (arr - 127.5) / 127.5
    mask = session.run(None, {session.get_inputs()[0].name: arr.transpose(2, 0, 1)[None]})[0][0, 0]
    span = float(mask.max() - mask.min())
    if not np.isfinite(mask).all() or span < .01:
        raise ValueError('PRESENTER_MATTE_UNCERTAIN')
    mask = np.clip(mask, 0, 1)
    # Damp small confidence fluctuations, but never trail a moving silhouette.
    if previous is not None:
        stable = np.abs(mask - previous) < .1
        mask = np.where(stable, .8 * mask + .2 * previous, mask)
    coverage = float(np.mean(mask > .5))
    if coverage < .02 or coverage > .98:
        raise ValueError('PRESENTER_MATTE_UNCERTAIN')
    alpha = Image.fromarray(np.clip(mask * 255, 0, 255).astype('uint8')).resize(image.size, Image.Resampling.LANCZOS)
    return alpha, mask


def paper_outline(image, alpha):
    """Bake a roughly six-pixel white outward edge once, not four browser filters.

    Opaque foreground RGB is preserved exactly; white is introduced only in
    newly expanded / partially transparent boundary pixels. Dilating at half
    size bounds work while keeping the outline rounded and temporally stable.
    """
    small = (max(1, image.width // 2), max(1, image.height // 2))
    expanded = alpha.resize(small, Image.Resampling.BILINEAR).filter(ImageFilter.MaxFilter(7)).resize(image.size, Image.Resampling.BILINEAR)
    original = np.asarray(alpha, dtype=np.float32) / 255
    outside = np.maximum(original, np.asarray(expanded, dtype=np.float32) / 255)
    rgb = np.asarray(image, dtype=np.float32)
    combined = (rgb * original[..., None] + 255 * (outside - original)[..., None]) / np.maximum(outside[..., None], 1 / 255)
    result = Image.fromarray(np.clip(combined, 0, 255).astype('uint8'))
    result.putalpha(Image.fromarray(np.clip(outside * 255, 0, 255).astype('uint8')))
    return result


def prepare(source, output, limit=None):
    if not source.is_file() or source.resolve() == output.resolve():
        raise ValueError('PRESENTER_MATTE_INVALID_SOURCE')
    model = Path(os.environ['CREATOR_MATTE_MODEL'])
    if not model.is_file():
        raise ValueError('PRESENTER_MATTE_MODEL_MISSING')
    info = json.loads(subprocess.check_output([binary('ffprobe'), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(source)], timeout=30))
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    duration = float(info['format']['duration'])
    if not math.isfinite(duration) or not 0 < duration <= 1800:
        raise ValueError('PRESENTER_MATTE_INVALID_DURATION')
    if limit is not None:
        duration = min(duration, limit)
    # Match the displayed orientation, including phone recordings with rotation.
    width, height = int(video['width']), int(video['height'])
    rotation = next((int(x.get('rotation', 0)) for x in video.get('side_data_list', []) if 'rotation' in x), 0)
    if abs(rotation) % 180 == 90:
        width, height = height, width
    scale = min(1, 1280 / max(width, height))
    width, height = max(2, int(width * scale) // 2 * 2), max(2, int(height * scale) // 2 * 2)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
    output.parent.mkdir(parents=True, exist_ok=True)
    # Atomic replacement ensures interrupted jobs cannot be mistaken for a cache hit.
    handle, temp = tempfile.mkstemp(prefix='presenter-', suffix='.webm', dir=output.parent)
    os.close(handle)
    decoder = encoder = None
    try:
        decoder = subprocess.Popen([binary('ffmpeg'), '-v', 'error', '-i', str(source), '-t', str(duration), '-vf', f'fps=30,scale={width}:{height}', '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], stdout=subprocess.PIPE)
        encoder = subprocess.Popen([binary('ffmpeg'), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{width}x{height}', '-r', '30', '-i', 'pipe:0', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-deadline', 'realtime', '-cpu-used', '8', '-threads', '2', '-crf', '24', '-b:v', '0', temp], stdin=subprocess.PIPE)
        previous = None
        frames = 0
        while True:
            raw = read_frame(decoder.stdout, width * height * 3)
            if not raw:
                break
            image = Image.frombytes('RGB', (width, height), bytes(raw))
            alpha, previous = person_alpha(image, session, previous)
            image = paper_outline(image, alpha)
            encoder.stdin.write(image.tobytes())
            frames += 1
            if frames % 150 == 0:
                print(json.dumps({'stage': 'presenter-matte', 'seconds': frames / 30, 'duration': duration}), flush=True)
        decoder.stdout.close()
        encoder.stdin.close()
        if decoder.wait(timeout=30) or encoder.wait(timeout=120) or frames < 1:
            raise ValueError('PRESENTER_MATTE_ENCODING_FAILED')
        if abs(frames / 30 - duration) > .1:
            raise ValueError('PRESENTER_MATTE_DURATION_MISMATCH')
        os.replace(temp, output)
        print(json.dumps({'output': str(output), 'frames': frames, 'width': width, 'height': height, 'duration': frames / 30}), flush=True)
    finally:
        for process in (decoder, encoder):
            if process is not None and process.poll() is None:
                process.kill()
                process.wait()
        Path(temp).unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--limit', type=float, help='Local proof only; production passes full source')
    args = parser.parse_args()
    if args.limit is not None and (not math.isfinite(args.limit) or args.limit <= 0):
        parser.error('--limit must be positive')
    prepare(args.source, args.output, args.limit)
