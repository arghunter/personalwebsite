from manim import *
from site_theme import Theme, BG, BG_CARD, BORDER, ACCENT, TERTIARY, WARNING

GRID = 3  # 3x3 systolic array

CELL_COLOR  = BG_CARD
CELL_STROKE = BORDER
A_COLOR     = ACCENT    # input matrix A (flows right) — violet
B_COLOR     = TERTIARY  # input matrix B (flows down)  — cyan
ACC_COLOR   = WARNING   # accumulator highlight         — gold


class SystolicArray(Scene):
    def construct(self):
        Theme.apply(self)

        cell_size = 1.1
        gap = 0.15
        step = cell_size + gap

        # --- build grid of PE cells ---
        cells = VGroup()
        cell_rects = [[None] * GRID for _ in range(GRID)]
        for r in range(GRID):
            for c in range(GRID):
                rect = RoundedRectangle(
                    corner_radius=0.12,
                    width=cell_size, height=cell_size,
                    fill_color=CELL_COLOR, fill_opacity=1,
                    stroke_color=CELL_STROKE, stroke_width=2,
                )
                rect.move_to([c * step, -r * step, 0])
                label = Text("PE", font_size=18, color=CELL_STROKE).move_to(rect.get_center())
                cell_rects[r][c] = rect
                cells.add(rect, label)

        grid_group = VGroup(cells)
        grid_group.move_to(ORIGIN)

        # row/col labels
        row_labels = VGroup()
        col_labels = VGroup()
        for i in range(GRID):
            rl = Text(f"Row {i}", font_size=14, color=GRAY).next_to(
                cell_rects[i][0], LEFT, buff=0.3
            )
            cl = Text(f"Col {i}", font_size=14, color=GRAY).next_to(
                cell_rects[0][i], UP, buff=0.3
            )
            row_labels.add(rl)
            col_labels.add(cl)

        title = Text("Systolic Array — Data Flow", font_size=28, color=WHITE).to_edge(UP, buff=0.3)
        a_legend = VGroup(
            Square(side_length=0.2, fill_color=A_COLOR, fill_opacity=1, stroke_width=0).shift(LEFT * 0.15),
            Text(" Matrix A  (→)", font_size=16, color=A_COLOR),
        ).arrange(RIGHT, buff=0.05)
        b_legend = VGroup(
            Square(side_length=0.2, fill_color=B_COLOR, fill_opacity=1, stroke_width=0).shift(LEFT * 0.15),
            Text(" Matrix B  (↓)", font_size=16, color=B_COLOR),
        ).arrange(RIGHT, buff=0.05)
        legend = VGroup(a_legend, b_legend).arrange(RIGHT, buff=0.6).to_edge(DOWN, buff=0.35)

        self.add(title, cells, row_labels, col_labels, legend)
        self.wait(0.1)

        def make_dot(color, radius=0.18):
            return Dot(radius=radius, color=color, fill_opacity=0.95)

        NUM_WAVES = 3

        for wave in range(NUM_WAVES):
            anims = []

            for r in range(GRID):
                delay = r * 0.3
                start = cell_rects[r][0].get_left() + LEFT * step * 0.6
                end   = cell_rects[r][GRID - 1].get_right() + RIGHT * 0.2
                dot = make_dot(A_COLOR)
                dot.move_to(start)
                path = Line(start, end)
                anims.append(Succession(
                    Wait(delay),
                    MoveAlongPath(dot, path, run_time=GRID * 0.4),
                    FadeOut(dot, run_time=0.15),
                ))

            for c in range(GRID):
                delay = c * 0.3
                start = cell_rects[0][c].get_top() + UP * step * 0.6
                end   = cell_rects[GRID - 1][c].get_bottom() + DOWN * 0.2
                dot = make_dot(B_COLOR)
                dot.move_to(start)
                path = Line(start, end)
                anims.append(Succession(
                    Wait(delay),
                    MoveAlongPath(dot, path, run_time=GRID * 0.4),
                    FadeOut(dot, run_time=0.15),
                ))

            flash_anims = []
            for diag in range(GRID * 2 - 1):
                for r in range(GRID):
                    c = diag - r
                    if 0 <= c < GRID:
                        flash_anims.append(Succession(
                            Wait(diag * 0.3 + 0.2),
                            Flash(cell_rects[r][c], color=ACC_COLOR,
                                  flash_radius=0.35, line_length=0.15,
                                  run_time=0.25),
                        ))

            self.play(*anims, *flash_anims, run_time=GRID * 0.4 + (GRID - 1) * 0.3 + 0.6)
            self.wait(0.2)

        self.wait(0.5)
