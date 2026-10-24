/**
 * SAMPLE rate card for Saudi Arabia (SAR).
 *
 * These numbers are illustrative placeholders for development and demos only.
 * They are NOT market quotations and must be replaced with the production company's
 * own negotiated rates before a budget is shared with anyone. The UI labels any
 * budget built from a sample card accordingly.
 */
export interface RateCardItemSeed {
  key: string;
  category: string;
  label: string;
  unit: "day" | "flat" | "hour" | "person_day";
  rate: number;
}

export const SAMPLE_SA_RATE_CARD: { name: string; country: string; currency: string; items: RateCardItemSeed[] } = {
  name: "Sample rates — Saudi Arabia (replace before use)",
  country: "SA",
  currency: "SAR",
  items: [
    { key: "crew.director", category: "Director", label: "Director", unit: "day", rate: 6000 },
    { key: "crew.producer", category: "Producing", label: "Producer", unit: "day", rate: 3500 },
    { key: "crew.production_manager", category: "Production management", label: "Production manager", unit: "day", rate: 2000 },
    { key: "crew.assistant_director", category: "Production management", label: "1st Assistant director", unit: "day", rate: 2000 },
    { key: "crew.dop", category: "Camera department", label: "Director of photography", unit: "day", rate: 4500 },
    { key: "crew.camera_assistant", category: "Camera department", label: "Camera assistant", unit: "day", rate: 1000 },
    { key: "crew.gaffer", category: "Lighting", label: "Gaffer", unit: "day", rate: 1500 },
    { key: "crew.electric", category: "Lighting", label: "Electrician", unit: "day", rate: 800 },
    { key: "crew.grip", category: "Grip", label: "Key grip", unit: "day", rate: 900 },
    { key: "crew.sound_mixer", category: "Sound", label: "Sound recordist", unit: "day", rate: 1500 },
    { key: "crew.boom", category: "Sound", label: "Boom operator", unit: "day", rate: 700 },
    { key: "crew.art_director", category: "Art department", label: "Art director", unit: "day", rate: 2000 },
    { key: "crew.props_master", category: "Art department", label: "Props master", unit: "day", rate: 900 },
    { key: "crew.wardrobe", category: "Wardrobe", label: "Wardrobe stylist", unit: "day", rate: 1000 },
    { key: "crew.makeup", category: "Makeup", label: "Hair & makeup artist", unit: "day", rate: 1000 },
    { key: "crew.runner", category: "Production management", label: "Production assistant", unit: "day", rate: 400 },
    { key: "crew.drone_pilot", category: "Camera department", label: "Licensed drone operator", unit: "day", rate: 3500 },
    { key: "cast.principal", category: "Cast", label: "Principal cast", unit: "day", rate: 2500 },
    { key: "cast.extra", category: "Extras", label: "Background extra", unit: "person_day", rate: 350 },
    { key: "equip.camera_package", category: "Equipment", label: "Camera package", unit: "day", rate: 3500 },
    { key: "equip.lighting_package", category: "Equipment", label: "Lighting package", unit: "day", rate: 2500 },
    { key: "equip.lighting_night_extra", category: "Equipment", label: "Night lighting / generator add-on", unit: "day", rate: 2000 },
    { key: "equip.grip_package", category: "Equipment", label: "Grip package", unit: "day", rate: 1200 },
    { key: "equip.sound_package", category: "Equipment", label: "Sound package", unit: "day", rate: 800 },
    { key: "equip.drone", category: "Equipment", label: "Drone package", unit: "day", rate: 1500 },
    { key: "loc.fee", category: "Locations", label: "Location fee", unit: "day", rate: 3000 },
    { key: "loc.permit", category: "Permits", label: "Location permit (per location)", unit: "flat", rate: 1500 },
    { key: "loc.scout", category: "Location scouting", label: "Location scouting", unit: "day", rate: 1500 },
    { key: "transport.van", category: "Transportation", label: "Crew van with driver", unit: "day", rate: 900 },
    { key: "catering.person_day", category: "Catering", label: "Catering", unit: "person_day", rate: 120 },
    { key: "art.props_allowance", category: "Art department", label: "Props allowance (per scene with props)", unit: "flat", rate: 600 },
    { key: "art.wardrobe_allowance", category: "Wardrobe", label: "Wardrobe allowance (per character)", unit: "flat", rate: 800 },
    { key: "art.vehicle", category: "Art department", label: "Picture vehicle", unit: "day", rate: 1200 },
    { key: "art.animal_handler", category: "Art department", label: "Animal + handler", unit: "day", rate: 2500 },
    { key: "fx.sfx_day", category: "Special effects", label: "SFX technician + consumables", unit: "day", rate: 3000 },
    { key: "safety.officer", category: "Safety", label: "Safety officer", unit: "day", rate: 1200 },
    { key: "insurance.production", category: "Insurance", label: "Production insurance (estimate)", unit: "flat", rate: 5000 },
    { key: "post.editor", category: "Editing", label: "Editor", unit: "day", rate: 1800 },
    { key: "post.color", category: "Color grading", label: "Colorist", unit: "day", rate: 3000 },
    { key: "post.sound_design", category: "Sound design", label: "Sound design & mix", unit: "day", rate: 2500 },
    { key: "post.music_license", category: "Music", label: "Music (library licence)", unit: "flat", rate: 3000 },
    { key: "post.vfx_shot", category: "VFX", label: "VFX (per scene with VFX)", unit: "flat", rate: 4000 },
    { key: "post.subtitles", category: "Subtitles", label: "Subtitles (EN/AR)", unit: "flat", rate: 1500 },
    { key: "pre.casting", category: "Casting", label: "Casting session", unit: "day", rate: 2000 },
    { key: "dev.storyboard", category: "Storyboarding", label: "Storyboard artist", unit: "day", rate: 1500 },
  ],
};
