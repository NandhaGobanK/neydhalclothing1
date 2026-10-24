import { Product, SareeCategory } from '../types/store';

/**
 * Checks whether a product belongs to an active, currently existing category in the boutique.
 * If a category was deleted/removed by the administrator (e.g. Jewels / Temple Jewelry),
 * any product created under that category or possessing that specialized type is considered invalid / purged.
 */
export function isProductInActiveCategories(
  product: Product | undefined | null,
  activeCategories: SareeCategory[] | undefined | null
): boolean {
  if (!product) return false;
  if (!activeCategories || !Array.isArray(activeCategories) || activeCategories.length === 0) {
    return false;
  }

  // Filter out any nullish or malformed category objects
  const validCategories = activeCategories.filter((c): c is SareeCategory => Boolean(c && typeof c === 'object'));
  if (validCategories.length === 0) return false;

  const validCatNames = new Set(
    validCategories
      .map((c) => (c?.name ? String(c.name).trim().toLowerCase() : ''))
      .filter(Boolean)
  );
  const validCatIds = new Set(
    validCategories
      .map((c) => (c?.id ? String(c.id).trim().toLowerCase() : ''))
      .filter(Boolean)
  );

  const prodCat = product.category ? String(product.category).trim().toLowerCase() : '';
  const prodTitle = product.title ? String(product.title).trim().toLowerCase() : '';

  // 1. If productType is 'jewelry', verify that at least one jewelry category is actively present
  const hasJewelryCategory = validCategories.some((c) => {
    const nameLower = c?.name ? String(c.name).toLowerCase() : '';
    const idLower = c?.id ? String(c.id).toLowerCase() : '';
    return nameLower.includes('jewel') || idLower.includes('jewel');
  });

  if (product.productType === 'jewelry') {
    if (!hasJewelryCategory) return false;
  }

  // If the product category or title refers to jewelry, but no jewelry category exists in the boutique:
  if (!hasJewelryCategory) {
    if (
      prodCat.includes('jewel') ||
      prodCat.includes('kundan') ||
      prodCat.includes('necklace') ||
      prodCat.includes('jhumka') ||
      prodTitle.includes('jewelry') ||
      prodTitle.includes('jewel')
    ) {
      return false;
    }
  }

  // 2. Direct exact match by Category Name or Category ID
  if (prodCat && (validCatNames.has(prodCat) || validCatIds.has(prodCat))) {
    return true;
  }

  // 3. Substring / fuzzy match within active category names
  if (prodCat) {
    const fuzzyMatch = validCategories.some((c) => {
      const cLower = c?.name ? String(c.name).trim().toLowerCase() : '';
      if (!cLower) return false;
      return (
        cLower === prodCat ||
        cLower.includes(prodCat) ||
        prodCat.includes(cLower)
      );
    });
    if (fuzzyMatch) return true;
  }

  return false;
}

/**
 * Returns a natural singular label for a product based on its category name.
 * e.g. "Heirloom Sarees" -> "Saree"
 *      "Designer Blouses" -> "Blouse"
 *      "Temple Jewelry" -> "Jewelry"
 *      "Ethnic Kurtis" -> "Kurti"
 *      "Silk Dupattas" -> "Dupatta"
 *      "Bridal Lehengas" -> "Lehenga"
 */
export function getCategorySingularName(categoryName?: string): string {
  if (!categoryName) return 'Product';
  const lower = categoryName.trim().toLowerCase();
  if (lower.includes('saree')) return 'Saree';
  if (lower.includes('blouse')) return 'Blouse';
  if (lower.includes('jewel') || lower.includes('necklace') || lower.includes('jhumka')) return 'Jewelry';
  if (lower.includes('kurti') || lower.includes('anarkali') || lower.includes('tunic')) return 'Kurti';
  if (lower.includes('lehenga')) return 'Lehenga';
  if (lower.includes('dupatta')) return 'Dupatta';
  if (lower.includes('palazzo') || lower.includes('bottom')) return 'Bottom';
  if (lower.endsWith('ies') && lower.length > 4) {
    return categoryName.trim().slice(0, -3) + 'y';
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2) {
    return categoryName.trim().slice(0, -1);
  }
  return categoryName.trim();
}

/**
 * Returns a natural plural label for products based on category name.
 * e.g. "Saree" -> "Sarees", "Blouse" -> "Blouses", "Jewelry" -> "Jewelry"
 */
export function getCategoryPluralName(categoryName?: string): string {
  if (!categoryName) return 'Products';
  const singular = getCategorySingularName(categoryName);
  if (singular === 'Jewelry') return 'Jewelry';
  if (singular.endsWith('y') && !singular.endsWith('ey')) {
    return singular.slice(0, -1) + 'ies';
  }
  if (singular.endsWith('s') || singular.endsWith('sh') || singular.endsWith('ch')) {
    return singular + 'es';
  }
  return singular + 's';
}
