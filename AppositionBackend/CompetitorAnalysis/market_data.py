"""Turn an engine run and its Gemini analysis into one report-ready record.

Both the Word report (generate_market_analysis.py) and the Streamlit
dashboard (market_insights.py) read this shape, so neither has to know
whether the run came from the live API or from files saved by local_test.py.
"""

import json
from pathlib import Path


def _read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _feature_comparison(analysis, feature_matrix, app_count):
    # Gemini's verified verdicts, with each row's cells put in ranked-app order.
    if analysis and analysis.get("feature_comparison"):
        rows = []
        for row in analysis["feature_comparison"]:
            by_index = {cell["app_index"]: cell for cell in row["competitors"]}
            rows.append({
                "feature": row["feature"],
                "cells": [
                    {"verdict": by_index[i]["verdict"], "evidence": by_index[i]["evidence"]}
                    for i in range(app_count)
                ],
            })
        return rows

    # Without Gemini, only the embedding candidates exist. They are labelled as
    # unverified rather than passed off as supported features.
    rows = []
    for row in (feature_matrix or {}).get("rows", []):
        rows.append({
            "feature": row["feature"],
            "cells": [
                {
                    "verdict": "candidate" if cell["candidate_match"] else "not_established",
                    "evidence": cell["evidence"][0]["passage"]
                    if cell["candidate_match"] and cell["evidence"] else "",
                }
                for cell in row["cells"]
            ],
        })
    return rows


def feature_ranking(feature_comparison):
    """Rank the founder's features from most to least unique.

    Counted from the verdicts, not asked of Gemini: a feature few competitors
    describe is a possible gap; one most of them describe is table stakes.
    """
    ranked = []
    for order, row in enumerate(feature_comparison):
        verdicts = [cell["verdict"] for cell in row["cells"]]
        ranked.append({
            "feature": row["feature"],
            "described": verdicts.count("supported") + verdicts.count("candidate"),
            "related": verdicts.count("related"),
            "apps": len(verdicts),
            "order": order,
        })
    # Fewest described first, then fewest related; ties keep the founder's order.
    ranked.sort(key=lambda item: (item["described"], item["related"], item["order"]))
    return ranked


def _build(idea, apps, candidate_count, analysis, reviews, feature_matrix,
           query_source, review_status, planned=(), revenue=None):
    analysis = analysis or {}
    comparison = _feature_comparison(analysis, feature_matrix, len(apps))
    differentiation = analysis.get("differentiation", [])
    if planned:
        # The founder's ticked ideas only, in the order Gemini ranked them.
        chosen = set(planned)
        differentiation = [item for i, item in enumerate(differentiation) if i in chosen]

    return {
        "idea": idea,
        "apps": [
            {
                "name": app["AppName"],
                "index": float(app.get("similarity_percentage", 0)),
                "price": app.get("Price") or "Unknown",
                "developer": app.get("Developer", ""),
                "rating": float(app.get("Rating") or 0),
                "rating_count": int(app.get("RatingCount") or 0),
                "score_basis": app.get("score_basis", "Cosine similarity of the idea and the App Store listing"),
                # Estimated from store signals (revenue.py); None when not estimated.
                "revenue": revenue[i] if revenue and i < len(revenue) else None,
            }
            for i, app in enumerate(apps)
        ],
        "candidate_count": candidate_count,
        "query_source": query_source,
        "overall_summary": analysis.get("overall_summary", ""),
        "competitor_summaries": {
            item["app_index"]: item["explanation"]
            for item in analysis.get("competitor_summaries", [])
        },
        "feature_comparison": comparison,
        "feature_ranking": feature_ranking(comparison),
        "differentiation": differentiation,
        "review_improvements": analysis.get("review_improvements", []),
        "reviews": (reviews or {}).get("apps", []),
        "review_status": review_status,
        "example": False,
    }


def market_data_from_result(result, planned=()):
    """Build report data from one /similarity response."""
    return _build(
        idea=result["idea"],
        apps=result["results"],
        candidate_count=result.get("candidate_count"),
        analysis=result.get("analysis"),
        reviews=result.get("reviews"),
        feature_matrix=result.get("feature_matrix"),
        query_source=result.get("query_source", "gemini"),
        review_status=result.get("review_status", "unknown"),
        planned=planned,
        revenue=result.get("revenue"),
    )


def load_market_data(engine_path, gemini_path=None, review_path=None):
    """Build report data from files saved on disk.

    engine_path is either local_test.py's itunes_test_results.json or a saved
    /similarity response. gemini_path holds analyze_competitors() output.
    """
    engine = _read_json(engine_path)
    if "results" in engine and "idea" in engine:
        # A saved API response already carries everything; a separate Gemini
        # file, if given, replaces its analysis.
        if gemini_path:
            engine = {**engine, "analysis": _read_json(gemini_path)}
        return market_data_from_result(engine)

    reviews = _read_json(review_path) if review_path else None
    return _build(
        idea=engine["user_input"],
        apps=engine["top_five"],
        candidate_count=engine.get("candidate_count"),
        analysis=_read_json(gemini_path) if gemini_path else None,
        reviews=reviews,
        feature_matrix=None,
        query_source="keywords",
        review_status="Loaded from file" if reviews else "No review file supplied",
    )
