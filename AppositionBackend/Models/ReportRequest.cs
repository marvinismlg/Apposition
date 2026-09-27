using System.Text.Json;

namespace AppositionBackend.Models;

public class ReportRequest
{
    // The analysis result returned by POST /api/analysis, sent back unchanged.
    public JsonElement Result { get; set; }

    // Indices of the differentiation ideas the founder ticked.
    public List<int> Planned { get; set; } = [];
}
