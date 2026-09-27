"""Static charts for the market analysis report.

Each function takes the report data from market_data.py and returns PNG bytes,
or None when the run has nothing to plot. Colors are the validated default
data-viz palette (blue, then orange), checked for colour-blind separation.
"""

import unicodedata
from io import BytesIO

import matplotlib

matplotlib.use("Agg")  # Render off-screen; the API server has no display.
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter, LogLocator, NullFormatter  # noqa: E402

SURFACE = "#ffffff"
TEXT = "#0b0b0b"
TEXT_MUTED = "#52514e"
GRID = "#e4e3df"
BLUE = "#2a78d6"      # categorical slot 1
ORANGE = "#eb6834"    # categorical slot 2
NEUTRAL = "#d6d5d0"   # "nothing here", never a series hue

DPI = 200


def _figure(height):
    fig, ax = plt.subplots(figsize=(6.5, height), dpi=DPI)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)
    # Recessive frame: no box, light grid behind the marks.
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=TEXT_MUTED, labelsize=8, length=0)
    ax.set_axisbelow(True)
    return fig, ax


def _png(fig):
    buffer = BytesIO()
    fig.tight_layout()
    fig.savefig(buffer, format="png", facecolor=SURFACE)
    plt.close(fig)
    return buffer.getvalue()


def _compact(count, _position=None):
    # 1500 -> "1.5K", 20000 -> "20K": readable where 10^4 notation is not.
    for size, suffix in ((1_000_000, "M"), (1_000, "K")):
        if count >= size:
            return f"{count / size:.1f}".rstrip("0").rstrip(".") + suffix
    return f"{count:.0f}"


def _short(name, limit=28):
    # Full-width punctuation (e.g. "Slumber－Calm") is missing from the chart font.
    name = unicodedata.normalize("NFKC", name)
    return name if len(name) <= limit else name[:limit - 1].rstrip() + "…"


def similarity_chart(data):
    """Bars of each ranked app's 0-100 similarity index, closest at the top."""
    apps = data["apps"]
    if not apps:
        return None
    fig, ax = _figure(0.5 + 0.42 * len(apps))
    labels = [f"{i}. {_short(app['name'])}" for i, app in enumerate(apps, 1)]
    values = [app["index"] for app in apps]
    rows = range(len(apps))[::-1]  # rank 1 on top
    ax.barh(list(rows), values, height=0.55, color=BLUE)
    for row, value in zip(rows, values):
        ax.text(value + 1.2, row, f"{value:.0f}", va="center", fontsize=8, color=TEXT)
    ax.set_yticks(list(rows), labels, color=TEXT, fontsize=8)
    ax.set_xlim(0, 100)
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlabel("Similarity index (0–100): cosine similarity of listing text, "
                  "not a share of features", fontsize=7.5, color=TEXT_MUTED)
    return _png(fig)


def feature_coverage_chart(data):
    """For each of the founder's features, how many competitors describe it."""
    ranking = data.get("feature_ranking") or []
    if not ranking:
        return None
    fig, ax = _figure(0.8 + 0.42 * len(ranking))
    rows = range(len(ranking))[::-1]  # most unique on top, matching the table
    for row, item in zip(rows, ranking):
        described, related = item["described"], item["related"]
        rest = item["apps"] - described - related
        # A 2px surface-coloured edge keeps adjacent segments visibly separate.
        segments = ((described, BLUE), (related, ORANGE), (rest, NEUTRAL))
        left = 0
        for width, color in segments:
            if width:
                ax.barh(row, width, left=left, height=0.55, color=color,
                        edgecolor=SURFACE, linewidth=2)
            left += width
    ax.set_yticks(list(rows), [_short(item["feature"], 34) for item in ranking],
                  color=TEXT, fontsize=8)
    apps = ranking[0]["apps"]
    ax.set_xlim(0, apps)
    ax.set_xticks(range(apps + 1))
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlabel(f"Competitors (of {apps}) whose listing describes the feature",
                  fontsize=7.5, color=TEXT_MUTED)
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in (BLUE, ORANGE, NEUTRAL)]
    ax.legend(handles, ("Described", "Related", "Not shown"), loc="lower center",
              bbox_to_anchor=(0.5, 1.0), ncol=3, frameon=False, fontsize=8,
              labelcolor=TEXT, handlelength=1, handleheight=1)
    return _png(fig)


