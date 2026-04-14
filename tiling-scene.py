from manim import *
from site_theme import Theme, BG, BG_CARD, BORDER, ACCENT, TERTIARY, WARNING, FG, SECONDARY, SUCCESS

MAT  = 4
TILE = 2

CELL = 0.38
GAP  = 0.05
STEP = CELL + GAP

A_COLOR  = ACCENT
B_COLOR  = TERTIARY
C_COLOR  = SUCCESS
SA_COLOR = WARNING


class Tiling(Scene):
    def construct(self):
        Theme.apply(self)

        # ── Build a matrix VGroup, return (group, cells[][]) ──────────────────
        def make_matrix(n, fill, lbl_text, lbl_color):
            grp   = VGroup()
            cells = [[None] * n for _ in range(n)]
            for r in range(n):
                for c in range(n):
                    sq = Square(
                        side_length=CELL,
                        fill_color=fill, fill_opacity=0.45,
                        stroke_color=BORDER, stroke_width=1.2,
                    )
                    sq.move_to([c * STEP, -r * STEP, 0])
                    grp.add(sq)
                    cells[r][c] = sq
            lbl = Text(lbl_text, font_size=18, color=lbl_color)
            lbl.next_to(grp, UP, buff=0.18)
            grp.add(lbl)
            return grp, cells

        a_grp, a_cells = make_matrix(MAT, A_COLOR, "A", A_COLOR)
        b_grp, b_cells = make_matrix(MAT, B_COLOR, "B", B_COLOR)
        c_grp, c_cells = make_matrix(MAT, BG_CARD,  "C", C_COLOR)

        # Row of matrices across the top
        MAT_Y = UP * 1.9
        a_grp.move_to(LEFT  * 3.8 + MAT_Y)
        b_grp.move_to(ORIGIN       + MAT_Y)
        c_grp.move_to(RIGHT * 3.8  + MAT_Y)

        times  = Text("×", font_size=28, color=FG).move_to(LEFT  * 2.05 + MAT_Y)
        equals = Text("=", font_size=28, color=FG).move_to(RIGHT * 2.05 + MAT_Y)

        # ── Systolic array, clearly below ─────────────────────────────────────
        SA_Y    = DOWN * 1.6
        sa_step = 0.62
        sa_rects = [[None] * TILE for _ in range(TILE)]
        sa_grp   = VGroup()
        for r in range(TILE):
            for c in range(TILE):
                sq = RoundedRectangle(
                    corner_radius=0.08,
                    width=0.55, height=0.55,
                    fill_color=BG_CARD, fill_opacity=1,
                    stroke_color=SA_COLOR, stroke_width=2.2,
                )
                sq.move_to([c * sa_step, -r * sa_step, 0])
                lbl = Text("PE", font_size=11, color=SA_COLOR).move_to(sq.get_center())
                sa_grp.add(sq, lbl)
                sa_rects[r][c] = sq
        sa_title = Text("2×2 Systolic Array", font_size=14, color=SA_COLOR)
        sa_title.next_to(sa_grp, DOWN, buff=0.18)
        sa_grp.add(sa_title)
        sa_grp.move_to(SA_Y)

        # ── Tile divider lines ─────────────────────────────────────────────────
        def tile_lines(cells, color):
            lines = VGroup()
            n = len(cells)
            for t in range(TILE, n, TILE):
                x  = (cells[0][t].get_left()[0] + cells[0][t-1].get_right()[0]) / 2
                yt = cells[0][0].get_top()[1]
                yb = cells[-1][0].get_bottom()[1]
                lines.add(Line([x, yt, 0], [x, yb, 0],
                               stroke_color=color, stroke_width=1.8, stroke_opacity=0.7))
                y  = (cells[t][0].get_top()[1] + cells[t-1][0].get_bottom()[1]) / 2
                xl = cells[0][0].get_left()[0]
                xr = cells[0][-1].get_right()[0]
                lines.add(Line([xl, y, 0], [xr, y, 0],
                               stroke_color=color, stroke_width=1.8, stroke_opacity=0.7))
            return lines

        # ── Tile outline rect ──────────────────────────────────────────────────
        def tile_rect(cells, tr, tc, color):
            tl = cells[tr*TILE][tc*TILE].get_corner(UL) + UP*0.04 + LEFT*0.04
            br = cells[tr*TILE+TILE-1][tc*TILE+TILE-1].get_corner(DR) + DOWN*0.04 + RIGHT*0.04
            return Rectangle(
                width=br[0]-tl[0], height=tl[1]-br[1],
                stroke_color=color, stroke_width=2.5, fill_opacity=0,
            ).move_to((tl + br) / 2)

        # ── Scene start ────────────────────────────────────────────────────────
        self.add(a_grp, b_grp, c_grp, times, equals, sa_grp)
        a_lines = tile_lines(a_cells, A_COLOR)
        b_lines = tile_lines(b_cells, B_COLOR)
        self.play(Create(a_lines), Create(b_lines), run_time=0.5)
        self.wait(0.2)

        # ── Process tiles ──────────────────────────────────────────────────────
        num_t = MAT // TILE
        active_outlines = []

        for ti in range(num_t):
            for tj in range(num_t):
                for k in range(num_t):

                    # Outline the active tiles
                    a_out = tile_rect(a_cells, ti, k,  A_COLOR)
                    b_out = tile_rect(b_cells, k,  tj, B_COLOR)
                    self.play(Create(a_out), Create(b_out), run_time=0.22)

                    # Arrows from tile centres down to SA
                    a_tile_center = a_out.get_center()
                    b_tile_center = b_out.get_center()
                    sa_center     = sa_grp.get_center()

                    arr_a = Arrow(
                        a_tile_center, sa_center + LEFT * 0.35,
                        buff=0.12, stroke_width=1.8, color=A_COLOR,
                        max_tip_length_to_length_ratio=0.15,
                    )
                    arr_b = Arrow(
                        b_tile_center, sa_center + RIGHT * 0.35,
                        buff=0.12, stroke_width=1.8, color=B_COLOR,
                        max_tip_length_to_length_ratio=0.15,
                    )
                    self.play(Create(arr_a), Create(arr_b), run_time=0.28)

                    # Flash SA
                    flashes = [
                        Flash(sa_rects[r][c], color=SA_COLOR,
                              flash_radius=0.25, line_length=0.09, run_time=0.3)
                        for r in range(TILE) for c in range(TILE)
                    ]
                    self.play(*flashes, run_time=0.3)

                    # Accumulate result into C tile
                    c_tile = VGroup(*[
                        c_cells[ti*TILE+r][tj*TILE+c]
                        for r in range(TILE) for c in range(TILE)
                    ])
                    opacity = 0.5 + (k + 1) * 0.22
                    self.play(
                        c_tile.animate.set_fill(C_COLOR, opacity=min(opacity, 0.95)),
                        FadeOut(arr_a), FadeOut(arr_b),
                        FadeOut(a_out), FadeOut(b_out),
                        run_time=0.25,
                    )

        # ── Final flash of completed C ─────────────────────────────────────────
        all_c = VGroup(*[c_cells[r][c] for r in range(MAT) for c in range(MAT)])
        self.play(all_c.animate.set_fill(C_COLOR, opacity=0.95), run_time=0.4)
        self.wait(0.7)
        self.play(all_c.animate.set_fill(BG_CARD, opacity=0.45), run_time=0.5)
        self.wait(0.2)
