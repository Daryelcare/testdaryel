// EU member countries (27 countries as of 2024, excluding UK post-Brexit)
const EU_COUNTRIES = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Czechia', // Alternative name
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden'
];

/**
 * Determines nationality status based on the selected country
 * @param country - The country name selected
 * @returns "British" if UK, "EU" if EU member state, "Non-EU" otherwise
 */
export function determineNationalityStatus(country: string): string {
  if (!country) return '';
  
  // Check if UK/United Kingdom
  if (country === 'United Kingdom' || country === 'UK' || country === 'United Kingdom of Great Britain and Northern Ireland') {
    return 'British';
  }
  
  // Check if EU country
  if (EU_COUNTRIES.includes(country)) {
    return 'EU';
  }
  
  // All other countries
  return 'Non-EU';
}
