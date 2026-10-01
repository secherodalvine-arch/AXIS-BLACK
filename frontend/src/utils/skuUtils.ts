/**
 * Smart ERP Item Code / SKU Utility
 * Generates structured, category-aware product codes when no custom code is provided.
 */
export const generateSmartItemCode = (category?: string, name?: string): string => {
  const cat = (category || '').trim().toLowerCase();
  let prefix = 'ITEM';

  if (cat.includes('hardware') || cat.includes('device')) prefix = 'HW';
  else if (cat.includes('finish') || cat.includes('product')) prefix = 'FG';
  else if (cat.includes('raw') || cat.includes('part') || cat.includes('material')) prefix = 'RM';
  else if (cat.includes('office') || cat.includes('facilit') || cat.includes('equip')) prefix = 'OE';
  else if (cat.includes('packag') || cat.includes('logistic')) prefix = 'PKG';
  else if (cat.includes('electric') || cat.includes('electron')) prefix = 'ELEC';
  else if (cat.includes('apparel') || cat.includes('cloth') || cat.includes('fashion')) prefix = 'APP';
  else if (cat.includes('food') || cat.includes('beverag')) prefix = 'FB';
  else if (cat.includes('chemical') || cat.includes('pharma')) prefix = 'CHEM';
  else if (cat.includes('service') || cat.includes('consult')) prefix = 'SRV';
  else if (cat.includes('general') || cat.includes('stock')) prefix = 'STK';
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

  if (!prefix || prefix.length < 2) prefix = 'SKU';
  
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randNum}`;
};
