import { readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const ITEMS_FILE_PATH = join(__dirname, './data/items.json');
const ORDERS_FILE_PATH = join(__dirname, './data/orders.json');
const PARCEL_MAX_WEIGHT = 30;

interface DataItems {
  items: {
    id: string;
    name: string;
    weight: string;
  }[];
}

interface DataOrders {
  orders: {
    id: string;
    date: string;
    items: {
      item_id: string;
      quantity: string;
    }[];
  }[];
}

interface Item {
  id: string;
  name: string;
  weight: number;
}

interface Order {
  id: string;
  date: Date;
  items: {
    item: Item;
    quantity: number;
  }[];
}

class Parcel {
  constructor(
    public order: Order,
    public paletteId: number,
    public trackingId: string,
    public items: Item[],
  ) {}

  get weight(): number {
    return getItemGroupWeight(this.items);
  }

  get cost(): number {
    if (this.weight <= 1) {
      return 1;
    }

    if (this.weight <= 5) {
      return 2;
    }

    if (this.weight <= 10) {
      return 3;
    }

    if (this.weight <= 20) {
      return 5;
    }

    if (this.isOverWeighted) {
      throw new Error(
        `The parcel ${this.trackingId} is exceeding the maximum weight authorized (${this.weight} > ${PARCEL_MAX_WEIGHT}kg)`,
      );
    }

    return 10;
  }

  get isOverWeighted(): boolean {
    return isOverWeighted(this.weight);
  }
}

const isOverWeighted = (weight: number) => weight > PARCEL_MAX_WEIGHT;

const getItems = (): Item[] => {
  const items = readFileSync(ITEMS_FILE_PATH);
  const dataItems = JSON.parse(items.toString()) as DataItems;
  return dataItems.items.map((cursor) => ({
    ...cursor,
    weight: parseFloat(cursor.weight),
  }));
};

const findItemById = (id: Item['id'], items: Item[]): Item => {
  const item = items.find((cursor) => cursor.id === id);
  if (!item) {
    throw new Error(`No item not found with the id: ${id}`);
  }
  return item;
};

const getOrders = (items: Item[]): Order[] => {
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

const getTrackingCode = async (): Promise<string> => {
  const res = await axios.post('https://helloacm.com/api/random/?n=15');
  return res.data;
};

const generateParcelItems = (order: Order): Item[] =>
  order.items.reduce(
    (acc, cursor) => [
      ...acc,
      ...Array.from(new Array(cursor.quantity)).map(() => cursor.item),
    ],
    new Array<Item>(),
  );

const getItemGroupWeight = (items: Item[]) =>
  items.reduce((acc, item) => acc + item.weight, 0);

const splitOrderOverParcels = (order: Order): Item[][] => {
  let items = generateParcelItems(order).sort((a, b) => b.weight - a.weight);
  const itemGroup = new Array<Item[]>([]);

  while (items.length > 0) {
    const group = itemGroup[itemGroup.length - 1];
    const weight = getItemGroupWeight(group);
    const index = items.findIndex(
      (cursor) => cursor.weight + weight <= PARCEL_MAX_WEIGHT,
    );
    if (index !== -1) {
      group.push(items[index]);
      items = [...items.slice(0, index), ...items.slice(index + 1, items.length)];
    } else {
      itemGroup.push([items.shift() as Item]);
    }
  }

  return itemGroup;
};

const generateParcels = async (
  orders: Order[],
  maxParcelPerPalette = 15,
): Promise<Parcel[]> =>
  orders.reduce(async (acc, order, position) => {
    const itemGroup = splitOrderOverParcels(order);
    const parcels = new Array<Parcel>();
    for (const items of itemGroup) {
      const paletteId = Math.floor(position / maxParcelPerPalette) + 1;
      const trackingCode = await getTrackingCode();
      parcels.push(new Parcel(order, paletteId, trackingCode, items));
    }
    return [...(await acc), ...parcels];
  }, Promise.resolve(new Array<Parcel>()));

const computeTotalAmount = (parcels: Parcel[]): number =>
  parcels.reduce((acc, parcel) => acc + parcel.cost, 0);

const main = async () => {
  const items = getItems();
  const orders = getOrders(items);
  const parcels = await generateParcels(orders);
  const totalAmount = computeTotalAmount(parcels);

  // console.log(
  //   totalAmount,
  //   orders.length,
  //   parcels.length,
  //   parcels.map((parcel) => parcel.weight),
  // );
};

main();
