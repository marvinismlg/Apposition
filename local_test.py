"""Run the iTunes search, cleaning, and cosine ranking locally without .NET."""

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
BASE_DIR = PROJECT_ROOT / "AppositionBackend" / "CompetitorAnalysis"

sys.path.insert(0, str(BASE_DIR))

from AppositionBackend.CompetitorAnalysis.embedding import collect_user_idea
from AppositionBackend.CompetitorAnalysis.main import (
    parse_itunes_data,
    embed_competitor_apps,
    cosine_similarity_score,
)
STOP_WORDS = {
    "a", "an", "the", "app", "application", "idea", "that", "with",
    "for", "to", "and", "of", "is", "allows", "users",
}


def make_search_terms(user_input):
    # Shorten the idea for iTunes, then search every feature separately.
    words = re.findall(r"[^\W_]+", user_input["Description"], re.UNICODE)
    idea_term = " ".join(word for word in words
                         if word.casefold() not in STOP_WORDS).split()
    terms = [" ".join(idea_term[:5])]
    terms += [feature.strip() for feature in user_input["Features"]
              if isinstance(feature, str) and feature.strip()]
    terms = list({term.casefold(): term for term in terms if term}.values())
    if len(terms) > 10:
        raise ValueError("Use at most ten distinct iTunes search terms per request")
    return terms


def fetch_itunes(term):
    query = urllib.parse.urlencode({
        "term": term, "country": "us", "entity": "software", "limit": 10,
    })
    request = urllib.request.Request(
        f"https://itunes.apple.com/search?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        data = json.load(response)
    if not isinstance(data.get("results"), list):
        raise ValueError("iTunes did not return a results array")
    return data


def select_candidates(batches):
    # Mix results from different searches; deduplicate by Apple's app ID.
    selected, seen = [], set()
    skipped_empty, skipped_duplicate = 0, 0
    for rank in range(max((len(batch) for batch in batches), default=0)):
        for batch in batches:
            if len(selected) == 10:
                return selected, skipped_empty, skipped_duplicate
            if rank >= len(batch):
                continue
            app = batch[rank]
            app_id = app.get("trackId")
            if (app_id is None or not app.get("trackName") or
                    not app.get("description")):
                skipped_empty += 1
            elif app_id in seen:
                skipped_duplicate += 1
            else:
                seen.add(app_id)
                selected.append(app)
    return selected, skipped_empty, skipped_duplicate


def main():
    # Reuse the input() prompts already defined in embedding.py.
    user_input = collect_user_idea()
    terms = make_search_terms(user_input)
    searches, batches = [], []

    for term in terms:
        try:
            data = fetch_itunes(term)
            batches.append(data["results"])
            searches.append({"term": term, "resultCount": data.get("resultCount", 0),
                             "results": data["results"]})
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            searches.append({"term": term, "error": str(error), "results": []})

    candidates, skipped_empty, skipped_duplicate = select_candidates(batches)

    # Give main.py the same top-level JSON shape as the original iTunes file.
    # Keep every full search response in a separate file for inspection.
    raw_path = BASE_DIR / "itunes_test_raw.json"
    raw_payload = {"resultCount": len(candidates), "results": candidates}
    raw_path.write_text(json.dumps(raw_payload, indent=2, ensure_ascii=False),
                        encoding="utf-8")
    searches_path = BASE_DIR / "itunes_test_searches.json"
    searches_path.write_text(json.dumps(searches, indent=2, ensure_ascii=False),
                             encoding="utf-8")

    parsed = parse_itunes_data(str(raw_path))
    cleaned_apps = [app.copy() for app in parsed["apps"]]
    if parsed["apps"]:
        embedded = embed_competitor_apps(parsed)
        top_five = cosine_similarity_score(user_input, embedded)["apps"]
        all_scored = embedded["apps"]  # The engine sorts all ten in place.
    else:
        top_five, all_scored = [], []

    report = {
        "user_input": user_input,
        "searches": [{"term": item["term"],
                      "returned": len(item["results"]),
                      **({"error": item["error"]} if "error" in item else {})}
                     for item in searches],
        "candidate_count": len(candidates),
        "skipped_empty": skipped_empty,
        "skipped_duplicate": skipped_duplicate,
        "cleaned_apps": cleaned_apps,
        "all_scored_apps": all_scored,
        "top_five": top_five,
        "raw_json_file": str(raw_path),
        "search_responses_file": str(searches_path),
    }
    report_path = BASE_DIR / "itunes_test_results.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False),
                           encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nFull results saved to {report_path}")
    if not top_five:
        raise SystemExit("No usable apps found; check the search errors above.")


if __name__ == "__main__":
    main()
