export const calculateCPVC = (items: any[], rmMasterProducts: any[]) => {
  let totalExtenderPercentage = 0;

  const sumPercentageTimesOilAbsorption = items.reduce((sum, item) => {
    const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
    if (rmProduct?.Subcategory === 'Extender') {
      const percentage = parseFloat(String(item.percentage || '0'));
      const oilAbsorption = parseFloat(String(rmProduct.OilAbsorption || '0'));
      totalExtenderPercentage += percentage;
      return sum + percentage * oilAbsorption;
    }
    return sum;
  }, 0);

  const sumPercentageTimesDensity = items.reduce((sum, item) => {
    const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
    if (rmProduct?.Subcategory === 'Extender') {
      const percentage = parseFloat(String(item.percentage || '0'));
      // Fallback to Density if RMDensity doesn't exist, though UI usually relies on RMDensity
      const density = parseFloat(String(rmProduct.RMDensity || rmProduct.Density || '0'));
      return sum + percentage * density;
    }
    return sum;
  }, 0);

  if (totalExtenderPercentage === 0) return 0;

  const weightedOilAbsorption = sumPercentageTimesOilAbsorption / totalExtenderPercentage;
  const weightedDensity = sumPercentageTimesDensity / totalExtenderPercentage;

  const result = (weightedOilAbsorption * weightedDensity) / 93;
  const cpvc = (1 / (1 + result)) * 100;

  return cpvc;
};
