export interface HeaderIndices {
  skuIdx: number;
  nameIdx: number;
  currencyIdx: number;
  unitPriceIdx: number;
  basePriceListIdx: number;
}

export function mapHeadersToIndices(headers: string[]): HeaderIndices {
  const find = (target: string) =>
    headers.findIndex((h) => h?.toLowerCase().trim() === target.toLowerCase());

  return {
    skuIdx: find("Item No."),
    nameIdx: find("Item Description"),
    basePriceListIdx: find("Base Price List"),
    currencyIdx: find("Primary Currency - Base Price (currency)"),
    unitPriceIdx: find("Primary Currency - Base Price"),
  };
}



