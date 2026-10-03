/**
 * Item Code Utility
 * Generates an easy-to-read product code (e.g. HAIR-4821) when the user does not type their own.
 */
export const generateSmartItemCode = (category?: string, name?: string): string => {
  const cat = (category || '').trim().toLowerCase();
  let prefix = 'ITEM';

  // Friendly categories first (order matters: "Hair Products" must not fall into the generic "product" rule)
  if (cat.includes('hair')) prefix = 'HAIR';
  else if (cat.includes('skin') || cat.includes('beauty')) prefix = 'SKIN';
  else if (cat.includes('food') || cat.includes('drink') || cat.includes('beverag')) prefix = 'FOOD';
  else if (cat.includes('cloth') || cat.includes('shoe') || cat.includes('apparel') || cat.includes('fashion')) prefix = 'WEAR';
  else if (cat.includes('phone') || cat.includes('electric') || cat.includes('electron')) prefix = 'ELEC';
  else if (cat.includes('home') || cat.includes('kitchen')) prefix = 'HOME';
  else if (cat.includes('health') || cat.includes('medic') || cat.includes('chemical') || cat.includes('pharma')) prefix = 'MED';
  else if (cat.includes('building') || cat.includes('tool')) prefix = 'BLD';
  else if (cat.includes('stationery') || cat.includes('office')) prefix = 'OFF';
  else if (cat.includes('make things') || cat.includes('material') || cat.includes('raw')) prefix = 'RAW';
  else if (cat.includes('packag')) prefix = 'PKG';
  else if (cat.includes('other') || cat.includes('general')) prefix = 'GEN';
  // Older category names (kept so existing items still get sensible codes)
  else if (cat.includes('hardware') || cat.includes('device')) prefix = 'HW';
  else if (cat.includes('finish') || cat.includes('product')) prefix = 'FG';
  else if (cat.includes('service') || cat.includes('consult')) prefix = 'SRV';
  else if (cat.length >= 3) {
    const words = cat.split(/[\s&/-]+/).filter(Boolean);
    if (words.length >= 2) {
      prefix = (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else {
      prefix = cat.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
  } else if (name && name.trim().length >= 3) {
    const cleanName = name.trim().replace(/[^a-zA-Z0-9]/g, '');
    prefix = cleanName.substring(0, 3).toUpperCase();
  }

  if (!prefix || prefix.length < 2) prefix = 'ITEM';

  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randNum}`;
};
