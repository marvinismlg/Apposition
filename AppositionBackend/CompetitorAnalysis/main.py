# These are the imports we'll be using from the library
# DISCLAIMER. I take some notes when I code, it helps me track what i'm doing and why. I will leave them in the code for now, but they can be removed later if needed.

from filter_reviews import recent_negative_reviews
from gemini_api import analyze_competitors
from sentence_transformers import SentenceTransformer as st
from sentence_transformers import util
import json
from embedding import collect_user_idea
from feature_similarity_engine import build_feature_matrix, attach_feature_matches

model = st("all-MiniLM-L6-v2")

SCORE_BASIS = ("Cosine similarity between all-MiniLM-L6-v2 embeddings of the idea "
               "(name, description, features) and the listing (name, description). "
               "similarity_percentage is that cosine clamped to a 0-100 similarity index, "
               "not a probability or a percent of shared features.")


# We are using a dictionary to store the cleaned app information. Potentially, later we could use an OpenAI API create a similar dictionary on the user input side for more accurate scoring
# If we have time, we'll do this
def parse_itunes_data(source):
    if isinstance(source, dict):
        data = source
    else:
        with open(source, "r", encoding="utf-8") as file:
            data = json.load(file)

    apps = []
    for app in data["results"]:
        apps.append({
            "AppName": app.get("trackName", ""),
            "Developer": app.get("artistName", ""),
            "Price": app.get("formattedPrice", ""),
            "Description": app.get("description", ""),
            # Not embedded; carried through so reviews and the UI need no second lookup.
            "TrackId": app.get("trackId"),
            "Genre": app.get("primaryGenreName", ""),
            "Rating": app.get("averageUserRating") or 0,
            "RatingCount": app.get("userRatingCount") or 0,
            "AppStoreUrl": app.get("trackViewUrl", ""),
            "ArtworkUrl": app.get("artworkUrl100", "")})
    return {"apps": apps}


def embed_competitor_apps(parsed_data):
    apps = parsed_data["apps"]
    if not apps: # If there are no apps, we return the parsed_data as is, without attempting to embed anything.
        return parsed_data
    texts = [f"{app['AppName']}. {app['Description']}"for app in apps]
    embeddings = model.encode(texts, convert_to_tensor=True)
    for app, embedding in zip(apps, embeddings):
        app["embedding"] = embedding
    return parsed_data


# This function will calculate the cosine similarity score between the user input and the competitor app.
# We will likely do this by looping through each app in the parsed_data and comparing them to our user_input (which will also be a dictionary of similar structure)
def cosine_similarity_score(user_input, parsed_data):
    # We turn the user's input into a vector so
    # Include the name and description, just as we did for each competitor.
    # Features go in too, since listings describe what an app does.
    user_text = ". ".join(
    part for part in (
        user_input.get("AppName", ""),
        user_input.get("Description", ""),
        ", ".join(user_input.get("Features", [])))
    if part
)
    user_embedding = model.encode(user_text, convert_to_tensor=True)

    # Compare the user's vector with each app's vector.
    for app in parsed_data["apps"]:  # To do that, we gotta loop through each app in parsed_data
        score = util.cos_sim(user_embedding,app["embedding"]).item()

        # Store the original cosine score for sorting.
        app["similarity_score"] = round(score, 4)

        # Scale that score to a number from 0 to 100 for display.
        app["similarity_percentage"] = round(max(0, min(1, score)) * 100, 1)
        # Say what the numbers measure so no one reads them as feature overlap.
        app["score_basis"] = SCORE_BASIS

        # Remove the vector because it cannot go into the JSON response.
        del app["embedding"]

    # Put the most similar apps first.
    parsed_data["apps"].sort(key=lambda app: app["similarity_score"],reverse=True)
    # Return only the five highest-scoring apps.
    return {"apps": parsed_data["apps"][:5]}


# Now we need a function that our Gemini API will call to make the explanation of the similarity score.
def cleaned_gemini_records(user_input, recommendation_input):
    # This function takes the user input and the ranked results from the
    # cosine engine, then organizes them for Gemini to analyze.
    output_dict = {
        "user_input_description": user_input["Description"],
        "user_input_name": user_input["AppName"],
        "competitor_apps": [
            {
                "app_name": app["AppName"],
                "developer": app["Developer"],
                "price": app["Price"],
                "description": app["Description"],
                "similarity_score": app["similarity_score"],
                "similarity_percentage": app["similarity_percentage"]
            }   for app in recommendation_input["apps"]]
    }
    return output_dict

# Function flow control

if __name__ == "__main__":
    # Sample user input for testing. It uses the same fields as an app record.
# Controller

    parsed_data = parse_itunes_data("competitor_app_responses.json")
    embedded_data = embed_competitor_apps(parsed_data)
    user_input = collect_user_idea()
    top_five = cosine_similarity_score(user_input, embedded_data)
    feature_matrix = build_feature_matrix(user_input, top_five, model)
    review_data = recent_negative_reviews(top_five)
    gemini_analysis = analyze_competitors(
    user_input, top_five, feature_matrix, review_data
    )
    top_five = attach_feature_matches(top_five, feature_matrix)
    gemini_records = cleaned_gemini_records(user_input, top_five)

    print(json.dumps(gemini_records, indent=2))