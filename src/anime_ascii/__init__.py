"""Accurate image → ASCII conversion for character silhouettes and portraits.

Design notes (informed by common open-source approaches such as ascii-forge
and AdvancedAsciiArt, implemented independently here):

- Average pixels in linear light, then map with Rec.709 / L*-style luminance
- Correct for monospace cell aspect (characters are taller than wide)
- Stretch contrast so midtones do not collapse into one glyph
- Use density-ordered ramps (classic ``.:-=+*#%@`` matches common bust art)
"""

from .converter import AsciiOptions, convert_image, convert_path
from .ramps import RAMPS, get_ramp

__all__ = [
    "AsciiOptions",
    "RAMPS",
    "convert_image",
    "convert_path",
    "get_ramp",
]

__version__ = "0.2.0"
