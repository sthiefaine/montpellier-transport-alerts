// /app/api/gtfs/common/auth.ts
/**
 * Module contenant les fonctions d'authentification communes
 * pour les endpoints de l'API GTFS.
 */

const IMPORT_TOKEN = process.env.CRON_SECRET;

/**
 * Valide l'authentification d'une requête en vérifiant soit l'en-tête Authorization
 * soit le paramètre token dans l'URL.
 * 
 * @param request La requête HTTP à valider
 * @returns true si l'authentification est valide, false sinon
 */
export function validateAuth(request: Request): boolean {
  // Vérifier l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === IMPORT_TOKEN) {
    return true;
  }
  
  // Vérifier le paramètre token dans l'URL
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token === IMPORT_TOKEN) {
    return true;
  }
  
  return false;
}