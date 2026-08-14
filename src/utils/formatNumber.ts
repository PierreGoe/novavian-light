/** Abrège un grand nombre en K/M (ex. 1500 → "1.5K", 2_300_000 → "2.3M"). */
export const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}
