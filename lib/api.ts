export function getApiUrl(path: string): string {
  if (typeof window === "undefined") {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host =
      process.env.VERCEL_URL ||
      process.env.NEXT_PUBLIC_API_HOST ||
      "localhost:3000";
    return `${protocol}://${host}${path}`;
  }

  return path;
}
