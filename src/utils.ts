import { readFileSync, writeFileSync } from 'fs';
import axios from 'axios';
import {
  PARCEL_MAX_WEIGHT,
  ITEMS_FILE_PATH,
  PARCELS_FILE_PATH,
  ORDERS_FILE_PATH,
  MAX_PARCEL_PER_PALETTE,
} from './environment';
import { ItemNotFoundError } from './errors';
import { DataItems, DataOrders, Item, Order, Parcel } from './typing';

/**
 * ----------------------------
 * PRIVATE
 * ----------------------------
 */

/**
 * Find an item using its id within an array of items
 * @private
 * @param id
 * @param items
 */
const findItemById = (id: Item['id'], items: Item[]): Item => {
  const item = items.find((cursor) => cursor.id === id);
  if (!item) {
    throw new ItemNotFoundError(id);
  }
  return item;
};

/**
 * Generate a tracking code using an external API
 * (the API limits the amount of queries you can trigger)
 * @private
 */
const getTrackingCode = async (): Promise<string> => {
  const res = await axios.post('https://helloacm.com/api/random/?n=15');
  return res.data;
};

/**
 * Generate all the items that an order contains in order to place them in the right parcel
 * ~ transforms a JSON { item: Item, capacity: number } into Item[]
 * @private
 * @param order
 */
const generateParcelItems = (order: Order): Item[] =>
  order.items.reduce(
    (acc, cursor) => [
      ...acc,
      ...Array.from(new Array(cursor.quantity)).map(() => cursor.item),
    ],
    new Array<Item>(),
  );

/**
 * As a parcel cannot exceed 30kg, orders can be split over many parcels.
 * @private
 * @param order
 */
const splitOrderOverParcels = (order: Order): Item[][] => {
  // We generate one item per item ordered (they are grouped in the JSON) and we sort them by descending
  let items = generateParcelItems(order).sort((a, b) => b.weight - a.weight);
  const itemGroup = new Array<Item[]>([]);

  while (items.length > 0) {
    const group = itemGroup[itemGroup.length - 1];
    const weight = getItemGroupWeight(group);

    // Find if there is an item which can be added to the parcel without exceeding the limit
    const index = items.findIndex((cursor) => !isOverWeighted(cursor.weight + weight));

    if (index !== -1) {
      // Add the Item to latest ItemGroup (will be transformed to a parcel)
      group.push(items[index]);
      items = [...items.slice(0, index), ...items.slice(index + 1, items.length)];
    } else {
      // Add the Item to a new ItemGroup (will be transformed to a parcel)
      itemGroup.push([items.shift() as Item]);
    }
  }

  return itemGroup;
};

/**
 * ----------------------------
 * PUBLIC
 * ----------------------------
 */

/**
 * Checks if a given weight is exceeding the defined limit
 * @param weight
 */
export const isOverWeighted = (weight: number): boolean => weight > PARCEL_MAX_WEIGHT;

/**
 * Retrieve the items from the furnished JSON file and format them into a stronger structure
 */
export const getItems = (): Item[] => {
  const items = readFileSync(ITEMS_FILE_PATH);
  const dataItems = JSON.parse(items.toString()) as DataItems;
  return dataItems.items.map((cursor) => ({
    ...cursor,
    weight: parseFloat(cursor.weight),
  }));
};

/**
 * Retrieve the orders from the furnished JSON file and format them into a stronger structure
 * We need the Items in order to link them to the Orders
 * @param items
 */
export const getOrders = (items: Item[]): Order[] => {
  const orders = readFileSync(ORDERS_FILE_PATH);
  const dataOrders = JSON.parse(orders.toString()) as DataOrders;
  return dataOrders.orders.map((cursor) => ({
    id: cursor.id,
    date: new Date(cursor.date),
    items: cursor.items.map(({ item_id, quantity }) => ({
      item: findItemById(item_id, items),
      quantity: parseInt(quantity, 10),
    })),
  }));
};

/**
 * Compute the weight of a list of items (just a basic sum)
 * @param items
 */
export const getItemGroupWeight = (items: Item[]): number =>
  items.reduce((acc, item) => acc + item.weight, 0);

/**
 * Generate the parcels from the order and assign them to the right palette
 * @param orders
 * @param maxParcelPerPalette
 */
export const generateParcels = async (
  orders: Order[],
  maxParcelPerPalette = MAX_PARCEL_PER_PALETTE,
): Promise<Parcel[]> => {
  const parcels = orders.reduce(async (acc, order, position) => {
    const itemGroup = splitOrderOverParcels(order);
    const parcels = new Array<Parcel>();
    for (const items of itemGroup) {
      const paletteId = Math.floor(position / maxParcelPerPalette) + 1;
      const trackingCode = await getTrackingCode();
      parcels.push(new Parcel(order, paletteId, trackingCode, items));
    }
    return [...(await acc), ...parcels];
  }, Promise.resolve(new Array<Parcel>()));

  return parcels;
};

/**
 * Compute how much a list a parcels is gonna cost
 * @param parcels
 */
export const computeTotalAmount = (parcels: Parcel[]): number =>
  parcels.reduce((acc, parcel) => acc + parcel.cost, 0);

/**
 * Update a message on a single line in the console
 * @param text
 */
export const inlineMessage = (text: string): void => {
  process.stdout.clearLine(1);
  process.stdout.cursorTo(0);
  process.stdout.write(text);
};

/**
 * Writes generate parcels into a JSON file
 * @param parcels
 */
export const writeResult = (parcels: Parcel[]): void => {
  const stringifiedParcels = JSON.stringify(parcels, null, 2);
  writeFileSync(PARCELS_FILE_PATH, stringifiedParcels);
};
