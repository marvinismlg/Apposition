"""Estimate each ranked competitor's monthly revenue from public App Store signals.

Two signals, averaged in log space (constants fitted offline, see revenue_model.json):
  1. iOS rating count summed over 13 storefronts, per tier (established vs small).
  2. Position in Apple's top-grossing charts (overall and category, 14 countries),
     converted to an overall-equivalent rank and a power law. Only apps that chart.
The result is a range, never a single figure: small apps' revenue varies widely for
the same public signals (paid ads, non-US markets, launch spikes), so their range is wider.
Revenue is gross (before Apple/Google fees) per month, all storefronts.
"""

import json
import math
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

MODEL = json.loads(Path(__file__).with_name("revenue_model.json").read_text())

RATING_COUNTRIES = ["us", "gb", "de", "fr", "jp", "br", "in", "ca", "au", "mx", "kr", "es", "it"]
CHART_COUNTRIES = RATING_COUNTRIES + ["cn"]
# Approximate share of App Store consumer spend by storefront (fixed, not fitted).
SPEND = {"us": .35, "cn": .25, "jp": .10, "kr": .04, "gb": .04, "de": .035, "fr": .02, "ca": .02,
         "au": .02, "it": .015, "es": .015, "br": .01, "mx": .01, "in": .01}
GAMES_GENRE = "6014"
CHART_TTL_SECONDS = 6 * 3600

_chart_cache = {}   # (country, genre or "all") -> (fetched_at, [track ids in rank order])


def _get_json(url, timeout=10):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def _chart(country, genre):
    # Apple's top-grossing feed: top 100 overall, or within a category.
    key = (country, genre or "all")
    cached = _chart_cache.get(key)
    if cached and time.time() - cached[0] < CHART_TTL_SECONDS:
        return cached[1]
    suffix = f"/genre={genre}" if genre else ""
    try:
        feed = _get_json(f"https://itunes.apple.com/{country}/rss/topgrossingapplications/limit=200{suffix}/json")
        ids = [int(e["id"]["attributes"]["im:id"]) for e in feed.get("feed", {}).get("entry", []) or []]
    except Exception:
        ids = []    # an unreachable chart counts as "not charting" for this country
    _chart_cache[key] = (time.time(), ids)
    return ids


def _listing(track_id, country):
    try:
        results = _get_json(f"https://itunes.apple.com/lookup?id={track_id}&country={country}")["results"]
        return results[0] if results else None
    except Exception:
        return None


