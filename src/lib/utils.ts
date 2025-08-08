import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getProductionRedirectUrl(path: string = "/"): string {
  // If we're already on the production domain, use the current origin
  if (window.location.hostname === "biopeak-ai.com") {
    return `${window.location.origin}${path}`;
  }
  
  // Otherwise, always redirect to production
  return `https://biopeak-ai.com${path}`;
}
