using System.Text.Json;
using System.Text.RegularExpressions;
using System.Linq;
using AppositionBackend.Models;

namespace AppositionBackend.Services;

public class ItunesService
{
    private readonly HttpClient _httpClient;

    public ItunesService(HttpClient httpClient) => _httpClient = httpClient;

    public async Task<List<Competitor>> Search(IdeaBrief brief)
    {
        // Apple searches short terms more reliably than a full app pitch.
        var ignored = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "a", "an", "the", "app", "application", "idea", "that",
            "with", "for", "to", "and", "of", "is", "allows", "users"
        };
        var ideaTerm = string.Join(" ", Regex.Matches(
                brief.AppIdea ?? "", @"[\p{L}\p{N}]+")
            .Cast<Match>()
            .Select(match => match.Value)
            .Where(word => !ignored.Contains(word))
            .Take(5));

        // Keep to ten searches per request; the idea term comes first.
        var terms = new[] { ideaTerm }
            .Concat(brief.KeyFeatures ?? [])
            .Select(term => term?.Trim() ?? "")
            .Where(term => !string.IsNullOrWhiteSpace(term))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(10)
            .ToList();

        var batches = new List<List<ItunesApp>>();

        foreach (var term in terms)
        {
            var url =
                $"https://itunes.apple.com/search" +
                $"?term={Uri.EscapeDataString(term)}" +
                $"&country=us&entity=software&limit=10";

            try
            {
                using var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<ItunesResponse>(
                    json,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                batches.Add(result?.Results ?? []);
            }
            catch (Exception error) when (
                error is HttpRequestException or TaskCanceledException or JsonException)
            {
                // One failed search should not sink the others.
                batches.Add([]);
            }
        }

        // Take results across searches, keeping at most ten distinct app IDs.
        var competitors = new List<Competitor>();
        var seenIds = new HashSet<long>();

        for (var rank = 0; rank < 10 && competitors.Count < 10; rank++)
        {
            foreach (var batch in batches)
            {
                if (competitors.Count == 10) break;
                if (rank >= batch.Count) continue;

                var app = batch[rank];

                if (app.TrackId is not long id ||
                    string.IsNullOrWhiteSpace(app.TrackName) ||
                    string.IsNullOrWhiteSpace(app.Description) ||
                    !seenIds.Add(id))
                {
                    continue;
                }

                competitors.Add(new Competitor
                {
                    TrackId = id,
                    Name = app.TrackName,
                    Developer = app.ArtistName ?? "",
                    Price = app.FormattedPrice ?? "",
                    Description = app.Description,
                    Genre = app.PrimaryGenreName ?? "",
                    Rating = app.AverageUserRating ?? 0,
                    RatingCount = app.UserRatingCount ?? 0,
                    AppStoreUrl = app.TrackViewUrl ?? "",
                    ArtworkUrl = app.ArtworkUrl100 ?? ""
                });
            }
        }

        return competitors;
    }
}

public class ItunesResponse
{
    public int ResultCount { get; set; }
    public List<ItunesApp> Results { get; set; } = [];
}

public class ItunesApp
{
    public long? TrackId { get; set; }
    public string? TrackName { get; set; }
    public string? ArtistName { get; set; }
    public string? FormattedPrice { get; set; }
    public string? Description { get; set; }
    public string? PrimaryGenreName { get; set; }
    public double? AverageUserRating { get; set; }
    public int? UserRatingCount { get; set; }
    public string? TrackViewUrl { get; set; }
    public string? ArtworkUrl100 { get; set; }
}