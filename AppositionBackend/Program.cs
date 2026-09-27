using Scalar.AspNetCore;
using AppositionBackend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddHttpClient<ItunesService>();

// Where the Python analysis API lives. Locally it's localhost:8000; on Render
// the blueprint sets PythonApiUrl to the Python service's URL (a bare host:port also works).
var pythonApiUrl = builder.Configuration["PythonApiUrl"] ?? "http://localhost:8000";
if (!pythonApiUrl.Contains("://"))
    pythonApiUrl = $"http://{pythonApiUrl}";

builder.Services.AddHttpClient<PythonService>(client =>
{
    client.BaseAddress = new Uri(pythonApiUrl);
    // Embedding, five review feeds and two Gemini calls can outlast the 100 s default.
    client.Timeout = TimeSpan.FromMinutes(3);
});


// The deployed frontend (e.g. on Vercel) calls this API from another origin.
// AllowedOrigins is a comma-separated list; the Vite dev server is always allowed.
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Append("http://localhost:5173")
    .ToArray();

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().WithMethods("POST")));

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();

    app.MapGet("/", () => Results.Redirect("/scalar/v1"));
}

app.UseHttpsRedirection();

app.UseCors();

// Render pings this to know the service is up.
app.MapGet("/health", () => Results.Ok("ok"));

app.MapControllers();

app.Run();
