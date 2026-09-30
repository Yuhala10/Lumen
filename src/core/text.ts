/** Text normalisation used to group notebook lines into items. */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const NOISE = new Set([
  // units and containers
  "tas", "kg", "seau", "seaux", "cageot", "cageots", "regime", "regimes", "sac", "sacs",
  "botte", "bottes", "paquet", "paquets", "pcs", "pc", "piece", "pieces", "litre", "litres",
  "bidon", "bidons", "verre", "verres", "cuvette", "cuvettes", "boite", "boites", "pack",
  "packs", "carton", "cartons", "unit", "units", "bunch", "bunches", "heap", "heaps",
  "basket", "baskets", "bag", "bags", "tin", "tins", "cup", "cups", "doz", "dozen",
  "douzaine", "plate", "plates", "assiette", "assiettes", "bol", "bols", "tasse", "tasses",
  // sizes
  "demi", "half", "gros", "grosse", "petit", "petite", "petits", "grand", "grande", "grands",
  "big", "small",
  // connecting words
  "de", "du", "des", "la", "le", "les", "of", "the", "et", "and", "pour", "for", "au", "aux",
  // bookkeeping words
  "vente", "ventes", "vendu", "sold", "sale", "sales", "cash", "momo", "om", "credit",
  "client", "customer",
]);

/** A stable key for "the same item": lowercase, no accents, no quantities or units. */
export function normalizeItem(description: string): string {
  const words = stripAccents(description.toLowerCase())
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  return words.slice(0, 3).join(" ") || "other";
}

const UNIT_WORDS = new Set([
  "tas", "kg", "seau", "seaux", "cageot", "cageots", "regime", "regimes", "sac", "sacs",
  "botte", "bottes", "paquet", "paquets", "pcs", "pc", "piece", "pieces", "litre", "litres",
  "bidon", "bidons", "verre", "verres", "cuvette", "cuvettes", "boite", "boites", "pack",
  "packs", "carton", "cartons", "unit", "units", "bunch", "bunches", "heap", "heaps",
  "basket", "baskets", "bag", "bags", "tin", "tins", "cup", "cups", "packet", "packets",
  "bar", "bars", "bol", "bols", "assiette", "assiettes", "x", "f", "fcfa", "frs", "fr",
]);

/** A readable label: quantities, units and currency removed, first letter capitalised. */
export function cleanLabel(description: string): string {
  const words = description
    .replace(/[×x]?\d+([.,]\d+)?[a-z]?\b/gi, " ")
    .split(/\s+/)
    .filter((w) => w && !UNIT_WORDS.has(stripAccents(w.toLowerCase()).replace(/[^a-z]/g, "")));
  const label = words.join(" ").trim() || description.trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
