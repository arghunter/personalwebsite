"""
Manim color theme matching arghunter.github.io

Usage:
    from site_theme import *   # or: from site_theme import Theme, BG, ACCENT, ...

    class MyScene(Scene):
        def construct(self):
            self.camera.background_color = BG
            dot = Dot(color=ACCENT)
            ...
"""

from manim import ManimColor

# ── Core palette ──────────────────────────────────────────────────────────────
BG        = ManimColor("#100d20")   # --background-lt  (dark background)
BG_CARD   = ManimColor("#1c1830")   # --detail-lt      (card / surface)
BORDER    = ManimColor("#2d2847")   # --hr-color       (dividers, grid lines)
FG        = ManimColor("#dbd6f0")   # --primary-lt     (body text)
ACCENT    = ManimColor("#a78bfa")   # --accent         (violet — primary highlight)
SHADOW    = ManimColor("#4c1d95")   # --headline-shadow

# ── Semantic aliases ──────────────────────────────────────────────────────────
PRIMARY   = ACCENT
SECONDARY = ManimColor("#c084fc")   # layer-1 violet (data bus)
TERTIARY  = ManimColor("#38bdf8")   # layer-2 cyan   (lower bus)
SUCCESS   = ManimColor("#34d399")   # layer-3 teal   (control)
WARNING   = ManimColor("#fbbf24")   # via gold        (pins / warnings)
ERROR     = ManimColor("#f43f5e")   # DRC severity    (errors)
POWER     = ManimColor("#fb923c")   # layer-power orange (power rails)
CODE_GRN  = ManimColor("#4ade80")   # inline code green

# ── Convenience tuple (useful for cycling through colors) ─────────────────────
PALETTE = [ACCENT, SECONDARY, TERTIARY, SUCCESS, WARNING, POWER]


class Theme:
    """Drop-in config object. Apply to a Scene with Theme.apply(self)."""

    background    = BG
    foreground    = FG
    accent        = ACCENT
    card          = BG_CARD
    border        = BORDER
    shadow        = SHADOW

    # Named roles
    primary       = PRIMARY
    secondary     = SECONDARY
    tertiary      = TERTIARY
    success       = SUCCESS
    warning       = WARNING
    error         = ERROR
    power         = POWER
    code          = CODE_GRN

    palette       = PALETTE

    @staticmethod
    def apply(scene):
        """Call as the first line of construct() to set the background."""
        scene.camera.background_color = Theme.background
