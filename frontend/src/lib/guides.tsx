import { CloudLightning, Flame, Mountain, Sun, Tornado, Waves, Activity, Droplets, type LucideIcon } from 'lucide-react';

export interface Guide {
  key: string; title: string; summary: string; icon: LucideIcon; from: string; to: string;
  incidentTypes: string[]; before: string[]; during: string[]; after: string[];
}

// Plain-language safety guidance, based on public NDMA (India) awareness material.
export const GUIDES: Guide[] = [
  {
    key: 'earthquake', title: 'Earthquake', icon: Activity, from: '#7c2d12', to: '#1c1917', incidentTypes: ['EARTHQUAKE', 'BUILDING_COLLAPSE'],
    summary: 'Stay safe during and after earthquakes with these essential guidelines.',
    before: ['Fix heavy shelves and cylinders to the wall.', 'Pick a safe spot in each room: under a sturdy table, away from glass.', 'Keep an emergency kit: water, torch, first-aid, medicines, copies of ID.'],
    during: ['Drop, Cover and Hold On until the shaking stops.', 'If outdoors, move to an open area away from buildings, trees and wires.', 'Do not use lifts. Do not run outside while the ground is shaking.'],
    after: ['Expect aftershocks. Leave damaged buildings carefully.', 'Check for gas leaks; do not light matches.', 'Call 112 for anyone trapped; do not move badly injured people.'],
  },
  {
    key: 'flood', title: 'Flood', icon: Droplets, from: '#0e7490', to: '#0c1a24', incidentTypes: ['FLOOD', 'WATER_RESCUE'],
    summary: 'Know how to prepare and stay safe during floods.',
    before: ['Know the nearest shelter on higher ground (see Shelters).', 'Keep documents and medicines in a waterproof bag.', 'Move valuables, food and water to an upper floor.'],
    during: ['Switch off electricity at the main switch.', 'Never walk or drive through moving water; 15 cm can knock you down.', 'Move to higher ground and wait for rescue teams if trapped.'],
    after: ['Drink only boiled or purified water.', 'Stay away from fallen power lines and damaged buildings.', 'Clean and disinfect everything that got wet.'],
  },
  {
    key: 'cyclone', title: 'Cyclone', icon: Tornado, from: '#334155', to: '#0f172a', incidentTypes: ['CYCLONE'],
    summary: 'Be prepared for cyclones and strong winds.',
    before: ['Follow IMD warnings on radio, TV or mobile alerts.', 'Tie down loose roof sheets and objects outside.', 'Store dry food, drinking water and a battery radio.'],
    during: ['Stay indoors away from windows; shelter in the strongest room.', 'If told to evacuate, go to the nearest cyclone shelter at once.', 'Beware the calm "eye": strong winds return from the other side.'],
    after: ['Wait for the official all-clear before going out.', 'Avoid loose and hanging electric wires.', 'Report damaged roads and blocked drains.'],
  },
  {
    key: 'tsunami', title: 'Tsunami', icon: Waves, from: '#1e3a8a', to: '#0b1120', incidentTypes: ['TSUNAMI'],
    summary: 'Learn early warning signs and evacuation steps.',
    before: ['Know your evacuation route to high ground (at least 30 m above sea level).', 'Learn natural warnings: strong quake near the coast, sea pulling back suddenly.'],
    during: ['Move inland and uphill immediately; do not wait for an official warning.', 'If you cannot leave, go to the upper floor of a strong concrete building.', 'Stay away from the beach; more waves can follow for hours.'],
    after: ['Return only when authorities declare it safe.', 'Avoid flood water; it may hide debris and live wires.'],
  },
  {
    key: 'wildfire', title: 'Wildfire', icon: Flame, from: '#9a3412', to: '#1c0f0a', incidentTypes: ['FIRE', 'WILDFIRE', 'GAS_LEAK'],
    summary: 'Prevent fires and get out safely when one starts.',
    before: ['Clear dry leaves and waste around homes near forests.', 'Keep a bucket of sand or water and a fire extinguisher at hand.'],
    during: ['Call 101 (Fire) or 112 at once.', 'Leave early on the route away from smoke; cover nose and mouth with a wet cloth.', 'If clothes catch fire: Stop, Drop and Roll.'],
    after: ['Do not go back until fire officials say it is safe.', 'Watch for hot spots and weakened trees.'],
  },
  {
    key: 'landslide', title: 'Landslide', icon: Mountain, from: '#57534e', to: '#1c1917', incidentTypes: ['LANDSLIDE', 'TREE_FALL'],
    summary: 'Recognise warning signs on slopes during heavy rain.',
    before: ['Watch for new cracks in ground or walls, tilting trees or poles.', 'Avoid building or camping near steep slopes and drains.'],
    during: ['Move away from the path of the slide, sideways, not downhill.', 'Listen for rumbling or cracking sounds; leave at once.'],
    after: ['Stay away from the slide area; more slides can follow.', 'Report blocked roads and injured people to 112.'],
  },
  {
    key: 'heatwave', title: 'Heatwave', icon: Sun, from: '#b45309', to: '#1f130a', incidentTypes: ['HEATWAVE'],
    summary: 'Stay cool and protect elderly people and children.',
    before: ['Keep ORS, water and a hat ready; plan outdoor work for early morning.'],
    during: ['Drink water often, even if not thirsty.', 'Stay indoors between 12 noon and 3 pm.', 'Signs of heat stroke: hot dry skin, confusion. Call 108 and cool the person.'],
    after: ['Check on neighbours who live alone.'],
  },
  {
    key: 'storm', title: 'Severe Storm', icon: CloudLightning, from: '#3730a3', to: '#0f0d24', incidentTypes: ['SEVERE_STORM'],
    summary: 'Protect yourself from lightning and strong winds.',
    before: ['Unplug electrical appliances when a storm is forecast.'],
    during: ['Go indoors. If outside, avoid tall trees, poles and open fields.', 'Stay away from water, metal fences and tin roofs.'],
    after: ['Report fallen trees and power lines; do not touch them.'],
  },
];

export const HELPLINES = [
  { label: 'National Emergency', number: '112' },
  { label: 'Ambulance', number: '108' },
  { label: 'Fire', number: '101' },
  { label: 'Police', number: '100' },
  { label: 'Disaster Helpline (NDMA)', number: '1078' },
  { label: 'State / District Control Room', number: '1070 / 1077' },
];

export function guideForType(incidentType: string): Guide | undefined {
  return GUIDES.find((g) => g.incidentTypes.includes(incidentType));
}
