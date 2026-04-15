from manim import *
from site_theme import (
    Theme, BG, BG_CARD, BORDER,
    ACCENT, TERTIARY, WARNING, FG, SUCCESS, POWER,
)

# ── Color aliases ──────────────────────────────────────────────────────────
HOST_COL = TERTIARY   # cyan
WT_COL   = ACCENT     # violet
ACT_COL  = SUCCESS    # teal
BIAS_COL = WARNING    # gold
OUT_COL  = POWER      # orange
FUNC_COL = ACCENT     # violet

MINI_N     = 3   # PE grid size inside the systolic-array block
NUM_LAYERS = 3


# ── Helpers ────────────────────────────────────────────────────────────────

def make_block(label: str, sub: str, w: float, h: float, col):
    """RoundedRectangle block with bold label + small sublabel."""
    rect = RoundedRectangle(
        corner_radius=0.12, width=w, height=h,
        fill_color=BG_CARD, fill_opacity=1,
        stroke_color=col, stroke_width=2.2,
    )
    title_y = rect.get_center() + UP * (h * 0.14) if sub else rect.get_center()
    title = Text(label, font_size=15, color=col, weight=BOLD).move_to(title_y)
    grp = VGroup(rect, title)
    if sub:
        sub_t = Text(sub, font_size=10, color=GRAY)
        sub_t.move_to(rect.get_center() + DOWN * h * 0.22)
        grp.add(sub_t)
    return grp, rect


def dot_stream(start, end, color, n=4, run_time=1.2):
    """Stream of n dots flowing start→end, staggered."""
    dots = [Dot(radius=0.10, color=color, fill_opacity=0.92).move_to(start)
            for _ in range(n)]
    return AnimationGroup(
        LaggedStart(
            *[Succession(
                MoveAlongPath(d, Line(start, end), run_time=run_time * 0.72),
                FadeOut(d, run_time=0.12),
            ) for d in dots],
            lag_ratio=1.0 / (n + 0.5),
        ),
        run_time=run_time,
    )


def curve_stream(p0, p1, p2, p3, color, n=4, run_time=1.4):
    """Stream of n dots flowing along a cubic bezier."""
    dots = [Dot(radius=0.10, color=color, fill_opacity=0.92).move_to(p0)
            for _ in range(n)]
    return AnimationGroup(
        LaggedStart(
            *[Succession(
                MoveAlongPath(d, CubicBezier(p0, p1, p2, p3), run_time=run_time * 0.72),
                FadeOut(d, run_time=0.12),
            ) for d in dots],
            lag_ratio=1.0 / (n + 0.5),
        ),
        run_time=run_time,
    )


# ── Main scene ─────────────────────────────────────────────────────────────

