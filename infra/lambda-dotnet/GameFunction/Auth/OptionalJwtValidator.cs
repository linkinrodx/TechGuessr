using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace GameFunction.Auth;

/// <summary>
/// Identidad resuelta a partir de un JWT de Cognito, o "invitado" si no
/// había token (o era inválido). Reemplaza la validación implícita que
/// antes hacía el JWT authorizer de API Gateway en las rutas de sesión:
/// esas rutas ahora son públicas a nivel de API Gateway (ver
/// infra/lib/api-stack.ts) para permitir jugar sin cuenta, y esta clase es
/// la que decide si el jugador está autenticado o no.
/// </summary>
public sealed record CallerIdentity(bool IsAuthenticated, string UserId, string? Username)
{
    /// <summary>
    /// UserId estable para invitados: no se persiste ninguna sesión de
    /// invitado más allá de la partida en curso, y las sesiones de
    /// invitado nunca se guardan en el leaderboard (ver Function.cs,
    /// llamadas a RecordScoreAsync condicionadas a IsAuthenticated).
    /// </summary>
    public const string GuestUserId = "guest";

    public static CallerIdentity Guest() => new(false, GuestUserId, null);
}

/// <summary>
/// Valida (de forma opcional) el JWT de Cognito adjunto en el header
/// Authorization. A diferencia del HttpJwtAuthorizer de API Gateway (que
/// rechaza la request entera si el token falta o es inválido), este
/// validador deja pasar la request sin token como invitado: solo rechaza
/// tokens presentes pero inválidos (firma incorrecta, expirado, audiencia
/// equivocada), tratando esos casos igual que "sin token" en vez de como
/// error 401, porque el llamador pudo simplemente tener una sesión vencida
/// y no debería bloquear el modo invitado.
///
/// Las claves públicas (JWKS) del User Pool se cachean en memoria del
/// proceso Lambda (OpenIdConnectConfigurationRetriever ya cachea
/// internamente vía ConfigurationManager) para no pagar una llamada HTTP
/// por invocación.
/// </summary>
public sealed class OptionalJwtValidator
{
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _configManager;
    private readonly string _issuer;
    private readonly string _audience;

    public OptionalJwtValidator(string userPoolId, string region, string clientId)
    {
        _issuer = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";
        _audience = clientId;

        _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{_issuer}/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever());
    }

    /// <summary>
    /// Extrae y valida el JWT del header Authorization ("Bearer &lt;token&gt;").
    /// Nunca lanza: cualquier ausencia o problema con el token resuelve en
    /// CallerIdentity.Guest().
    /// </summary>
    public async Task<CallerIdentity> ResolveAsync(string? authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader))
        {
            return CallerIdentity.Guest();
        }

        const string bearerPrefix = "Bearer ";
        var token = authorizationHeader.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase)
            ? authorizationHeader[bearerPrefix.Length..].Trim()
            : authorizationHeader.Trim();

        if (string.IsNullOrWhiteSpace(token))
        {
            return CallerIdentity.Guest();
        }

        try
        {
            var config = await _configManager.GetConfigurationAsync();

            var validationParameters = new TokenValidationParameters
            {
                ValidIssuer = _issuer,
                ValidAudience = _audience,
                IssuerSigningKeys = config.SigningKeys,
                ValidateIssuer = true,
                // Cognito ID tokens no llevan la audiencia esperada en
                // "aud" de forma consistente con el flujo que valida
                // JwtSecurityTokenHandler por defecto para "client_id"; se
                // valida igual porque el UserPoolClient de este proyecto
                // (auth-stack.ts) es un client público sin secreto, así
                // que el ID token sí incluye "aud" con el clientId.
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ClockSkew = TimeSpan.FromMinutes(2),
            };

            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, validationParameters, out _);

            var sub = principal.FindFirst("sub")?.Value;
            if (string.IsNullOrWhiteSpace(sub))
            {
                return CallerIdentity.Guest();
            }

            var username = principal.FindFirst("cognito:username")?.Value ?? sub;
            return new CallerIdentity(true, sub, username);
        }
        catch
        {
            // Token presente pero inválido/expirado: se trata como
            // invitado en vez de 401 (ver comentario de clase). El
            // interceptor del frontend (auth.interceptor.ts) ya maneja el
            // caso de token vencido en las rutas que SÍ siguen exigiendo
            // auth (ninguna de las de sesión, tras este cambio).
            return CallerIdentity.Guest();
        }
    }
}
