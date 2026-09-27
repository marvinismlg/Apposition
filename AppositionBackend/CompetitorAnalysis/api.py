"""Python API for competitor ranking and review-backed analysis.

Run from this folder:  uvicorn api:app --port 8000
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from typing import Annotated

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field, StringConstraints

# main.py loads the SentenceTransformer model once.
from main import (
    parse_itunes_data,
    embed_competitor_apps,
    cosine_similarity_score,
    model,
)
from feature_similarity_engine import build_feature_matrix, attach_feature_matches
from filter_reviews import recent_negative_reviews
from gemini_api import (
    MAX_FEATURE_CHARS,
    MAX_FEATURES,
    MAX_IDEA_CHARS,
    analyze_competitors,
    extract_brief,
)
from generate_market_analysis import report_bytes
from revenue import estimate_revenue
from market_data import market_data_from_result


app = FastAPI()
logger = logging.getLogger(__name__)
# Revenue lookups run beside review collection and Gemini instead of adding to them.
_background = ThreadPoolExecutor(max_workers=4)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class Candidate(BaseModel):
    name: str = ""
    developer: str = ""
    price: str = ""
    description: str = ""
    trackId: int | None = None
    genre: str = ""
    rating: float = 0
    ratingCount: int = 0
    appStoreUrl: str = ""
    artworkUrl: str = ""


class ExtractRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=MAX_IDEA_CHARS)


class SimilarityRequest(BaseModel):
    appIdea: str = Field(min_length=1, max_length=MAX_IDEA_CHARS)
    appName: str = ""
    # The founder may edit the extracted features before analysis, so check them here too.
    keyFeatures: list[Annotated[str, StringConstraints(max_length=MAX_FEATURE_CHARS)]] = Field(
        default_factory=list, max_length=MAX_FEATURES)
    targetAudience: str = ""
    competitors: list[Candidate]


class ReportRequest(BaseModel):
    # The /similarity response, echoed back by the client.
    result: dict
    # Differentiation ideas the founder ticked; empty means include them all.
    planned: list[int] = Field(default_factory=list)


@app.get("/health")
def health():
    # Render pings this; the embedding model is already loaded by import time.
    return {"status": "ok"}


@app.post("/extract")
def extract(request: ExtractRequest):
    # Gemini splits the one-message pitch into idea, features and audience.
    try:
        brief = extract_brief(request.prompt)
        status = "available"
    except Exception:
        logger.exception("Brief extraction failed")
        # Still rank on the raw pitch; the evidence grid will just be empty.
        brief = {
            "AppName": "",
            "Description": request.prompt.strip(),
            "Features": [],
            "Target_Audience": "",
            "features_inferred": False,
            "audience_inferred": False,
            "suggested_features": [],
        }
        status = "unavailable"

    return {
        "appName": brief["AppName"],
        "appIdea": brief["Description"],
        "keyFeatures": brief["Features"],
        "targetAudience": brief["Target_Audience"],
        "featuresInferred": brief["features_inferred"],
        "audienceInferred": brief["audience_inferred"],
        "suggestedFeatures": brief["suggested_features"],
        "status": status,
    }


@app.post("/similarity")
def similarity(request: SimilarityRequest):
    # Match the user dictionary expected by main.py and Gemini.
    user_input = {
        "AppName": request.appName,
        "Description": request.appIdea,
        "Features": [
            feature.strip()
            for feature in request.keyFeatures
            if feature.strip()
        ],
        "Target_Audience": request.targetAudience,
    }

    # Restore iTunes field names for the existing parser.
    itunes_data = {
        "results": [
            {
                "trackName": item.name,
                "artistName": item.developer,
                "formattedPrice": item.price,
                "description": item.description,
                "trackId": item.trackId,
                "primaryGenreName": item.genre,
                "averageUserRating": item.rating,
                "userRatingCount": item.ratingCount,
                "trackViewUrl": item.appStoreUrl,
                "artworkUrl100": item.artworkUrl,
            }
            for item in request.competitors
        ]
    }

    parsed = parse_itunes_data(itunes_data)
    candidate_count = len(parsed["apps"])

    if not parsed["apps"]:
        return {
            "idea": user_input,
            "results": [],
            "candidate_count": 0,
            "returned_count": 0,
            "feature_matrix": {"competitors": [], "rows": []},
            "reviews": {"apps": []},
            "review_status": "no_competitors",
            "analysis": None,
            "analysis_status": "no_competitors",
            "revenue": [],
            "revenue_status": "no_competitors",
        }

    # Score first. Every subsequent app_index uses this ranked order.
    embedded = embed_competitor_apps(parsed)
    top_five = cosine_similarity_score(user_input, embedded)

    # Compare each user feature with passages from those five listings.
    feature_matrix = build_feature_matrix(user_input, top_five, model)
    attach_feature_matches(top_five, feature_matrix)

    # Revenue estimates only need the ranked listings; start them now.
    revenue_job = _background.submit(estimate_revenue, top_five["apps"])

    # Gather up to five recent 1- or 2-star reviews per competitor.
    try:
        reviews = recent_negative_reviews(top_five)

        if (
            len(reviews["apps"]) != len(top_five["apps"])
            or any(
                app["AppName"] != group["AppName"]
                for app, group in zip(top_five["apps"], reviews["apps"])
            )
        ):
            raise ValueError("Reviews do not match the ranked apps")
    except Exception:
        logger.exception("Review collection failed")
        reviews = {
            "apps": [
                {
                    "AppName": app["AppName"],
                    "reviews": [],
                    "error": "Reviews unavailable",
                }
                for app in top_five["apps"]
            ]
        }

    # Gemini explains existing scores and evidence; it does not set scores.
    analysis = None
    analysis_status = "available"

    try:
        analysis = analyze_competitors(
            user_input, top_five, feature_matrix, reviews
        )
    except Exception:
        logger.exception("Gemini analysis failed")
        analysis_status = "unavailable"

    # Estimated from public store signals; a range, never a reported figure.
    try:
        revenue = revenue_job.result(timeout=60)
        revenue_status = "available" if any(r.get("status") == "available" for r in revenue) else "unavailable"
    except Exception:
        logger.exception("Revenue estimation failed")
        revenue = [{"status": "unavailable"} for _ in top_five["apps"]]
        revenue_status = "unavailable"

    return {
        "idea": user_input,
        "results": top_five["apps"],
        "candidate_count": candidate_count,
        "returned_count": len(top_five["apps"]),
        "feature_matrix": feature_matrix,
        "reviews": reviews,
        # "unavailable" means no feed loaded at all, so an empty
        # recommendations list is not mistaken for "no complaints".
        "review_status": (
            "unavailable"
            if all(group.get("error") for group in reviews["apps"])
            else "partial"
            if any(group.get("error") for group in reviews["apps"])
            else "available"
        ),
        "analysis": analysis,
        "analysis_status": analysis_status,
        # Same order as results.
        "revenue": revenue,
        "revenue_status": revenue_status,
    }


@app.post("/report")
def report(request: ReportRequest):
    try:
        data = market_data_from_result(request.result, request.planned)
    except (KeyError, TypeError, ValueError, IndexError) as error:
        raise HTTPException(status_code=422, detail=f"Not an analysis result: {error}") from error

    return Response(
        content=report_bytes(data),
        media_type=DOCX_MIME,
        headers={"Content-Disposition": 'attachment; filename="market_analysis.docx"'},
    )
