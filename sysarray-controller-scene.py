from manim import *
from site_theme import (
    Theme, BG, BG_CARD, BORDER,
    ACCENT, TERTIARY, WARNING, FG, SUCCESS, POWER, SECONDARY,
)

# ── Constants ───────────────────────────────────────────────────────────────
N = 4   # example array size

STATES = ["INIT", "INIT_1", "IDLE", "FEED", "FLUSH", "DRAIN_SKIP", "DRAIN_READ"]

TRANSITIONS = [
    ("INIT",       "INIT_1",     "reset"),
    ("INIT_1",     "IDLE",       "done"),
    ("IDLE",       "FEED",       "start"),
    ("FEED",       "FLUSH",      "n fed"),
    ("FLUSH",      "DRAIN_SKIP", "drained"),
    ("DRAIN_SKIP", "DRAIN_READ", "rst sent"),
    ("DRAIN_READ", "IDLE",       "done"),
]

STATE_COLORS = {
    "INIT":       BORDER,
    "INIT_1":     BORDER,
    "IDLE":       TERTIARY,
    "FEED":       ACCENT,
    "FLUSH":      WARNING,
    "DRAIN_SKIP": POWER,
    "DRAIN_READ": SUCCESS,
}

NODE_W  = 1.38
NODE_H  = 0.54
Y_ROW   = 1.55

# Evenly spaced across the scene
N_STATES = len(STATES)
SPACING  = 1.82
XS = [SPACING * (i - (N_STATES - 1) / 2.0) for i in range(N_STATES)]


def state_pos(name):
    return np.array([XS[STATES.index(name)], Y_ROW, 0])


def make_node(name, active=False):
    col = STATE_COLORS[name]
    rect = RoundedRectangle(
        corner_radius=0.12, width=NODE_W, height=NODE_H,
        fill_color=col, fill_opacity=0.28 if active else 0.07,
        stroke_color=col, stroke_width=2.8 if active else 1.4,
    )
    lbl = Text(name, font_size=11, color=col, weight=BOLD).move_to(rect)
    return VGroup(rect, lbl), rect


# ── Phase proportion bar ────────────────────────────────────────────────────
def make_phase_bar(bar_y, total_w=10.4):
    total_cyc = 4 * N - 1  # FEED(n) + FLUSH(2n-1) + DRAIN(n)
    segs = [
        (N,           ACCENT,  f"FEED\nn={N}"),
        (2 * N - 1,   WARNING, f"FLUSH\n2n−1={2*N-1}"),
        (N,           SUCCESS, f"DRAIN\nn={N}"),
    ]
    grp = VGroup()
    x = -total_w / 2
    for cyc, col, label in segs:
        w = (cyc / total_cyc) * total_w
        bar = Rectangle(
            width=w, height=0.30,
            fill_color=col, fill_opacity=0.15,
            stroke_color=col, stroke_width=1.0,
        ).move_to([x + w / 2, bar_y, 0])
        txt = Text(label, font_size=9, color=col, line_spacing=0.8)
        txt.move_to(bar)
        if txt.width > w - 0.06:
            txt.scale_to_fit_width(w - 0.06)
        grp.add(bar, txt)
        x += w
    return grp


