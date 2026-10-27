"""Pinned MODNet ONNX model, downloaded at image build, never during a request.

Official upstream ONNX download is linked at:
https://github.com/ZHKKKe/MODNet/blob/master/onnx/README.md
Code, models and demos are Apache-2.0 according to upstream README.
"""
import hashlib
from pathlib import Path
import urllib.request

folder = Path('/opt/creator-models')
folder.mkdir(parents=True, exist_ok=True)
target = folder / 'modnet.onnx'
urllib.request.urlretrieve('https://drive.google.com/uc?export=download&id=1cgycTQlYXpTh26gB9FTnthE7AvruV8hd', target)
if hashlib.sha256(target.read_bytes()).hexdigest() != '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9':
    raise ValueError('MODNet model checksum mismatch')
urllib.request.urlretrieve('https://raw.githubusercontent.com/ZHKKKe/MODNet/master/LICENSE', folder / 'MODNET-LICENSE')
