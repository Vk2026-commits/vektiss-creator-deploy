"""Non-generative person mask; original RGB pixels are never repainted.
U2-Net human segmentation by Xuebin Qin et al. (Apache-2.0).
Normalization/output conventions follow rembg (Daniel Gatis, MIT).
This creates placement artwork only, never certifies a rendered video.
"""
import os
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 16_000_000
image = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert('RGBA')
if image.width < 32 or image.height < 32:
    raise ValueError('Image too small')
image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
rgb = image.convert('RGB')
arr = np.asarray(rgb.resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
arr /= max(float(arr.max()), 1)
arr = (arr - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
session = ort.InferenceSession(os.environ['CREATOR_PERSON_MODEL'], sess_options=options, providers=['CPUExecutionProvider'])
mask = session.run(None, {session.get_inputs()[0].name: arr.transpose(2, 0, 1)[None]})[0][0, 0]
span = float(mask.max() - mask.min())
if not np.isfinite(mask).all() or span < .01:
    raise ValueError('Uncertain person mask')
mask = (mask - mask.min()) / span
alpha = Image.fromarray((mask * 255).astype('uint8')).resize(image.size, Image.Resampling.LANCZOS)
alpha = np.minimum(np.asarray(alpha), np.asarray(image.getchannel('A')))
coverage = float(np.mean(alpha > 128))
if coverage < .05 or coverage > .95:
    raise ValueError('Uncertain person mask')
image.putalpha(Image.fromarray(alpha))
image.save(sys.argv[2], 'PNG')
