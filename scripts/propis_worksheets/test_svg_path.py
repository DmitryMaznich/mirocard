from svg_path import parse_path, path_bounds, draw_path


def test_parse_simple_move_line():
    assert parse_path("M 10 20 L 30 40") == [("M", (10.0, 20.0)), ("L", (30.0, 40.0))]


def test_parse_cubic_bezier():
    assert parse_path("M 0 0 C 1 2 3 4 5 6") == [
        ("M", (0.0, 0.0)),
        ("C", (1.0, 2.0, 3.0, 4.0, 5.0, 6.0)),
    ]


def test_parse_rejects_unsupported_command():
    try:
        parse_path("M 0 0 A 5 5 0 0 1 10 10")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_bounds_of_straight_line_are_its_endpoints():
    minx, maxx, miny, maxy = path_bounds("M 0 0 L 10 5")
    assert (minx, maxx, miny, maxy) == (0.0, 10.0, 0.0, 5.0)


def test_bounds_of_bezier_include_the_curve_bulge():
    # A cubic whose control points pull hard to the left of both endpoints
    # (which sit at x=0) must report bounds wider than just the endpoints --
    # this is exactly why bounds need real curve sampling, not endpoint
    # min/max (a captured letter's loops bulge past their own M/end points
    # constantly).
    minx, maxx, miny, maxy = path_bounds("M 0 0 C -10 0 -10 10 0 10")
    assert minx < -1.0


def test_draw_path_applies_transform_and_replays_commands():
    class FakePath:
        def __init__(self):
            self.calls = []

        def moveTo(self, x, y):
            self.calls.append(("moveTo", x, y))

        def lineTo(self, x, y):
            self.calls.append(("lineTo", x, y))

        def curveTo(self, x1, y1, x2, y2, x, y):
            self.calls.append(("curveTo", x1, y1, x2, y2, x, y))

    fake = FakePath()
    draw_path(fake, "M 0 0 L 10 0", transform=lambda x, y: (x * 2, y * 2))
    assert fake.calls == [("moveTo", 0, 0), ("lineTo", 20, 0)]


def test_draw_path_handles_bezier():
    class FakePath:
        def __init__(self):
            self.calls = []

        def moveTo(self, x, y):
            self.calls.append(("moveTo", x, y))

        def curveTo(self, x1, y1, x2, y2, x, y):
            self.calls.append(("curveTo", x1, y1, x2, y2, x, y))

    fake = FakePath()
    draw_path(fake, "M 0 0 C 1 1 2 2 3 3", transform=lambda x, y: (x, y))
    assert fake.calls == [("moveTo", 0, 0), ("curveTo", 1, 1, 2, 2, 3, 3)]
