#Build a feature-by-competitor evidence grid from App Store descriptions.

#This module reuses the model already loaded by similarity_engine.py. It does
#not reuse whole-description embeddings: each description passage needs its own

#embedding to serve as evidence for an individual feature.

import re
from sentence_transformers import util


def split_description(description):
    # sHORT readable passages linked to the existing description
    # App Store descriptions often use line breaks and bullets for features.
    sections = re.split(r"[\r\n]+|[•●▪]+", description or "")
    passages = []

    for section in sections:
        # Split prose into sentences; compare sentences, never individual words.
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", section):
            passage = " ".join(sentence.split()).strip(" -–\t")  # Remove the whitespace
            if passage:  # Only keeps the non-empty passages. We don't want to compare empty strings.
                passages.append(passage)

    return passages


def build_feature_matrix(user_input, competitor_data, model, top_k=2,candidate_threshold=0.55):
    if top_k < 1:
        raise ValueError("top_k must be at least 1")

    features = [feature.strip() for feature in user_input["Features"]
                if isinstance(feature, str) and feature.strip()]
    apps = competitor_data["apps"]
    app_passages = [split_description(app.get("Description", "")) for app in apps]

    # Flatten once so model.encode runs in batches, not inside nested loops.
    passages = [passage for group in app_passages for passage in group]
    if not features or not apps:
        return {"competitors": [app.get("AppName", "") for app in apps],
                "rows": [], "candidate_threshold": candidate_threshold}

    scores = None # we will only compute the scores if there are passages to compare against
    if passages:
        feature_vectors = model.encode(features, convert_to_tensor=True)
        passage_vectors = model.encode(passages, convert_to_tensor=True)
        # One matrix: row = user feature, column = original source passage.
        scores = util.cos_sim(feature_vectors, passage_vectors)

    rows = [{"feature": feature, "cells": []} for feature in features]
    offset = 0
    for app_index, (app, group) in enumerate(zip(apps, app_passages)):
        for feature_index, row in enumerate(rows):
            evidence = []
            if group:
                passage_scores = scores[feature_index, offset:offset + len(group)]
                values, indices = passage_scores.topk(min(top_k, len(group)))
                evidence = [{"passage": group[index], "cosine_score": round(float(value), 4)}
            for value, index in zip(values.tolist(), indices.tolist())]
            highest_score = evidence[0]["cosine_score"] if evidence else None # The "best score" is the highest cosine similarity score for this feature against the passages of this app.
            row["cells"].append({
                "app_index": app_index,
                "app_name": app.get("AppName", ""),
                "highest_score": highest_score,
                "candidate_match": highest_score is not None and highest_score >= candidate_threshold,
                "evidence": evidence,})
        offset += len(group)

    # Candidate matches are unverified. Have Gemini inspect the text passages
    # before saying an app truly contains a feature or counting "8 out of 10".
    for row in rows:
        row["candidate_count"] = sum(cell["candidate_match"] for cell in row["cells"])

    return {
        "competitors": [app.get("AppName", "") for app in apps],
        "rows": rows,
        "candidate_threshold": candidate_threshold,}

def attach_feature_matches(competitor_data, matrix):
    # Each entry links a user's feature to evidence from this competitor.
    # These are candidates, not confirmed competitor features.
    apps = competitor_data["apps"]

    for app in apps:
        app["features"] = []

    for row in matrix["rows"]:
        for cell in row["cells"]:
            apps[cell["app_index"]]["features"].append({
                "name": row["feature"],
                "candidate_match": cell["candidate_match"],
                "score": cell["highest_score"],
                "evidence": cell["evidence"],
            })

    return competitor_data