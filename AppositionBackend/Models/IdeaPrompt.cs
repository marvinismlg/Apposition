namespace AppositionBackend.Models;

// What the frontend sends: the founder's one-message pitch.
public class IdeaPrompt
{
    // Same limit as the UI and the Python request models; longer text is rejected, not cut.
    public const int MaxLength = 1000;

    // Match MAX_FEATURES / MAX_FEATURE_CHARS in gemini_api.py.
    public const int MaxFeatures = 8;
    public const int MaxFeatureLength = 80;

    public string Prompt { get; set; } = string.Empty;

    // The brief from POST /api/analysis/brief after the founder edited its
    // features. When absent, the pitch is extracted here instead.
    public IdeaBrief? Brief { get; set; }
}
