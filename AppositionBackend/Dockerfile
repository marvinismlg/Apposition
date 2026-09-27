# C# backend (ASP.NET): orchestrates iTunes search and the Python analysis API.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY AppositionBackend.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish AppositionBackend.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_ENVIRONMENT=Production

# Render sets PORT. PythonApiUrl and AllowedOrigins come from environment variables.
CMD ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet AppositionBackend.dll"]
