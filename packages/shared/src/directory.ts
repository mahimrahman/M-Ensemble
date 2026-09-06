/**
 * The mosque directory — GENERATED, do not edit by hand.
 *
 *   npx tsx scripts/build-mosque-directory.ts
 *
 * Source: `database.json` at the repo root. These are mosques we hold public
 * directory data for: address, coordinates, contact, rating and the programs
 * they publish. Nobody has claimed them in the app, so they carry no posts, no
 * coordinator and no iqamah times — the profile screen says so rather than
 * rendering an empty prayer table.
 *
 * The ten mosques in `fixtures.ts` are hand-written and deliberately absent
 * here; the generator skips them on street address so a re-run cannot
 * overwrite that prose.
 */

import type { Mosque } from './types';

/** 60 mosques, alphabetical. Real data, unclaimed accounts. */
export const directoryMosques: Mosque[] = [
  {
    "_id": "mosque_abo_ther_alghafari_mosque",
    "name": "Abo-Ther Alghafari Mosque",
    "address": "273 Donald St, Ottawa, ON K1K 1N1",
    "coordinates": {
      "lat": 45.4282939,
      "lng": -75.6568289
    },
    "joinCode": "ABOTHE",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-747-6252",
    "rating": {
      "score": 4.6,
      "count": 121
    },
    "bio": "Iraqi/Kuwaiti-led; English-language program available; free Ramadan iftars open to all. On 273 Donald St in Ottawa."
  },
  {
    "_id": "mosque_abu_huraira_centre",
    "name": "Abu Huraira Centre",
    "address": "270 Yorkland Blvd, North York, ON M2J 5C9",
    "coordinates": {
      "lat": 43.7731126,
      "lng": -79.334424
    },
    "joinCode": "ABUHUR",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-752-1200",
    "rating": {
      "score": 4.8,
      "count": 1276
    },
    "bio": "Tajweed/Tafseer classes for sisters; separate women's building; free Ramadan food. On 270 Yorkland Blvd in North York."
  },
  {
    "_id": "mosque_aisha_islamic_center",
    "name": "Aisha Islamic Center",
    "address": "425 Rue de l'Aqueduc, Montréal, QC H3C 4J8",
    "coordinates": {
      "lat": 45.4921106,
      "lng": -73.5648339
    },
    "joinCode": "AISHAI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-360-3133",
    "website": "aishaic.org",
    "rating": {
      "score": 4.7,
      "count": 253
    },
    "bio": "On 425 Rue de l'Aqueduc.",
    "services": [
      "Daily prayers and Jumu'ah near Notre-Dame / de la Montagne; convenient for Concordia students",
      "Men's and women's prayer rooms, secured entry, on-site parking",
      "Currently undergoing renovation"
    ]
  },
  {
    "_id": "mosque_al_itissam_mosque",
    "name": "Al Itissam Mosque",
    "address": "600 Bd des Laurentides, Laval, QC H7G 2V5",
    "coordinates": {
      "lat": 45.5720379,
      "lng": -73.6941309
    },
    "joinCode": "ALITIS",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-668-4381",
    "rating": {
      "score": 4.8,
      "count": 325
    },
    "bio": "Weekly lessons/halaqas; door code required outside prayer times. On 600 Bd des Laurentides in Laval."
  },
  {
    "_id": "mosque_al_andalous_islamic_center",
    "name": "Al-Andalous Islamic Center",
    "address": "816 Av. Sainte-Croix, Saint-Laurent, QC H4L 3Y4",
    "coordinates": {
      "lat": 45.5135959,
      "lng": -73.6762394
    },
    "joinCode": "ALANDA",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-360-2360",
    "rating": {
      "score": 4.8,
      "count": 513
    },
    "bio": "On 816 Av. Sainte-Croix in Saint-Laurent.",
    "services": [
      "Children's Summer Camp combining educational activities with fun and discipline (praised by parents for...",
      "Daily prayers and Jumu'ah (khutbah largely in Arabic); large volunteer base"
    ]
  },
  {
    "_id": "mosque_ama_community_centre",
    "name": "AMA Community Centre",
    "address": "1216 Hunt Club Rd, Ottawa, ON K1V 2P1",
    "coordinates": {
      "lat": 45.3517921,
      "lng": -75.6474269
    },
    "joinCode": "AMACOM",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-523-9977",
    "rating": {
      "score": 4.9,
      "count": 83
    },
    "bio": "Fitness & senior programs, toddler halaqas, new-Muslim programs, blood-donation clinics; wheelchair accessible. On 1216 Hunt Club Rd in Ottawa."
  },
  {
    "_id": "mosque_association_al_bayan_ecole",
    "name": "Association Al-Bayan / École Coranique Al-Bayane",
    "address": "2468 Rue Sauvé E, Montréal, QC H2B 1B9",
    "coordinates": {
      "lat": 45.5726263,
      "lng": -73.6418235
    },
    "joinCode": "ASSOCI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "(438) 401-0773",
    "website": "albayane.ca",
    "rating": {
      "score": 4.9,
      "count": 39
    },
    "bio": "On 2468 Rue Sauvé E.",
    "services": [
      "MAC Quran school and small neighbourhood mosque in Ahuntsic",
      "Dedicated Quran-studies programming (one of MAC's four designated Quran schools nationally)",
      "Jumu'ah at 12:45 PM"
    ]
  },
  {
    "_id": "mosque_association_musulmane_de_lachine",
    "name": "Association Musulmane de Lachine",
    "address": "1220 Rue Notre-Dame, Lachine, QC H8S 2C4",
    "coordinates": {
      "lat": 45.4350493,
      "lng": -73.6748569
    },
    "joinCode": "ASSOC2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-245-3081",
    "rating": {
      "score": 4.8,
      "count": 53
    },
    "bio": "On 1220 Rue Notre-Dame in Lachine.",
    "services": [
      "Small, close-knit Lachine mosque; five daily prayers and Ramadan Taraweeh"
    ]
  },
  {
    "_id": "mosque_assuna_annabawiyah_mosque",
    "name": "Assuna Annabawiyah Mosque",
    "address": "7220 Rue Hutchison, Montréal, QC H3N 1Z1",
    "coordinates": {
      "lat": 45.5297172,
      "lng": -73.6232417
    },
    "joinCode": "ASSUNA",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-278-8441",
    "rating": {
      "score": 4.8,
      "count": 245
    },
    "bio": "On 7220 Rue Hutchison.",
    "services": [
      "Park-Extension / Mile End mosque with an on-site library; open for daily congregational prayers; women's..."
    ]
  },
  {
    "_id": "mosque_baitul_mukarram_mosque",
    "name": "Baitul Mukarram Mosque",
    "address": "4225 Av. de Courtrai, Montréal, QC H3S 1B8",
    "coordinates": {
      "lat": 45.5006081,
      "lng": -73.6430255
    },
    "joinCode": "BAITUL",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-737-8671",
    "rating": {
      "score": 4.8,
      "count": 335
    },
    "bio": "On 4225 Av. de Courtrai.",
    "services": [
      "Côte-des-Neiges mosque with multiple Jumu'ah timings; separate women's prayer area; on-site collection of..."
    ]
  },
  {
    "_id": "mosque_canadian_islamic_centre_al",
    "name": "Canadian Islamic Centre Al-Jamieh",
    "address": "241 Av. Anselme-Lavigne, Dollard-des-Ormeaux, QC H9A 3H6",
    "coordinates": {
      "lat": 45.4926665,
      "lng": -73.8381618
    },
    "joinCode": "CANADI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "514-624-5833",
    "website": "cical-jamieh.com",
    "rating": {
      "score": 4.8,
      "count": 492
    },
    "bio": "On 241 Av. Anselme-Lavigne in Dollard-des-Ormeaux.",
    "services": [
      "Main hall seats 1,000 — daily prayers, Jumu'ah, and both Eid prayers",
      "Short Courses after Maghrib every Saturday, Sunday, Monday & Tuesday: Quran recitation, rituals (ibadat)...",
      "Weekend School - Quran + Arabic for ~300 children aged 5–15, Saturdays or Sundays",
      "Institute of Islamic & Arabic Studies - Quran, Hadith, prayers, stories of the prophets, Arabic — for youth aged 16–30",
      "Social activities to support families; guidance for new Muslim immigrants; welcoming/assisting new converts",
      "Ran adult computer classes, summer camp, BBQs, sports and Islamic film nights"
    ]
  },
  {
    "_id": "mosque_centre_al_iman",
    "name": "Centre Al-Iman",
    "address": "5050 Bd des Laurentides, Laval, QC H7K 2J5",
    "coordinates": {
      "lat": 45.6205887,
      "lng": -73.7459216
    },
    "joinCode": "CENTR5",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-709-6031",
    "rating": {
      "score": 4.8,
      "count": 167
    },
    "bio": "Neighbourhood prayer centre. On 5050 Bd des Laurentides in Laval."
  },
  {
    "_id": "mosque_centre_aljisr",
    "name": "Centre Aljisr",
    "address": "3005 Bd Cartier O, Laval, QC H7V 1J3",
    "coordinates": {
      "lat": 45.5431194,
      "lng": -73.7259226
    },
    "joinCode": "CENTR6",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-681-2133",
    "rating": {
      "score": 4.8,
      "count": 253
    },
    "bio": "Active imam & community programming. On 3005 Bd Cartier O in Laval."
  },
  {
    "_id": "mosque_centre_assalam_de_laval",
    "name": "Centre Assalam de Laval Est",
    "address": "1235 Mnt du Moulin, Laval, QC H7A 3X8",
    "coordinates": {
      "lat": 45.6779246,
      "lng": -73.5819549
    },
    "joinCode": "CENTR8",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-666-0268",
    "rating": {
      "score": 4.7,
      "count": 36
    },
    "bio": "Jumu'ah 12:15 & 1:00 PM; French-speaking imam. On 1235 Mnt du Moulin in Laval."
  },
  {
    "_id": "mosque_centre_communautaire_islamique",
    "name": "Centre Communautaire Islamique",
    "address": "4201 Rue Bélanger, Montréal, QC H1T 1A4",
    "coordinates": {
      "lat": 45.5657554,
      "lng": -73.5869
    },
    "joinCode": "CENTR4",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-725-0008",
    "rating": {
      "score": 4.8,
      "count": 229
    },
    "bio": "On 4201 Rue Bélanger.",
    "services": [
      "Girls' Quran classes; post-Taraweeh lectures during Ramadan; generous women's section with an expanding men's..."
    ]
  },
  {
    "_id": "mosque_centre_communautaire_laurentien",
    "name": "Centre Communautaire Laurentien",
    "address": "12265 Blvd. Marcel-Laurin, Montréal, QC H4K 1N5",
    "coordinates": {
      "lat": 45.529379,
      "lng": -73.7224937
    },
    "joinCode": "CENTRE",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-227-5000",
    "website": "cclmac.ca",
    "rating": {
      "score": 4.7,
      "count": 129
    },
    "bio": "On 12265 Blvd. Marcel-Laurin.",
    "services": [
      "MAC's large multi-purpose community centre (adjoining Mosquée Al-Rawdah): many rooms, year-round activities...",
      "Home base for the École Coranique Al-Bayan (MAC Quran school)"
    ]
  },
  {
    "_id": "mosque_centre_communautaire_musulman_de",
    "name": "Centre Communautaire Musulman de Longueuil",
    "address": "1398 Ch. de Chambly, Longueuil, QC J4J 3X3",
    "coordinates": {
      "lat": 45.5314207,
      "lng": -73.4868762
    },
    "joinCode": "CENTR9",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-321-1225",
    "rating": {
      "score": 4.8,
      "count": 289
    },
    "bio": "Well-regarded South Shore community mosque. On 1398 Ch. de Chambly in Longueuil."
  },
  {
    "_id": "mosque_centre_communautaire_villeray_mosquee",
    "name": "Centre Communautaire Villeray (CCV) / Mosquée Abou Bakr Asseddique",
    "address": "371 Rue Jean-Talon E, Montréal, QC H2R 2E2",
    "coordinates": {
      "lat": 45.5380763,
      "lng": -73.614871
    },
    "joinCode": "CENTR2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-506-8899",
    "website": "ccvmac.ca",
    "rating": {
      "score": 4.7,
      "count": 123
    },
    "bio": "On 371 Rue Jean-Talon E.",
    "services": [
      "MAC community centre + mosque in Villeray",
      "Three Jumu'ah prayers (approx. 12:00 and 1:00 PM with iqama ~15–20 min later)",
      "Community programming for families and youth",
      "Ramadan Taraweeh and iftars"
    ]
  },
  {
    "_id": "mosque_centre_culturel_islamique_de",
    "name": "Centre Culturel Islamique de Québec",
    "address": "2877 Ch Ste-Foy, Québec, QC G1V 1W3",
    "coordinates": {
      "lat": 46.777942,
      "lng": -71.305444
    },
    "joinCode": "CENTR11",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 418-683-1329",
    "rating": {
      "score": 4.8,
      "count": 822
    },
    "bio": "Site of the 2017 attack; rebuilt & expanded; active evening children's classes with imams. On 2877 Ch Ste-Foy in Québec."
  },
  {
    "_id": "mosque_centre_islamique_libanais_a",
    "name": "Centre Islamique Libanais à Montréal",
    "address": "40 Rue de Port-Royal E, Montréal, QC H3L 1H7",
    "coordinates": {
      "lat": 45.5473326,
      "lng": -73.6562489
    },
    "joinCode": "CENTR3",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-381-6827",
    "rating": {
      "score": 4.8,
      "count": 41
    },
    "bio": "On 40 Rue de Port-Royal E.",
    "services": [
      "Serves the Lebanese Shia community; explicitly open to worshippers of all faiths and traditions; hosts...",
      "Open 10 AM–3 PM Mon–Sat, closed Sunday"
    ]
  },
  {
    "_id": "mosque_centre_kawtar_de_laval",
    "name": "Centre Kawtar de Laval",
    "address": "3871 A. des Laurentides, Laval, QC H7L 3H7",
    "coordinates": {
      "lat": 45.5825821,
      "lng": -73.7632165
    },
    "joinCode": "CENTR7",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-682-8055",
    "rating": {
      "score": 4.7,
      "count": 148
    },
    "bio": "Pre-khutbah lessons before Friday prayer (Jumu'ah 1:15 PM). On 3871 A. des Laurentides in Laval."
  },
  {
    "_id": "mosque_centretown_mosque",
    "name": "Centretown Mosque",
    "address": "397 Kent St, Ottawa, ON K2P 2B1",
    "coordinates": {
      "lat": 45.4120057,
      "lng": -75.6962699
    },
    "joinCode": "CENTR10",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "rating": {
      "score": 4.9,
      "count": 215
    },
    "bio": "Converted heritage church, founded ~2025; hosts lectures (e.g. Islamic finance); 400+ capacity. On 397 Kent St in Ottawa."
  },
  {
    "_id": "mosque_darul_uloom_ottawa",
    "name": "Darul Uloom Ottawa",
    "address": "2803 St Joseph Blvd, Orléans, ON K1C 1G6",
    "coordinates": {
      "lat": 45.4735074,
      "lng": -75.52058
    },
    "joinCode": "DARULU",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-406-0786",
    "rating": {
      "score": 5,
      "count": 224
    },
    "bio": "Led by Mufti Rashid; Shahada ceremonies, personal religious guidance. On 2803 St Joseph Blvd in Orléans."
  },
  {
    "_id": "mosque_darul_ummah",
    "name": "Darul Ummah",
    "address": "7311 Bank St, Ottawa, ON K0A 2P0",
    "coordinates": {
      "lat": 45.2232323,
      "lng": -75.4931503
    },
    "joinCode": "DARUL2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-468-6624",
    "rating": {
      "score": 5,
      "count": 31
    },
    "bio": "Small rural-south musallah, open 24/7; community bonfires. On 7311 Bank St in Ottawa."
  },
  {
    "_id": "mosque_islamic_centre_of_quebec",
    "name": "Islamic Centre of Quebec – El Markaz Islami",
    "address": "2520 Chemin Laval, Saint-Laurent, QC H4L 3A1",
    "coordinates": {
      "lat": 45.5212603,
      "lng": -73.7047613
    },
    "joinCode": "ISLAMI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-331-1770",
    "website": "icqmontreal.com",
    "rating": {
      "score": 4.7,
      "count": 450
    },
    "bio": "On 2520 Chemin Laval in Saint-Laurent.",
    "services": [
      "Oldest Islamic institution in Quebec (est. 1965 by Act of the National Assembly, Bill 194)",
      "Children's Quran & Islamic-studies classes held Friday Through Monday each week; separate class stream for...",
      "Marriage (nikah) services; administration of the Islamic Cemetery of Quebec and burial services; prison..."
    ]
  },
  {
    "_id": "mosque_islamic_community_center",
    "name": "Islamic Community Center",
    "address": "5905 Grande Allée, Brossard, QC J4Z 3R5",
    "coordinates": {
      "lat": 45.4697187,
      "lng": -73.4366674
    },
    "joinCode": "ISLAM3",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-656-9841",
    "rating": {
      "score": 4.9,
      "count": 1252
    },
    "bio": "Founded 1985; large facility w/ indoor basketball court; guest Quran reciters in Ramadan; registered charity. On 5905 Grande Allée in Brossard."
  },
  {
    "_id": "mosque_islamic_foundation_of_toronto",
    "name": "Islamic Foundation of Toronto",
    "address": "441 Nugget Ave, Scarborough, ON M1S 5E1",
    "coordinates": {
      "lat": 43.797987,
      "lng": -79.2417524
    },
    "joinCode": "ISLAM4",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-321-0909",
    "rating": {
      "score": 4.7,
      "count": 1844
    },
    "bio": "50+ yrs; full-time school, evening Hifz/Madressah, nikah & funerals; wheelchair accessible. On 441 Nugget Ave in Scarborough."
  },
  {
    "_id": "mosque_islamic_information_dawah_centre",
    "name": "Islamic Information & Dawah Centre International",
    "address": "1168 Bloor St W, Toronto, ON M6H 1N2",
    "coordinates": {
      "lat": 43.659633,
      "lng": -79.4369864
    },
    "joinCode": "ISLAM5",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-536-8433",
    "rating": {
      "score": 4.8,
      "count": 346
    },
    "bio": "Dawah/outreach focus; welcomes non-Muslims wanting to learn about Islam. On 1168 Bloor St W in Toronto."
  },
  {
    "_id": "mosque_islamic_services_of_quebec",
    "name": "Islamic Services of Quebec",
    "address": "2038 Boul. Saint-Laurent, Montréal, QC H2X 2T2",
    "coordinates": {
      "lat": 45.5116051,
      "lng": -73.5678776
    },
    "joinCode": "ISLAM2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-999-0986",
    "rating": {
      "score": 5,
      "count": 562
    },
    "bio": "On 2038 Boul. Saint-Laurent.",
    "services": [
      "Best known for Imam Bukhari's one-on-one support for new Muslims — Shahada ceremonies, religious Q&A by...",
      "Daily prayers and Friday khutbah"
    ]
  },
  {
    "_id": "mosque_islamic_society_of_sandy",
    "name": "Islamic Society of Sandy Hill",
    "address": "117 Mann Ave, Ottawa, ON K1N 5A4",
    "coordinates": {
      "lat": 45.4213274,
      "lng": -75.6720196
    },
    "joinCode": "ISLAM6",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-366-9112",
    "rating": {
      "score": 4.7,
      "count": 163
    },
    "bio": "School by day; Quran classes & dawah; Jumu'ah ~1:30 PM. On 117 Mann Ave in Ottawa."
  },
  {
    "_id": "mosque_jami_mosque_isna_canada",
    "name": "Jami Mosque | ISNA Canada",
    "address": "56 Boustead Ave, Toronto, ON M6R 1Y9",
    "coordinates": {
      "lat": 43.6533228,
      "lng": -79.4544554
    },
    "joinCode": "JAMIMO",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 905-403-8406",
    "rating": {
      "score": 4.8,
      "count": 480
    },
    "bio": "Community centre, bookstore & funeral home; weekend meals and iftars; accessible (elevator). On 56 Boustead Ave in Toronto."
  },
  {
    "_id": "mosque_jami_omar",
    "name": "Jami Omar",
    "address": "3990 Old Richmond Rd, Nepean, ON K2H 8R5",
    "coordinates": {
      "lat": 45.3116154,
      "lng": -75.8282778
    },
    "joinCode": "JAMIOM",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-828-2222",
    "rating": {
      "score": 4.8,
      "count": 711
    },
    "bio": "Gym on site; large Ramadan iftars (~300 people). On 3990 Old Richmond Rd in Nepean."
  },
  {
    "_id": "mosque_jamia_islamia",
    "name": "Jamia Islamia",
    "address": "2144 Rue Sainte-Hélène, Longueuil, QC J4K 3T6",
    "coordinates": {
      "lat": 45.513428,
      "lng": -73.4855384
    },
    "joinCode": "JAMIAI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-674-9018",
    "rating": {
      "score": 4.7,
      "count": 106
    },
    "bio": "Second-oldest masjid in Quebec. On 2144 Rue Sainte-Hélène in Longueuil."
  },
  {
    "_id": "mosque_kanata_muslim_association",
    "name": "Kanata Muslim Association",
    "address": "351 Sandhill Rd, Kanata, ON K2K 0P6",
    "coordinates": {
      "lat": 45.3562497,
      "lng": -75.9284454
    },
    "joinCode": "KANATA",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-973-5000",
    "rating": {
      "score": 4.9,
      "count": 252
    },
    "bio": "Three Jumu'ah services; kids' programs fill fast; fundraising to build a permanent mosque. On 351 Sandhill Rd in Kanata."
  },
  {
    "_id": "mosque_laval_islamic_cultural_centre",
    "name": "Laval Islamic Cultural Centre",
    "address": "1330 Rue Antonio, Laval, QC H7V 3N4",
    "coordinates": {
      "lat": 45.5475553,
      "lng": -73.7542296
    },
    "joinCode": "LAVALI",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 450-680-1612",
    "rating": {
      "score": 4.9,
      "count": 459
    },
    "bio": "Two Friday Jumu'ah services (12:45 & 1:30 PM); modern building, women's section. On 1330 Rue Antonio in Laval."
  },
  {
    "_id": "mosque_mac_barrhaven_islamic_centre",
    "name": "MAC Barrhaven Islamic Centre",
    "address": "3971 Greenbank Rd, Nepean, ON K2C 3H2",
    "coordinates": {
      "lat": 45.2364361,
      "lng": -75.7255711
    },
    "joinCode": "MACBAR",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "rating": {
      "score": 4.9,
      "count": 238
    },
    "bio": "MAC branch (centres.macnet.ca/bic); children's & adult Islamic activities. On 3971 Greenbank Rd in Nepean."
  },
  {
    "_id": "mosque_madinah_masjid",
    "name": "Madinah Masjid",
    "address": "1015 Danforth Ave, Toronto, ON M4J 1M1",
    "coordinates": {
      "lat": 43.6804494,
      "lng": -79.3361776
    },
    "joinCode": "MADIN2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-465-7833",
    "rating": {
      "score": 4.9,
      "count": 1497
    },
    "bio": "One of Toronto's oldest; large Ramadan iftar program. On 1015 Danforth Ave in Toronto."
  },
  {
    "_id": "mosque_masjid_al_forqane",
    "name": "Masjid Al-Forqane",
    "address": "3390 Bd Sainte-Rose, Laval, QC H7R 3R2",
    "coordinates": {
      "lat": 45.5489087,
      "lng": -73.8720449
    },
    "joinCode": "MASJI3",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 438-638-9777",
    "rating": {
      "score": 4.9,
      "count": 115
    },
    "bio": "Islamic classes for kids; 8-rakat Taraweeh; Jumu'ah 12:00 & 1:00 PM. On 3390 Bd Sainte-Rose in Laval."
  },
  {
    "_id": "mosque_masjid_al_hidaya",
    "name": "Masjid Al-Hidaya",
    "address": "1100 Birchmount Rd, Scarborough, ON M1K 5H9",
    "coordinates": {
      "lat": 43.735518,
      "lng": -79.2804141
    },
    "joinCode": "MASJI6",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-461-8842",
    "rating": {
      "score": 4.8,
      "count": 658
    },
    "bio": "Hosts the annual Ijtema gathering. On 1100 Birchmount Rd in Scarborough."
  },
  {
    "_id": "mosque_masjid_al_rahma",
    "name": "Masjid Al-Rahma",
    "address": "621 Bd Charest E, Québec, QC G1K 3J5",
    "coordinates": {
      "lat": 46.8144963,
      "lng": -71.2210212
    },
    "joinCode": "MASJI8",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 418-261-6652",
    "rating": {
      "score": 4.6,
      "count": 21
    },
    "bio": "MAC Quebec centre (mac-quebec.org); buzzer entry. On 621 Bd Charest E in Québec."
  },
  {
    "_id": "mosque_masjid_ar_rahmah",
    "name": "Masjid Ar-Rahmah",
    "address": "1216 Hunt Club Rd, Ottawa, ON K1V 2P1",
    "coordinates": {
      "lat": 45.3518291,
      "lng": -75.6472662
    },
    "joinCode": "MASJI7",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-523-9977",
    "rating": {
      "score": 4.9,
      "count": 1454
    },
    "bio": "Ottawa's flagship masjid; Turkish/Middle-Eastern inspired interior. On 1216 Hunt Club Rd in Ottawa."
  },
  {
    "_id": "mosque_masjid_as_salam",
    "name": "Masjid As-Salam",
    "address": "1177 Rue de la Montagne, Montréal, QC H3G 1Z2",
    "coordinates": {
      "lat": 45.4972367,
      "lng": -73.5730618
    },
    "joinCode": "MASJID",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "514-545-5466",
    "website": "salam-mosque.org",
    "rating": {
      "score": 4.8,
      "count": 614
    },
    "bio": "On 1177 Rue de la Montagne.",
    "services": [
      "Founded 2011 (originally on Stanley St, now at de la Montagne)",
      "Runs an authorized Marriage Registration service — has an officiant authorized by the province to file the...",
      "Daily prayers, Friday khutbah, Eid prayers followed by a light breakfast",
      "Ramadan: Taraweeh starting 5 min after adhan, plus a daily iftar served at Maghrib",
      "Coordinates its Ramadan/Taraweeh programming jointly with Al-Madinah Center",
      "Expanding its waqf toward a permanent downtown centre",
      "Larger separate women's floor"
    ]
  },
  {
    "_id": "mosque_masjid_darussalam",
    "name": "Masjid Darussalam",
    "address": "20 Overlea Blvd, East York, ON M4H 1A4",
    "coordinates": {
      "lat": 43.7047205,
      "lng": -79.3515266
    },
    "joinCode": "MASJI5",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-467-0786",
    "rating": {
      "score": 4.8,
      "count": 1374
    },
    "bio": "New large facility: gym/basketball court, funeral room, women's elevator entrance. On 20 Overlea Blvd in East York."
  },
  {
    "_id": "mosque_masjid_makkah_al_mukkaramah",
    "name": "Masjid Makkah-Al-Mukkaramah",
    "address": "11900 Boul. Gouin O, Pierrefonds, QC H8Z 1V6",
    "coordinates": {
      "lat": 45.5069757,
      "lng": -73.8249798
    },
    "joinCode": "MASJI2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-421-1455",
    "rating": {
      "score": 4.8,
      "count": 376
    },
    "bio": "On 11900 Boul. Gouin O in Pierrefonds.",
    "services": [
      "Active West Island mosque; two Jumu'ah services with khutbah by Sheikh Farasat; large prayer hall and parking",
      "Women's area on 2nd floor (stairs only, no elevator)"
    ]
  },
  {
    "_id": "mosque_masjid_toronto_adelaide",
    "name": "Masjid Toronto @ Adelaide",
    "address": "86 Adelaide St E, Toronto, ON M5C 1K6",
    "coordinates": {
      "lat": 43.6514455,
      "lng": -79.3743362
    },
    "joinCode": "MASJI4",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 647-748-4756",
    "rating": {
      "score": 4.9,
      "count": 752
    },
    "bio": "MAC-run; masjidtoronto.com; multiple Jumu'ah services. On 86 Adelaide St E in Toronto."
  },
  {
    "_id": "mosque_mosquee_al_ansar",
    "name": "Mosquée Al Ansar",
    "address": "221 Bd des Laurentides, Laval, QC H7G 2T7",
    "coordinates": {
      "lat": 45.5661353,
      "lng": -73.687141
    },
    "joinCode": "MOSQU4",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-466-7228",
    "rating": {
      "score": 4.7,
      "count": 79
    },
    "bio": "Known for its khatirah/lessons. On 221 Bd des Laurentides in Laval."
  },
  {
    "_id": "mosque_mosquee_al_athar",
    "name": "Mosquée Al Athar",
    "address": "1098 4e Avenue, Québec, QC G1J 3B3",
    "coordinates": {
      "lat": 46.8279581,
      "lng": -71.2282608
    },
    "joinCode": "MOSQU7",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "rating": {
      "score": 4.9,
      "count": 54
    },
    "bio": "Small musallah with a book collection; rear entrance. On 1098 4e Avenue in Québec."
  },
  {
    "_id": "mosque_mosquee_al_omah_al",
    "name": "Mosquée Al-Omah Al-Islamiah",
    "address": "1245 Rue Saint-Dominique, Montréal, QC H2X 2W4",
    "coordinates": {
      "lat": 45.5101411,
      "lng": -73.5623861
    },
    "joinCode": "MOSQU2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-879-8677",
    "rating": {
      "score": 4.8,
      "count": 469
    },
    "bio": "On 1245 Rue Saint-Dominique.",
    "services": [
      "Largest mosque in downtown Montreal",
      "Two Friday Jumu'ah services (12:00 and 1:00 PM)",
      "Daily prayers led by Sheikh Fawaz, who is reachable by phone",
      "Women's section upstairs with a ground-floor area for elderly women",
      "Ramadan Taraweeh"
    ]
  },
  {
    "_id": "mosque_mosquee_de_la_capitale",
    "name": "Mosquée de la Capitale",
    "address": "270 Rue Marie-de-l'Incarnation, Québec, QC G1N 3G6",
    "coordinates": {
      "lat": 46.8078263,
      "lng": -71.2454343
    },
    "joinCode": "MOSQU5",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 418-914-2025",
    "rating": {
      "score": 4.8,
      "count": 210
    },
    "bio": "Khutbah in Arabic then French; single Jumu'ah; call for door code if locked. On 270 Rue Marie-de-l'Incarnation in Québec."
  },
  {
    "_id": "mosque_mosquee_de_quebec_a",
    "name": "Mosquée de Québec à Limoilou",
    "address": "1287 1re Av., Québec, QC G1L 3K7",
    "coordinates": {
      "lat": 46.8268788,
      "lng": -71.2349402
    },
    "joinCode": "MOSQU6",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 418-204-4477",
    "rating": {
      "score": 4.9,
      "count": 103
    },
    "bio": "Limoilou neighbourhood mosque; back-door entry if front is locked. On 1287 1re Av. in Québec."
  },
  {
    "_id": "mosque_mosquee_madani_academy_an",
    "name": "Mosquée Madani / Academy An-Noor",
    "address": "12080 Blvd. Laurentien, Montréal, QC H4K 1M9",
    "coordinates": {
      "lat": 45.5269045,
      "lng": -73.7180181
    },
    "joinCode": "MOSQUE",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-331-0733",
    "website": "academyannoor.com",
    "rating": {
      "score": 4.9,
      "count": 891
    },
    "bio": "On 12080 Blvd. Laurentien.",
    "services": [
      "Academy An-Noor teaches Quran, Arabic, Tajweed, Tafsir, Hadith, Seerah, Du'as, Aqaa'id and Islamic culture —...",
      "Class formats: Weekday Evening classes, Weekend classes, Tahfeez-UL-Quran (full memorization) classes, and an...",
      "Nikah / Katb Kitab Islamic wedding ceremonies (Sheikh Imran officiates)",
      "Youth religious guidance",
      "Family fun events and end-of-year community gala",
      "Capacity 800+; services in English, French, Arabic and Urdu"
    ]
  },
  {
    "_id": "mosque_mosquee_rahma_du_cds",
    "name": "Mosquée Rahma du CDS Balimaya",
    "address": "5690 Rue Fullum, Local B, Montréal, QC H2G 2H7",
    "coordinates": {
      "lat": 45.5435554,
      "lng": -73.5835812
    },
    "joinCode": "MOSQU3",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-272-2424",
    "rating": {
      "score": 5,
      "count": 203
    },
    "bio": "On 5690 Rue Fullum.",
    "services": [
      "Run by the Cds Balimaya community organization, serving the West-African Muslim community",
      "Daily prayers, women's section, Friday khutbah described as traditionally grounded but accessible"
    ]
  },
  {
    "_id": "mosque_scarborough_muslim_association_jame",
    "name": "Scarborough Muslim Association – Jame Abu Bakr Siddique",
    "address": "2665 Lawrence Ave E, Scarborough, ON M1P 2S2",
    "coordinates": {
      "lat": 43.7516537,
      "lng": -79.262253
    },
    "joinCode": "SCARBO",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-750-2253",
    "rating": {
      "score": 4.8,
      "count": 1770
    },
    "bio": "Produces 30+ Hifz graduates yearly. On 2665 Lawrence Ave E in Scarborough."
  },
  {
    "_id": "mosque_shah_jalal_mosque",
    "name": "Shah Jalal Mosque",
    "address": "3740 Rue Workman, Montréal, QC H4C 1N8",
    "coordinates": {
      "lat": 45.4794565,
      "lng": -73.5825481
    },
    "joinCode": "SHAHJA",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-935-1213",
    "rating": {
      "score": 4.7,
      "count": 162
    },
    "bio": "On 3740 Rue Workman.",
    "services": [
      "Bangladeshi-community mosque near Atwater Market / Lionel-Groulx",
      "Daily prayers",
      "Imam reachable at 514-817-5289"
    ]
  },
  {
    "_id": "mosque_snmc_mosque",
    "name": "SNMC Mosque",
    "address": "3020 Woodroffe Ave, Nepean, ON K2J 6B4",
    "coordinates": {
      "lat": 45.2891467,
      "lng": -75.7264618
    },
    "joinCode": "SNMCMO",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-440-6300",
    "rating": {
      "score": 4.8,
      "count": 846
    },
    "bio": "On-site school; youth, sisters' and elders' programs; community events hall. On 3020 Woodroffe Ave in Nepean."
  },
  {
    "_id": "mosque_the_ismaili_centre_toronto",
    "name": "The Ismaili Centre, Toronto",
    "address": "49 Wynford Dr, North York, ON M3C 1K1",
    "coordinates": {
      "lat": 43.7240378,
      "lng": -79.3335709
    },
    "joinCode": "THEISM",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-646-6965",
    "rating": {
      "score": 4.9,
      "count": 821
    },
    "bio": "Ismaili Jamatkhana + cultural centre; guided tours; pairs with the Aga Khan Museum. On 49 Wynford Dr in North York."
  },
  {
    "_id": "mosque_the_ottawa_islamic_centre",
    "name": "The Ottawa Islamic Centre & Assalam Mosque",
    "address": "2335 St. Laurent Blvd #100, Ottawa, ON K1G 5G6",
    "coordinates": {
      "lat": 45.3831034,
      "lng": -75.6202987
    },
    "joinCode": "THEOTT",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 613-739-3939",
    "rating": {
      "score": 4.8,
      "count": 510
    },
    "bio": "Eid fun-day with kids' activities & market area. On 2335 St. Laurent Blvd #100 in Ottawa."
  },
  {
    "_id": "mosque_toronto_and_region_islamic",
    "name": "Toronto and Region Islamic Congregation",
    "address": "99 Beverly Hills Dr, North York, ON M3L 1A2",
    "coordinates": {
      "lat": 43.7180767,
      "lng": -79.5162528
    },
    "joinCode": "TORON2",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 416-245-5675",
    "rating": {
      "score": 4.7,
      "count": 431
    },
    "bio": "Strong Qur'an-teaching programs; basketball court. On 99 Beverly Hills Dr in North York."
  },
  {
    "_id": "mosque_toronto_islamic_centre_community",
    "name": "Toronto Islamic Centre & Community Services",
    "address": "817 Yonge St, Toronto, ON M4W 2G9",
    "coordinates": {
      "lat": 43.6725264,
      "lng": -79.3874306
    },
    "joinCode": "TORONT",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 647-350-4262",
    "rating": {
      "score": 4.9,
      "count": 685
    },
    "bio": "Jumu'ah 12:30 & 1:30 PM; own mobile app for prayer times. On 817 Yonge St in Toronto."
  },
  {
    "_id": "mosque_turkish_muslim_association_of",
    "name": "Turkish Muslim Association of Montreal",
    "address": "416 Bd Neptune, Dorval, QC H9S 2L8",
    "coordinates": {
      "lat": 45.4473283,
      "lng": -73.7740991
    },
    "joinCode": "TURKIS",
    "prayerConfig": {
      "calculationMethod": "NorthAmerica",
      "madhab": "shafi",
      "highLatitudeRule": "TwilightAngle"
    },
    "phone": "+1 514-636-2827",
    "rating": {
      "score": 4.5,
      "count": 176
    },
    "bio": "On 416 Bd Neptune in Dorval.",
    "services": [
      "Turkish-community mosque near the airport, founded by Imam Mehmet Deger, one of the early figures in...",
      "Two Jumu'ah prayers (winter: 12:20 PM and 1:15 PM)",
      "Community aid offered regardless of the recipient's religion",
      "Open 12–5 PM daily"
    ]
  }
];

/** Directory ids, for the "is this mosque claimed?" check the UI makes. */
export const directoryMosqueIds: ReadonlySet<string> = new Set(
  directoryMosques.map((m) => m._id),
);
