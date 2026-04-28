/**
 * Convierte un texto en un slug URL-friendly.
 * Ejemplo: "iPhone 15 Pro Max!" → "iphone-15-pro-max"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')                        // Separa diacríticos (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '')         // Elimina los diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')            // Solo alfanuméricos, espacios y guiones
    .replace(/\s+/g, '-')                   // Espacios → guiones
    .replace(/-+/g, '-')                    // Múltiples guiones → uno solo
    .replace(/^-+|-+$/g, '');              // Elimina guiones al inicio/fin
}
