from manim import *
from site_theme import Theme, ACCENT, TERTIARY, FG

# Run with:
#   ./manim-embed.sh example-scene.py ExampleScene my-blog --caption "A circle transforming into a square"

class ExampleScene(Scene):
    def construct(self):
        Theme.apply(self)

        circle = Circle(radius=1.5, color=ACCENT, fill_opacity=0.4)
        square = Square(side_length=2.5, color=TERTIARY, fill_opacity=0.4)
        label  = Text("Hello from Manim!", font_size=32, color=FG).to_edge(UP, buff=0.5)

        self.play(Write(label), run_time=0.8)
        self.play(FadeIn(circle))
        self.wait(0.5)
        self.play(Transform(circle, square), run_time=1.2)
        self.wait(0.5)
        self.play(FadeOut(circle), FadeOut(label))
