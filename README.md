# Apposition

**Know your competition before you build.**

Apposition is a competitor research tool for startup founders. A user describes an app idea in plain English, and Apposition finds similar App Store products, compares features, analyzes negative reviews, estimates competitor revenue, and suggests ways to differentiate.

**Live Demo:** [apposition-gray.vercel.app](https://apposition-gray.vercel.app/)

## Built in 24 Hours

Apposition was ideated, developed, integrated, and deployed during a 24-hour hackathon.

I assembled a **team of four developers with different technical strengths**, so we structured the project around what each person could build best and fastest. That is why different parts of Apposition use different technologies: C# handles API communication and backend orchestration, Python handles NLP and data analysis, and the frontend focuses on presenting the results in a clear workflow.

The mixed stack was intentional. Instead of forcing every teammate into the same language or framework, we connected independently developed components through APIs and focused on getting each part working together reliably within the deadline.

We also used **agentic AI development tools** during frontend and UI/UX development to automate repetitive work such as component scaffolding, styling changes, debugging, and iteration. This helped us move faster while keeping the actual product flow and design decisions team-driven.

## Architecture

```text
React / TypeScript Frontend
          |
          v
     C# ASP.NET API
       /       \
      v         v
Apple iTunes   Python FastAPI
Search API     Analysis Service
                   |
        +----------+----------+
        |          |          |
   Embeddings   Gemini     Reviews
        |          |          |
        +----------+----------+
                   |
             DOCX + Charts
```

## C# / ASP.NET Backend

The main backend is written in **C# with ASP.NET Core**.

It acts as the orchestration layer between the frontend, Apple's App Store data, and the Python analysis service. The backend validates requests, makes API calls, organizes competitor data, and sends the final analysis back to the frontend.

Using C# `HttpClient`, Apposition queries Apple's **iTunes Search API** for information including:

- App name
- Developer
- Description
- Rating and rating count
- Price
- Genre
- App Store ID and URL

Rather than relying on one search, the backend searches using the founder's idea and extracted features, combines the results, removes duplicates, and sends the strongest candidates into the ranking pipeline.

## Python Analysis Service

A separate **Python FastAPI service** handles the heavier analysis.

Python is responsible for:

- Sentence embeddings
- Cosine similarity ranking
- Feature comparison
- Review collection
- Revenue estimation
- Gemini analysis
- Matplotlib charts
- Word report generation

Separating this work from the C# backend allowed us to use Python's NLP and data-analysis ecosystem without giving up a structured API layer.

## Semantic Competitor Ranking

Apposition uses the pretrained:

`all-MiniLM-L6-v2`

model from the **SentenceTransformers** library.

The founder's idea and each competitor's App Store listing are converted into numerical embeddings. We then calculate **cosine similarity** between those vectors and rank the most similar applications.

We chose a pretrained SentenceTransformer instead of training our own model because a custom model would require collecting data, labeling it, training, tuning, and validating it. Within a 24-hour hackathon, using an existing model let us focus on the actual competitor-analysis system.

The result is shown as a **similarity index**, not as a percentage of identical features.

## Feature Comparison

Apposition also compares each user-defined feature against individual passages from competitor App Store descriptions.

This creates a feature-by-competitor comparison showing whether a competitor:

- Clearly describes the same feature
- Has a related feature
- Does not establish that feature in its listing

Embeddings identify possible matches, but those matches are treated as candidates until the original App Store text is checked.

This helps the founder see not just which apps are similar, but **which parts of their idea are already common and which may offer room for differentiation**.

## Google Gemini API

We use the **Google Gemini API** to make the analysis easier to understand.

Gemini does not determine the competitor rankings. Those come from our embedding and cosine-similarity pipeline.

Instead, Gemini helps:

- Structure a founder's original idea
- Explain competitor rankings
- Interpret feature overlap
- Suggest differentiation strategies
- Turn negative reviews into readable product recommendations

We also validate Gemini's outputs against the source data. Feature evidence must exist in the real App Store description, and review quotes must match real reviews.

This keeps the AI focused on **explanation and interpretation rather than inventing the underlying analysis**.

## Review Mining

For each competitor, Apposition retrieves recent **1-star and 2-star App Store reviews**.

These reviews provide a useful source of data that the company's own product description cannot: what actual customers dislike about the product.

Apposition uses those reviews to identify complaints and turn them into possible product improvements. This helps founders answer:

> What are competitors doing poorly, and how could my product do it better?

## Revenue Estimation

Apposition estimates a competitor's monthly revenue range using public App Store signals such as:

- Rating volume
- Paid versus free status
- In-app purchases
- Top-grossing chart position
- App category

Because these are estimates rather than reported financial statements, the application displays ranges and confidence levels instead of presenting them as exact revenue.

## Downloadable Market Analysis

Apposition can turn the completed analysis into a downloadable **Word report**.

The Python service uses **`python-docx`** to build the report and **Matplotlib** to generate charts for:

- Competitor similarity
- Feature coverage
- Revenue estimates
- Market position

The charts are embedded directly into the generated `.docx` file and returned through the C# API.

We chose this approach instead of building accounts, databases, and saved dashboards during the hackathon. Users can simply download their analysis directly to their computer and keep it for later.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend API | C#, ASP.NET Core |
| Analysis API | Python, FastAPI |
| App data | Apple iTunes Search API |
| NLP | SentenceTransformers, `all-MiniLM-L6-v2` |
| Similarity | Cosine similarity |
| AI explanations | Google Gemini API |
| Reviews | Apple customer review feeds |
| Visualization | Matplotlib |
| Reports | `python-docx` |
| Frontend hosting | Vercel |
| Backend deployment | Docker / Render |
| Development workflow | Agentic AI tools for UI, debugging, and repetitive frontend tasks |

## Real-World Use

Founders can spend hours manually searching competitors, comparing App Store listings, reading reviews, and trying to determine whether their idea is actually different.

Apposition compresses that research into one workflow.

The goal is not to predict whether a startup will succeed. It helps founders answer a simpler question before spending weeks building:

**What already exists, what are users unhappy with, and where can my product actually stand out?**

Within 24 hours, our four-person team took that idea from initial concept to a working, hosted application.
