"use server";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

/**
 * Construit une URL absolue valide pour les appels API
 */
export async function getBaseUrl() {
  // Environnement Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // URL d'API personnalisée
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  return "http://localhost:3000";
}

/**
 * Type pour les options de fetch étendues
 */
export type ApiFetchOptions = RequestInit & {
  next?: {
    tags?: string[];
    revalidate?: number;
  };
  fallbackData?: any;
};

/**
 * Fonction pour effectuer des requêtes API de manière fiable
 * Compatible avec les composants serveur et la revalidation
 */
export const apiFetch = async <T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  // Extraire les options spécifiques
  const { fallbackData, ...fetchOptions } = options;

  // Créer une fonction de fetch qui pourra être mise en cache
  const fetchFunction = async () => {
    // S'assurer que le chemin commence par "/"
    const apiPath = path.startsWith("/") ? path : `/${path}`;
    const baseUrl = await getBaseUrl();
    const url = `${baseUrl}${apiPath}`;

    console.log(`Fetching from: ${url}`);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);

      if (fallbackData !== undefined) {
        console.log("Utilisation des données de fallback");
        return fallbackData;
      }

      throw error;
    }
  };

  // Mettre en cache la fonction de fetch avec les tags spécifiés
  if (options.next?.tags && options.next.tags.length > 0) {
    const cachedFetch = unstable_cache(fetchFunction, [`api-fetch-${path}`], {
      tags: options.next.tags,
      revalidate: options.next.revalidate,
    });

    return cachedFetch();
  }

  return fetchFunction();
};

/**
 * Fonction pratique pour forcer la revalidation d'un endpoint API
 */
export async function revalidateApi(tags: string[]) {
  tags.forEach((tag) => revalidateTag(tag));
  return { success: true, revalidatedTags: tags };
}