class KernnSystem(Scene):
    def construct(self):
        Theme.apply(self)

        BW, BH = 1.75, 0.72   # standard block width / height
        SW     = 2.4           # systolic-array block size

        # ── Blocks ────────────────────────────────────────────────────────
        host_g, host_r  = make_block("Host",           "UART / DMA",        1.4,  1.4, HOST_COL)
        wt_g,   wt_r    = make_block("Weight Mem",     "16 K × 8-bit",      BW,   BH,  WT_COL)
        act_g,  act_r   = make_block("Act Mem",        "double-buffered",    BW,   BH,  ACT_COL)
        bias_g, bias_r  = make_block("Bias Mem",       "256 × 32-bit",      BW,   BH,  BIAS_COL)
        sys_g,  sys_r   = make_block("Systolic Array", f"{MINI_N}×{MINI_N} PE grid", SW, SW, FG)
        out_g,  out_r   = make_block("Output Mem",     "4 K × 32-bit",      BW,   BH,  OUT_COL)
        func_g, func_r  = make_block("Act Func Bank",  "ReLU / shift",      BW,   BH,  FUNC_COL)

        host_g.move_to(LEFT  * 5.5)
        wt_g.move_to(LEFT    * 2.9 + UP   * 1.45)
        act_g.move_to(LEFT   * 2.9)
        bias_g.move_to(LEFT  * 2.9 + DOWN * 1.45)
        sys_g.move_to(ORIGIN)
        out_g.move_to(RIGHT  * 3.1 + UP   * 0.70)
        func_g.move_to(RIGHT * 3.1 + DOWN * 0.70)

        # ── Mini PE grid (positioned over sys_g) ──────────────────────────
        pe_rects = [[None] * MINI_N for _ in range(MINI_N)]
        pe_grp   = VGroup()
        for r in range(MINI_N):
            for c in range(MINI_N):
                sq = RoundedRectangle(
                    corner_radius=0.06, width=0.44, height=0.44,
                    fill_color=BG, fill_opacity=1,
                    stroke_color=BORDER, stroke_width=1.4,
                )
                sq.move_to(ORIGIN + RIGHT * (c - 1) * 0.60 + UP * (1 - r) * 0.60)
                pe_rects[r][c] = sq
                pe_grp.add(sq)

        # ── Static connection arrows ───────────────────────────────────────
        def sarr(a, b, col):
            return Arrow(a, b, buff=0.07, stroke_width=1.5, color=col,
                         stroke_opacity=0.30, max_tip_length_to_length_ratio=0.12)

        conn_arrows = VGroup(
            sarr(host_r.get_right(),  wt_r.get_left(),   WT_COL),
            sarr(host_r.get_right(),  act_r.get_left(),  ACT_COL),
            sarr(host_r.get_right(),  bias_r.get_left(), BIAS_COL),
            sarr(wt_r.get_right(),    sys_r.get_left(),  WT_COL),
            sarr(act_r.get_right(),   sys_r.get_left(),  ACT_COL),
            sarr(bias_r.get_right(),  sys_r.get_left(),  BIAS_COL),
            sarr(sys_r.get_right(),   out_r.get_left(),  OUT_COL),
            sarr(out_r.get_bottom(),  func_r.get_top(),  FUNC_COL),
        )

        # Feedback arc: Act Func Bank → Act Mem (curves below the scene)
        fb_p0 = func_r.get_bottom()
        fb_p3 = act_r.get_bottom()
        fb_p1 = fb_p0 + DOWN * 1.5
        fb_p2 = fb_p3 + DOWN * 1.5
        feedback_curve = CubicBezier(
            fb_p0, fb_p1, fb_p2, fb_p3,
            stroke_color=ACT_COL, stroke_width=1.5, stroke_opacity=0.30,
        )
        fb_tip = Arrow(
            fb_p3 + DOWN * 0.18, fb_p3,
            buff=0, stroke_width=1.5, color=ACT_COL, stroke_opacity=0.30,
            max_tip_length_to_length_ratio=0.50,
        )

        # ── Status / layer labels ──────────────────────────────────────────
        status = Text("KERNN — Neural Network Accelerator", font_size=20, color=FG).to_edge(UP, buff=0.28)
        layer_lbl = Text("", font_size=14, color=GRAY).to_edge(DOWN, buff=0.22).to_edge(RIGHT, buff=0.4)

        # ── Build scene ────────────────────────────────────────────────────
        self.play(
            LaggedStart(
                FadeIn(host_g, shift=RIGHT * 0.08),
                FadeIn(wt_g,   shift=RIGHT * 0.08),
                FadeIn(act_g,  shift=RIGHT * 0.08),
                FadeIn(bias_g, shift=RIGHT * 0.08),
                FadeIn(sys_g,  shift=UP    * 0.08),
                FadeIn(out_g,  shift=LEFT  * 0.08),
                FadeIn(func_g, shift=LEFT  * 0.08),
                lag_ratio=0.14,
            ),
            run_time=1.5,
        )
        self.play(Create(pe_grp), run_time=0.45)
        self.play(
            LaggedStart(*[Create(x) for x in [*conn_arrows, feedback_curve, fb_tip]], lag_ratio=0.07),
            run_time=0.9,
        )
        self.add(status, layer_lbl)
        self.wait(0.4)

        def upd_status(txt, col=FG):
            return Transform(status, Text(txt, font_size=20, color=col).to_edge(UP, buff=0.28))

        def upd_layer(n):
            return Transform(
                layer_lbl,
                Text(f"Layer {n} / {NUM_LAYERS}", font_size=14, color=GRAY)
                    .to_edge(DOWN, buff=0.22).to_edge(RIGHT, buff=0.4),
            )

        # ── Layer loop ────────────────────────────────────────────────────
        for layer in range(NUM_LAYERS):

            self.play(upd_layer(layer + 1), run_time=0.22)

            # ── LOAD ───────────────────────────────────────────────────────
            self.play(upd_status(f"Layer {layer+1}: Loading weights & activations", WT_COL), run_time=0.28)
            load_anims = [
                dot_stream(host_r.get_right(), wt_r.get_left(),  WT_COL,   n=3, run_time=1.3),
                dot_stream(host_r.get_right(), act_r.get_left(), ACT_COL,  n=3, run_time=1.3),
            ]
            if layer == 0:
                load_anims.append(
                    dot_stream(host_r.get_right(), bias_r.get_left(), BIAS_COL, n=3, run_time=1.3)
                )
            self.play(
                *load_anims,
                Indicate(host_r, color=HOST_COL, scale_factor=1.05, run_time=1.3),
                run_time=1.5,
            )
            self.wait(0.1)

            # ── FEED / COMPUTE ─────────────────────────────────────────────
            self.play(upd_status(f"Layer {layer+1}: Tiled matmul — diagonal wavefront", FG), run_time=0.28)

            feed_anims = [
                dot_stream(wt_r.get_right(),   sys_r.get_left(), WT_COL,   n=3, run_time=2.0),
                dot_stream(act_r.get_right(),  sys_r.get_left(), ACT_COL,  n=3, run_time=2.0),
                dot_stream(bias_r.get_right(), sys_r.get_left(), BIAS_COL, n=3, run_time=2.0),
            ]

            # Diagonal wavefront: each anti-diagonal fires in sequence
            pe_wave = []
            for diag in range(2 * MINI_N - 1):
                for r in range(MINI_N):
                    c = diag - r
                    if 0 <= c < MINI_N:
                        t0 = 0.35 + diag * 0.34
                        pe_wave += [
                            Succession(
                                Wait(t0),
                                Flash(pe_rects[r][c], color=WT_COL,
                                      flash_radius=0.22, line_length=0.09, run_time=0.22),
                            ),
                            Succession(
                                Wait(t0 + 0.06),
                                pe_rects[r][c].animate(run_time=0.14).set_fill(ACCENT, opacity=0.50),
                                pe_rects[r][c].animate(run_time=0.40).set_fill(BG,     opacity=1.00),
                            ),
                        ]

            self.play(*feed_anims, *pe_wave, run_time=2.6)
            self.wait(0.15)

            # ── DRAIN ──────────────────────────────────────────────────────
            self.play(upd_status(f"Layer {layer+1}: Writing results to output memory", OUT_COL), run_time=0.28)
            self.play(
                dot_stream(sys_r.get_right(), out_r.get_left(), OUT_COL, n=4, run_time=1.3),
                Indicate(out_r, color=OUT_COL, scale_factor=1.05, run_time=1.3),
                run_time=1.4,
            )
            self.wait(0.1)

            # ── ACTIVATE ───────────────────────────────────────────────────
            is_last = (layer == NUM_LAYERS - 1)
            act_txt = (
                "Final activation function"
                if is_last
                else f"Layer {layer+1}: Activation + buffer swap"
            )
            self.play(upd_status(act_txt, ACT_COL), run_time=0.28)

            act_anims = [
                dot_stream(out_r.get_bottom(), func_r.get_top(), OUT_COL,  n=3, run_time=1.0),
                Indicate(func_r, color=FUNC_COL, scale_factor=1.05, run_time=1.0),
            ]
            if not is_last:
                act_anims.append(
                    curve_stream(fb_p0, fb_p1, fb_p2, fb_p3, ACT_COL, n=3, run_time=1.3)
                )
            self.play(*act_anims, run_time=1.5)

            if not is_last:
                self.play(
                    Flash(act_r, color=ACT_COL, flash_radius=0.55, line_length=0.20, run_time=0.38)
                )
            self.wait(0.18)

        # ── Done ──────────────────────────────────────────────────────────
        self.play(upd_status("Inference Complete  ✓", SUCCESS), run_time=0.4)
        self.play(
            Flash(out_r,  color=SUCCESS, flash_radius=0.60, line_length=0.20, run_time=0.5),
            Flash(func_r, color=SUCCESS, flash_radius=0.50, line_length=0.16, run_time=0.5),
            out_r.animate.set_stroke(SUCCESS, width=3.2),
            run_time=0.5,
        )
        self.wait(0.8)
