import argparse
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from charts import feature_coverage_chart, market_position_chart, revenue_chart, similarity_chart
from market_data import load_market_data


FONT = "Calibri"

SYMBOLS = {"supported": "S", "related": "R", "candidate": "C", "not_established": "?"}


def _soft_borders(table):
    """Apply subtle gray borders to every cell in a table."""
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)

    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        border = borders.find(tag)
        if border is None:
            border = OxmlElement(f"w:{edge}")
            borders.append(border)
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "D9E2F3")


def _bold_header(table):
    for cell in table.rows[0].cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True


def _money(value):
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if value >= size:
            return "$" + f"{value / size:.1f}".rstrip("0").rstrip(".") + suffix
    return f"${value:,.0f}"


def _add_chart(doc, png, caption):
    # Charts are skipped when a run has nothing to plot (for example, no ratings).
    if png:
        doc.add_picture(BytesIO(png), width=Inches(6.2))
        doc.add_paragraph(caption).runs[0].italic = True


def build_document(data):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = section.bottom_margin = Inches(0.62)
    section.left_margin = section.right_margin = Inches(0.72)

    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = FONT, Pt(10)
    normal.paragraph_format.space_after = Pt(3)
    normal.paragraph_format.line_spacing = 1.04
    for style_name, size in (("Title", 20), ("Heading 1", 13), ("Heading 2", 11)):
        style = doc.styles[style_name]
        style.font.name, style.font.size = FONT, Pt(size)
        style.font.bold, style.font.color.rgb = True, RGBColor(0, 0, 0)
        style.paragraph_format.space_after = Pt(3)
        # Word's stock Title style may carry a blue bottom rule.
        if style.element.pPr is not None:
            for border in style.element.pPr.findall(qn("w:pBdr")):
                style.element.pPr.remove(border)
    example = data.get("example", False)
    doc.core_properties.title = "Market Analysis Example" if example else "Market Analysis"

    title = doc.add_paragraph(style="Title")
    title.add_run("Market Analysis Example" if example else "Market Analysis")
    idea = data["idea"]
    subtitle = idea.get("AppName") or idea.get("Description") or "App idea"
    doc.add_paragraph(f"App idea  {subtitle[:110]}  |  {len(data['apps'])} ranked competitors")
    if example:
        doc.add_paragraph("Illustrative example. Similarity values and recommendations below are sample data, not results from a live run.")

    doc.add_heading("Your idea", level=1)
    doc.add_paragraph(idea.get("Description", ""))
    if idea.get("Features"):
        doc.add_paragraph("Features: " + "; ".join(idea["Features"]))
    if idea.get("Target_Audience"):
        doc.add_paragraph(f"Target audience: {idea['Target_Audience']}")

    doc.add_heading("Overview", level=1)
    doc.add_paragraph(
        data["overall_summary"]
        or "Gemini analysis was unavailable for this run. The ranking and feature "
           "candidates below come from sentence embeddings only and are unverified."
    )

    doc.add_heading("Closest competitors", level=1)
    table = doc.add_table(rows=1, cols=5)
    table.style = "Table Grid"
    _soft_borders(table)
    for cell, name in zip(table.rows[0].cells,
                          ("No.", "Application", "Developer", "Similarity index", "Price")):
        cell.text = name
    for index, app in enumerate(data["apps"], 1):
        cells = table.add_row().cells
        for cell, value in zip(cells, (str(index), app["name"], app["developer"],
                                       f"{app['index']:.1f} / 100", app["price"])):
            cell.text = value
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    _bold_header(table)
    doc.add_paragraph("Similarity indices rank listing text; they are not percentages of shared features.")
    _add_chart(doc, similarity_chart(data),
               "Figure 1. Similarity index of the five closest App Store listings.")
    for i, app in enumerate(data["apps"]):
        explanation = data["competitor_summaries"].get(i)
        if explanation:
            paragraph = doc.add_paragraph(style="Normal")
            paragraph.add_run(f"{i + 1}. {app['name']}: ").bold = True
            paragraph.add_run(explanation)

    doc.add_heading("Market position", level=1)
    _add_chart(doc, market_position_chart(data),
               "Figure 2. Average rating against number of ratings. Right means more "
               "established; high means better liked.")
    if not any(app.get("rating_count") for app in data["apps"]):
        doc.add_paragraph("Not enough rating data to plot market position.")

    estimates = [(i, app) for i, app in enumerate(data["apps"], 1) if app.get("revenue")]
    if any(app["revenue"].get("status") in ("available", "no_store_revenue") for _, app in estimates):
        doc.add_heading("Estimated revenue", level=1)
        doc.add_paragraph(
            "Monthly revenue before Apple/Google fees, estimated from public App Store ratings and "
            "top-grossing chart positions, not from reported figures. In testing on apps with known "
            "revenue, the likely range held about 3 in 4 times for established apps (medium "
            "confidence) and 2 in 3 times for small apps (low confidence).")
        table = doc.add_table(rows=1, cols=5)
        table.style = "Table Grid"
        _soft_borders(table)
        for cell, name in zip(table.rows[0].cells, ("No.", "Application", "Estimate", "Likely range", "Confidence")):
            cell.text = name
        for i, app in estimates:
            rev = app["revenue"]
            if rev.get("status") == "available":
                values = (str(i), app["name"], f"~{_money(rev['estimate'])}/mo",
                          f"{_money(rev['likely'][0])}–{_money(rev['likely'][1])}", rev["confidence"])
            elif rev.get("status") == "no_store_revenue":
                values = (str(i), app["name"], "None", "Free, no in-app purchases", "—")
            else:
                values = (str(i), app["name"], "Unavailable", "—", "—")
            cells = table.add_row().cells
            for cell, value in zip(cells, values):
                cell.text = value
        _bold_header(table)
        _add_chart(doc, revenue_chart(data),
                   "Figure 3. Estimated monthly revenue: likely range and estimate per competitor.")

    if data["feature_ranking"]:
        doc.add_heading("Feature uniqueness", level=1)
        doc.add_paragraph("Your features ranked from most to least unique, by how many of the "
                          "ranked competitors' listings describe each one.")
        ranking = doc.add_table(rows=1, cols=4)
        ranking.style = "Table Grid"
        _soft_borders(ranking)
        for cell, name in zip(ranking.rows[0].cells, ("Rank", "Your feature", "Described", "Related")):
            cell.text = name
        for rank, item in enumerate(data["feature_ranking"], 1):
            cells = ranking.add_row().cells
            for cell, value in zip(cells, (str(rank), item["feature"],
                                           f"{item['described']} of {item['apps']}",
                                           f"{item['related']} of {item['apps']}")):
                cell.text = value
        _bold_header(ranking)
        _add_chart(doc, feature_coverage_chart(data),
                   "Figure 4. How many competitors describe each of your features, "
                   "most unique first.")

    if data["feature_comparison"]:
        doc.add_heading("Feature comparison", level=1)
        doc.add_paragraph("S = described in listing   R = related capability   "
                          "C = unverified embedding candidate   ? = not established by listing")
        grid = doc.add_table(rows=1, cols=1 + len(data["apps"]))
        grid.style = "Table Grid"
        _soft_borders(grid)
        for cell, value in zip(grid.rows[0].cells,
                               ["Your feature"] + [str(i) for i in range(1, len(data["apps"]) + 1)]):
            cell.text = value
        for row in data["feature_comparison"][:8]:
            cells = grid.add_row().cells
            cells[0].text = row["feature"][:72]
            for index in range(len(data["apps"])):
                cells[index + 1].text = SYMBOLS[row["cells"][index]["verdict"]]
                for paragraph in cells[index + 1].paragraphs:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _bold_header(grid)
        doc.add_paragraph("The numbers correspond to the competitors listed above.")

        doc.add_heading("Listing evidence", level=2)
        for row in data["feature_comparison"][:8]:
            for index, cell in enumerate(row["cells"]):
                if cell["evidence"]:
                    paragraph = doc.add_paragraph(style="Normal")
                    paragraph.add_run(f"{row['feature']} · {data['apps'][index]['name']}: ").bold = True
                    paragraph.add_run(f"“{cell['evidence']}”").italic = True

    if data["differentiation"]:
        doc.add_heading("Ways to differentiate", level=1)
        for item in data["differentiation"]:
            doc.add_heading(item["idea"].strip(), level=2)
            doc.add_paragraph(item["rationale"].strip())

    doc.add_heading("Improvements from negative reviews", level=1)
    if data["review_improvements"]:
        for item in data["review_improvements"]:
            doc.add_heading(item["complaint"].strip(), level=2)
            doc.add_paragraph(item["recommendation"].strip())
            for ref in item["review_refs"]:
                # Gemini's references were validated against these same review lists.
                groups = data["reviews"]
                reviews = groups[ref["app_index"]]["reviews"] if ref["app_index"] < len(groups) else []
                if ref["review_index"] < len(reviews):
                    review = reviews[ref["review_index"]]
                    paragraph = doc.add_paragraph(style="Normal")
                    paragraph.add_run(f"{data['apps'][ref['app_index']]['name']}, {review['rating']}★: ").bold = True
                    # The quote was checked word for word against this review.
                    paragraph.add_run(f"“{ref.get('quote') or review['title']}”").italic = True
    elif data["review_status"] == "unavailable":
        doc.add_paragraph("Competitor review feeds could not be loaded for this run, so no "
                          "review-backed improvements are given.")
    else:
        doc.add_paragraph("No review-backed improvements for this run. The recent 1- and 2-star "
                          "reviews held no complaint Gemini could cite word for word.")

    return doc


def make_report(data, output_path):
    output_path = Path(output_path)
    build_document(data).save(output_path)
    return output_path


def report_bytes(data):
    # For HTTP responses: the browser saves the file, not the server.
    buffer = BytesIO()
    build_document(data).save(buffer)
    return buffer.getvalue()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Write a market analysis .docx from a saved run.")
    parser.add_argument("engine", help="itunes_test_results.json or a saved /similarity response")
    parser.add_argument("--gemini", help="Saved analyze_competitors() JSON")
    parser.add_argument("--reviews", help="Saved recent_negative_reviews() JSON")
    parser.add_argument("--out", default="market_analysis.docx")
    args = parser.parse_args()
    path = make_report(load_market_data(args.engine, args.gemini, args.reviews), args.out)
    print(f"Saved {path}")
