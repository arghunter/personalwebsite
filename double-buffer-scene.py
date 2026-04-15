from manim import *
from site_theme import (
    Theme, BG, BG_CARD, BORDER,
    ACCENT, TERTIARY, WARNING, FG, SUCCESS, POWER, SECONDARY,
)

BUF_A_COL = ACCENT    # violet — buffer A
BUF_B_COL = TERTIARY  # cyan   — buffer B
COMP_COL  = FG
ACC_COL   = POWER     # orange — accumulator
QUANT_COL = SUCCESS   # teal   — act+quant

NUM_LAYERS = 3

# ── Layout constants ────────────────────────────────────────────────────────
INPUT_POS  = LEFT  * 5.3
BUFA_POS   = LEFT  * 2.6 + UP   * 1.05
BUFB_POS   = LEFT  * 2.6 + DOWN * 1.05
COMP_POS   = ORIGIN + RIGHT * 0.35
ACC_POS    = RIGHT * 3.2 + UP   * 1.05
QUANT_POS  = RIGHT * 3.2 + DOWN * 1.05
Y_BELOW    = -2.55   # routing channel below all blocks


def make_block(label, sub, col, w=1.85, h=0.88):
    rect = RoundedRectangle(
        corner_radius=0.12, width=w, height=h,
        fill_color=BG_CARD, fill_opacity=1,
        stroke_color=col, stroke_width=1.9,
    )
    t = Text(label, font_size=14, color=col, weight=BOLD).move_to(
        rect.get_center() + UP * 0.15)
    s = Text(sub, font_size=10, color=BORDER).move_to(
        rect.get_center() + DOWN * 0.20)
    return VGroup(rect, t, s), rect


def dot_stream(start, end, color, n=4, run_time=1.0):
    dots = [Dot(radius=0.09, color=color, fill_opacity=0.92).move_to(start) for _ in range(n)]
    return AnimationGroup(
        LaggedStart(
            *[Succession(
                MoveAlongPath(d, Line(start, end), run_time=run_time * 0.75),
                FadeOut(d, run_time=0.10),
            ) for d in dots],
            lag_ratio=1.0 / (n + 0.5),
        ),
        run_time=run_time,
    )


def path_stream(path, color, n=4, run_time=1.0):
    """Stream dots along an arbitrary VMobject path."""
    dots = [Dot(radius=0.09, color=color, fill_opacity=0.92).move_to(path.get_start())
            for _ in range(n)]
    return AnimationGroup(
        LaggedStart(
            *[Succession(
                MoveAlongPath(d, path.copy(), run_time=run_time * 0.75),
                FadeOut(d, run_time=0.10),
            ) for d in dots],
            lag_ratio=1.0 / (n + 0.5),
        ),
        run_time=run_time,
    )


def u_curve(start_rect, end_rect):
    """CubicBezier U-routing: exits bottom of start, enters bottom of end."""
    p0 = start_rect.get_bottom()
    p3 = end_rect.get_bottom()
    p1 = np.array([p0[0], Y_BELOW, 0])
    p2 = np.array([p3[0], Y_BELOW, 0])
    return CubicBezier(p0, p1, p2, p3)


def arrow_at_end(curve, col, opacity=0.32):
    """Small arrowhead pointing upward into the end of a U-curve."""
    p3 = curve.get_end()
    return Arrow(p3 + DOWN * 0.20, p3,
                 buff=0, stroke_width=1.6, color=col, stroke_opacity=opacity,
                 max_tip_length_to_length_ratio=0.90)


def sarr(a, b, col, op=0.32):
    return Arrow(a, b, buff=0.07, stroke_width=1.5, color=col,
                 stroke_opacity=op, max_tip_length_to_length_ratio=0.11)


