
import json
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

# Originally this API was in Typescript, but it was easier to implement in Python because of the XML parsing and HTTP requests.
Atom = "{http://www.w3.org/2005/Atom}"
ITUNES = "{http://itunes.apple.com/rss}"


# We'll likely need to use a webhook to get the user input from the frontend, but for now we'll just use a function to collect it from the command line.
def _fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return response.read()


def _find_app_id(app, country): # Might add an "_" later to indicate that this is a private function, but for now we'll leave it as is. It will be used to find the app ID for each competitor app so that we can fetch their reviews.
    # Search using the app name supplied by similarity_engine
    name = app["AppName"].strip()
    query = urllib.parse.urlencode({
        "term": name, "country": country, "entity": "software", "limit": 50})
    results = json.loads(_fetch(f"https://itunes.apple.com/search?{query}"))["results"]
    matches = [item for item in results
               if item.get("trackName", "").casefold() == name.casefold()]
    # Avoid attaching reviews from a different app with the same name.
    developer = app.get("Developer", "").strip().casefold()
    if developer:
        matches = [item for item in matches if developer in {
            item.get("artistName", "").casefold(),
            item.get("sellerName", "").casefold(),}]
    if len(matches) != 1:
        raise ValueError(
            f"Expected one exact App Store match for {name!r}; found {len(matches)}")
    return matches[0]["trackId"]

# Next, we'll prolly need to get the reviews themselves for each comepetitor. app
def _app_reviews(app, country, per_app, max_pages):
    result = {"AppName": app["AppName"], "reviews": []}
    try:
        # The ranked app already carries Apple's ID; only search by name as a fallback.
        app_id = app.get("TrackId") or _find_app_id(app, country)
        result["AppId"] = app_id
        for page in range(1, max_pages + 1): # We gotta loop through the pages of reviews because the API only returns a limited number of reviews per page. We will stop when we reach the maximum number of pages or when we have enough reviews.
            url = (f"https://itunes.apple.com/{country}/rss/customerreviews/"f"page={page}/id={app_id}/sortby=mostrecent/xml")
            try:
                feed = ET.fromstring(_fetch(url))
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    break
                raise
            entries = feed.findall(f"{Atom}entry")
            if not entries:
                break
            for entry in entries:
                rating = entry.findtext(f"{ITUNES}rating")
                if rating not in ("1", "2"):
                    continue
                result["reviews"].append({
                    "rating": int(rating),
                    "title": entry.findtext(f"{Atom}title", default=""),
                    "text": entry.findtext(f"{Atom}content", default=""),
                    "updated": entry.findtext(f"{Atom}updated", default=""),})
            if len(result["reviews"]) >= per_app: # We create this limit so that we don't fetch too many pages of reviews if the app has a lot of negative reviews. We only want the most recent ones.
                break
        result["reviews"].sort(key=lambda review: review["updated"], reverse=True) # Using the lambda function to sort the reviews by the "updated" field in descending order, so that the most recent reviews come first.
        result["reviews"] = result["reviews"][:per_app]
    except (ValueError, KeyError, urllib.error.URLError, TimeoutError, ET.ParseError) as error:
        result["error"] = str(error)
    return result


def recent_negative_reviews(competitor_data, country="us", per_app=5, max_pages=10):
    """Return each app's newest available reviews rated below 3 stars."""
    apps = competitor_data["apps"]
    if not apps:
        return {"apps": []}
    # Apps are independent, so fetch them side by side; map() keeps the ranked order.
    with ThreadPoolExecutor(max_workers=len(apps)) as pool:
        groups = pool.map(lambda app: _app_reviews(app, country, per_app, max_pages), apps)
        return {"apps": list(groups)}
