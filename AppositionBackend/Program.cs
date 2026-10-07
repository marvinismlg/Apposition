using Scalar.AspNetCore;
using AppositionBackend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddHttpClient<ItunesService>();

// Vercel injects the private analysis service's base URL through a service binding.
// Locally it defaults to localhost:8000 (a bare host:port also works).
var pythonApiUrl = builder.Configuration["PythonApiUrl"];
if (string.IsNullOrWhiteSpace(pythonApiUrl))
{
    if (builder.Configuration["VERCEL"] == "1")
        throw new InvalidOperationException("The PythonApiUrl service binding is missing. Check the root vercel.json.");

    pythonApiUrl = "http://localhost:8000";
}
if (!pythonApiUrl.Contains("://"))
    pythonApiUrl = $"http://{pythonApiUrl}";

builder.Services.AddHttpClient<PythonService>(client =>
{
    // Keep a binding's path prefix when resolving relative endpoint paths.
    client.BaseAddress = new Uri(pythonApiUrl.TrimEnd('/') + "/");
    // Embedding, five review feeds and two Gemini calls can outlast the 100 s default.
    client.Timeout = TimeSpan.FromMinutes(3);
});


// Vercel serves the frontend and API from the same origin. Keep the existing
// CORS policy for local development and direct API clients.
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

// Vercel terminates HTTPS before forwarding HTTP to the container.
if (app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseCors();

// Public API health check; the Python service has its own private /health endpoint.
app.MapGet("/health", () => Results.Ok("ok"));

app.MapControllers();

app.Run();
