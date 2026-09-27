# Apposition

**Know your competition before you build.**

Describe your app idea in one sentence. Apposition finds the closest apps already on the
App Store and tells you:

- **Who you're up against:** the 5 most similar apps, ranked.
- **Which of your features they already have:** checked against each app's own listing.
- **What their users hate:** recent 1- and 2-star reviews, turned into fixes you can build.
- **How to stand out:** gaps in the market and ideas to differentiate.
- **How much they make:** estimated monthly revenue for each competitor.

It all ends with a downloadable market analysis report (Word, with charts).

## How it works

1. Type your idea.
2. Check the features we pulled out, and add or remove any.
3. Get your competitor analysis in about a minute.

Rankings come from comparing your idea with App Store listings using an AI language
model. Gemini writes the explanations and suggestions, and every claim is checked against
real listing text or real reviews. Revenue figures are estimates from public App Store
data, shown as a range.

## Run it yourself

You need [Node.js](https://nodejs.org) 20+, the [.NET 10 SDK](https://dotnet.microsoft.com/download),
[Python](https://www.python.org/downloads/) 3.10+, and a free
[Gemini API key](https://aistudio.google.com/apikey) (optional).

```bash
git clone https://github.com/samdesire/Apposition.git
cd Apposition

# One-time setup
cd AppositionBackend/CompetitorAnalysis
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env.local        # then paste your Gemini key into .env.local
cd ../../AppositionFrontend && npm install && cd ..
```

Then start these three, each in its own terminal from the repo root:

```bash
cd AppositionBackend/CompetitorAnalysis && ./.venv/bin/uvicorn api:app --port 8000
cd AppositionBackend && dotnet run --launch-profile http
cd AppositionFrontend && npm run dev
```

Open **http://localhost:5173**.

- **No Gemini key?** It still works: add your features by hand, and you'll get everything
  except the AI-written summaries and suggestions.
- **Deploying:** see [DEPLOY.md](DEPLOY.md).
