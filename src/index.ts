import {
  getItems,
  getOrders,
  generateParcels,
  computeTotalAmount,
  writeResult,
} from './utils';

const main = async () => {
  const items = getItems();
  const orders = getOrders(items);
  const parcels = await generateParcels(orders);
  const totalAmount = computeTotalAmount(parcels);

  writeResult(parcels);
  console.log(`
    Orders: ${orders.length}
    Parcels: ${parcels.length}
    Total cost: ${totalAmount}€
  `);
};

main();