class DoubleBuffer(Scene):
    def construct(self):
        Theme.apply(self)

        # ── Title ────────────────────────────────────────────────────────────
        title = Text("LayerSequencer — Double-Buffer Swap",
                     font_size=21, color=FG, weight=BOLD).to_edge(UP, buff=0.26)

        # ── Blocks ───────────────────────────────────────────────────────────
        inp_g, inp_r   = make_block("Input Mem",  "host-loaded", TERTIARY,  w=1.7, h=0.80)
        bufA_g, bufA_r = make_block("Act Buf A",  "int8",        BUF_A_COL, w=1.8, h=0.88)
        bufB_g, bufB_r = make_block("Act Buf B",  "int8",        BUF_B_COL, w=1.8, h=0.88)
        comp_g, comp_r = make_block("Compute",    "sys. array",  COMP_COL,  w=2.0, h=1.05)
        acc_g,  acc_r  = make_block("Output Mem", "int32 acc.",  ACC_COL,   w=1.8, h=0.88)
        qnt_g,  qnt_r  = make_block("Act+Quant",  "→ int8",      QUANT_COL, w=1.8, h=0.88)

        inp_g.move_to(INPUT_POS)
        bufA_g.move_to(BUFA_POS)
        bufB_g.move_to(BUFB_POS)
        comp_g.move_to(COMP_POS)
        acc_g.move_to(ACC_POS)
        qnt_g.move_to(QUANT_POS)

        # ── Static arrows ────────────────────────────────────────────────────
        static_arrows = VGroup(
            sarr(comp_r.get_right(), acc_r.get_left(),   ACC_COL),
            sarr(acc_r.get_bottom(), qnt_r.get_top(),    QUANT_COL),
        )

        # U-curve write paths (quant → buf, routed below all blocks)
        curve_to_A = u_curve(qnt_r, bufA_r)
        curve_to_B = u_curve(qnt_r, bufB_r)
        tip_to_A   = arrow_at_end(curve_to_A, BUF_A_COL)
        tip_to_B   = arrow_at_end(curve_to_B, BUF_B_COL)

        ghost_A = VGroup(
            curve_to_A.copy().set_stroke(BUF_A_COL, width=1.4, opacity=0.22),
            tip_to_A.copy().set_stroke(BUF_A_COL, opacity=0.22).set_fill(BUF_A_COL, opacity=0.22),
        )
        ghost_B = VGroup(
            curve_to_B.copy().set_stroke(BUF_B_COL, width=1.4, opacity=0.22),
            tip_to_B.copy().set_stroke(BUF_B_COL, opacity=0.22).set_fill(BUF_B_COL, opacity=0.22),
        )

        # ── readBase / writeBase pointer tags ────────────────────────────────
        def ptr_tag(text, col):
            bg = RoundedRectangle(corner_radius=0.07, width=1.20, height=0.28,
                                  fill_color=col, fill_opacity=0.18,
                                  stroke_color=col, stroke_width=1.2)
            t  = Text(text, font_size=10, color=col, weight=BOLD).move_to(bg)
            return VGroup(bg, t)

        rd_tag = ptr_tag("readBase", BUF_A_COL)   # starts above Buf A
        wr_tag = ptr_tag("writeBase", BUF_B_COL)  # starts above Buf B

        def tag_pos_above(rect):
            return rect.get_top() + UP * 0.30

        rd_tag.move_to(tag_pos_above(bufA_r))
        wr_tag.move_to(tag_pos_above(bufB_r))

        # ── Layer / status labels ────────────────────────────────────────────
        layer_lbl = Text("", font_size=13, color=BORDER).to_edge(DOWN, buff=0.22).to_edge(LEFT, buff=0.40)
        status    = Text("", font_size=13, color=FG).to_edge(DOWN, buff=0.22).to_edge(RIGHT, buff=0.40)

        # ── Build-in animation ───────────────────────────────────────────────
        self.play(
            LaggedStart(
                FadeIn(inp_g,  shift=RIGHT * 0.06),
                FadeIn(bufA_g, shift=RIGHT * 0.06),
                FadeIn(bufB_g, shift=RIGHT * 0.06),
                FadeIn(comp_g, shift=UP    * 0.06),
                FadeIn(acc_g,  shift=LEFT  * 0.06),
                FadeIn(qnt_g,  shift=LEFT  * 0.06),
                lag_ratio=0.13,
            ),
            run_time=1.1,
        )
        self.play(Create(static_arrows), Create(ghost_A), Create(ghost_B), run_time=0.45)
        self.play(FadeIn(rd_tag), FadeIn(wr_tag), run_time=0.35)
        self.add(title, layer_lbl, status)
        self.wait(0.35)

        # ── Helpers ──────────────────────────────────────────────────────────
        def upd_layer(n):
            return Transform(
                layer_lbl,
                Text(f"Layer {n} / {NUM_LAYERS}", font_size=13, color=BORDER)
                    .to_edge(DOWN, buff=0.22).to_edge(LEFT, buff=0.40),
            )

        def upd_status(txt, col=FG):
            return Transform(
                status,
                Text(txt, font_size=13, color=col)
                    .to_edge(DOWN, buff=0.22).to_edge(RIGHT, buff=0.40),
            )

        def glow_on(rect, col):
            return rect.animate.set_stroke(col, width=3.4)

        def glow_off(rect, col):
            return rect.animate.set_stroke(col, width=1.9)

        # Alternating read/write buffers per layer
        # Layer 0: read A (violet), write B (cyan)
        # Layer 1: read B (cyan),   write A (violet)
        # Layer 2: read A (violet), write B (cyan)
        def cfg(layer):
            if layer % 2 == 0:
                return bufA_r, bufB_r, BUF_A_COL, BUF_B_COL, curve_to_B, "A", "B"
            else:
                return bufB_r, bufA_r, BUF_B_COL, BUF_A_COL, curve_to_A, "B", "A"

        # ── First layer: load host → Buf A ───────────────────────────────────
        self.play(upd_layer(1), upd_status("Loading input activations → Act Buf A", BUF_A_COL), run_time=0.30)
        inp_arr = sarr(inp_r.get_right(), bufA_r.get_left(), BUF_A_COL, op=0.58)
        self.play(Create(inp_arr), run_time=0.25)
        self.play(
            dot_stream(inp_r.get_right(), bufA_r.get_left(), BUF_A_COL, n=4, run_time=1.1),
            Indicate(inp_r, color=TERTIARY, scale_factor=1.05, run_time=1.1),
            run_time=1.2,
        )
        self.play(FadeOut(inp_arr), run_time=0.20)
        self.wait(0.15)

        # ── Layer loop ───────────────────────────────────────────────────────
        for layer in range(NUM_LAYERS):
            rb, wb, rc, wc, wr_curve, rd_name, wr_name = cfg(layer)

            self.play(upd_layer(layer + 1), run_time=0.25)

            # ── READ + COMPUTE ───────────────────────────────────────────────
            self.play(
                upd_status(f"Layer {layer+1}: READ Buf {rd_name} → compute", rc),
                glow_on(rb, rc),
                run_time=0.28,
            )
            rd_arr = sarr(rb.get_right(), comp_r.get_left(), rc, op=0.65)
            self.play(Create(rd_arr), run_time=0.22)
            self.play(
                dot_stream(rb.get_right(), comp_r.get_left(), rc, n=5, run_time=1.30),
                Indicate(comp_r, color=COMP_COL, scale_factor=1.04, run_time=1.30),
                run_time=1.35,
            )

            # ── ACCUMULATE + QUANTIZE + WRITE — runs concurrently with tail of read ──
            self.play(
                upd_status(f"Layer {layer+1}: accumulate → quantize → WRITE Buf {wr_name}", wc),
                glow_on(wb, wc),
                run_time=0.25,
            )
            # comp → acc and acc → quant → buf simultaneously
            active_curve = VGroup(
                wr_curve.copy().set_stroke(wc, width=1.8, opacity=0.65),
                arrow_at_end(wr_curve, wc, opacity=0.65),
            )
            self.play(Create(active_curve), run_time=0.22)
            self.play(
                dot_stream(comp_r.get_right(), acc_r.get_left(),   ACC_COL,   n=3, run_time=1.10),
                dot_stream(acc_r.get_bottom(), qnt_r.get_top(),    QUANT_COL, n=3, run_time=1.10),
                path_stream(wr_curve,                              wc,        n=4, run_time=1.30),
                Indicate(qnt_r, color=QUANT_COL, scale_factor=1.04, run_time=1.10),
                run_time=1.35,
            )
            self.play(FadeOut(rd_arr), FadeOut(active_curve), run_time=0.20)
            self.play(glow_off(rb, rc), glow_off(wb, wc), run_time=0.22)

            # ── SWAP ─────────────────────────────────────────────────────────
            if layer < NUM_LAYERS - 1:
                new_rc, new_wc = (BUF_B_COL, BUF_A_COL) if rc == BUF_A_COL else (BUF_A_COL, BUF_B_COL)
                new_rb = bufB_r if rb is bufA_r else bufA_r
                new_wb = bufA_r if wb is bufA_r else bufB_r

                self.play(
                    upd_status("swap: readBase ↔ writeBase", WARNING),
                    run_time=0.28,
                )
                # Tags slide between buffers
                rd_dest = tag_pos_above(new_rb)
                wr_dest = tag_pos_above(new_wb)
                self.play(
                    Flash(rb, color=rc, flash_radius=0.55, line_length=0.16, run_time=0.40),
                    Flash(wb, color=wc, flash_radius=0.55, line_length=0.16, run_time=0.40),
                    run_time=0.45,
                )
                self.play(
                    rd_tag.animate.move_to(rd_dest),
                    wr_tag.animate.move_to(wr_dest),
                    run_time=0.50,
                )
                # Re-color the tags to match new roles
                new_rd_tag = ptr_tag("readBase",  new_rc).move_to(rd_dest)
                new_wr_tag = ptr_tag("writeBase", new_wc).move_to(wr_dest)
                self.play(
                    Transform(rd_tag, new_rd_tag),
                    Transform(wr_tag, new_wr_tag),
                    run_time=0.28,
                )
            else:
                self.play(
                    upd_status("Inference complete — final output in Act+Quant", SUCCESS),
                    run_time=0.30,
                )
                self.play(
                    Flash(qnt_r,  color=SUCCESS, flash_radius=0.55, line_length=0.16, run_time=0.45),
                    Flash(acc_r,  color=SUCCESS, flash_radius=0.55, line_length=0.16, run_time=0.45),
                    run_time=0.50,
                )

            self.wait(0.30)

        self.wait(0.70)