class SysArrayController(Scene):
    def construct(self):
        Theme.apply(self)

        # ── Title ────────────────────────────────────────────────────────────
        title = Text("SysArrayController — State Machine",
                     font_size=21, color=FG, weight=BOLD).to_edge(UP, buff=0.26)
        self.add(title)

        # ── Nodes ────────────────────────────────────────────────────────────
        nodes = {}
        for name in STATES:
            grp, _ = make_node(name, active=False)
            grp.move_to(state_pos(name))
            nodes[name] = grp

        # ── Edges ────────────────────────────────────────────────────────────
        # All transitions are between adjacent nodes except DRAIN_READ → IDLE
        # which arcs above the row.
        edge_visuals = {}  # VGroup drawn on scene
        edge_paths   = {}  # path object used for dot animation

        for src, dst, lbl_txt in TRANSITIONS:
            sp  = state_pos(src)
            dp  = state_pos(dst)
            col = STATE_COLORS[src]

            if src == "DRAIN_READ" and dst == "IDLE":
                arc_y = Y_ROW + 1.50
                p0 = sp + UP * (NODE_H / 2)
                p3 = dp + UP * (NODE_H / 2)
                p1 = np.array([sp[0], arc_y, 0])
                p2 = np.array([dp[0], arc_y, 0])
                bez  = CubicBezier(p0, p1, p2, p3,
                                   stroke_color=col, stroke_width=1.6,
                                   stroke_opacity=0.32)
                tip  = Arrow(p3 + UP * 0.22, p3,
                             buff=0, stroke_width=1.6, color=col,
                             stroke_opacity=0.32,
                             max_tip_length_to_length_ratio=0.90)
                lbl  = Text(lbl_txt, font_size=9, color=col).set_opacity(0.55)
                lbl.move_to([(sp[0] + dp[0]) / 2, arc_y + 0.22, 0])
                edge_visuals[(src, dst)] = VGroup(bez, tip, lbl)
                edge_paths[(src, dst)]   = CubicBezier(p0, p1, p2, p3)
            else:
                p0 = sp + RIGHT * (NODE_W / 2)
                p3 = dp + LEFT  * (NODE_W / 2)
                arr = Arrow(p0, p3, buff=0, stroke_width=1.6, color=col,
                            stroke_opacity=0.32,
                            max_tip_length_to_length_ratio=0.10)
                lbl = Text(lbl_txt, font_size=9, color=col).set_opacity(0.55)
                lbl.move_to((p0 + p3) / 2 + UP * 0.21)
                edge_visuals[(src, dst)] = VGroup(arr, lbl)
                edge_paths[(src, dst)]   = Line(p0, p3)

        # ── Info panel (bottom-left) ─────────────────────────────────────────
        info_rect = RoundedRectangle(
            corner_radius=0.12, width=7.2, height=1.30,
            fill_color=BG_CARD, fill_opacity=1,
            stroke_color=BORDER, stroke_width=1.4,
        ).to_edge(DOWN, buff=0.28).to_edge(LEFT, buff=0.30)
        info_text = Text("", font_size=12, color=FG).move_to(info_rect)

        # ── Cycle counter (bottom-right) ─────────────────────────────────────
        cnt_rect = RoundedRectangle(
            corner_radius=0.12, width=3.6, height=1.30,
            fill_color=BG_CARD, fill_opacity=1,
            stroke_color=BORDER, stroke_width=1.4,
        ).to_edge(DOWN, buff=0.28).to_edge(RIGHT, buff=0.30)
        cnt_lbl = Text("cycle", font_size=10, color=BORDER).move_to(
            cnt_rect.get_center() + UP * 0.38)
        cnt_val = Text("—", font_size=32, color=FG, weight=BOLD).move_to(
            cnt_rect.get_center() + DOWN * 0.08)

        # ── Phase bar (between row and panels) ───────────────────────────────
        bar_y     = (info_rect.get_top()[1] + state_pos("FEED")[1] - NODE_H / 2) / 2
        phase_bar = make_phase_bar(bar_y)
        bar_cap   = Text("one tile: FEED + FLUSH + DRAIN", font_size=10, color=BORDER)
        bar_cap.next_to(phase_bar, UP, buff=0.10).align_to(phase_bar, LEFT)

        # ── Animate in ───────────────────────────────────────────────────────
        self.play(
            LaggedStart(*[FadeIn(nodes[n], shift=UP * 0.05) for n in STATES],
                        lag_ratio=0.10),
            run_time=1.0,
        )
        self.play(
            LaggedStart(*[Create(ev) for ev in edge_visuals.values()], lag_ratio=0.07),
            run_time=0.85,
        )
        self.play(
            FadeIn(info_rect), FadeIn(cnt_rect), FadeIn(cnt_lbl), FadeIn(cnt_val),
            FadeIn(phase_bar), FadeIn(bar_cap),
            run_time=0.45,
        )
        self.wait(0.35)

        # ── Animation helpers ────────────────────────────────────────────────
        def activate(name):
            g, _ = make_node(name, active=True)
            g.move_to(state_pos(name))
            return Transform(nodes[name], g)

        def deactivate(name):
            g, _ = make_node(name, active=False)
            g.move_to(state_pos(name))
            return Transform(nodes[name], g)

        def set_info(txt, col=FG):
            new_t = Text(txt, font_size=12, color=col, line_spacing=1.25)
            new_t.move_to(info_rect)
            if new_t.width > info_rect.width - 0.30:
                new_t.scale_to_fit_width(info_rect.width - 0.30)
            return Transform(info_text, new_t)

        def set_cnt(s, col=FG):
            nv = Text(s, font_size=32, color=col, weight=BOLD).move_to(
                cnt_rect.get_center() + DOWN * 0.08)
            return Transform(cnt_val, nv)

        def transit(src, dst):
            """Dot + halo travel along edge path, then swap active node."""
            path = edge_paths[(src, dst)]
            col  = STATE_COLORS[src]
            dot  = Dot(radius=0.11, color=col, fill_opacity=1.0).move_to(path.get_start())
            halo = Dot(radius=0.24, color=col, fill_opacity=0.20).move_to(path.get_start())
            self.add(halo, dot)
            self.play(
                MoveAlongPath(dot,  path.copy(), run_time=0.55, rate_func=smooth),
                MoveAlongPath(halo, path.copy(), run_time=0.55, rate_func=smooth),
            )
            self.remove(dot, halo)
            self.play(deactivate(src), activate(dst), run_time=0.25)

        def smooth_count(end, col, total_time):
            """Single smooth animation that counts cnt_val from 1 to end."""
            def upd(mob, alpha):
                v = max(1, round(alpha * end))
                mob.become(
                    Text(f"{v} / {end}", font_size=32, color=col, weight=BOLD)
                    .move_to(cnt_rect.get_center() + DOWN * 0.08)
                )
            self.play(UpdateFromAlphaFunc(cnt_val, upd, run_time=total_time,
                                          rate_func=linear))

        # ── Walk through states ──────────────────────────────────────────────

        # INIT
        self.play(activate("INIT"),
                  set_info("Assert reset=1 across every PE — clears all accumulators", BORDER),
                  set_cnt("rst=1", BORDER), run_time=0.38)
        self.wait(0.55)
        transit("INIT", "INIT_1")

        # INIT_1
        self.play(set_info("Wait 2n−1 cycles for reset to propagate diagonally through array", BORDER),
                  set_cnt("2n−1", BORDER), run_time=0.35)
        self.wait(0.55)
        transit("INIT_1", "IDLE")

        # IDLE
        self.play(set_info("Waiting for start signal from TiledMatMulController", TERTIARY),
                  set_cnt("—", TERTIARY), run_time=0.35)
        self.wait(0.70)
        transit("IDLE", "FEED")

        # FEED — n cycles, smooth counter
        self.play(
            set_info(f"FEED: stream weights (→) and activations (↓) into array — {N} cycles", ACCENT),
            run_time=0.35,
        )
        smooth_count(N, ACCENT, N * 0.26)
        self.wait(0.20)
        transit("FEED", "FLUSH")

        # FLUSH — 2n-1 cycles
        flush_n = 2 * N - 1
        self.play(
            set_info(f"FLUSH: inputs stop — wait {flush_n} cycles (2n−1) for partial products to drain out", WARNING),
            run_time=0.35,
        )
        smooth_count(flush_n, WARNING, flush_n * 0.18)
        self.wait(0.20)
        transit("FLUSH", "DRAIN_SKIP")

        # DRAIN_SKIP — pulse reset diagonally
        self.play(
            set_info("DRAIN_SKIP: pulse reset=1 diagonally — each PE latches its accumulated result", POWER),
            set_cnt("rst→PEs", POWER), run_time=0.35,
        )
        self.wait(0.90)
        transit("DRAIN_SKIP", "DRAIN_READ")

        # DRAIN_READ — n results
        self.play(
            set_info(f"DRAIN_READ: read {N} latched outputs, optionally accumulate into output buffer", SUCCESS),
            run_time=0.35,
        )
        smooth_count(N, SUCCESS, N * 0.26)
        self.wait(0.25)
        transit("DRAIN_READ", "IDLE")

        # Back to IDLE
        self.play(
            set_info("Tile complete — TiledMatMulController issues next tile or moves to next layer", TERTIARY),
            set_cnt("—", TERTIARY), run_time=0.35,
        )
        self.wait(1.0)
