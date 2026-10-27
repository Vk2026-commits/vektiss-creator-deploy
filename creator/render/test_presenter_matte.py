"""Run with the same Python environment as prepare-presenter-matte.py."""
import importlib.util
import io
from pathlib import Path
import unittest
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('presenter_matte', Path(__file__).with_name('prepare-presenter-matte.py'))
matte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matte)


class Session:
    def __init__(self, mask):
        self.mask = mask

    def get_inputs(self):
        return [type('Input', (), {'name': 'input'})()]

    def run(self, _, inputs):
        assert inputs['input'].shape[0:2] == (1, 3)
        assert all(x % 32 == 0 for x in inputs['input'].shape[2:])
        return [self.mask[None, None]]


class MatteTest(unittest.TestCase):
    def test_alpha_tracks_person_region_in_original_frame(self):
        mask = np.zeros((320, 320), dtype=np.float32)
        mask[60:300, 100:220] = 1
        alpha, _ = matte.person_alpha(Image.new('RGB', (720, 1280), 'red'), Session(mask))
        self.assertEqual(alpha.size, (720, 1280))
        self.assertEqual(alpha.getpixel((360, 600)), 255)
        self.assertEqual(alpha.getpixel((5, 5)), 0)

    def test_rejects_uncertain_or_nonfinite_output(self):
        for mask in [np.ones((320, 320), dtype=np.float32), np.full((320, 320), np.nan, dtype=np.float32)]:
            with self.assertRaisesRegex(ValueError, 'UNCERTAIN'):
                matte.person_alpha(Image.new('RGB', (64, 64)), Session(mask))

    def test_short_frame_is_error_not_silent_truncation(self):
        with self.assertRaisesRegex(ValueError, 'TRUNCATED'):
            matte.read_frame(io.BytesIO(b'abc'), 4)
        self.assertEqual(matte.read_frame(io.BytesIO(), 4), b'')

    def test_outline_preserves_opaque_foreground(self):
        mask = Image.new('L', (64, 64), 0)
        mask.paste(255, (20, 20, 44, 44))
        result = matte.paper_outline(Image.new('RGB', (64, 64), (120, 60, 30)), mask)
        self.assertEqual(result.getpixel((32, 32)), (120, 60, 30, 255))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertGreater(result.getpixel((18, 32))[3], 0)
        self.assertEqual(result.getpixel((18, 32))[:3], (255, 255, 255))


if __name__ == '__main__':
    unittest.main()
