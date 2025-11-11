import { supabase } from "@/integrations/supabase/client";

export interface DefaultSetting {
  category: string;
  setting_type?: string;
  setting_key: string;
  setting_value: any;
  display_order: number;
  is_active: boolean;
}

export const getDefaultSettings = (): DefaultSetting[] => [
  // Personal Settings - Titles
  { category: 'personal', setting_type: 'title', setting_key: 'mr', setting_value: { value: 'Mr' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'title', setting_key: 'mrs', setting_value: { value: 'Mrs' }, display_order: 2, is_active: true },
  { category: 'personal', setting_type: 'title', setting_key: 'miss', setting_value: { value: 'Miss' }, display_order: 3, is_active: true },
  { category: 'personal', setting_type: 'title', setting_key: 'ms', setting_value: { value: 'Ms' }, display_order: 4, is_active: true },

  // Personal Settings - Boroughs (London)
  { category: 'personal', setting_type: 'borough', setting_key: 'barking_dagenham', setting_value: { value: 'Barking and Dagenham' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'barnet', setting_value: { value: 'Barnet' }, display_order: 2, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'bexley', setting_value: { value: 'Bexley' }, display_order: 3, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'brent', setting_value: { value: 'Brent' }, display_order: 4, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'bromley', setting_value: { value: 'Bromley' }, display_order: 5, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'camden', setting_value: { value: 'Camden' }, display_order: 6, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'croydon', setting_value: { value: 'Croydon' }, display_order: 7, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'ealing', setting_value: { value: 'Ealing' }, display_order: 8, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'enfield', setting_value: { value: 'Enfield' }, display_order: 9, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'greenwich', setting_value: { value: 'Greenwich' }, display_order: 10, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'hackney', setting_value: { value: 'Hackney' }, display_order: 11, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'hammersmith_fulham', setting_value: { value: 'Hammersmith and Fulham' }, display_order: 12, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'haringey', setting_value: { value: 'Haringey' }, display_order: 13, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'harrow', setting_value: { value: 'Harrow' }, display_order: 14, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'havering', setting_value: { value: 'Havering' }, display_order: 15, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'hillingdon', setting_value: { value: 'Hillingdon' }, display_order: 16, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'hounslow', setting_value: { value: 'Hounslow' }, display_order: 17, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'islington', setting_value: { value: 'Islington' }, display_order: 18, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'kensington_chelsea', setting_value: { value: 'Kensington and Chelsea' }, display_order: 19, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'kingston', setting_value: { value: 'Kingston upon Thames' }, display_order: 20, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'lambeth', setting_value: { value: 'Lambeth' }, display_order: 21, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'lewisham', setting_value: { value: 'Lewisham' }, display_order: 22, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'merton', setting_value: { value: 'Merton' }, display_order: 23, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'newham', setting_value: { value: 'Newham' }, display_order: 24, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'redbridge', setting_value: { value: 'Redbridge' }, display_order: 25, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'richmond', setting_value: { value: 'Richmond upon Thames' }, display_order: 26, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'southwark', setting_value: { value: 'Southwark' }, display_order: 27, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'sutton', setting_value: { value: 'Sutton' }, display_order: 28, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'tower_hamlets', setting_value: { value: 'Tower Hamlets' }, display_order: 29, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'waltham_forest', setting_value: { value: 'Waltham Forest' }, display_order: 30, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'wandsworth', setting_value: { value: 'Wandsworth' }, display_order: 31, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'westminster', setting_value: { value: 'Westminster' }, display_order: 32, is_active: true },
  { category: 'personal', setting_type: 'borough', setting_key: 'city_of_london', setting_value: { value: 'City of London' }, display_order: 33, is_active: true },

  // Personal Settings - Languages
  { category: 'personal', setting_type: 'language', setting_key: 'afrikaans', setting_value: { value: 'Afrikaans' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'albanian', setting_value: { value: 'Albanian' }, display_order: 2, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'amharic', setting_value: { value: 'Amharic' }, display_order: 3, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'arabic', setting_value: { value: 'Arabic' }, display_order: 4, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'armenian', setting_value: { value: 'Armenian' }, display_order: 5, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'aymara', setting_value: { value: 'Aymara' }, display_order: 6, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'azerbaijani', setting_value: { value: 'Azerbaijani' }, display_order: 7, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'bengali', setting_value: { value: 'Bengali' }, display_order: 8, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'berber', setting_value: { value: 'Berber' }, display_order: 9, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'bislama', setting_value: { value: 'Bislama' }, display_order: 10, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'bosnian', setting_value: { value: 'Bosnian' }, display_order: 11, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'bulgarian', setting_value: { value: 'Bulgarian' }, display_order: 12, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'burmese', setting_value: { value: 'Burmese' }, display_order: 13, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'catalan', setting_value: { value: 'Catalan' }, display_order: 14, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'chichewa', setting_value: { value: 'Chichewa' }, display_order: 15, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'chinese_mandarin', setting_value: { value: 'Chinese (Mandarin)' }, display_order: 16, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'comorian', setting_value: { value: 'Comorian' }, display_order: 17, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'croatian', setting_value: { value: 'Croatian' }, display_order: 18, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'czech', setting_value: { value: 'Czech' }, display_order: 19, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'danish', setting_value: { value: 'Danish' }, display_order: 20, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'dhivehi', setting_value: { value: 'Dhivehi' }, display_order: 21, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'dutch', setting_value: { value: 'Dutch' }, display_order: 22, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'dzongkha', setting_value: { value: 'Dzongkha' }, display_order: 23, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'english', setting_value: { value: 'English' }, display_order: 24, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'estonian', setting_value: { value: 'Estonian' }, display_order: 25, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'fijian', setting_value: { value: 'Fijian' }, display_order: 26, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'filipino', setting_value: { value: 'Filipino' }, display_order: 27, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'finnish', setting_value: { value: 'Finnish' }, display_order: 28, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'french', setting_value: { value: 'French' }, display_order: 29, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'gaelic_irish', setting_value: { value: 'Gaelic (Irish)' }, display_order: 30, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'georgian', setting_value: { value: 'Georgian' }, display_order: 31, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'german', setting_value: { value: 'German' }, display_order: 32, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'gilbertese', setting_value: { value: 'Gilbertese' }, display_order: 33, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'greek', setting_value: { value: 'Greek' }, display_order: 34, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'guarani', setting_value: { value: 'Guarani' }, display_order: 35, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'haitian_creole', setting_value: { value: 'Haitian Creole' }, display_order: 36, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'hebrew', setting_value: { value: 'Hebrew' }, display_order: 37, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'hindi', setting_value: { value: 'Hindi' }, display_order: 38, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'hiri_motu', setting_value: { value: 'Hiri Motu' }, display_order: 39, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'hungarian', setting_value: { value: 'Hungarian' }, display_order: 40, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'icelandic', setting_value: { value: 'Icelandic' }, display_order: 41, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'indonesian', setting_value: { value: 'Indonesian' }, display_order: 42, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'italian', setting_value: { value: 'Italian' }, display_order: 43, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'japanese', setting_value: { value: 'Japanese' }, display_order: 44, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'kazakh', setting_value: { value: 'Kazakh' }, display_order: 45, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'khmer', setting_value: { value: 'Khmer' }, display_order: 46, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'kinyarwanda', setting_value: { value: 'Kinyarwanda' }, display_order: 47, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'kirundi', setting_value: { value: 'Kirundi' }, display_order: 48, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'korean', setting_value: { value: 'Korean' }, display_order: 49, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'kurdish', setting_value: { value: 'Kurdish' }, display_order: 50, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'kyrgyz', setting_value: { value: 'Kyrgyz' }, display_order: 51, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'lao', setting_value: { value: 'Lao' }, display_order: 52, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'latin', setting_value: { value: 'Latin' }, display_order: 53, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'latvian', setting_value: { value: 'Latvian' }, display_order: 54, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'lithuanian', setting_value: { value: 'Lithuanian' }, display_order: 55, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'luxembourgish', setting_value: { value: 'Luxembourgish' }, display_order: 56, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'macedonian', setting_value: { value: 'Macedonian' }, display_order: 57, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'malagasy', setting_value: { value: 'Malagasy' }, display_order: 58, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'malay', setting_value: { value: 'Malay' }, display_order: 59, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'maltese', setting_value: { value: 'Maltese' }, display_order: 60, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'maori', setting_value: { value: 'Māori' }, display_order: 61, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'marshallese', setting_value: { value: 'Marshallese' }, display_order: 62, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'mongolian', setting_value: { value: 'Mongolian' }, display_order: 63, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'montenegrin', setting_value: { value: 'Montenegrin' }, display_order: 64, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'nauruan', setting_value: { value: 'Nauruan' }, display_order: 65, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'nepali', setting_value: { value: 'Nepali' }, display_order: 66, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'norwegian', setting_value: { value: 'Norwegian' }, display_order: 67, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'palauan', setting_value: { value: 'Palauan' }, display_order: 68, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'pashto', setting_value: { value: 'Pashto' }, display_order: 69, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'persian_farsi', setting_value: { value: 'Persian (Farsi)' }, display_order: 70, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'polish', setting_value: { value: 'Polish' }, display_order: 71, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'portuguese', setting_value: { value: 'Portuguese' }, display_order: 72, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'quechua', setting_value: { value: 'Quechua' }, display_order: 73, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'romanian', setting_value: { value: 'Romanian' }, display_order: 74, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'romansh', setting_value: { value: 'Romansh' }, display_order: 75, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'russian', setting_value: { value: 'Russian' }, display_order: 76, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'samoan', setting_value: { value: 'Samoan' }, display_order: 77, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'sango', setting_value: { value: 'Sango' }, display_order: 78, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'serbian', setting_value: { value: 'Serbian' }, display_order: 79, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'sesotho', setting_value: { value: 'Sesotho' }, display_order: 80, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'seychellois_creole', setting_value: { value: 'Seychellois Creole' }, display_order: 81, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'shona', setting_value: { value: 'Shona' }, display_order: 82, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'sinhala', setting_value: { value: 'Sinhala' }, display_order: 83, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'slovak', setting_value: { value: 'Slovak' }, display_order: 84, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'slovene', setting_value: { value: 'Slovene' }, display_order: 85, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'somali', setting_value: { value: 'Somali' }, display_order: 86, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'spanish', setting_value: { value: 'Spanish' }, display_order: 87, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'swahili', setting_value: { value: 'Swahili' }, display_order: 88, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'swati', setting_value: { value: 'Swati (Swazi)' }, display_order: 89, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'swedish', setting_value: { value: 'Swedish' }, display_order: 90, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tajik', setting_value: { value: 'Tajik' }, display_order: 91, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tamil', setting_value: { value: 'Tamil' }, display_order: 92, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tetum', setting_value: { value: 'Tetum' }, display_order: 93, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'thai', setting_value: { value: 'Thai' }, display_order: 94, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tigrinya', setting_value: { value: 'Tigrinya' }, display_order: 95, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tok_pisin', setting_value: { value: 'Tok Pisin' }, display_order: 96, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tongan', setting_value: { value: 'Tongan' }, display_order: 97, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'tswana', setting_value: { value: 'Tswana' }, display_order: 98, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'turkish', setting_value: { value: 'Turkish' }, display_order: 99, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'turkmen', setting_value: { value: 'Turkmen' }, display_order: 100, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'ukrainian', setting_value: { value: 'Ukrainian' }, display_order: 101, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'urdu', setting_value: { value: 'Urdu' }, display_order: 102, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'uzbek', setting_value: { value: 'Uzbek' }, display_order: 103, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'vietnamese', setting_value: { value: 'Vietnamese' }, display_order: 104, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'xhosa', setting_value: { value: 'Xhosa' }, display_order: 105, is_active: true },
  { category: 'personal', setting_type: 'language', setting_key: 'zulu', setting_value: { value: 'Zulu' }, display_order: 106, is_active: true },

  // Personal Settings - English Proficiency
  { category: 'personal', setting_type: 'english_level', setting_key: 'fluent', setting_value: { value: 'Fluent' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'english_level', setting_key: 'good', setting_value: { value: 'Good' }, display_order: 2, is_active: true },
  { category: 'personal', setting_type: 'english_level', setting_key: 'basic', setting_value: { value: 'Basic' }, display_order: 3, is_active: true },
  { category: 'personal', setting_type: 'english_level', setting_key: 'weak', setting_value: { value: 'Weak' }, display_order: 4, is_active: true },

  // Personal Settings - DBS Options
  { category: 'personal', setting_type: 'dbs_option', setting_key: 'yes', setting_value: { value: 'Yes' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'dbs_option', setting_key: 'no', setting_value: { value: 'No' }, display_order: 2, is_active: true },

  // Personal Settings - Car and Licence
  { category: 'personal', setting_type: 'car_licence', setting_key: 'yes', setting_value: { value: 'Yes' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'car_licence', setting_key: 'no', setting_value: { value: 'No' }, display_order: 2, is_active: true },

  // Personal Settings - Right to Work
  { category: 'personal', setting_type: 'right_to_work', setting_key: 'yes', setting_value: { value: 'Yes' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'right_to_work', setting_key: 'no', setting_value: { value: 'No' }, display_order: 2, is_active: true },

  // Personal Settings - Personal Care
  { category: 'personal', setting_type: 'personal_care_option', setting_key: 'male', setting_value: { value: 'Male' }, display_order: 1, is_active: true },
  { category: 'personal', setting_type: 'personal_care_option', setting_key: 'female', setting_value: { value: 'Female' }, display_order: 2, is_active: true },
  { category: 'personal', setting_type: 'personal_care_option', setting_key: 'both', setting_value: { value: 'Both' }, display_order: 3, is_active: true },

  // Emergency Settings - Relationships
  { category: 'emergency', setting_type: 'relationship', setting_key: 'parent', setting_value: { value: 'Parent' }, display_order: 1, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'sibling', setting_value: { value: 'Sibling' }, display_order: 2, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'spouse', setting_value: { value: 'Spouse' }, display_order: 3, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'partner', setting_value: { value: 'Partner' }, display_order: 4, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'friend', setting_value: { value: 'Friend' }, display_order: 5, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'colleague', setting_value: { value: 'Colleague' }, display_order: 6, is_active: true },
  { category: 'emergency', setting_type: 'relationship', setting_key: 'other', setting_value: { value: 'Other' }, display_order: 7, is_active: true },

  // Emergency Settings - How Did You Hear About Us
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'job_board', setting_value: { value: 'Job Board' }, display_order: 1, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'social_media', setting_value: { value: 'Social Media' }, display_order: 2, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'website', setting_value: { value: 'Company Website' }, display_order: 3, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'referral', setting_value: { value: 'Referral' }, display_order: 4, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'walk_in', setting_value: { value: 'Walk-in' }, display_order: 5, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'agency', setting_value: { value: 'Recruitment Agency' }, display_order: 6, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'newspaper', setting_value: { value: 'Newspaper' }, display_order: 7, is_active: true },
  { category: 'emergency', setting_type: 'hear_about', setting_key: 'other', setting_value: { value: 'Other' }, display_order: 8, is_active: true },

  // Shift Settings
  { category: 'shift', setting_key: 'early_mornings', setting_value: { name: 'early_mornings', label: 'Early Mornings', start_time: '07:00', end_time: '10:00' }, display_order: 1, is_active: true },
  { category: 'shift', setting_key: 'late_mornings', setting_value: { name: 'late_mornings', label: 'Late Mornings', start_time: '10:00', end_time: '12:00' }, display_order: 2, is_active: true },
  { category: 'shift', setting_key: 'early_afternoons', setting_value: { name: 'early_afternoons', label: 'Early Afternoons', start_time: '12:00', end_time: '15:00' }, display_order: 3, is_active: true },
  { category: 'shift', setting_key: 'late_afternoons', setting_value: { name: 'late_afternoons', label: 'Late Afternoons', start_time: '15:00', end_time: '18:00' }, display_order: 4, is_active: true },
  { category: 'shift', setting_key: 'evenings', setting_value: { name: 'evenings', label: 'Evenings', start_time: '18:00', end_time: '22:00' }, display_order: 5, is_active: true },
  { category: 'shift', setting_key: 'waking_nights', setting_value: { name: 'waking_nights', label: 'Waking Nights', start_time: '20:00', end_time: '08:00' }, display_order: 6, is_active: true },
  { category: 'shift', setting_key: 'sleeping_nights', setting_value: { name: 'sleeping_nights', label: 'Sleeping Nights', start_time: '20:00', end_time: '08:00' }, display_order: 7, is_active: true },

  // Skills Settings - Category
  { category: 'skills', setting_type: 'category', setting_key: 'care_skills', setting_value: { id: 'care_skills', name: 'Care Skills' }, display_order: 1, is_active: true },

  // Skills Settings - Care Skills
  { category: 'skills', setting_type: 'skill', setting_key: 'adhd', setting_value: { name: 'ADHD', category_id: 'care_skills' }, display_order: 1, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'administration_of_medicine', setting_value: { name: 'Administration of medicine', category_id: 'care_skills' }, display_order: 2, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'alzheimers', setting_value: { name: 'Alzheimers', category_id: 'care_skills' }, display_order: 3, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'assisting_with_immobility', setting_value: { name: 'Assisting with immobility', category_id: 'care_skills' }, display_order: 4, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'autism', setting_value: { name: 'Autism', category_id: 'care_skills' }, display_order: 5, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'cancer_care', setting_value: { name: 'Cancer care', category_id: 'care_skills' }, display_order: 6, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'catheter_care', setting_value: { name: 'Catheter care', category_id: 'care_skills' }, display_order: 7, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'cerebral_palsy', setting_value: { name: 'Cerebral Palsy', category_id: 'care_skills' }, display_order: 8, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'challenging_behaviour', setting_value: { name: 'Challenging behaviour', category_id: 'care_skills' }, display_order: 9, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'dementia_care', setting_value: { name: 'Dementia care', category_id: 'care_skills' }, display_order: 10, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'diabetes', setting_value: { name: 'Diabetes', category_id: 'care_skills' }, display_order: 11, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'downs_syndrome', setting_value: { name: "Down's syndrome", category_id: 'care_skills' }, display_order: 12, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'frail_elderly', setting_value: { name: 'Frail elderly', category_id: 'care_skills' }, display_order: 13, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'hoists', setting_value: { name: 'Hoists', category_id: 'care_skills' }, display_order: 14, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'incontinence', setting_value: { name: 'Incontinence', category_id: 'care_skills' }, display_order: 15, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'learning_disabilities', setting_value: { name: 'Learning disabilities', category_id: 'care_skills' }, display_order: 16, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'lewy_body_dementia', setting_value: { name: 'Lewy-Body dementia', category_id: 'care_skills' }, display_order: 17, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'mental_health', setting_value: { name: 'Mental health', category_id: 'care_skills' }, display_order: 18, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'multiple_sclerosis', setting_value: { name: 'Multiple sclerosis', category_id: 'care_skills' }, display_order: 19, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'parkinsons_disease', setting_value: { name: "Parkinson's disease", category_id: 'care_skills' }, display_order: 20, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'special_need_children', setting_value: { name: 'Special need children', category_id: 'care_skills' }, display_order: 21, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'stroke_care', setting_value: { name: 'Stroke care', category_id: 'care_skills' }, display_order: 22, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'terminally_ill', setting_value: { name: 'Terminally III', category_id: 'care_skills' }, display_order: 23, is_active: true },
  { category: 'skills', setting_type: 'skill', setting_key: 'tube_feeding', setting_value: { name: 'Tube feeding', category_id: 'care_skills' }, display_order: 24, is_active: true },

  // Status Settings
  { category: 'status', setting_key: 'new', setting_value: { status_name: 'New' }, display_order: 1, is_active: true },
  { category: 'status', setting_key: 'under_review', setting_value: { status_name: 'Under Review' }, display_order: 2, is_active: true },
  { category: 'status', setting_key: 'interview_scheduled', setting_value: { status_name: 'Interview Scheduled' }, display_order: 3, is_active: true },
  { category: 'status', setting_key: 'interviewed', setting_value: { status_name: 'Interviewed' }, display_order: 4, is_active: true },
  { category: 'status', setting_key: 'offer_extended', setting_value: { status_name: 'Offer Extended' }, display_order: 5, is_active: true },
  { category: 'status', setting_key: 'accepted', setting_value: { status_name: 'Accepted' }, display_order: 6, is_active: true },
  { category: 'status', setting_key: 'rejected', setting_value: { status_name: 'Rejected' }, display_order: 7, is_active: true },
  { category: 'status', setting_key: 'withdrawn', setting_value: { status_name: 'Withdrawn' }, display_order: 8, is_active: true },

  // Position Settings
  { category: 'position', setting_key: 'care_coordinator', setting_value: { title: 'Care coordinator', description: 'Coordinate care services and support', department: 'Care Services', location: 'Various Locations' }, display_order: 1, is_active: true },
  { category: 'position', setting_key: 'support_worker_carer', setting_value: { title: 'Support Worker/Carer', description: 'Provide direct care and support to service users', department: 'Care Services', location: 'Various Locations' }, display_order: 2, is_active: true },
  { category: 'position', setting_key: 'childminder', setting_value: { title: 'Childminder', description: 'Provide childcare services', department: 'Childcare Services', location: 'Various Locations' }, display_order: 3, is_active: true },
  { category: 'position', setting_key: 'registered_manager', setting_value: { title: 'Registered Manager', description: 'Manage care services and staff', department: 'Management', location: 'Various Locations' }, display_order: 4, is_active: true },
  { category: 'position', setting_key: 'deputy_manager', setting_value: { title: 'Deputy Manager', description: 'Support management operations', department: 'Management', location: 'Various Locations' }, display_order: 5, is_active: true },
  { category: 'position', setting_key: 'field_care_supervisor', setting_value: { title: 'Field Care Supervisor', description: 'Supervise care workers in the field', department: 'Care Services', location: 'Various Locations' }, display_order: 6, is_active: true },
  { category: 'position', setting_key: 'housekeeping_cleaner', setting_value: { title: 'Housekeeping/Cleaner', description: 'Maintain cleanliness and hygiene', department: 'Facilities', location: 'Various Locations' }, display_order: 7, is_active: true },
];

export async function seedApplicationSettings(): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const defaultSettings = getDefaultSettings();
    
    // Delete all existing settings first
    const { error: deleteError } = await supabase
      .from('job_application_settings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      throw deleteError;
    }

    // Insert default settings
    const { error: insertError, count } = await supabase
      .from('job_application_settings')
      .insert(defaultSettings);

    if (insertError) {
      throw insertError;
    }

    return { success: true, count: defaultSettings.length };
  } catch (error: any) {
    console.error('Error seeding application settings:', error);
    return { success: false, error: error.message };
  }
}
