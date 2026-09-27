using System.Net.Http.Json;
using System.Linq;
using System.Text.Json;
using AppositionBackend.Models;

namespace AppositionBackend.Services;

public class PythonService
{
    private readonly HttpClient _httpClient;

    public PythonService(HttpClient httpClient) => _httpClient = httpClient;

    // Gemini splits the pitch into idea, features and audience.
    public async Task<IdeaBrief> ExtractBrief(string prompt)
    {
        using var response = await _httpClient.PostAsJsonAsync(
            "/extract",
            new { prompt });

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IdeaBrief>()
            ?? throw new InvalidOperationException("Python returned no brief.");
    }

    // Ranking, feature evidence, reviews and Gemini analysis. The result is
    // passed through untouched so no field is lost between Python and the UI.
    public async Task<JsonElement> Analyze(
        IdeaBrief brief,
        List<Competitor> competitors)
    {
        var pythonRequest = new
        {
            appName = brief.AppName,
            appIdea = brief.AppIdea,
            keyFeatures = brief.KeyFeatures,
            targetAudience = brief.TargetAudience,
            competitors = competitors.Select(app => new
            {
                name = app.Name,
                developer = app.Developer,
                price = app.Price,
                description = app.Description,
                trackId = app.TrackId,
                genre = app.Genre,
                rating = app.Rating,
                ratingCount = app.RatingCount,
                appStoreUrl = app.AppStoreUrl,
                artworkUrl = app.ArtworkUrl
            }).ToList()
        };

        using var response = await _httpClient.PostAsJsonAsync(
            "/similarity",
            pythonRequest);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    public async Task<byte[]> BuildReport(ReportRequest request)
    {
        using var response = await _httpClient.PostAsJsonAsync(
            "/report",
            new { result = request.Result, planned = request.Planned });

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsByteArrayAsync();
    }
}