def _sells_in_app(track_id):
    """True/False from the App Store page's "In-App Purchases" field; None if unreadable.

    The lookup API doesn't expose this, so read the product page. A rate-limited or
    failed page returns None, and the app keeps its normal estimate rather than being
    wrongly shown as earning nothing.
    """
    try:
        request = urllib.request.Request(
            f"https://apps.apple.com/us/app/id{track_id}",
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"})
        with urllib.request.urlopen(request, timeout=10) as response:
            page = response.read().decode("utf-8", "ignore")
    except Exception:
        return None
    return '"title":"In-App Purchases","summary":"Yes"' in page


def _genre_to_overall(charts, genre):
    """How many overall ranks one category rank is worth, for each country.

    Apps listed in both the category chart and the overall chart translate one into
    the other; the deepest such app needs the least extrapolation. Countries without
    one borrow the category's median, then fall back to the category's share of the
    overall charts.
    """
    ratios = {}
    for c in CHART_COUNTRIES:
        overall, category = charts[(c, None)], charts.get((c, genre), [])
        pairs = [(category.index(i) + 1, overall.index(i) + 1) for i in category if i in overall]
        if pairs:
            deepest = max(pairs)
            ratios[c] = deepest[1] / deepest[0]
    pooled = sorted(ratios.values())
    if pooled:
        median = pooled[len(pooled) // 2]
    else:
        share = max(MODEL["genre_share"].get(genre, 0), 0.5) / MODEL["genre_share_total"]
        median = 1 / share
    return {c: ratios.get(c, median) for c in CHART_COUNTRIES}


def _chart_signal(track_id, genre, charts, slope):
    """Spend-weighted sum over countries of (overall-equivalent rank) ^ -slope, and where it charts."""
    per_rank = _genre_to_overall(charts, genre)
    signal, positions = 0.0, []
    for c in CHART_COUNTRIES:
        overall, category = charts[(c, None)], charts.get((c, genre), [])
        if track_id in overall:
            rank = overall.index(track_id) + 1
            positions.append((rank, f"{c.upper()} top-grossing #{rank}"))
        elif track_id in category:
            category_rank = category.index(track_id) + 1
            rank = category_rank * per_rank[c]
            positions.append((rank, f"{c.upper()} category #{category_rank}"))
        else:
            continue
        signal += SPEND[c] * rank ** -slope
    return signal, [label for _, label in sorted(positions)[:3]]


def _round(value):
    # Two significant figures: the ranges are too wide for more to mean anything.
    if value <= 0:
        return 0
    digits = int(math.floor(math.log10(value))) - 1
    return int(round(value, -digits)) if digits > 0 else round(value)


def estimate_revenue(apps):
    """Revenue range for each ranked app, in the same order as the ranking.

    apps: the ranked results (need TrackId and AppName). Returns a list of dicts,
    or dicts with "status": "unavailable" for apps whose listing could not be read.
    """
    ids = [app.get("TrackId") for app in apps]
    with ThreadPoolExecutor(16) as pool:
        lookups = list(pool.map(lambda job: _listing(*job),
                                [(i, c) for i in ids for c in RATING_COUNTRIES]))
    listings = {i: lookups[k * len(RATING_COUNTRIES):(k + 1) * len(RATING_COUNTRIES)]
                for k, i in enumerate(ids)}

    genres = {i: str(next((l["primaryGenreId"] for l in listings[i] if l), "")) for i in ids}
    wanted = {(c, None) for c in CHART_COUNTRIES} | {(c, g) for g in set(genres.values()) if g for c in CHART_COUNTRIES}
    with ThreadPoolExecutor(16) as pool:
        charts = dict(zip(wanted, pool.map(lambda key: _chart(*key), wanted)))
        sells = dict(zip(ids, pool.map(_sells_in_app, ids)))

    results = []
    for app, track_id in zip(apps, ids):
        found = [l for l in listings.get(track_id, []) if l]
        if not track_id or not found:
            results.append({"status": "unavailable"})
            continue
        ratings = sum(l.get("userRatingCount", 0) for l in found)
        paid = bool(found[0].get("price"))
        if not paid and sells.get(track_id) is False:
            # Free with nothing to buy: no App Store revenue (it may still earn from ads).
            results.append({"status": "no_store_revenue", "ratings": ratings, "paid_app": False,
                            "basis": "free, no in-app purchases"})
            continue
        genre = genres[track_id]
        signal, positions = _chart_signal(track_id, genre, charts, MODEL["chart_slope"])
        in_overall = any(p.split()[1] == "top-grossing" for p in positions)
        tier = "established" if ratings >= MODEL["established_min_ratings"] or in_overall else "small"

        a, b = MODEL["ratings_model"][tier]
        logs = [a + b * math.log(max(ratings, 1))]
        if signal > 0:
            scale = MODEL["chart_scale"]["game" if genre == GAMES_GENRE else "app"]
            logs.append(math.log(signal) + scale)
        estimate = math.exp(sum(logs) / len(logs))

        window = MODEL["windows"][tier]
        results.append({
            "status": "available",
            "estimate": _round(estimate),
            "likely": [_round(estimate / window["likely"]), _round(estimate * window["likely"])],
            "wide": [_round(estimate / window["wide"]), _round(estimate * window["wide"])],
            "tier": tier,
            "confidence": "medium" if tier == "established" else "low",
            "basis": "top-grossing charts and ratings" if signal > 0 else "ratings only",
            "chart_positions": positions,
            "ratings": ratings,
            "paid_app": paid,
        })
    return results
