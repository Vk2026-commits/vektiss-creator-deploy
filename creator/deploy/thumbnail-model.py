"""Fetch the pinned upstream U2-Net person model during image build, never at request time."""
import hashlib
import pathlib
import urllib.request

folder = pathlib.Path('/opt/creator-models')
folder.mkdir(parents=True, exist_ok=True)
target = folder / 'u2net_human_seg.onnx'
urllib.request.urlretrieve('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx', target)
if hashlib.md5(target.read_bytes()).hexdigest() != 'c09ddc2e0104f800e3e1bb4652583d1f':
    raise ValueError('Model checksum mismatch')
urllib.request.urlretrieve('https://raw.githubusercontent.com/xuebinqin/U-2-Net/master/LICENSE', folder / 'U2NET-LICENSE')
urllib.request.urlretrieve('https://raw.githubusercontent.com/danielgatis/rembg/main/LICENSE.txt', folder / 'REMBG-LICENSE')
