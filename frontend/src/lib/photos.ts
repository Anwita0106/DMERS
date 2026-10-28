// Disaster photographs used by the site. All are U.S. Government works in the public domain,
// hosted on Wikimedia Commons. `tools/download_photos.py` (run by windows/1_SETUP.bat) saves
// them into frontend/public/images/<key>.jpg so the site works offline. If a local file is
// missing, the page loads the same photo from Wikimedia, and if that fails too it shows the
// built-in illustration.
export interface Photo { key: string; file: string; credit: string; caption: string }

export const PHOTOS: Record<string, Photo> = {
  hero: { key: 'hero', file: '101st_Rescue_Squadron_-_Hurricane_Katrina_Rescue.jpg',
    credit: 'U.S. Air Force, public domain', caption: 'Air rescue during Hurricane Katrina' },
  earthquake: { key: 'earthquake', file: 'US_Navy_110315-N-5503T-756_A_Japanese_search_and_rescue_team_searches_the_rubble_near_a_high-rise_building_in_Northern_Japan.jpg',
    credit: 'U.S. Navy, public domain', caption: 'Search and rescue team in earthquake rubble' },
  flood: { key: 'flood', file: 'FEMA_downtown_Cedar_Rapids_Iowa_flood_2008.jpg',
    credit: 'FEMA, public domain', caption: 'Flooded city centre' },
  cyclone: { key: 'cyclone', file: 'Hurricane_Isabel_from_ISS.jpg',
    credit: 'NASA, public domain', caption: 'Cyclone seen from the International Space Station' },
  tsunami: { key: 'tsunami', file: 'US_Navy_110315-N-2653B-054_The_city_of_Ofunato,_Japan,_is_severely_damaged_by_a_9.0_magnitude_earthquake_and_subsequent_tsunami.jpg',
    credit: 'U.S. Navy, public domain', caption: 'Coastal town after a tsunami' },
  wildfire: { key: 'wildfire', file: 'Rim_Fire_20130817-FS-UNK-0027_(9626930351).jpg',
    credit: 'U.S. Forest Service, public domain', caption: 'Wildfire' },
  landslide: { key: 'landslide', file: 'Thistlelandslideusgs.jpg',
    credit: 'USGS, public domain', caption: 'Landslide blocking a valley' },
  heatwave: { key: 'heatwave', file: 'Corn_shows_the_affect_of_drought.jpg',
    credit: 'USDA, public domain', caption: 'Crops damaged by heat and drought' },
  storm: { key: 'storm', file: 'Lightning_NOAA.jpg',
    credit: 'NOAA, public domain', caption: 'Lightning storm' },
};

export const localSrc = (key: string) => `/images/${key}.jpg`;
export const remoteSrc = (key: string, width = 1600) =>
  PHOTOS[key] ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(PHOTOS[key].file)}?width=${width}` : '';
export const sourcePage = (key: string) =>
  PHOTOS[key] ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(PHOTOS[key].file)}` : '';