def _money(value, _position=None):
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if value >= size:
            return "$" + f"{value / size:.1f}".rstrip("0").rstrip(".") + suffix
    return f"${value:.0f}"


def revenue_chart(data):
    """Each competitor's likely monthly revenue range (bar) and estimate (dot), log scale."""
    rows = [(i, app) for i, app in enumerate(data["apps"], 1)
            if (app.get("revenue") or {}).get("status") == "available"]
    if not rows:
        return None
    fig, ax = _figure(0.6 + 0.42 * len(rows))
    ypos = range(len(rows))[::-1]   # rank 1 on top, matching Figure 1
    for y, (_, app) in zip(ypos, rows):
        rev = app["revenue"]
        low, high = rev["likely"]
        ax.plot([low, high], [y, y], color=BLUE, alpha=0.35, linewidth=9, solid_capstyle="round")
        ax.scatter([rev["estimate"]], [y], s=60, color=BLUE, edgecolor=SURFACE, linewidth=2, zorder=3)
        ax.annotate(f"~{_money(rev['estimate'])}", (high, y), xytext=(8, 0), textcoords="offset points",
                    va="center", fontsize=7.5, color=TEXT)
    ax.set_yticks(list(ypos), [f"{i}. {_short(app['name'])}" for i, app in rows], color=TEXT, fontsize=8)
    ax.set_xscale("log")
    ax.xaxis.set_major_formatter(FuncFormatter(_money))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(which="minor", length=0)
    lows = [app["revenue"]["likely"][0] for _, app in rows]
    highs = [app["revenue"]["likely"][1] for _, app in rows]
    ax.set_xlim(min(lows) / 1.5, max(highs) * 4)      # room for the value labels
    ax.set_ylim(-0.6, len(rows) - 0.4)
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlabel("Monthly revenue before store fees (log scale). Bar: likely range. Dot: estimate.",
                  fontsize=7.5, color=TEXT_MUTED)
    return _png(fig)


def market_position_chart(data):
    """Star rating against number of ratings: who is established, who is loved."""
    apps = [app for app in data["apps"] if app.get("rating_count")]
    if len(apps) < 2:
        return None
    fig, ax = _figure(3.2)
    counts = [app["rating_count"] for app in apps]
    ratings = [app["rating"] for app in apps]
    # A surface ring keeps overlapping markers distinguishable.
    ax.scatter(counts, ratings, s=70, color=BLUE, edgecolor=SURFACE, linewidth=2, zorder=3)
    for app, x, y in zip(apps, counts, ratings):
        ax.annotate(_short(app["name"], 22), (x, y), xytext=(6, 5),
                    textcoords="offset points", fontsize=7.5, color=TEXT)
    ax.set_xscale("log")
    ax.xaxis.set_major_locator(LogLocator(base=10, subs=(1, 2, 5)))
    ax.xaxis.set_major_formatter(FuncFormatter(_compact))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.tick_params(which="minor", length=0)
    # Room on the right so the last app's label stays inside the figure.
    ax.set_xlim(min(counts) / 1.6, max(counts) * 3)
    ax.set_ylim(max(0, min(ratings) - 0.5), 5.15)
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlabel("Number of App Store ratings (log scale)", fontsize=7.5, color=TEXT_MUTED)
    ax.set_ylabel("Average rating (stars)", fontsize=7.5, color=TEXT_MUTED)
    return _png(fig)
