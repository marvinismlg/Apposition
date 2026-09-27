"""Streamlit dashboard for a saved Apposition engine run and Gemini analysis."""

from pathlib import Path

import streamlit as st

from generate_market_analysis import report_bytes
from market_data import load_market_data


st.set_page_config(page_title="Market Insights", page_icon="📊", layout="wide")
st.title("Market Insights")
st.caption("App Store competitor descriptions, feature evidence, and Gemini analysis")

# local_test.py saves its run files beside this module.
DEFAULT_DIR = Path(__file__).resolve().parent

with st.sidebar:
    st.header("Run files")
    engine_path = st.text_input("Engine results", str(DEFAULT_DIR / "itunes_test_results.json"))
    gemini_path = st.text_input("Gemini analysis", str(DEFAULT_DIR / "gemini_analysis.json"))
    review_path = st.text_input("Negative reviews (optional)", "")

try:
    data = load_market_data(engine_path,
                            gemini_path if Path(gemini_path).is_file() else None,
                            review_path if review_path else None)
except (OSError, ValueError, KeyError, TypeError) as error:
    st.error(f"Cannot load this run: {error}")
    st.stop()

idea = data["idea"]
st.subheader(idea.get("AppName") or idea.get("Description") or "Your app idea")
st.caption("Similarity indices rank listing evidence; they are not percentages of shared features.")

a, b, c = st.columns(3)
a.metric("Ranked competitors", len(data["apps"]))
b.metric("Candidates checked", data["candidate_count"] or "Unknown")
c.metric("Search term source", data["query_source"].title())

if data["overall_summary"]:
    st.info(data["overall_summary"])
    # Give the browser the generated document so users can save it locally.
    st.download_button(
        "Download market analysis",
        data=report_bytes(data),
        file_name="market_analysis.docx",
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
else:
    st.info("Gemini analysis not loaded. Add its JSON file in the sidebar for feature verdicts and recommendations.")

rankings, features, opportunities = st.tabs(("Competitors", "Feature comparison", "Opportunities"))

with rankings:
    st.subheader("Closest app listings")
    st.bar_chart(
        [{"App": app["name"], "Similarity index": app["index"]} for app in data["apps"]],
        x="App", y="Similarity index", horizontal=True,
        x_label="Similarity index (0–100)",
    )
    for index, app in enumerate(data["apps"]):
        with st.expander(f"{index + 1}. {app['name']}  ·  {app['index']:.1f} / 100  ·  {app['price']}"):
            st.write(data["competitor_summaries"].get(index, "No Gemini explanation for this app."))
            st.caption(f"Developer: {app['developer'] or 'Unknown'}")
            st.caption(f"Score basis: {app['score_basis']}")

with features:
    if not data["feature_comparison"]:
        st.info("Feature verdicts require the saved Gemini analysis JSON.")
    else:
        symbols = {"supported": "Supported", "related": "Related",
                   "candidate": "Unverified candidate", "not_established": "Not established"}
        rows = []
        for row in data["feature_comparison"]:
            rows.append({"Your feature": row["feature"], **{
                app["name"]: symbols[row["cells"][index]["verdict"]]
                for index, app in enumerate(data["apps"])
            }})
        st.dataframe(rows, hide_index=True, use_container_width=True)
        feature = st.selectbox("Inspect listing evidence", [row["feature"] for row in data["feature_comparison"]])
        selected = next(row for row in data["feature_comparison"] if row["feature"] == feature)
        for index, app in enumerate(data["apps"]):
            cell = selected["cells"][index]
            st.markdown(f"**{app['name']} — {symbols[cell['verdict']]}**")
            st.caption(cell["evidence"] or "The supplied listing does not establish this feature.")

with opportunities:
    st.subheader("Ways to differentiate")
    if data["differentiation"]:
        for item in data["differentiation"]:
            st.markdown(f"**{item['idea']}** — {item['rationale']}")
    else:
        st.info("No Gemini recommendations loaded.")

    st.subheader("Negative review signals")
    st.caption(data["review_status"])
    for item in data["review_improvements"]:
        st.markdown(f"**{item['complaint']}** — {item['recommendation']}")
        st.caption("Review references: " + ", ".join(
            f"{data['apps'][ref['app_index']]['name']} review {ref['review_index'] + 1}"
            for ref in item["review_refs"]
        ))
